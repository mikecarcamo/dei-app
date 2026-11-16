require('dotenv').config();
const path = require('path');
const db = require('./database');
const { DSM_WHITELIST, DEFAULT_CRISIS_RESOURCES } = require('../utils/screening');

console.log('Ejecutando migración Terapeutas...');

// 1. Permitir el rol TERAPEUTA en users (SQLite no permite alterar un CHECK: se reconstruye la tabla).
const usersSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'`).get()?.sql || '';
if (usersSql && !usersSql.includes("'TERAPEUTA'")) {
  const dbFile = path.resolve(process.env.DB_PATH || './data/dei.sqlite');
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
  const backupFile = path.join(path.dirname(dbFile), `backup_pre_terapeuta_${stamp}.sqlite`);
  db.exec(`VACUUM INTO '${backupFile.replace(/'/g, "''")}'`);
  console.log('Respaldo creado:', backupFile);

  const cols = db.pragma('table_info(users)').map(c => c.name);
  const colList = cols.join(', ');
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_id INTEGER REFERENCES entities(id),
          full_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('ADMIN','EMPRESA','USUARIO','TERAPEUTA')) DEFAULT 'USUARIO',
          active INTEGER NOT NULL DEFAULT 1,
          must_change_password INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      db.exec(`INSERT INTO users_new (${colList}) SELECT ${colList} FROM users`);
      const before = db.prepare(`SELECT COUNT(*) c FROM users`).get().c;
      const after = db.prepare(`SELECT COUNT(*) c FROM users_new`).get().c;
      if (before !== after) throw new Error(`Conteo de usuarios no coincide (${before} vs ${after})`);
      db.exec(`DROP TABLE users`);
      db.exec(`ALTER TABLE users_new RENAME TO users`);
      const fkErrors = db.pragma('foreign_key_check');
      if (fkErrors.length) throw new Error(`Errores de llave foránea: ${JSON.stringify(fkErrors)}`);
    })();
    console.log('Rol TERAPEUTA habilitado en users');
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

// 2. Tablas del módulo de terapeutas
db.exec(`
  CREATE TABLE IF NOT EXISTS therapist_licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    key_value TEXT NOT NULL UNIQUE,
    valid_from TEXT NOT NULL,
    valid_to TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('activa','anulada')) DEFAULT 'activa',
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    birth_date TEXT,
    sex TEXT,
    phone TEXT,
    email TEXT,
    consultation_reason TEXT,
    background TEXT,
    medication TEXT,
    consent INTEGER NOT NULL DEFAULT 0,
    consent_date TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS screenings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    license_id INTEGER REFERENCES therapist_licenses(id),
    screened_at TEXT NOT NULL,
    params TEXT,
    results TEXT NOT NULL,
    risk_alert INTEGER NOT NULL DEFAULT 0,
    risk_level TEXT,
    risk_reasons TEXT,
    ai_result TEXT,
    ai_discarded TEXT,
    ai_model TEXT,
    prompt_version TEXT,
    ai_generated_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_screenings_patient ON screenings(patient_id);
  CREATE INDEX IF NOT EXISTS idx_patients_therapist ON patients(therapist_id);
  CREATE INDEX IF NOT EXISTS idx_therapist_licenses_user ON therapist_licenses(user_id);

  CREATE TABLE IF NOT EXISTS dsm_whitelist (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const insertCode = db.prepare(`INSERT OR IGNORE INTO dsm_whitelist (code, name) VALUES (?, ?)`);
db.transaction(() => { for (const c of DSM_WHITELIST) insertCode.run(c.code, c.name); })();

db.prepare(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('crisis_resources', ?)`).run(DEFAULT_CRISIS_RESOURCES);

// 3. Links de tamizaje respondidos por el paciente (un solo uso)
db.exec(`
  CREATE TABLE IF NOT EXISTS screening_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    therapist_id INTEGER NOT NULL REFERENCES users(id),
    instruments TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pendiente','completado')) DEFAULT 'pendiente',
    screening_id INTEGER REFERENCES screenings(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    used_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_screening_links_token ON screening_links(token);
`);

const scrCols = db.pragma('table_info(screenings)').map(c => c.name);
if (!scrCols.includes('source')) db.exec(`ALTER TABLE screenings ADD COLUMN source TEXT NOT NULL DEFAULT 'terapeuta'`);
if (!scrCols.includes('viewed_at')) db.exec(`ALTER TABLE screenings ADD COLUMN viewed_at TEXT`);

console.log('Migración Terapeutas completada.');
