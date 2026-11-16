// Envío de correos transaccionales vía Brevo.
// - Clave API xkeysib-  → API REST (recomendado; Railway bloquea SMTP saliente)
// - Clave SMTP xsmtpsib- → SMTP con login BREVO_SMTP_LOGIN (solo donde el puerto 587 esté abierto)
// Variables: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME (opcional), BREVO_SMTP_LOGIN (para SMTP)
const nodemailer = require('nodemailer');

async function sendViaRest({ to, subject, text }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Sistema DEI' },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    if (!res.ok) { console.error('Brevo API error:', res.status, (await res.text()).substring(0, 300)); return false; }
    return true;
  } finally {
    clearTimeout(timer);
  }
}

async function sendViaSmtp({ to, subject, text }) {
  const t = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com', port: 587, secure: false,
    auth: { user: process.env.BREVO_SMTP_LOGIN, pass: process.env.BREVO_API_KEY },
    connectionTimeout: 15000,
  });
  await t.sendMail({
    from: `"${process.env.BREVO_SENDER_NAME || 'Sistema DEI'}" <${process.env.BREVO_SENDER_EMAIL}>`,
    to, subject, text,
  });
  return true;
}

async function sendEmail({ to, subject, text }) {
  const key = process.env.BREVO_API_KEY;
  if (!key || !process.env.BREVO_SENDER_EMAIL) return false;
  try {
    if (key.startsWith('xkeysib')) return await sendViaRest({ to, subject, text });
    if (process.env.BREVO_SMTP_LOGIN) return await sendViaSmtp({ to, subject, text });
    return false;
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
