const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { verifyToken, requireAdmin, requireRole } = require('../middleware/auth');
const { randomBytes } = require('crypto');

function generateCode() {
  return 'CLI-' + randomBytes(3).toString('hex').toUpperCase();
}

function createCodes(eventId, count) {
  const insert = db.prepare(`INSERT INTO access_codes (event_id, code) VALUES (?, ?)`);
  for (let i = 0; i < count; i++) insert.run(eventId, generateCode());
}

function getEventFull(id) {
  const event = db.prepare(`
    SELECT ev.*, e.name as entity_name, t.name as test_name,
           lk.key_value, lk.status as license_status, lk.valid_from, lk.valid_to
    FROM events ev
    LEFT JOIN entities e ON ev.entity_id = e.id
    LEFT JOIN tests t ON ev.test_id = t.id
    LEFT JOIN license_keys lk ON ev.license_key_id = lk.id
    WHERE ev.id = ?
  `).get(id);
  if (!event) return null;
  event.assigned_users = db.prepare(`
    SELECT eu.user_id, u.full_name, u.email
    FROM event_users eu JOIN users u ON eu.user_id = u.id
    WHERE eu.event_id = ?
  `).all(id);
  return event;
}

router.get('/', verifyToken, requireRole('ADMIN', 'EMPRESA'), (req, res) => {
  let events;
  if (req.user.role === 'EMPRESA') {
    events = db.prepare(`
      SELECT ev.*, e.name as entity_name, t.name as test_name, t.test_type,
             lk.key_value, lk.status as license_status
      FROM events ev
      LEFT JOIN entities e ON ev.entity_id = e.id
      LEFT JOIN tests t ON ev.test_id = t.id
      LEFT JOIN license_keys lk ON ev.license_key_id = lk.id
      WHERE ev.entity_id = ?
      ORDER BY ev.created_at DESC
    `).all(req.user.entity_id);
  } else {
    events = db.prepare(`
      SELECT ev.*, e.name as entity_name, t.name as test_name, t.test_type,
             lk.key_value, lk.status as license_status
      FROM events ev
      LEFT JOIN entities e ON ev.entity_id = e.id
      LEFT JOIN tests t ON ev.test_id = t.id
      LEFT JOIN license_keys lk ON ev.license_key_id = lk.id
      ORDER BY ev.created_at DESC
    `).all();
  }
  res.json(events);
});

router.get('/:id', verifyToken, requireRole('ADMIN', 'EMPRESA'), (req, res) => {
  const event = getEventFull(req.params.id);
  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
  if (req.user.role === 'EMPRESA' && event.entity_id !== req.user.entity_id) {
    return res.status(403).json({ message: 'Sin acceso a este evento' });
  }
  res.json(event);
});

router.post('/', verifyToken, requireAdmin, [
  body('entity_id').notEmpty().withMessage('Entidad requerida'),
  body('test_id').notEmpty().withMessage('Test requerido'),
  body('name').notEmpty().trim().withMessage('Nombre requerido'),
  body('license_key_id').notEmpty().withMessage('Licencia requerida'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { entity_id, test_id, name, active, license_key_id, target_audience, codes_count } = req.body;

  const key = db.prepare(`SELECT * FROM license_keys WHERE id = ?`).get(license_key_id);
  if (!key) return res.status(400).json({ message: 'Licencia no encontrada' });
  if (key.event_id && key.event_id !== null) return res.status(400).json({ message: 'Esa licencia ya está asignada a otro evento' });
  if (key.status !== 'activa') return res.status(400).json({ message: 'La licencia no está activa' });
  if (key.entity_id !== parseInt(entity_id)) return res.status(400).json({ message: 'La licencia no pertenece a esa entidad' });

  const testRow = db.prepare(`SELECT test_type FROM tests WHERE id = ?`).get(test_id);
  const isClima = testRow && testRow.test_type === 'CLIMA';
  if (isClima) {
    if (!target_audience || !target_audience.trim()) {
      return res.status(400).json({ message: 'Indique a quién va dirigida la encuesta (ej: Gerencia)' });
    }
    if (!codes_count || codes_count < 1 || codes_count > 1000) {
      return res.status(400).json({ message: 'Indique cuántos códigos de acceso generar (1-1000)' });
    }
  }

  const result = db.prepare(`
    INSERT INTO events (entity_id, test_id, name, start_date, end_date, active, license_key_id, target_audience, codes_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(entity_id, test_id, name.trim(), key.valid_from, key.valid_to, active !== false ? 1 : 0, license_key_id,
    isClima ? target_audience.trim() : null, isClima ? codes_count : 0);

  db.prepare(`UPDATE license_keys SET event_id = ? WHERE id = ?`).run(result.lastInsertRowid, license_key_id);
  if (isClima) createCodes(result.lastInsertRowid, codes_count);

  res.status(201).json(getEventFull(result.lastInsertRowid));
});

router.put('/:id', verifyToken, requireAdmin, (req, res) => {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });

  const { name, active, license_key_id } = req.body;

  let newKey = null;
  if (license_key_id && license_key_id !== event.license_key_id) {
    const key = db.prepare(`SELECT * FROM license_keys WHERE id = ?`).get(license_key_id);
    if (!key) return res.status(400).json({ message: 'Licencia no encontrada' });
    if (key.event_id && key.event_id !== parseInt(req.params.id)) {
      return res.status(400).json({ message: 'Esa licencia ya está asignada a otro evento' });
    }
    if (key.status !== 'activa') return res.status(400).json({ message: 'La licencia no está activa' });
    if (key.entity_id !== event.entity_id) return res.status(400).json({ message: 'La licencia no pertenece a la entidad del evento' });
    newKey = key;
    if (event.license_key_id) {
      db.prepare(`UPDATE license_keys SET event_id = NULL WHERE id = ?`).run(event.license_key_id);
    }
    db.prepare(`UPDATE license_keys SET event_id = ? WHERE id = ?`).run(req.params.id, license_key_id);
  }

  const effectiveLicenseId = license_key_id !== undefined ? license_key_id : event.license_key_id;
  const dates = newKey
    ? { from: newKey.valid_from, to: newKey.valid_to }
    : db.prepare(`SELECT valid_from, valid_to FROM license_keys WHERE id = ?`).get(effectiveLicenseId) || { from: event.start_date, to: event.end_date };

  db.prepare(`
    UPDATE events SET name = ?, start_date = ?, end_date = ?, active = ?, license_key_id = ?
    WHERE id = ?
  `).run(
    name || event.name,
    dates.from,
    dates.to,
    active !== undefined ? (active ? 1 : 0) : event.active,
    effectiveLicenseId,
    req.params.id
  );

  res.json(getEventFull(req.params.id));
});

router.post('/:id/users', verifyToken, requireRole('ADMIN', 'EMPRESA'), [
  body('user_ids').isArray({ min: 1 }).withMessage('Se requiere al menos un usuario'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
  if (req.user.role === 'EMPRESA' && event.entity_id !== req.user.entity_id) {
    return res.status(403).json({ message: 'Sin acceso a este evento' });
  }
  if (!event.active) return res.status(400).json({ message: 'No se pueden asignar usuarios a un evento inactivo' });

  const insert = db.prepare(`INSERT OR IGNORE INTO event_users (event_id, user_id) VALUES (?, ?)`);
  const validUser = db.prepare(`SELECT id FROM users WHERE id = ? AND entity_id = ?`);
  for (const uid of req.body.user_ids) {
    if (!validUser.get(uid, event.entity_id)) {
      return res.status(400).json({ message: 'Solo puede asignar usuarios de la entidad del evento' });
    }
    insert.run(req.params.id, uid);
  }
  res.json({ message: 'Usuarios asignados', assigned_users: db.prepare(`SELECT eu.user_id, u.full_name, u.email FROM event_users eu JOIN users u ON eu.user_id = u.id WHERE eu.event_id = ?`).all(req.params.id) });
});

router.delete('/:id/users/:uid', verifyToken, requireRole('ADMIN', 'EMPRESA'), (req, res) => {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
  if (req.user.role === 'EMPRESA' && event.entity_id !== req.user.entity_id) {
    return res.status(403).json({ message: 'Sin acceso a este evento' });
  }
  db.prepare(`DELETE FROM event_users WHERE event_id = ? AND user_id = ?`).run(req.params.id, req.params.uid);
  res.json({ message: 'Usuario removido del evento' });
});

router.get('/user/available', verifyToken, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user.id;
  const entityId = req.user.entity_id;

  const events = db.prepare(`
    SELECT ev.id, ev.name, ev.start_date, ev.end_date, ev.test_id,
           t.name as test_name, t.description as test_description, t.test_type,
           e.name as entity_name,
           lk.key_value, lk.status as license_status,
           (SELECT COUNT(*) FROM responses r WHERE r.event_id = ev.id AND r.annulled = 0) as response_count
    FROM events ev
    JOIN entities e ON ev.entity_id = e.id
    JOIN tests t ON ev.test_id = t.id
    JOIN license_keys lk ON ev.license_key_id = lk.id
    JOIN event_users eu ON eu.event_id = ev.id
    WHERE ev.active = 1
      AND ev.entity_id = ?
      AND eu.user_id = ?
      AND ev.start_date <= ?
      AND ev.end_date >= ?
      AND lk.status = 'activa'
      AND lk.valid_from <= ?
      AND lk.valid_to >= ?
    ORDER BY ev.start_date
  `).all(entityId, userId, today, today, today, today);

  res.json(events);
});

router.get('/:id/codes', verifyToken, requireRole('ADMIN', 'EMPRESA'), (req, res) => {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
  if (req.user.role === 'EMPRESA' && event.entity_id !== req.user.entity_id) {
    return res.status(403).json({ message: 'Sin acceso a este evento' });
  }
  const codes = db.prepare(`SELECT id, code, used, created_at FROM access_codes WHERE event_id = ? ORDER BY id`).all(req.params.id);
  res.json(codes);
});

module.exports = router;
