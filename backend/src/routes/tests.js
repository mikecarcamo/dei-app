const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, requireAdmin, (req, res) => {
  const tests = db.prepare(`SELECT * FROM tests ORDER BY name`).all();
  res.json(tests);
});

router.get('/:id', verifyToken, (req, res) => {
  const test = db.prepare(`SELECT * FROM tests WHERE id = ?`).get(req.params.id);
  if (!test) return res.status(404).json({ message: 'Test no encontrado' });
  const questions = db.prepare(`SELECT * FROM questions WHERE test_id = ? ORDER BY number`).all(req.params.id);
  for (const q of questions) {
    q.options = db.prepare(`SELECT * FROM options WHERE question_id = ? ORDER BY letter`).all(q.id);
  }
  res.json({ ...test, questions });
});

router.post('/', verifyToken, requireAdmin, [
  body('name').notEmpty().trim().withMessage('Nombre requerido'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, description } = req.body;
  const result = db.prepare(`INSERT INTO tests (name, description) VALUES (?, ?)`).run(name.trim(), description || null);
  res.status(201).json(db.prepare(`SELECT * FROM tests WHERE id = ?`).get(result.lastInsertRowid));
});

router.put('/:id', verifyToken, requireAdmin, (req, res) => {
  const test = db.prepare(`SELECT * FROM tests WHERE id = ?`).get(req.params.id);
  if (!test) return res.status(404).json({ message: 'Test no encontrado' });
  const { name, description, active } = req.body;
  db.prepare(`UPDATE tests SET name = ?, description = ?, active = ? WHERE id = ?`).run(
    name || test.name, description !== undefined ? description : test.description,
    active !== undefined ? (active ? 1 : 0) : test.active, req.params.id
  );
  res.json(db.prepare(`SELECT * FROM tests WHERE id = ?`).get(req.params.id));
});

router.post('/:id/questions', verifyToken, requireAdmin, [
  body('number').isInt({ min: 1 }).withMessage('Número requerido'),
  body('section').isIn(['FORTALEZAS', 'DEBILIDADES']).withMessage('Sección inválida'),
  body('text').notEmpty().trim().withMessage('Texto requerido'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { number, section, text, options } = req.body;
  const result = db.prepare(`INSERT INTO questions (test_id, number, section, text) VALUES (?, ?, ?, ?)`).run(req.params.id, number, section, text.trim());
  const qId = result.lastInsertRowid;

  if (options && Array.isArray(options)) {
    for (const opt of options) {
      db.prepare(`INSERT INTO options (question_id, letter, text, temperament) VALUES (?, ?, ?, ?)`).run(qId, opt.letter, opt.text, opt.temperament);
    }
  }
  const q = db.prepare(`SELECT * FROM questions WHERE id = ?`).get(qId);
  q.options = db.prepare(`SELECT * FROM options WHERE question_id = ? ORDER BY letter`).all(qId);
  res.status(201).json(q);
});

router.put('/questions/:qid', verifyToken, requireAdmin, (req, res) => {
  const q = db.prepare(`SELECT * FROM questions WHERE id = ?`).get(req.params.qid);
  if (!q) return res.status(404).json({ message: 'Pregunta no encontrada' });
  const { text, section, active } = req.body;
  db.prepare(`UPDATE questions SET text = ?, section = ?, active = ? WHERE id = ?`).run(
    text || q.text, section || q.section, active !== undefined ? (active ? 1 : 0) : q.active, req.params.qid
  );
  res.json(db.prepare(`SELECT * FROM questions WHERE id = ?`).get(req.params.qid));
});

module.exports = router;
