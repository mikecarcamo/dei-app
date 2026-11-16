// Envío de correos transaccionales vía API de Brevo.
// Variables de entorno: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME (opcional).
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !process.env.BREVO_SENDER_EMAIL) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Sistema DEI' },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });
    if (!res.ok) {
      console.error('Brevo API error:', res.status, (await res.text()).substring(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error('Error enviando correo:', e.message);
    return false;
  } finally {
    clearTimeout(timer);
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
