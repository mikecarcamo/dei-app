const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, requireAdmin, (req, res) => {
  const keys = db.prepare(`
    SELECT lk.*, e.name as entity_name, ev.name as event_name
    FROM license_keys lk
    LEFT JOIN entities e ON lk.entity_id = e.id
    LEFT JOIN events ev ON lk.event_id = ev.id
    ORDER BY lk.created_at DESC
  `).all();
  res.json(keys);
});

router.get('/:id', verifyToken, requireAdmin, (req, res) => {
  const key = db.prepare(`
    SELECT lk.*, e.name as entity_name, ev.name as event_name
    FROM license_keys lk
    LEFT JOIN entities e ON lk.entity_id = e.id
    LEFT JOIN events ev ON lk.event_id = ev.id
    WHERE lk.id = ?
  `).get(req.params.id);
  if (!key) return res.status(404).json({ message: 'Licencia no encontrada' });
  res.json(key);
});

router.post('/generate', verifyToken, requireAdmin, [
  body('entity_id').notEmpty().withMessage('Entidad requerida'),
  body('valid_from').notEmpty().withMessage('Fecha inicio requerida'),
  body('valid_to').notEmpty().withMessage('Fecha fin requerida'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { entity_id, valid_from, valid_to } = req.body;
  const keyValue = 'DEI-' + uuidv4().toUpperCase().replace(/-/g, '').substring(0, 16);

  const result = db.prepare(`
    INSERT INTO license_keys (key_value, entity_id, valid_from, valid_to, status)
    VALUES (?, ?, ?, ?, 'activa')
  `).run(keyValue, entity_id, valid_from, valid_to);

  res.status(201).json(db.prepare(`SELECT * FROM license_keys WHERE id = ?`).get(result.lastInsertRowid));
});

router.post('/manual', verifyToken, requireAdmin, [
  body('key_value').notEmpty().trim().withMessage('Key requerida'),
  body('entity_id').notEmpty().withMessage('Entidad requerida'),
  body('valid_from').notEmpty().withMessage('Fecha inicio requerida'),
  body('valid_to').notEmpty().withMessage('Fecha fin requerida'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { key_value, entity_id, valid_from, valid_to } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO license_keys (key_value, entity_id, valid_from, valid_to, status)
      VALUES (?, ?, ?, ?, 'activa')
    `).run(key_value.trim(), entity_id, valid_from, valid_to);
    res.status(201).json(db.prepare(`SELECT * FROM license_keys WHERE id = ?`).get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ message: 'Esa key ya existe en el sistema' });
    throw e;
  }
});

router.put('/:id/status', verifyToken, requireAdmin, [
  body('status').isIn(['activa', 'usada', 'vencida', 'anulada']).withMessage('Estado inválido'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const key = db.prepare(`SELECT * FROM license_keys WHERE id = ?`).get(req.params.id);
  if (!key) return res.status(404).json({ message: 'Licencia no encontrada' });

  db.prepare(`UPDATE license_keys SET status = ? WHERE id = ?`).run(req.body.status, req.params.id);
  res.json(db.prepare(`SELECT * FROM license_keys WHERE id = ?`).get(req.params.id));
});

module.exports = router;
