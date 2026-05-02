const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/dei.sqlite';
const resolvedDb = path.resolve(DB_PATH);
const seedDb = path.resolve(__dirname, 'data/seed/dei.sqlite');

if (!fs.existsSync(resolvedDb) && fs.existsSync(seedDb)) {
  const dir = path.dirname(resolvedDb);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(seedDb, resolvedDb);
  console.log('DB seed copiada al volumen:', resolvedDb);
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
