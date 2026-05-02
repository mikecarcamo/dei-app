require('dotenv').config();
const db = require('./database');

console.log('Migrando response_answers para nullable selected_option_id y selected_letter...');

db.pragma('foreign_keys = OFF');
db.exec(`
  CREATE TABLE IF NOT EXISTS response_answers_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id INTEGER NOT NULL REFERENCES responses(id),
    question_id INTEGER NOT NULL REFERENCES questions(id),
    selected_option_id INTEGER REFERENCES options(id),
    selected_letter TEXT,
    numeric_value INTEGER
  );
  INSERT INTO response_answers_new SELECT id, response_id, question_id, selected_option_id, selected_letter, numeric_value FROM response_answers;
  DROP TABLE response_answers;
  ALTER TABLE response_answers_new RENAME TO response_answers;
`);
db.pragma('foreign_keys = ON');

console.log('OK - response_answers migrada correctamente.');
