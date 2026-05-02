const jwt = require('jsonwebtoken');
const db = require('../db/database');

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare(`SELECT id, email, role, entity_id, active, must_change_password FROM users WHERE id = ?`).get(decoded.id);
    if (!user || !user.active) return res.status(401).json({ message: 'Usuario no activo o no encontrado' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tiene permisos para esta acción' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRole('ADMIN')(req, res, next);
}

module.exports = { verifyToken, requireRole, requireAdmin };
