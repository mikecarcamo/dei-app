require('dotenv').config();
process.env.TZ = process.env.TZ || 'America/Guatemala';
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

require('./db/migrate');

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));

const authRoutes = require('./routes/auth');
const entityRoutes = require('./routes/entities');
const userRoutes = require('./routes/users');
const testRoutes = require('./routes/tests');
const licenseRoutes = require('./routes/licenses');
const eventRoutes = require('./routes/events');
const responseRoutes = require('./routes/responses');
const reportRoutes = require('./routes/reports');

app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.get('/api/debug-users', (req, res) => {
  const db = require('./db/database');
  const users = db.prepare('SELECT id, email, active FROM users').all();
  const dbPath = require('path').resolve(process.env.DB_PATH || './data/dei.sqlite');
  res.json({ dbPath, users });
});

app.get('/api/restore-seed-db', (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const liveDb = require('./db/database');
    const candidates = [
      path.resolve(__dirname, '../seed/dei.sqlite'),
      path.resolve(process.cwd(), 'seed/dei.sqlite'),
      '/app/seed/dei.sqlite',
    ];
    const usePath = candidates.find(p => fs.existsSync(p));
    if (!usePath) return res.status(404).json({ error: 'seed no encontrado', tried: candidates, __dirname, cwd: process.cwd() });
    const tables = ['entities','tests','questions','options','users','licenses','events','event_users','responses','response_answers'];
    let counts = {};
    liveDb.prepare(`ATTACH DATABASE '${usePath}' AS seed`).run();
    for (const t of tables) {
      try {
        const r = liveDb.prepare(`INSERT OR IGNORE INTO main.${t} SELECT * FROM seed.${t}`).run();
        counts[t] = r.changes;
      } catch(e) { counts[t] = `error: ${e.message}`; }
    }
    liveDb.prepare(`DETACH DATABASE seed`).run();
    res.json({ ok: true, counts });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reset-admin', (req, res) => {
  try {
    const db = require('./db/database');
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('123456789', 12);
    const entity = db.prepare(`SELECT id FROM entities WHERE name = 'DEI'`).get();
    if (!entity) {
      db.prepare(`INSERT OR IGNORE INTO entities (name, description, active) VALUES ('DEI','Entidad principal',1)`).run();
    }
    const eid = db.prepare(`SELECT id FROM entities WHERE name = 'DEI'`).get().id;
    db.prepare(`INSERT OR IGNORE INTO users (entity_id, full_name, email, password_hash, role, active, must_change_password) VALUES (?,?,?,?,?,1,1)`)
      .run(eid, 'Administrador DEI', 'mikenoecarcamo@gmail.com', hash, 'ADMIN');
    db.prepare(`UPDATE users SET password_hash=?, active=1 WHERE email='mikenoecarcamo@gmail.com'`).run(hash);
    res.json({ ok: true, message: 'Admin reseteado con password 123456789' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.use((req, res, next) => {
  next(new Error(`Ruta no encontrada: ${req.method} ${req.url}`));
});

app.use((err, req, res, next) => {
  console.error('=== ERROR ===', err.message);
  console.error(err.stack);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Error interno del servidor', error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 DEI Backend corriendo en http://0.0.0.0:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Acceso intranet: http://<TU_IP_LOCAL>:${PORT}\n`);
});
