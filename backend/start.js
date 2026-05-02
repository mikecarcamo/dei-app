const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/dei.sqlite';
const resolvedDb = path.resolve(DB_PATH);
const seedDb = path.resolve(__dirname, 'seed/dei.sqlite');

if (!fs.existsSync(resolvedDb) && fs.existsSync(seedDb)) {
  const dir = path.dirname(resolvedDb);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(seedDb, resolvedDb);
  console.log('DB seed copiada al volumen:', resolvedDb);
  // Forzar password conocido para todos los usuarios tras copiar el seed
  try {
    const bcrypt = require('bcryptjs');
    const Database = require('better-sqlite3');
    const tmpDb = new Database(resolvedDb);
    const hash = bcrypt.hashSync('123456789', 12);
    tmpDb.prepare(`UPDATE users SET password_hash = ?, must_change_password = 1`).run(hash);
    tmpDb.close();
    console.log('Passwords de todos los usuarios reseteados a 123456789');
  } catch(e) { console.error('Error reseteando passwords:', e.message); }
}

require('./src/db/migrate');
require('./src/db/migrate_burnout');
require('./src/db/migrate_response_answers');

const seeds = ['./src/db/seed', './src/db/seed_burnout'];
for (const s of seeds) {
  try { require(s); } catch (e) { console.error(`Seed error (${s}):`, e.message); }
}

// Seeds de respuestas solo si la BD está vacía
try {
  const db = require('./src/db/database');
  const count = db.prepare('SELECT COUNT(*) as c FROM responses').get().c;
  if (count === 0) {
    console.log('BD vacía, insertando respuestas de ejemplo...');
    try { require('./src/db/seed_personalidad'); } catch(e) { console.error('seed_personalidad error:', e.message); }
    try { require('./src/db/seed_burnout_70'); } catch(e) { console.error('seed_burnout_70 error:', e.message); }
  } else {
    console.log(`BD con ${count} respuestas existentes, omitiendo seeds de respuestas.`);
  }
} catch(e) { console.error('Error verificando responses:', e.message); }

require('./src/index');
