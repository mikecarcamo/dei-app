const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { calculateClimaScore } = require('../utils/scoring');

function getSurveyByCode(code) {
  return db.prepare(`
    SELECT ac.id AS code_id, ac.code, ac.used,
           ev.id AS event_id, ev.name AS event_name, ev.active, ev.start_date, ev.end_date,
           ev.target_audience, ev.test_id,
           e.name AS entity_name,
           t.name AS test_name, t.test_type,
           lk.status AS license_status, lk.valid_from, lk.valid_to
    FROM access_codes ac
    JOIN events ev ON ac.event_id = ev.id
    JOIN entities e ON ev.entity_id = e.id
    JOIN tests t ON ev.test_id = t.id
    LEFT JOIN license_keys lk ON ev.license_key_id = lk.id
    WHERE ac.code = ?
  `).get(code);
}

function validateSurvey(survey) {
  const today = new Date().toISOString().split('T')[0];
  if (!survey || survey.test_type !== 'CLIMA') return 'Código no válido';
  if (survey.used) return 'Este código ya fue utilizado';
  if (!survey.active) return 'El evento no está activo';
  if (today < survey.start_date || today > survey.end_date) {
    return 'El evento no está dentro del rango de fechas permitido';
  }
  if (survey.license_status !== 'activa' || today < survey.valid_from || today > survey.valid_to) {
    return 'El evento no tiene una licencia vigente';
  }
  return null;
}

router.get('/:code', (req, res) => {
  const survey = getSurveyByCode(req.params.code.toUpperCase().trim());
  const error = validateSurvey(survey);
  if (error) return res.status(400).json({ message: error });

  const questions = db.prepare(`
    SELECT id, number, section, text FROM questions
    WHERE test_id = ? AND active = 1 ORDER BY number
  `).all(survey.test_id);

  res.json({
    code: survey.code,
    event_name: survey.event_name,
    entity_name: survey.entity_name,
    test_name: survey.test_name,
    target_audience: survey.target_audience,
    questions,
  });
});

router.post('/:code', [
  body('answers').isArray({ min: 1 }).withMessage('Respuestas requeridas'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const survey = getSurveyByCode(req.params.code.toUpperCase().trim());
  const error = validateSurvey(survey);
  if (error) return res.status(400).json({ message: error });

  const questions = db.prepare(`
    SELECT id, number FROM questions WHERE test_id = ? AND active = 1 ORDER BY number
  `).all(survey.test_id);

  const answers = req.body.answers;
  if (answers.length < questions.length) {
    return res.status(400).json({ message: `Debe responder las ${questions.length} preguntas` });
  }
  if (answers.some(a => !Number.isInteger(a.numeric_value) || a.numeric_value < 1 || a.numeric_value > 5)) {
    return res.status(400).json({ message: 'Las respuestas deben estar entre 1 y 5' });
  }

  const score = calculateClimaScore(answers);
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const tx = db.transaction(() => {
    const stillUnused = db.prepare(`UPDATE access_codes SET used = 1 WHERE id = ? AND used = 0`).run(survey.code_id);
    if (stillUnused.changes === 0) throw new Error('Este código ya fue utilizado');

    const result = db.prepare(`
      INSERT INTO responses (event_id, test_id, user_id, participant_full_name, score_a, score_b, score_c, score_d,
        clima_score, conclusion, submitted_at)
      VALUES (?, ?, NULL, ?, 0, 0, 0, 0, ?, ?, ?)
    `).run(
      survey.event_id, survey.test_id, survey.code, score,
      `Ponderación general: ${score.toFixed(2)}%`, now
    );

    const responseId = result.lastInsertRowid;
    const insertAnswer = db.prepare(`INSERT INTO response_answers (response_id, question_id, selected_option_id, numeric_value) VALUES (?, ?, NULL, ?)`);
    for (const ans of answers) {
      insertAnswer.run(responseId, ans.question_id, ans.numeric_value);
    }
    db.prepare(`UPDATE access_codes SET response_id = ? WHERE id = ?`).run(responseId, survey.code_id);
    return responseId;
  });

  try {
    const responseId = tx();
    const saved = db.prepare(`SELECT * FROM responses WHERE id = ?`).get(responseId);
    res.status(201).json({ ...saved, clima_score: score, code: survey.code });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;
