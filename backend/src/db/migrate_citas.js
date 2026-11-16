require('dotenv').config();
const db = require('./database');

console.log('Ejecutando migración Citas...');

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'agendada'
      CHECK(status IN ('agendada','celebrada','cancelada_paciente','cancelada_terapeuta','anulada')),
    situacion_actual TEXT,
    desarrollo TEXT,
    plan_trabajo TEXT,
    observaciones TEXT,
    closed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_appointments_therapist ON appointments(therapist_id, starts_at);

  CREATE TABLE IF NOT EXISTS therapist_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_blocks_therapist ON therapist_blocks(therapist_id, starts_at);
`);

if (!db.pragma('table_info(appointments)').some(c => c.name === 'category')) {
  db.exec(`ALTER TABLE appointments ADD COLUMN category TEXT NOT NULL DEFAULT 'PRESENCIAL_MENTAL_Z9'`);
}

console.log('Migración Citas completada.');
