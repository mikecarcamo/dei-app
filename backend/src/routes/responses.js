const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { calculateTemperament, calculateBurnout } = require('../utils/scoring');

router.get('/my-events', verifyToken, (req, res) => {
  const { role, entity_id, id: userId } = req.user;
  let events = [];
  if (role === 'EMPRESA') {
    events = db.prepare(`
      SELECT ev.id, ev.name, ev.start_date, ev.end_date, t.name as test_name, t.test_type,
             (SELECT COUNT(*) FROM responses r WHERE r.event_id = ev.id AND r.annulled = 0) as total_responses
      FROM events ev
      JOIN tests t ON ev.test_id = t.id
      WHERE ev.active = 1 AND (
        ev.entity_id = ?
        OR ev.id IN (SELECT event_id FROM event_users WHERE user_id = ?)
      )
      GROUP BY ev.id
      ORDER BY ev.start_date DESC
    `).all(entity_id, userId);
  } else {
    events = db.prepare(`
      SELECT ev.id, ev.name, ev.start_date, ev.end_date, t.name as test_name, t.test_type,
             COUNT(r.id) as total_responses
      FROM events ev
      JOIN tests t ON ev.test_id = t.id
      JOIN event_users eu ON eu.event_id = ev.id AND eu.user_id = ?
      LEFT JOIN responses r ON r.event_id = ev.id AND r.user_id = ? AND r.annulled = 0
      WHERE ev.active = 1
      GROUP BY ev.id
      ORDER BY ev.start_date DESC
    `).all(userId, userId);
  }
  res.json(events);
});

router.get('/my-events/:eventId/results', verifyToken, (req, res) => {
  const { role, entity_id, id: userId } = req.user;
  const { eventId } = req.params;

  const event = db.prepare(`SELECT ev.*, t.name as test_name, t.test_type FROM events ev JOIN tests t ON ev.test_id = t.id WHERE ev.id = ?`).get(eventId);
  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });

  if (role === 'EMPRESA') {
    const assignedToEvent = db.prepare(`SELECT id FROM event_users WHERE event_id = ? AND user_id = ?`).get(eventId, userId);
    if (event.entity_id !== entity_id && !assignedToEvent) return res.status(403).json({ message: 'Sin acceso' });
    const results = db.prepare(`
      SELECT r.id, r.participant_full_name, r.score_a, r.score_b, r.score_c, r.score_d,
             r.dominant_temperament, r.secondary_temperament, r.submitted_at,
             r.burnout_ce, r.burnout_dp, r.burnout_rp,
             r.burnout_ce_nivel, r.burnout_dp_nivel, r.burnout_rp_nivel, r.burnout_diagnostico
      FROM responses r
      WHERE r.event_id = ? AND r.annulled = 0
      ORDER BY r.submitted_at DESC
    `).all(eventId);
    return res.json({ event, results });
  } else {
    const results = db.prepare(`
      SELECT r.id, r.participant_full_name, r.score_a, r.score_b, r.score_c, r.score_d,
             r.dominant_temperament, r.secondary_temperament, r.submitted_at,
             r.burnout_ce, r.burnout_dp, r.burnout_rp,
             r.burnout_ce_nivel, r.burnout_dp_nivel, r.burnout_rp_nivel, r.burnout_diagnostico
      FROM responses r
      WHERE r.event_id = ? AND r.user_id = ? AND r.annulled = 0
      ORDER BY r.submitted_at DESC
    `).all(eventId, userId);
    return res.json({ event, results });
  }
});

router.get('/event/:eventId', verifyToken, requireAdmin, (req, res) => {
  const responses = db.prepare(`
    SELECT r.*, u.full_name as user_name, u.email as user_email
    FROM responses r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.event_id = ? AND r.annulled = 0
    ORDER BY r.submitted_at DESC
  `).all(req.params.eventId);
  res.json(responses);
});

router.get('/:id', verifyToken, (req, res) => {
  const response = db.prepare(`SELECT * FROM responses WHERE id = ?`).get(req.params.id);
  if (!response) return res.status(404).json({ message: 'Respuesta no encontrada' });
  if (req.user.role !== 'ADMIN' && response.user_id !== req.user.id) {
    return res.status(403).json({ message: 'Sin acceso' });
  }
  response.answers = db.prepare(`
    SELECT ra.*, q.number, q.text as question_text, q.section,
           o.text as option_text, o.temperament
    FROM response_answers ra
    JOIN questions q ON ra.question_id = q.id
    JOIN options o ON ra.selected_option_id = o.id
    WHERE ra.response_id = ?
    ORDER BY q.number
  `).all(req.params.id);
  res.json(response);
});

router.post('/', verifyToken, [
  body('event_id').notEmpty().withMessage('Evento requerido'),
  body('participant_full_name').notEmpty().trim().withMessage('Nombre completo requerido'),
  body('answers').isArray({ min: 1 }).withMessage('Respuestas requeridas'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { event_id, participant_full_name, answers } = req.body;
  const today = new Date().toISOString().split('T')[0];

  const event = db.prepare(`
    SELECT ev.*, lk.status as license_status, lk.valid_from, lk.valid_to
    FROM events ev
    LEFT JOIN license_keys lk ON ev.license_key_id = lk.id
    WHERE ev.id = ?
  `).get(event_id);

  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
  if (!event.active) return res.status(400).json({ message: 'El evento no está activo' });
  if (today < event.start_date || today > event.end_date) {
    return res.status(400).json({ message: 'El evento no está dentro del rango de fechas permitido' });
  }
  if (!event.license_key_id || event.license_status !== 'activa') {
    return res.status(400).json({ message: 'El evento no tiene licencia válida' });
  }

  if (req.user.role !== 'ADMIN') {
    if (req.user.entity_id !== event.entity_id) {
      return res.status(403).json({ message: 'No tiene acceso a este evento' });
    }
    const hasAccess = db.prepare(`SELECT id FROM event_users WHERE event_id = ? AND user_id = ?`).get(event_id, req.user.id);
    if (!hasAccess) return res.status(403).json({ message: 'No tiene acceso a este evento' });
  }

  const duplicate = db.prepare(`
    SELECT id FROM responses WHERE event_id = ? AND participant_full_name = ? AND annulled = 0
  `).get(event_id, participant_full_name.trim());
  if (duplicate) {
    return res.status(400).json({ message: 'Ya existe un formulario registrado para este evento con ese nombre completo' });
  }

  const testInfo = db.prepare(`SELECT test_type FROM tests WHERE id = ?`).get(event.test_id);
  const isBurnout = testInfo && testInfo.test_type === 'BURNOUT';

  const questions = db.prepare(`
    SELECT q.* FROM questions q
    WHERE q.test_id = ? AND q.active = 1
    ORDER BY q.number
  `).all(event.test_id);

  if (answers.length < questions.length) {
    return res.status(400).json({ message: `Debe responder las ${questions.length} preguntas` });
  }

  if (isBurnout) {
    const answersWithQ = answers.map(a => ({ ...a, numeric_value: a.numeric_value ?? 0 }));
    const scoring = calculateBurnout(answersWithQ, questions);

    const nowBurnout = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const insertResponse = db.prepare(`
      INSERT INTO responses (event_id, test_id, user_id, participant_full_name, score_a, score_b, score_c, score_d,
        burnout_ce, burnout_dp, burnout_rp, burnout_ce_nivel, burnout_dp_nivel, burnout_rp_nivel, burnout_diagnostico, conclusion, submitted_at)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event_id, event.test_id, req.user.id, participant_full_name.trim(),
      scoring.burnout_ce, scoring.burnout_dp, scoring.burnout_rp,
      scoring.burnout_ce_nivel, scoring.burnout_dp_nivel, scoring.burnout_rp_nivel,
      scoring.burnout_diagnostico, scoring.burnout_diagnostico, nowBurnout
    );

    const responseId = insertResponse.lastInsertRowid;
    const insertAnswer = db.prepare(`INSERT INTO response_answers (response_id, question_id, selected_option_id, selected_letter, numeric_value) VALUES (?, ?, NULL, NULL, ?)`);
    for (const ans of answers) {
      insertAnswer.run(responseId, ans.question_id, ans.numeric_value ?? 0);
    }

    const result = db.prepare(`SELECT * FROM responses WHERE id = ?`).get(responseId);
    return res.status(201).json({ ...result, ...scoring, test_type: 'BURNOUT' });
  }

  const answersWithQuestions = answers.map(a => {
    const q = questions.find(q => q.id === a.question_id);
    const opt = db.prepare(`SELECT letter, temperament FROM options WHERE id = ?`).get(a.selected_option_id);
    return { ...a, section: q ? q.section : null, selected_letter: opt ? opt.letter : null };
  });

  const scoring = calculateTemperament(answersWithQuestions, questions);

  const nowTemp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const insertResponse = db.prepare(`
    INSERT INTO responses (event_id, test_id, user_id, participant_full_name, score_a, score_b, score_c, score_d, dominant_temperament, secondary_temperament, conclusion, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event_id, event.test_id, req.user.id, participant_full_name.trim(),
    scoring.score_a, scoring.score_b, scoring.score_c, scoring.score_d,
    scoring.dominant_temperament, scoring.secondary_temperament, scoring.conclusion, nowTemp
  );

  const responseId = insertResponse.lastInsertRowid;
  const insertAnswer = db.prepare(`INSERT INTO response_answers (response_id, question_id, selected_option_id, selected_letter) VALUES (?, ?, ?, ?)`);

  for (const ans of answers) {
    const opt = db.prepare(`SELECT * FROM options WHERE id = ?`).get(ans.selected_option_id);
    if (!opt) continue;
    insertAnswer.run(responseId, ans.question_id, ans.selected_option_id, opt.letter);
  }

  const result = db.prepare(`SELECT * FROM responses WHERE id = ?`).get(responseId);
  res.status(201).json({ ...result, ...scoring });
});

router.put('/:id/annul', verifyToken, requireAdmin, (req, res) => {
  const response = db.prepare(`SELECT * FROM responses WHERE id = ?`).get(req.params.id);
  if (!response) return res.status(404).json({ message: 'Respuesta no encontrada' });
  db.prepare(`UPDATE responses SET annulled = 1 WHERE id = ?`).run(req.params.id);
  res.json({ message: 'Respuesta anulada correctamente' });
});

router.get('/event/:eventId/check-name', verifyToken, (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ message: 'Nombre requerido' });
  const existing = db.prepare(`SELECT id FROM responses WHERE event_id = ? AND participant_full_name = ? AND annulled = 0`).get(req.params.eventId, name.trim());
  res.json({ exists: !!existing });
});

module.exports = router;
