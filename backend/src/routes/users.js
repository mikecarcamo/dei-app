const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { verifyToken, requireAdmin, requireRole } = require('../middleware/auth');

router.get('/', verifyToken, requireRole('ADMIN', 'EMPRESA'), (req, res) => {
  let users;
  if (req.user.role === 'ADMIN') {
    users = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.role, u.active, u.must_change_password, u.created_at,
             u.entity_id, e.name as entity_name
      FROM users u LEFT JOIN entities e ON u.entity_id = e.id
      ORDER BY u.full_name
    `).all();
  } else {
    users = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.role, u.active, u.must_change_password, u.created_at,
             u.entity_id, e.name as entity_name
      FROM users u LEFT JOIN entities e ON u.entity_id = e.id
      WHERE u.entity_id = ?
      ORDER BY u.full_name
    `).all(req.user.entity_id);
  }
  res.json(users);
});

router.get('/:id', verifyToken, requireRole('ADMIN', 'EMPRESA'), (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.role, u.active, u.must_change_password, u.created_at,
           u.entity_id, e.name as entity_name
    FROM users u LEFT JOIN entities e ON u.entity_id = e.id
    WHERE u.id = ?
  `).get(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  if (req.user.role === 'EMPRESA' && user.entity_id !== req.user.entity_id) {
    return res.status(403).json({ message: 'Sin acceso a este usuario' });
  }
  res.json(user);
});

router.post('/', verifyToken, requireAdmin, [
  body('full_name').notEmpty().trim().withMessage('Nombre completo requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('role').isIn(['ADMIN', 'EMPRESA', 'USUARIO']).withMessage('Rol inválido'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { full_name, email, password, role, entity_id, must_change_password } = req.body;
  const passwordHash = bcrypt.hashSync(password, 12);

  try {
    const result = db.prepare(`
      INSERT INTO users (entity_id, full_name, email, password_hash, role, active, must_change_password)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(entity_id || null, full_name.trim(), email.toLowerCase().trim(), passwordHash, role, must_change_password ? 1 : 0);

    const user = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.role, u.active, u.must_change_password, u.entity_id, e.name as entity_name
      FROM users u LEFT JOIN entities e ON u.entity_id = e.id WHERE u.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ message: 'Ya existe un usuario con ese email' });
    throw e;
  }
});

router.put('/:id', verifyToken, requireAdmin, (req, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

  const { full_name, email, role, entity_id, active, must_change_password, password } = req.body;

  let passwordHash = user.password_hash;
  if (password && password.length >= 8) {
    passwordHash = bcrypt.hashSync(password, 12);
  }

  try {
    db.prepare(`
      UPDATE users SET full_name = ?, email = ?, role = ?, entity_id = ?, active = ?, must_change_password = ?, password_hash = ?
      WHERE id = ?
    `).run(
      full_name || user.full_name,
      (email || user.email).toLowerCase().trim(),
      role || user.role,
      entity_id !== undefined ? entity_id : user.entity_id,
      active !== undefined ? (active ? 1 : 0) : user.active,
      must_change_password !== undefined ? (must_change_password ? 1 : 0) : user.must_change_password,
      passwordHash,
      req.params.id
    );
    const updated = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.role, u.active, u.must_change_password, u.entity_id, e.name as entity_name
      FROM users u LEFT JOIN entities e ON u.entity_id = e.id WHERE u.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ message: 'Ya existe un usuario con ese email' });
    throw e;
  }
});

module.exports = router;
