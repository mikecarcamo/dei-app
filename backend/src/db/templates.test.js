const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Database = require('better-sqlite3');

function migrate(db) {
  const source = fs.readFileSync(path.join(__dirname, 'migrate.js'), 'utf8');
  vm.runInNewContext(source, {
    require: name => name === './database' ? db : { config() {} },
    console: { log() {} },
  });
}

test('la carga de la plantilla es repetible sin duplicados', () => {
  const db = new Database(':memory:');
  try {
    migrate(db);
    const source = fs.readFileSync(path.join(__dirname, 'seed.js'), 'utf8');
    const templateSeed = source.slice(source.indexOf('const insertTest ='), source.indexOf('const questionsData ='));
    const run = () => vm.runInNewContext(templateSeed, { db, console: { log() {} } });
    run();
    run();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tests').get().count, 1);
  } finally {
    db.close();
  }
});

test('la base impide nombres duplicados al crear o renombrar', () => {
  const db = new Database(':memory:');
  try {
    migrate(db);
    const insert = db.prepare('INSERT INTO tests (name) VALUES (?)');
    insert.run('Test de Personalidad');
    insert.run('Clima Laboral');
    assert.throws(() => insert.run('  test de personalidad  '), /Ya existe/);
    assert.throws(() => db.prepare('UPDATE tests SET name = ? WHERE id = 2').run('Test de Personalidad'), /Ya existe/);
    db.prepare('UPDATE tests SET description = ? WHERE id = 1').run('Descripción');
  } finally {
    db.close();
  }
});

test('la protección se instala sin borrar duplicados históricos', () => {
  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE tests (id INTEGER PRIMARY KEY, name TEXT, description TEXT, active INTEGER, created_at TEXT)');
    db.prepare('INSERT INTO tests (name) VALUES (?)').run('Test de Personalidad');
    db.prepare('INSERT INTO tests (name) VALUES (?)').run('Test de Personalidad');
    migrate(db);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tests').get().count, 2);
    assert.throws(() => db.prepare('INSERT INTO tests (name) VALUES (?)').run('Test de Personalidad'), /Ya existe/);
  } finally {
    db.close();
  }
});
