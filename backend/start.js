const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './data/dei.sqlite';
const resolvedDb = path.resolve(DB_PATH);
const seedDb = path.resolve(__dirname, 'data/dei.sqlite');

if (!fs.existsSync(resolvedDb) && fs.existsSync(seedDb)) {
  const dir = path.dirname(resolvedDb);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(seedDb, resolvedDb);
  console.log('DB seed copiada al volumen:', resolvedDb);
}

require('./src/db/migrate');
try {
  require('./src/db/seed');
} catch (e) {
  console.error('Seed error (non-fatal):', e.message);
}
require('./src/index');
