require('dotenv').config();
const db = require('./database');

console.log('Ejecutando migración Clima Laboral...');

const ecols = db.pragma('table_info(events)').map(c => c.name);
if (!ecols.includes('target_audience')) {
  db.exec(`ALTER TABLE events ADD COLUMN target_audience TEXT`);
  db.exec(`ALTER TABLE events ADD COLUMN codes_count INTEGER NOT NULL DEFAULT 0`);
  console.log('Columnas target_audience y codes_count agregadas a events');
}
if (!ecols.includes('price_per_code')) {
  db.exec(`ALTER TABLE events ADD COLUMN price_per_code REAL NOT NULL DEFAULT 0`);
  console.log('Columna price_per_code agregada a events');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS access_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id),
    code TEXT NOT NULL UNIQUE,
    used INTEGER NOT NULL DEFAULT 0,
    response_id INTEGER REFERENCES responses(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const rcols = db.pragma('table_info(responses)').map(c => c.name);
if (!rcols.includes('clima_score')) {
  db.exec(`ALTER TABLE responses ADD COLUMN clima_score REAL`);
  console.log('Columna clima_score agregada a responses');
}

const qcols = db.pragma('table_info(questions)').map(c => c.name);
if (!qcols.includes('is_external')) {
  db.exec(`ALTER TABLE questions ADD COLUMN is_external INTEGER NOT NULL DEFAULT 0`);
  console.log('Columna is_external agregada a questions');
}

console.log('Migración Clima Laboral completada.');
