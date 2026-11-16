const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { verifyToken, requireAdmin, requireRole } = require('../middleware/auth');
const { todayGT, timestampGT } = require('../utils/dates');
const { scoreInstrument, evaluateRisk, filterHypotheses, publicInstruments, DEFAULT_CRISIS_RESOURCES } = require('../utils/screening');
const { generateScreeningAnalysis } = require('../utils/ai');
const { drawWatermark } = require('../utils/pdf');
const { generateScreeningPDF, generatePatientFichaPDF } = require('../utils/pdf_screening');

const requireTherapist = requireRole('TERAPEUTA');

function validate(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return true;
  res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  return false;
}

function audit(userId, action, entityType, entityId, details) {
  try {
    db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, action, entityType, entityId || null, details ? JSON.stringify(details) : null);
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

function newKey(prefix) {
  return `${prefix}-` + uuidv4().toUpperCase().replace(/-/g, '').substring(0, 12);
}

function getActiveLicense(userId) {
  const today = todayGT();
  return db.prepare(`
    SELECT * FROM therapist_licenses
    WHERE user_id = ? AND status = 'activa' AND valid_from <= ? AND valid_to >= ?
    ORDER BY valid_to DESC LIMIT 1
  `).get(userId, today, today);
}

function requireLicense(req, res, next) {
  const license = getActiveLicense(req.user.id);
  if (!license) return res.status(403).json({ message: 'Su licencia de terapeuta no está vigente. Contacte al administrador.' });
  req.license = license;
  next();
}

function getCrisisResources() {
  return db.prepare(`SELECT value FROM app_settings WHERE key = 'crisis_resources'`).get()?.value || DEFAULT_CRISIS_RESOURCES;
}

function ageFrom(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b)) return null;
  const t = new Date(todayGT());
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--;
  return age;
}

function parseScreening(s) {
  if (!s) return s;
  return {
    ...s,
    params: s.params ? JSON.parse(s.params) : {},
    results: JSON.parse(s.results || '[]'),
    risk_reasons: s.risk_reasons ? JSON.parse(s.risk_reasons) : [],
    ai_result: s.ai_result ? JSON.parse(s.ai_result) : null,
    ai_discarded: s.ai_discarded ? JSON.parse(s.ai_discarded) : [],
  };
}

function ownPatient(req, res) {
  const patient = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(req.params.id || req.body.patient_id);
  if (!patient) { res.status(404).json({ message: 'Paciente no encontrado' }); return null; }
  if (patient.therapist_id !== req.user.id) { res.status(403).json({ message: 'Sin acceso a este paciente' }); return null; }
  return patient;
}

// ------------------------------------------------------------------
// ADMIN: Entidades > Terapeutas
// ------------------------------------------------------------------

const THERAPIST_LIST_SQL = `
  SELECT u.id, u.full_name, u.email, u.active, u.entity_id, u.created_at, e.name AS entity_name,
    (SELECT COUNT(*) FROM patients p WHERE p.therapist_id = u.id) AS patients_count,
    (SELECT COUNT(*) FROM screenings s WHERE s.therapist_id = u.id) AS screenings_count
  FROM users u LEFT JOIN entities e ON u.entity_id = e.id
  WHERE u.role = 'TERAPEUTA'
`;

function withLicenses(user) {
  const licenses = db.prepare(`SELECT * FROM therapist_licenses WHERE user_id = ? ORDER BY valid_to DESC, id DESC`).all(user.id);
  const active = getActiveLicense(user.id);
  return { ...user, licenses, active_license: active || null };
}

router.get('/admin/therapists', verifyToken, requireAdmin, (req, res) => {
  const rows = db.prepare(`${THERAPIST_LIST_SQL} ORDER BY u.full_name`).all();
  res.json(rows.map(withLicenses));
});

router.post('/admin/therapists', verifyToken, requireAdmin, [
  body('full_name').trim().notEmpty().withMessage('Nombre completo requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('valid_from').isISO8601().withMessage('Fecha de inicio de licencia requerida'),
  body('valid_to').isISO8601().withMessage('Fecha de fin de licencia requerida'),
], (req, res) => {
  if (!validate(req, res)) return;
  const { full_name, email, password, entity_id, valid_from, valid_to } = req.body;
  if (valid_to < valid_from) return res.status(400).json({ message: 'La fecha de fin debe ser posterior al inicio' });

  try {
    const userId = db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO users (entity_id, full_name, email, password_hash, role, active, must_change_password)
        VALUES (?, ?, ?, ?, 'TERAPEUTA', 1, 1)
      `).run(entity_id || null, full_name.trim(), email.toLowerCase().trim(), bcrypt.hashSync(password, 12));
      db.prepare(`
        INSERT INTO therapist_licenses (user_id, key_value, valid_from, valid_to, created_by) VALUES (?, ?, ?, ?, ?)
      `).run(r.lastInsertRowid, newKey('TER'), valid_from, valid_to, req.user.id);
      return r.lastInsertRowid;
    })();
    audit(req.user.id, 'CREATE_THERAPIST', 'user', userId, { email });
    res.status(201).json(withLicenses(db.prepare(`${THERAPIST_LIST_SQL} AND u.id = ?`).get(userId)));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ message: 'Ya existe un usuario con ese email' });
    throw e;
  }
});

router.put('/admin/therapists/:id', verifyToken, requireAdmin, (req, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'TERAPEUTA'`).get(req.params.id);
  if (!user) return res.status(404).json({ message: 'Terapeuta no encontrado' });
  const { full_name, email, entity_id, active, password } = req.body;
  if (password && password.length < 8) return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
  try {
    db.prepare(`
      UPDATE users SET full_name = ?, email = ?, entity_id = ?, active = ?, password_hash = ?, must_change_password = ?
      WHERE id = ?
    `).run(
      full_name?.trim() || user.full_name,
      (email || user.email).toLowerCase().trim(),
      entity_id !== undefined ? (entity_id || null) : user.entity_id,
      active !== undefined ? (active ? 1 : 0) : user.active,
      password ? bcrypt.hashSync(password, 12) : user.password_hash,
      password ? 1 : user.must_change_password,
      user.id
    );
    audit(req.user.id, 'UPDATE_THERAPIST', 'user', user.id, null);
    res.json(withLicenses(db.prepare(`${THERAPIST_LIST_SQL} AND u.id = ?`).get(user.id)));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ message: 'Ya existe un usuario con ese email' });
    throw e;
  }
});

router.post('/admin/therapists/:id/licenses', verifyToken, requireAdmin, [
  body('valid_from').isISO8601().withMessage('Fecha de inicio requerida'),
  body('valid_to').isISO8601().withMessage('Fecha de fin requerida'),
], (req, res) => {
  if (!validate(req, res)) return;
  const user = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'TERAPEUTA'`).get(req.params.id);
  if (!user) return res.status(404).json({ message: 'Terapeuta no encontrado' });
  const { valid_from, valid_to, notes } = req.body;
  if (valid_to < valid_from) return res.status(400).json({ message: 'La fecha de fin debe ser posterior al inicio' });
  const r = db.prepare(`
    INSERT INTO therapist_licenses (user_id, key_value, valid_from, valid_to, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.id, newKey('TER'), valid_from, valid_to, notes || null, req.user.id);
  audit(req.user.id, 'CREATE_THERAPIST_LICENSE', 'therapist_license', r.lastInsertRowid, { user_id: user.id });
  res.status(201).json(withLicenses(db.prepare(`${THERAPIST_LIST_SQL} AND u.id = ?`).get(user.id)));
});

router.put('/admin/licenses/:id/status', verifyToken, requireAdmin, [
  body('status').isIn(['activa', 'anulada']).withMessage('Estado inválido'),
], (req, res) => {
  if (!validate(req, res)) return;
  const lic = db.prepare(`SELECT * FROM therapist_licenses WHERE id = ?`).get(req.params.id);
  if (!lic) return res.status(404).json({ message: 'Licencia no encontrada' });
  db.prepare(`UPDATE therapist_licenses SET status = ? WHERE id = ?`).run(req.body.status, lic.id);
  audit(req.user.id, 'UPDATE_THERAPIST_LICENSE', 'therapist_license', lic.id, { status: req.body.status });
  res.json(withLicenses(db.prepare(`${THERAPIST_LIST_SQL} AND u.id = ?`).get(lic.user_id)));
});

router.get('/admin/settings/crisis', verifyToken, requireAdmin, (req, res) => {
  res.json({ value: getCrisisResources() });
});

router.put('/admin/settings/crisis', verifyToken, requireAdmin, [
  body('value').isString().trim().notEmpty().withMessage('Texto requerido'),
], (req, res) => {
  if (!validate(req, res)) return;
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES ('crisis_resources', ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(req.body.value.trim());
  audit(req.user.id, 'UPDATE_CRISIS_RESOURCES', 'app_settings', null, null);
  res.json({ value: getCrisisResources() });
});

// ------------------------------------------------------------------
// TERAPEUTA
// ------------------------------------------------------------------

router.get('/me/license', verifyToken, requireTherapist, (req, res) => {
  const active = getActiveLicense(req.user.id);
  const latest = db.prepare(`SELECT * FROM therapist_licenses WHERE user_id = ? ORDER BY valid_to DESC LIMIT 1`).get(req.user.id);
  const me = db.prepare(`SELECT signature_image FROM users WHERE id = ?`).get(req.user.id);
  res.json({ active: !!active, license: active || latest || null, today: todayGT(), signature_image: me?.signature_image || null });
});

// Firma y sello del terapeuta (data URL PNG/JPG, se usa en los PDF).
const SIGNATURE_RE = /^data:image\/(png|jpe?g);base64,/;
router.post('/me/signature', verifyToken, requireTherapist, (req, res) => {
  const image = String(req.body.image || '');
  if (!SIGNATURE_RE.test(image)) return res.status(400).json({ message: 'La imagen debe ser PNG o JPG' });
  if (image.length > 1_400_000) return res.status(400).json({ message: 'La imagen es demasiado grande (máx. ~1 MB)' });
  db.prepare(`UPDATE users SET signature_image = ? WHERE id = ?`).run(image, req.user.id);
  audit(req.user.id, 'UPDATE_SIGNATURE', 'user', req.user.id, null);
  res.json({ ok: true });
});

router.delete('/me/signature', verifyToken, requireTherapist, (req, res) => {
  db.prepare(`UPDATE users SET signature_image = NULL WHERE id = ?`).run(req.user.id);
  audit(req.user.id, 'DELETE_SIGNATURE', 'user', req.user.id, null);
  res.json({ ok: true });
});

router.get('/instruments', verifyToken, requireTherapist, (req, res) => {
  res.json({ instruments: publicInstruments(), crisis_resources: getCrisisResources() });
});

router.get('/patients', verifyToken, requireTherapist, (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM screenings s WHERE s.patient_id = p.id) AS screenings_count,
      (SELECT COUNT(*) FROM screenings s WHERE s.patient_id = p.id AND s.source = 'link' AND s.viewed_at IS NULL) AS pending_new,
      (SELECT MAX(s.screened_at) FROM screenings s WHERE s.patient_id = p.id) AS last_screening_at
    FROM patients p
    WHERE p.therapist_id = ? AND (p.code LIKE ? OR p.full_name LIKE ?)
    ORDER BY p.full_name COLLATE NOCASE
  `).all(req.user.id, q, q);
  res.json(rows);
});

const patientValidators = [
  body('full_name').trim().notEmpty().withMessage('Nombre del paciente requerido'),
  body('birth_date').optional({ values: 'falsy' }).isISO8601().withMessage('Fecha de nacimiento inválida'),
  body('sex').optional({ values: 'falsy' }).isIn(['F', 'M', 'O']).withMessage('Sexo inválido'),
];

function patientFields(b) {
  return [
    b.full_name.trim(), b.birth_date || null, b.sex || null, b.phone || null, b.email || null,
    b.consultation_reason || null, b.background || null, b.medication || null,
    b.consent ? 1 : 0, b.consent ? (b.consent_date || todayGT()) : null,
  ];
}

router.post('/patients', verifyToken, requireTherapist, requireLicense, patientValidators, (req, res) => {
  if (!validate(req, res)) return;
  if (!req.body.consent) return res.status(400).json({ message: 'Se requiere el consentimiento informado del paciente' });
  let code;
  do { code = newKey('PAC').substring(0, 10); } while (db.prepare(`SELECT 1 FROM patients WHERE code = ?`).get(code));
  const r = db.prepare(`
    INSERT INTO patients (therapist_id, code, full_name, birth_date, sex, phone, email,
      consultation_reason, background, medication, consent, consent_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, code, ...patientFields(req.body));
  audit(req.user.id, 'CREATE_PATIENT', 'patient', r.lastInsertRowid, { code });
  res.status(201).json(db.prepare(`SELECT * FROM patients WHERE id = ?`).get(r.lastInsertRowid));
});

router.put('/patients/:id', verifyToken, requireTherapist, requireLicense, patientValidators, (req, res) => {
  if (!validate(req, res)) return;
  const patient = ownPatient(req, res);
  if (!patient) return;
  db.prepare(`
    UPDATE patients SET full_name = ?, birth_date = ?, sex = ?, phone = ?, email = ?,
      consultation_reason = ?, background = ?, medication = ?, consent = ?, consent_date = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(...patientFields({ ...req.body, consent_date: req.body.consent_date || patient.consent_date }), patient.id);
  audit(req.user.id, 'UPDATE_PATIENT', 'patient', patient.id, null);
  res.json(db.prepare(`SELECT * FROM patients WHERE id = ?`).get(patient.id));
});

// Link para que el paciente responda el tamizaje (un solo uso).
router.post('/patients/:id/links', verifyToken, requireTherapist, requireLicense, [
  body('instruments').isArray({ min: 1 }).withMessage('Seleccione al menos un instrumento'),
], (req, res) => {
  if (!validate(req, res)) return;
  const patient = ownPatient(req, res);
  if (!patient) return;
  const known = new Set(publicInstruments().map(i => i.code));
  const codes = [...new Set(req.body.instruments)].filter(c => known.has(c));
  if (!codes.length) return res.status(400).json({ message: 'Instrumentos inválidos' });
  const token = uuidv4().replace(/-/g, '');
  db.prepare(`INSERT INTO screening_links (token, patient_id, therapist_id, instruments) VALUES (?, ?, ?, ?)`)
    .run(token, patient.id, req.user.id, JSON.stringify(codes));
  audit(req.user.id, 'CREATE_SCREENING_LINK', 'patient', patient.id, { instruments: codes });
  res.status(201).json({ token });
});

// Ficha del paciente en PDF: datos + historial resumido de tamizajes.
router.get('/patients/:id/ficha.pdf', verifyToken, requireTherapist, (req, res) => {
  const patient = ownPatient(req, res);
  if (!patient) return;
  const screenings = db.prepare(`SELECT * FROM screenings WHERE patient_id = ? ORDER BY screened_at, id`).all(patient.id).map(parseScreening);
  const appointments = db.prepare(`
    SELECT a.*, (SELECT COUNT(*) FROM appointment_documents d WHERE d.appointment_id = a.id) AS documents_count
    FROM appointments a WHERE a.patient_id = ? ORDER BY a.starts_at, a.id
  `).all(patient.id);
  const therapist = db.prepare(`SELECT full_name, signature_image FROM users WHERE id = ?`).get(req.user.id);
  audit(req.user.id, 'EXPORT_FICHA', 'patient', patient.id, null);

  const doc = new PDFDocument({ margin: 40, size: 'LETTER', bufferPages: true });
  drawWatermark(doc);
  doc.on('pageAdded', () => drawWatermark(doc));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.view === 'true' ? 'inline' : 'attachment'}; filename="ficha_${patient.code}.pdf"`);
  doc.pipe(res);
  generatePatientFichaPDF(doc, { patient, therapist, screenings, appointments });
  doc.end();
});

router.get('/patients/:id', verifyToken, requireTherapist, (req, res) => {
  const patient = ownPatient(req, res);
  if (!patient) return;
  const screenings = db.prepare(`
    SELECT s.*, u.full_name AS therapist_name FROM screenings s JOIN users u ON s.therapist_id = u.id
    WHERE s.patient_id = ? ORDER BY s.screened_at DESC, s.id DESC
  `).all(patient.id).map(parseScreening);
  const appointments = db.prepare(`
    SELECT a.*, (SELECT COUNT(*) FROM appointment_documents d WHERE d.appointment_id = a.id) AS documents_count
    FROM appointments a WHERE a.patient_id = ? ORDER BY a.starts_at DESC, a.id DESC
  `).all(patient.id);
  audit(req.user.id, 'VIEW_PATIENT', 'patient', patient.id, null);
  res.json({ ...patient, age: ageFrom(patient.birth_date), screenings, appointments });
});

async function runAnalysis(screeningId) {
  const s = db.prepare(`SELECT * FROM screenings WHERE id = ?`).get(screeningId);
  const patient = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(s.patient_id);
  const parsed = parseScreening(s);
  const whitelist = db.prepare(`SELECT code, name FROM dsm_whitelist WHERE active = 1 ORDER BY code`).all();

  // Contexto anonimizado: sin nombre, teléfono ni correo.
  const context = {
    codigo_paciente: patient.code,
    edad: ageFrom(patient.birth_date),
    sexo: { F: 'Femenino', M: 'Masculino', O: 'Otro' }[patient.sex] || 'No indicado',
    motivo_consulta: patient.consultation_reason || null,
    antecedentes_relevantes: patient.background || null,
    medicacion_actual: patient.medication || null,
    parametros_basicos: parsed.params,
    instrumentos: parsed.results.map(r => ({
      instrumento: r.name, puntaje: r.code === 'CSSRS' ? undefined : `${r.score}/${r.max}`, severidad: r.severity, respuestas_por_item: r.answers,
    })),
    alerta_de_riesgo: parsed.risk_alert ? { nivel: parsed.risk_level, motivos: parsed.risk_reasons } : null,
  };

  const ai = await generateScreeningAnalysis(context, whitelist);
  if (!ai) return null;
  const { accepted, discarded } = filterHypotheses(ai.hipotesis, whitelist);
  if (discarded.length) console.warn(`Tamizaje #${screeningId}: códigos descartados por no estar en la lista permitida`, discarded);
  const { model, prompt_version, ...result } = ai;
  db.prepare(`
    UPDATE screenings SET ai_result = ?, ai_discarded = ?, ai_model = ?, prompt_version = ?, ai_generated_at = ? WHERE id = ?
  `).run(JSON.stringify({ ...result, hipotesis: accepted }), JSON.stringify(discarded), model, prompt_version, timestampGT(), screeningId);
  return true;
}

function screeningDetail(id) {
  const s = db.prepare(`
    SELECT s.*, u.full_name AS therapist_name, p.code AS patient_code, p.full_name AS patient_name
    FROM screenings s JOIN users u ON s.therapist_id = u.id JOIN patients p ON s.patient_id = p.id
    WHERE s.id = ?
  `).get(id);
  return parseScreening(s);
}

router.post('/screenings', verifyToken, requireTherapist, requireLicense, [
  body('patient_id').isInt().withMessage('Paciente requerido'),
  body('instruments').isObject().withMessage('Instrumentos requeridos'),
], async (req, res) => {
  if (!validate(req, res)) return;
  const patient = ownPatient(req, res);
  if (!patient) return;

  const entries = Object.entries(req.body.instruments || {});
  if (entries.length === 0) return res.status(400).json({ message: 'Seleccione al menos un instrumento' });

  let results;
  try {
    results = entries.map(([code, answers]) => scoreInstrument(code, answers));
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
  const params = req.body.params || {};
  const risk = evaluateRisk(results, params);

  const r = db.prepare(`
    INSERT INTO screenings (patient_id, therapist_id, license_id, screened_at, params, results, risk_alert, risk_level, risk_reasons, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patient.id, req.user.id, req.license.id, timestampGT(), JSON.stringify(params), JSON.stringify(results),
    risk.alert ? 1 : 0, risk.level, JSON.stringify(risk.reasons), req.body.notes || null
  );
  audit(req.user.id, 'CREATE_SCREENING', 'screening', r.lastInsertRowid, { patient_id: patient.id });

  await runAnalysis(r.lastInsertRowid);
  res.status(201).json({ ...screeningDetail(r.lastInsertRowid), crisis_resources: risk.alert ? getCrisisResources() : null });
});

function ownScreening(req, res) {
  const s = db.prepare(`SELECT * FROM screenings WHERE id = ?`).get(req.params.id);
  if (!s) { res.status(404).json({ message: 'Tamizaje no encontrado' }); return null; }
  if (s.therapist_id !== req.user.id) { res.status(403).json({ message: 'Sin acceso a este tamizaje' }); return null; }
  return s;
}

router.get('/screenings/:id', verifyToken, requireTherapist, (req, res) => {
  const s = ownScreening(req, res);
  if (!s) return;
  if (s.source === 'link' && !s.viewed_at) {
    db.prepare(`UPDATE screenings SET viewed_at = ? WHERE id = ?`).run(timestampGT(), s.id);
    s.viewed_at = timestampGT();
  }
  audit(req.user.id, 'VIEW_SCREENING', 'screening', s.id, null);
  res.json({ ...screeningDetail(s.id), crisis_resources: s.risk_alert ? getCrisisResources() : null });
});

router.post('/screenings/:id/analysis', verifyToken, requireTherapist, requireLicense, async (req, res) => {
  const s = ownScreening(req, res);
  if (!s) return;
  const ok = await runAnalysis(s.id);
  if (!ok) return res.status(502).json({ message: 'No se pudo generar el análisis de IA. Intente de nuevo.' });
  res.json({ ...screeningDetail(s.id), crisis_resources: s.risk_alert ? getCrisisResources() : null });
});

router.get('/screenings/:id/pdf', verifyToken, requireTherapist, (req, res) => {
  const s = ownScreening(req, res);
  if (!s) return;
  const patient = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(s.patient_id);
  const therapist = db.prepare(`SELECT full_name, signature_image FROM users WHERE id = ?`).get(s.therapist_id);
  audit(req.user.id, 'EXPORT_SCREENING_PDF', 'screening', s.id, null);

  const doc = new PDFDocument({ margin: 40, size: 'LETTER', bufferPages: true });
  drawWatermark(doc);
  doc.on('pageAdded', () => drawWatermark(doc));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.view === 'true' ? 'inline' : 'attachment'}; filename="tamizaje_${patient.code}_${s.id}.pdf"`);
  doc.pipe(res);
  generateScreeningPDF(doc, { screening: s, patient, therapist, crisisResources: getCrisisResources() });
  doc.end();
});

// ------------------------------------------------------------------
// CITAS
// ------------------------------------------------------------------

const CLOSE_STATUSES = ['celebrada', 'cancelada_paciente', 'cancelada_terapeuta', 'anulada'];
const CLOSE_LABELS = { celebrada: 'Celebrada', cancelada_paciente: 'Cancelada por paciente', cancelada_terapeuta: 'Cancelada por terapeuta', anulada: 'Anulada' };
const APPT_CATEGORIES = ['PRESENCIAL_MENTAL_Z9', 'PRESENCIAL_DEI_Z1', 'VIRTUAL', 'LLAMADA'];

function normalizeDT(v) {
  if (!v || typeof v !== 'string') return null;
  const m = v.trim().replace('T', ' ').match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : null;
}

function plusHour(startsAt) {
  const d = new Date(startsAt.replace(' ', 'T'));
  if (isNaN(d)) return null;
  d.setMinutes(d.getMinutes() + 60);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function overlapConflicts(therapistId, startsAt, endsAt, excludeId = null) {
  const appt = db.prepare(`
    SELECT a.id, a.starts_at, a.ends_at, p.full_name AS patient_name
    FROM appointments a JOIN patients p ON p.id = a.patient_id
    WHERE a.therapist_id = ? AND a.status IN ('agendada','celebrada')
      AND a.id != COALESCE(?, -1) AND NOT (a.ends_at <= ? OR a.starts_at >= ?)
    LIMIT 1
  `).get(therapistId, excludeId, startsAt, endsAt);
  if (appt) return { type: 'cita', ...appt };
  const block = db.prepare(`
    SELECT id, starts_at, ends_at, reason FROM therapist_blocks
    WHERE therapist_id = ? AND NOT (ends_at <= ? OR starts_at >= ?)
    LIMIT 1
  `).get(therapistId, startsAt, endsAt);
  if (block) return { type: 'bloqueo', ...block };
  return null;
}

router.get('/appointments', verifyToken, requireTherapist, (req, res) => {
  const from = (req.query.from || '').slice(0, 10);
  const to = (req.query.to || '').slice(0, 10);
  const range = from && to ? `AND a.starts_at < ? || ' 23:59' AND a.ends_at > ?` : '';
  const params = from && to ? [to, from] : [];
  const appointments = db.prepare(`
    SELECT a.*, p.full_name AS patient_name, p.code AS patient_code
    FROM appointments a JOIN patients p ON p.id = a.patient_id
    WHERE a.therapist_id = ? ${range}
    ORDER BY a.starts_at
  `).all(req.user.id, ...params);
  const blocks = db.prepare(`
    SELECT * FROM therapist_blocks
    WHERE therapist_id = ? ${from && to ? `AND starts_at < ? || ' 23:59' AND ends_at > ?` : ''}
    ORDER BY starts_at
  `).all(req.user.id, ...params);
  res.json({ appointments, blocks });
});

router.post('/appointments', verifyToken, requireTherapist, requireLicense, (req, res) => {
  const patient = ownPatient(req, res);
  if (!patient) return;
  const startsAt = normalizeDT(req.body.starts_at);
  if (!startsAt) return res.status(400).json({ message: 'Indique fecha y hora de la cita' });
  const endsAt = plusHour(startsAt);
  const conflict = overlapConflicts(req.user.id, startsAt, endsAt);
  if (conflict) return res.status(409).json({
    message: conflict.type === 'cita'
      ? `Se traslapa con la cita #${conflict.id} de ${conflict.patient_name} (${conflict.starts_at} - ${conflict.ends_at})`
      : `Se traslapa con un horario bloqueado (${conflict.starts_at} - ${conflict.ends_at}${conflict.reason ? `: ${conflict.reason}` : ''})`,
  });
  const category = req.body.category || 'PRESENCIAL_MENTAL_Z9';
  if (!APPT_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Categoría de cita inválida' });
  const r = db.prepare(`
    INSERT INTO appointments (therapist_id, patient_id, starts_at, ends_at, status, observaciones, category)
    VALUES (?, ?, ?, ?, 'agendada', ?, ?)
  `).run(req.user.id, patient.id, startsAt, endsAt, req.body.observaciones || null, category);
  audit(req.user.id, 'CREATE_APPOINTMENT', 'appointment', r.lastInsertRowid, { patient_id: patient.id, starts_at: startsAt });
  res.status(201).json(db.prepare(`SELECT a.*, p.full_name AS patient_name, p.code AS patient_code FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?`).get(r.lastInsertRowid));
});

function ownAppointment(req, res) {
  const a = db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(req.params.id);
  if (!a) { res.status(404).json({ message: 'Cita no encontrada' }); return null; }
  if (a.therapist_id !== req.user.id) { res.status(403).json({ message: 'Sin acceso a esta cita' }); return null; }
  return a;
}

router.put('/appointments/:id/reschedule', verifyToken, requireTherapist, requireLicense, (req, res) => {
  const a = ownAppointment(req, res);
  if (!a) return;
  if (a.status !== 'agendada') return res.status(400).json({ message: 'Solo se puede reprogramar una cita agendada' });
  const startsAt = normalizeDT(req.body.starts_at);
  if (!startsAt) return res.status(400).json({ message: 'Indique fecha y hora de la cita' });
  const endsAt = plusHour(startsAt);
  const conflict = overlapConflicts(req.user.id, startsAt, endsAt, a.id);
  if (conflict) return res.status(409).json({
    message: conflict.type === 'cita'
      ? `Se traslapa con la cita #${conflict.id} de ${conflict.patient_name} (${conflict.starts_at} - ${conflict.ends_at})`
      : `Se traslapa con un horario bloqueado (${conflict.starts_at} - ${conflict.ends_at}${conflict.reason ? `: ${conflict.reason}` : ''})`,
  });
  db.prepare(`UPDATE appointments SET starts_at = ?, ends_at = ?, updated_at = ? WHERE id = ?`)
    .run(startsAt, endsAt, timestampGT(), a.id);
  audit(req.user.id, 'RESCHEDULE_APPOINTMENT', 'appointment', a.id, { starts_at: startsAt });
  res.json(db.prepare(`SELECT a.*, p.full_name AS patient_name, p.code AS patient_code FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?`).get(a.id));
});

router.put('/appointments/:id/close', verifyToken, requireTherapist, requireLicense, (req, res) => {
  const a = ownAppointment(req, res);
  if (!a) return;
  if (a.status !== 'agendada') return res.status(400).json({ message: `La cita ya está cerrada (${CLOSE_LABELS[a.status] || a.status})` });
  const outcome = req.body.outcome;
  if (!CLOSE_STATUSES.includes(outcome)) return res.status(400).json({ message: 'Estado de cierre inválido' });
  const { situacion_actual, desarrollo, plan_trabajo, observaciones } = req.body;
  if (outcome === 'celebrada') {
    const missing = [['Situación actual', situacion_actual], ['Desarrollo', desarrollo], ['Plan de trabajo', plan_trabajo], ['Observaciones', observaciones]]
      .filter(([, v]) => !v || !String(v).trim()).map(([k]) => k);
    if (missing.length) return res.status(400).json({ message: `Para concluir como "Celebrada" complete: ${missing.join(', ')}` });
  } else if (!observaciones || !String(observaciones).trim()) {
    return res.status(400).json({ message: `Para "${CLOSE_LABELS[outcome]}" indique las Observaciones` });
  }
  const docs = Array.isArray(req.body.documents) ? req.body.documents : [];
  if (docs.length > 5) return res.status(400).json({ message: 'Máximo 5 documentos por cita' });
  for (const d of docs) {
    if (!d?.filename || typeof d.data !== 'string' || !d.data.startsWith('data:')) {
      return res.status(400).json({ message: 'Documento adjunto inválido' });
    }
    if (d.data.length > 6_800_000) return res.status(400).json({ message: `El archivo "${d.filename}" supera el máximo de 5 MB` });
  }
  db.transaction(() => {
    db.prepare(`
      UPDATE appointments SET status = ?, situacion_actual = ?, desarrollo = ?, plan_trabajo = ?, observaciones = ?, closed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(outcome, situacion_actual || null, desarrollo || null, plan_trabajo || null, observaciones, timestampGT(), timestampGT(), a.id);
    const ins = db.prepare(`INSERT INTO appointment_documents (appointment_id, filename, mime, data_url) VALUES (?, ?, ?, ?)`);
    for (const d of docs) ins.run(a.id, String(d.filename).slice(0, 200), d.mime || null, d.data);
  })();
  audit(req.user.id, 'CLOSE_APPOINTMENT', 'appointment', a.id, { outcome, documents: docs.length });
  res.json(db.prepare(`SELECT a.*, p.full_name AS patient_name, p.code AS patient_code FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?`).get(a.id));
});

router.get('/appointments/:id/documents', verifyToken, requireTherapist, (req, res) => {
  const a = ownAppointment(req, res);
  if (!a) return;
  res.json(db.prepare(`SELECT id, filename, mime, data_url, created_at FROM appointment_documents WHERE appointment_id = ? ORDER BY id`).all(a.id));
});

router.delete('/appointments/:id/documents/:docId', verifyToken, requireTherapist, (req, res) => {
  const a = ownAppointment(req, res);
  if (!a) return;
  db.prepare(`DELETE FROM appointment_documents WHERE id = ? AND appointment_id = ?`).run(req.params.docId, a.id);
  res.json({ ok: true });
});

router.post('/blocks', verifyToken, requireTherapist, requireLicense, (req, res) => {
  const type = req.body.type || 'single';
  const reason = req.body.reason || null;
  const segments = [];

  if (type === 'daily' || type === 'vacation') {
    const dateFrom = (req.body.date_from || '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
    const dateTo = (req.body.date_to || '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
    if (!dateFrom || !dateTo) return res.status(400).json({ message: 'Indique el rango de fechas del bloqueo' });
    if (dateTo < dateFrom) return res.status(400).json({ message: 'La fecha final debe ser igual o posterior a la inicial' });

    if (type === 'vacation') {
      segments.push({ starts_at: `${dateFrom} 00:00`, ends_at: `${dateTo} 23:59` });
    } else {
      const timeFrom = (req.body.time_from || '').match(/^\d{2}:\d{2}$/)?.[0];
      const timeTo = (req.body.time_to || '').match(/^\d{2}:\d{2}$/)?.[0];
      if (!timeFrom || !timeTo) return res.status(400).json({ message: 'Indique el rango de horas del bloqueo' });
      if (timeTo <= timeFrom) return res.status(400).json({ message: 'La hora final debe ser posterior a la inicial' });
      const days = [];
      let d = new Date(`${dateFrom}T00:00:00`);
      const end = new Date(`${dateTo}T00:00:00`);
      while (d <= end && days.length < 93) { days.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
      if (!days.length || d <= end) return res.status(400).json({ message: 'El rango de fechas es demasiado amplio (máx. 92 días)' });
      for (const day of days) segments.push({ starts_at: `${day} ${timeFrom}`, ends_at: `${day} ${timeTo}` });
    }
  } else {
    const startsAt = normalizeDT(req.body.starts_at);
    const endsAt = normalizeDT(req.body.ends_at);
    if (!startsAt || !endsAt) return res.status(400).json({ message: 'Indique el rango de fechas y horas del bloqueo' });
    if (endsAt <= startsAt) return res.status(400).json({ message: 'La fecha/hora final debe ser posterior al inicio' });
    segments.push({ starts_at: startsAt, ends_at: endsAt });
  }

  // Las citas agendadas/celebradas que se traslapan se devuelven como aviso (el bloqueo se crea igual).
  const findAppts = db.prepare(`
    SELECT a.id, a.starts_at, a.ends_at, p.full_name AS patient_name
    FROM appointments a JOIN patients p ON p.id = a.patient_id
    WHERE a.therapist_id = ? AND a.status IN ('agendada','celebrada')
      AND NOT (a.ends_at <= ? OR a.starts_at >= ?)
  `);
  const conflicts = [];
  const seen = new Set();
  for (const s of segments) {
    for (const c of findAppts.all(req.user.id, s.starts_at, s.ends_at)) {
      if (!seen.has(c.id)) { seen.add(c.id); conflicts.push(c); }
    }
  }

  const insert = db.prepare(`INSERT INTO therapist_blocks (therapist_id, starts_at, ends_at, reason) VALUES (?, ?, ?, ?)`);
  const created = db.transaction(() => segments.map(s => insert.run(req.user.id, s.starts_at, s.ends_at, reason).lastInsertRowid))();
  audit(req.user.id, 'CREATE_BLOCK', 'therapist_block', created[0], { count: created.length, type });
  res.status(201).json({ created: created.length, conflicts });
});

router.delete('/blocks/:id', verifyToken, requireTherapist, (req, res) => {
  const b = db.prepare(`SELECT * FROM therapist_blocks WHERE id = ?`).get(req.params.id);
  if (!b) return res.status(404).json({ message: 'Bloqueo no encontrado' });
  if (b.therapist_id !== req.user.id) return res.status(403).json({ message: 'Sin acceso a este bloqueo' });
  db.prepare(`DELETE FROM therapist_blocks WHERE id = ?`).run(b.id);
  audit(req.user.id, 'DELETE_BLOCK', 'therapist_block', b.id, null);
  res.json({ ok: true });
});

module.exports = router;
// Compartidos con el endpoint público /api/screening-link.
module.exports.runScreeningAnalysis = runAnalysis;
module.exports.audit = audit;
module.exports.getActiveLicense = getActiveLicense;
