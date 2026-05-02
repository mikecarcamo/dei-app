const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

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

router.get('/', verifyToken, requireAdmin, (req, res) => {
  const events = db.prepare(`
    SELECT ev.*, e.name as entity_name, t.name as test_name,
           lk.key_value, lk.status as license_status
    FROM events ev
    LEFT JOIN entities e ON ev.entity_id = e.id
    LEFT JOIN tests t ON ev.test_id = t.id
    LEFT JOIN license_keys lk ON ev.license_key_id = lk.id
    ORDER BY ev.created_at DESC
  `).all();
  res.json(events);
});

router.get('/:id', verifyToken, requireAdmin, (req, res) => {
  const event = getEventFull(req.params.id);
  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });
  res.json(event);
});

router.post('/', verifyToken, requireAdmin, [
  body('entity_id').notEmpty().withMessage('Entidad requerida'),
  body('test_id').notEmpty().withMessage('Test requerido'),
  body('name').notEmpty().trim().withMessage('Nombre requerido'),
  body('start_date').notEmpty().withMessage('Fecha inicio requerida'),
  body('end_date').notEmpty().withMessage('Fecha fin requerida'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { entity_id, test_id, name, start_date, end_date, active, license_key_id } = req.body;

  if (license_key_id) {
    const key = db.prepare(`SELECT * FROM license_keys WHERE id = ?`).get(license_key_id);
    if (!key) return res.status(400).json({ message: 'Licencia no encontrada' });
    if (key.event_id && key.event_id !== null) return res.status(400).json({ message: 'Esa licencia ya está asignada a otro evento' });
    if (key.status !== 'activa') return res.status(400).json({ message: 'La licencia no está activa' });
  }

  const result = db.prepare(`
    INSERT INTO events (entity_id, test_id, name, start_date, end_date, active, license_key_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entity_id, test_id, name.trim(), start_date, end_date, active !== false ? 1 : 0, license_key_id || null);

  if (license_key_id) {
    db.prepare(`UPDATE license_keys SET event_id = ? WHERE id = ?`).run(result.lastInsertRowid, license_key_id);
  }

  res.status(201).json(getEventFull(result.lastInsertRowid));
});

router.put('/:id', verifyToken, requireAdmin, (req, res) => {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });

  const { name, start_date, end_date, active, license_key_id } = req.body;

  if (license_key_id && license_key_id !== event.license_key_id) {
    const key = db.prepare(`SELECT * FROM license_keys WHERE id = ?`).get(license_key_id);
    if (!key) return res.status(400).json({ message: 'Licencia no encontrada' });
    if (key.event_id && key.event_id !== parseInt(req.params.id)) {
      return res.status(400).json({ message: 'Esa licencia ya está asignada a otro evento' });
    }
    if (key.status !== 'activa') return res.status(400).json({ message: 'La licencia no está activa' });
    if (event.license_key_id) {
      db.prepare(`UPDATE license_keys SET event_id = NULL WHERE id = ?`).run(event.license_key_id);
    }
    db.prepare(`UPDATE license_keys SET event_id = ? WHERE id = ?`).run(req.params.id, license_key_id);
  }

  db.prepare(`
    UPDATE events SET name = ?, start_date = ?, end_date = ?, active = ?, license_key_id = ?
    WHERE id = ?
  `).run(
    name || event.name,
    start_date || event.start_date,
    end_date || event.end_date,
    active !== undefined ? (active ? 1 : 0) : event.active,
    license_key_id !== undefined ? license_key_id : event.license_key_id,
    req.params.id
  );

  res.json(getEventFull(req.params.id));
});

router.post('/:id/users', verifyToken, requireAdmin, [
  body('user_ids').isArray({ min: 1 }).withMessage('Se requiere al menos un usuario'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });

  const insert = db.prepare(`INSERT OR IGNORE INTO event_users (event_id, user_id) VALUES (?, ?)`);
  for (const uid of req.body.user_ids) {
    insert.run(req.params.id, uid);
  }
  res.json({ message: 'Usuarios asignados', assigned_users: db.prepare(`SELECT eu.user_id, u.full_name, u.email FROM event_users eu JOIN users u ON eu.user_id = u.id WHERE eu.event_id = ?`).all(req.params.id) });
});

router.delete('/:id/users/:uid', verifyToken, requireAdmin, (req, res) => {
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

module.exports = router;
