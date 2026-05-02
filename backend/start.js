require('./src/db/migrate');
try {
  require('./src/db/seed');
} catch (e) {
  console.error('Seed error (non-fatal):', e.message);
}
require('./src/index');
