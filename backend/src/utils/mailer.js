// Envío de correos transaccionales vía SMTP de Brevo.
// Variables de entorno:
//   BREVO_API_KEY     → clave SMTP (xsmtpsib-...)
//   BREVO_SMTP_LOGIN  → login SMTP (cXXXXXXX@smtp-brevo.com)
//   BREVO_SENDER_EMAIL→ remitente verificado en Brevo
//   BREVO_SENDER_NAME → nombre del remitente (opcional)
const nodemailer = require('nodemailer');

function transport() {
  const { BREVO_API_KEY, BREVO_SMTP_LOGIN } = process.env;
  if (!BREVO_API_KEY || !BREVO_SMTP_LOGIN) return null;
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: BREVO_SMTP_LOGIN, pass: BREVO_API_KEY },
    connectionTimeout: 15000,
  });
}

async function sendEmail({ to, subject, text }) {
  const t = transport();
  if (!t || !process.env.BREVO_SENDER_EMAIL) return false;
  try {
    await t.sendMail({
      from: `"${process.env.BREVO_SENDER_NAME || 'Sistema DEI'}" <${process.env.BREVO_SENDER_EMAIL}>`,
      to, subject, text,
    });
    return true;
  } catch (e) {
    console.error('Error enviando correo:', e.message);
    return false;
  }
}

function sendScreeningCompletedEmail({ to, therapistName, patientCode, patientName, screenedAt, riskLevel, screeningId }) {
  const riesgo = riskLevel ? ` Nivel de riesgo detectado: ${riskLevel.toUpperCase()}.` : '';
  return sendEmail({
    to,
    subject: `Tamizaje completado — Paciente ${patientCode}`,
    text: [
      `Estimado/a ${therapistName}:`,
      '',
      `El paciente ${patientName} (${patientCode}) completó el tamizaje que le envió, el ${screenedAt} (hora de Guatemala).`,
      `Registro: tamizaje #${screeningId}.${riesgo}`,
      '',
      'Ingrese al sistema para revisar los resultados y el análisis:',
      'https://dei-app.netlify.app',
      '',
      '— Sistema de Evaluación DEI',
    ].join('\n'),
  });
}

module.exports = { sendEmail, sendScreeningCompletedEmail };
