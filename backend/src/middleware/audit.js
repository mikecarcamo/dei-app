const db = require('../db/database');

function auditLog(action, entityType, entityId, details) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (res.statusCode < 400 && req.user) {
        try {
          db.prepare(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            req.user.id,
            action,
            entityType || null,
            typeof entityId === 'function' ? entityId(req, data) : entityId || null,
            typeof details === 'function' ? JSON.stringify(details(req, data)) : details || null
          );
        } catch (e) {
          console.error('Audit log error:', e.message);
        }
      }
      return originalJson(data);
    };
    next();
  };
}

module.exports = { auditLog };
