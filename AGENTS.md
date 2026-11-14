# Verificación

- Desde `backend`, ejecutar `node --test src/db/templates.test.js` para comprobar la inicialización repetible de plantillas y la prevención de nombres duplicados.
- `node src/db/cleanup_personality_duplicates.js` diagnostica las plantillas de Personalidad sin borrar registros. `--apply` crea un respaldo y elimina únicamente copias vacías; requiere confirmación explícita antes de ejecutarlo sobre datos reales.
- No ejecutar `seed.js` ni `start.js` como verificación contra una base real: la carga inicial también modifica usuarios y otros datos.
