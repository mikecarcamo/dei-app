---
name: dei-manual
description: Conocimiento funcional del sistema DEI — roles, módulos y flujos (evaluaciones organizacionales y tamizaje clínico). Úsalo para responder dudas de uso o ubicar funcionalidades.
---

# Sistema DEI — conocimiento funcional

Plataforma de evaluación psicológica: React+Vite+MUI (Netlify) + Express+SQLite (Railway, volumen `/app/data/dei.sqlite`).

## Roles

- **ADMIN**: gestiona entidades, usuarios (incl. rol TERAPEUTA con licencia), plantillas de tests, eventos, licencias de eventos, reportes, terapeutas y recursos de crisis.
- **EMPRESA**: crea usuarios USUARIO de su entidad, ve sus eventos y descarga PDF consolidado (activos o inactivos).
- **USUARIO**: ve sus tests asignados por evento/licencia vigente y los responde.
- **TERAPEUTA**: módulo clínico propio (pacientes, tamizaje, firma y sello). Requiere licencia vigente (`therapist_licenses`); sin ella solo consulta historial.

## Módulo de evaluaciones

- Plantillas reutilizables: Personalidad/Temperamento, Burnout (MBI), Clima Laboral (61 ítems, anónimo por códigos CLI-xxxx reclamados atómicamente).
- Eventos: agrupan test + entidad + usuarios asignados + fechas (Guatemala UTC-6). Clima usa códigos con precio por código; otros usan monto fijo.
- Reportes PDF: individual, consolidado (3 modos: resumen/conclusión/detalle) y comparativo (últimos 3 eventos del mismo tipo, solo aparece en el más reciente si hay ≥2).
- IA con Groq (`openai/gpt-oss-120b`, `callGroq` compartido): análisis clínico-organizacional por evento y comparativo. Sin abreviaturas. Regenera en cada descarga.
- Fechas en PDF: `dd/mm/yyyy hh:mm` (24h, Guatemala).

## Módulo terapeuta (tamizaje)

- Admin crea terapeuta en Entidades→Terapeutas (o rol en Usuarios + licencia ahí).
- Terapeuta → Pacientes: ficha del paciente (consentimiento obligatorio), tamizajes PHQ-9/GAD-7/PCL-5/C-SSRS + parámetros básicos. Riesgo y severidad los calcula el código (`utils/screening.js`), nunca la IA. Ítem 9 PHQ-9>0 o C-SSRS positivo → alerta con recursos de crisis configurables.
- Link de un solo uso: el paciente responde sin login en `/tamizaje/:token`; no ve resultados; al enviar, el terapeuta recibe correo (Brevo, `BREVO_API_KEY` xkeysib vía API REST — Railway bloquea SMTP).
- Hipótesis IA validadas contra `dsm_whitelist`; las fuera de lista se descartan.
- PDFs de tamizaje y ficha llevan firma+sello que cada terapeuta sube en Terapeuta→Firma y Sello (quita-fondo + compresión a 280×84, montada sobre el nombre).
- Citas (Terapeuta→Citas): calendario react-big-calendar (mes/semana/día, dayjsLocalizer). Tabla `appointments` (1h fija, categoría PRESENCIAL_MENTAL_Z9/PRESENCIAL_DEI_Z1/VIRTUAL/LLAMADA, status agendada/celebrada/cancelada_paciente/cancelada_terapeuta/anulada) y `therapist_blocks` (tipos: single exacto, daily = rango de fechas + horas repetido cada día, vacation = días completos). Sin traslapes por terapeuta (validación en `overlapConflicts`, therapy.js). Cierre "celebrada" exige 4 textareas (situación actual, desarrollo, plan de trabajo, observaciones); los otros cierres solo observaciones. Adjuntos opcionales al cerrar (máx. 5 de 5 MB) en `appointment_documents` como data_url. La ficha (pantalla y PDF) incluye "Historial de citas" del paciente. Botón "Agenda PDF" en Citas: GET `/therapy/appointments/agenda.pdf?from&to&label` → PDF del rango visible (mes/semana/día) con tabla resumen de citas por estado + total, y listado de citas. Migración `migrate_citas.js`.
- Landing del terapeuta: `/terapeuta/pacientes`.

## Reglas de trabajo

- Migraciones en `backend/src/db/migrate*.js` (idempotentes, corren en `start.js`).
- Verificación: `node --test src/db/templates.test.js` desde `backend`. No correr `seed.js`/`start.js` contra datos reales.
- Producción: push a `main` → redeploy automático Railway+Netlify.
