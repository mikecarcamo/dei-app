// Endpoint público: el paciente responde su tamizaje desde un link de un solo uso.
// No requiere autenticación; el paciente nunca ve los resultados.
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { scoreInstrument, evaluateRisk, publicInstruments } = require('../utils/screening');
const { timestampGT, todayGT } = require('../utils/dates');
const { runScreeningAnalysis, audit, getActiveLicense } = require('./therapy');

function getLink(token) {
  return db.prepare(`
    SELECT l.*, p.full_name AS patient_name, p.code AS patient_code, p.consent AS patient_consent
    FROM screening_links l JOIN patients p ON p.id = l.patient_id
    WHERE l.token = ?
  `).get(String(token || ''));
}

router.get('/:token', (req, res) => {
  const link = getLink(req.params.token);
  if (!link) return res.status(404).json({ message: 'Link no válido o inexistente' });
  if (link.status !== 'pendiente') return res.status(410).json({ message: 'Este tamizaje ya fue completado', completed: true });
  const codes = JSON.parse(link.instruments);
  res.json({
    patient_name: link.patient_name,
    patient_code: link.patient_code,
    instruments: publicInstruments().filter(i => codes.includes(i.code)),
  });
});

router.post('/:token', async (req, res) => {
  const link = getLink(req.params.token);
  if (!link) return res.status(404).json({ message: 'Link no válido o inexistente' });
  if (link.status !== 'pendiente') return res.status(410).json({ message: 'Este tamizaje ya fue completado', completed: true });

  const codes = JSON.parse(link.instruments);
  const answers = req.body.answers || {};
  let results;
  try {
    results = codes.map(code => scoreInstrument(code, answers[code]));
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
  const params = req.body.params || {};
  const risk = evaluateRisk(results, params);
  const license = getActiveLicense(link.therapist_id);

  const screeningId = db.transaction(() => {
    const ins = db.prepare(`
      INSERT INTO screenings (patient_id, therapist_id, license_id, screened_at, params, results, risk_alert, risk_level, risk_reasons, notes, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'link')
    `).run(
      link.patient_id, link.therapist_id, license?.id || null, timestampGT(),
      JSON.stringify(params), JSON.stringify(results),
      risk.alert ? 1 : 0, risk.level, JSON.stringify(risk.reasons)
    );
    db.prepare(`UPDATE screening_links SET status = 'completado', used_at = ?, screening_id = ? WHERE id = ?`)
      .run(timestampGT(), ins.lastInsertRowid, link.id);
    return ins.lastInsertRowid;
  })();
  audit(link.therapist_id, 'SCREENING_VIA_LINK', 'screening', screeningId, { patient_id: link.patient_id });

  await runScreeningAnalysis(screeningId);
  // Al paciente solo se le confirma el envío; nunca los resultados.
  res.status(201).json({ ok: true });
});

module.exports = router;
