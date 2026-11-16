# Verificación

- Desde `backend`, ejecutar `node --test src/db/templates.test.js` para comprobar la inicialización repetible de plantillas y la prevención de nombres duplicados.
- `node src/db/cleanup_personality_duplicates.js` diagnostica las plantillas de Personalidad sin borrar registros. `--apply` crea un respaldo y elimina únicamente copias vacías; requiere confirmación explícita antes de ejecutarlo sobre datos reales.
- No ejecutar `seed.js` ni `start.js` como verificación contra una base real: la carga inicial también modifica usuarios y otros datos.
- Para probar migraciones o endpoints, copiar `backend/seed/dei.sqlite` a una carpeta temporal y apuntar `DB_PATH` a esa copia.

# Módulo Terapeutas (tamizaje clínico)

- Rol `TERAPEUTA`. Lo crea el ADMIN en Entidades → Terapeutas (`/admin/therapists`), con una licencia por usuario en `therapist_licenses` (solo vigencia por fechas, hora de Guatemala).
- Backend: `backend/src/routes/therapy.js` montado en `/api/therapy`. Migración: `backend/src/db/migrate_terapeuta.js` (reconstruye `users` para permitir el rol, con respaldo `VACUUM INTO` previo, y crea `therapist_licenses`, `patients`, `screenings`, `dsm_whitelist`, `app_settings`).
- Instrumentos (PHQ-9, GAD-7, PCL-5, C-SSRS), puntuación, regla de riesgo y lista permitida de códigos: `backend/src/utils/screening.js`. La severidad y el riesgo los calcula el código, nunca la IA.
- IA: Groq vía `generateScreeningAnalysis` en `backend/src/utils/ai.js`, con salida JSON validada; los códigos fuera de `dsm_whitelist` se descartan y se guardan en `screenings.ai_discarded`. A la IA no se envían nombre, teléfono, correo ni notas del profesional.
- Base clínica: `backend/knowledge/clinical-mental-health/SKILL.md` (dentro de `backend/` porque Railway despliega desde esa carpeta).
- Frontend: `frontend/src/pages/therapist/` (Tamizaje, Pacientes, Historial) y `frontend/src/pages/admin/Therapists.jsx`.
- Sin licencia vigente el terapeuta puede consultar el historial, pero no crear ni editar pacientes ni tamizajes.
- Citas (`/terapeuta/citas`): `appointments` (duración fija 1h) y `therapist_blocks` en `migrate_citas.js`; traslapes validados en `overlapConflicts` de `therapy.js` (solo bloquean estados agendada/celebrada; cancelada/anulada liberan el horario).
