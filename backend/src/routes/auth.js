const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { verifyToken } = require('../middleware/auth');

router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
], (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = db.prepare(`
      SELECT u.*, e.name as entity_name 
      FROM users u LEFT JOIN entities e ON u.entity_id = e.id
      WHERE u.email = ?
    `).get(email.toLowerCase().trim());

    if (!user) return res.status(401).json({ message: 'Credenciales incorrectas' });
    if (!user.active) return res.status(401).json({ message: 'Usuario inactivo. Contacte al administrador.' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    try {
      db.prepare(`INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (?, 'LOGIN', 'user', ?)`).run(
        user.id, JSON.stringify({ email: user.email })
      );
    } catch (e) {}

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        entity_id: user.entity_id,
        entity_name: user.entity_name,
        must_change_password: user.must_change_password === 1,
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', verifyToken, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.email, u.full_name, u.role, u.entity_id, u.active, u.must_change_password, e.name as entity_name
    FROM users u LEFT JOIN entities e ON u.entity_id = e.id
    WHERE u.id = ?
  `).get(req.user.id);
  res.json({ user: { ...user, must_change_password: user.must_change_password === 1 } });
});

router.post('/change-password', verifyToken, [
  body('current_password').notEmpty().withMessage('Contraseña actual requerida'),
  body('new_password').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { current_password, new_password } = req.body;
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);

  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) return res.status(400).json({ message: 'Contraseña actual incorrecta' });

  const newHash = bcrypt.hashSync(new_password, 12);
  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(newHash, req.user.id);

  res.json({ message: 'Contraseña actualizada correctamente' });
});

module.exports = router;
