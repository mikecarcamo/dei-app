require('dotenv').config();
const db = require('./database');

function inspect() {
  return db.prepare(`
    SELECT t.id,
      (SELECT COUNT(*) FROM questions WHERE test_id = t.id) AS questions,
      (SELECT COUNT(*) FROM events WHERE test_id = t.id) AS events,
      (SELECT COUNT(*) FROM responses WHERE test_id = t.id) AS responses
    FROM tests t
    WHERE lower(trim(t.name)) = lower('Test de Personalidad')
    ORDER BY t.id
  `).all();
}

async function main() {
  const templates = inspect();
  console.table(templates);
  if (templates.length < 2) {
    console.log('No hay duplicados que limpiar.');
    return;
  }
  const [canonical, ...duplicates] = templates;
  if (duplicates.some(t => t.questions || t.events || t.responses)) {
    throw new Error('Hay duplicados con datos asociados. Se requiere una revisión manual; no se ha eliminado nada.');
  }
  console.log(`Conservar plantilla ${canonical.id}; copias vacías: ${duplicates.map(t => t.id).join(', ')}.`);
  if (!process.argv.includes('--apply')) {
    console.log('Solo diagnóstico. Para aplicar con respaldo: node src/db/cleanup_personality_duplicates.js --apply');
    return;
  }
  const backupPath = `${db.name}.before-personality-cleanup-${Date.now()}.sqlite`;
  await db.backup(backupPath);
  db.transaction(() => {
    const current = inspect();
    if (JSON.stringify(current) !== JSON.stringify(templates)) {
      throw new Error('Los datos cambiaron durante el respaldo. Vuelva a ejecutar el diagnóstico.');
    }
    const remove = db.prepare('DELETE FROM tests WHERE id = ?');
    for (const template of duplicates) remove.run(template.id);
  }).immediate();
  console.log(`Limpieza completada. Respaldo: ${backupPath}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => db.close());
