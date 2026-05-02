const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.get('/', verifyToken, requireAdmin, (req, res) => {
  const entities = db.prepare(`SELECT * FROM entities ORDER BY name`).all();
  res.json(entities);
});

router.get('/:id', verifyToken, requireAdmin, (req, res) => {
  const entity = db.prepare(`SELECT * FROM entities WHERE id = ?`).get(req.params.id);
  if (!entity) return res.status(404).json({ message: 'Entidad no encontrada' });
  res.json(entity);
});

router.post('/', verifyToken, requireAdmin, [
  body('name').notEmpty().trim().withMessage('Nombre requerido'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description } = req.body;
  try {
    const result = db.prepare(`INSERT INTO entities (name, description) VALUES (?, ?)`).run(name.trim(), description || null);
    const entity = db.prepare(`SELECT * FROM entities WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(entity);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ message: 'Ya existe una entidad con ese nombre' });
    throw e;
  }
});

router.put('/:id', verifyToken, requireAdmin, [
  body('name').notEmpty().trim().withMessage('Nombre requerido'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description, active } = req.body;
  const entity = db.prepare(`SELECT * FROM entities WHERE id = ?`).get(req.params.id);
  if (!entity) return res.status(404).json({ message: 'Entidad no encontrada' });

  try {
    db.prepare(`UPDATE entities SET name = ?, description = ?, active = ? WHERE id = ?`).run(
      name.trim(), description || null, active !== undefined ? (active ? 1 : 0) : entity.active, req.params.id
    );
    res.json(db.prepare(`SELECT * FROM entities WHERE id = ?`).get(req.params.id));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ message: 'Ya existe una entidad con ese nombre' });
    throw e;
  }
});

module.exports = router;
