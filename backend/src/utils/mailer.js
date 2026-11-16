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

const APPT_CATEGORY_LABELS = {
  PRESENCIAL_MENTAL_Z9: 'Presencial — MENTAL Zona 9',
  PRESENCIAL_DEI_Z1: 'Presencial — DEI Zona 1',
  VIRTUAL: 'Virtual',
  LLAMADA: 'Llamada telefónica',
};

// Notificación de cita agendada o cancelada al terapeuta y al paciente (si tiene correo).
// event: 'agendada' | 'cancelada'. statusLabel solo aplica en cancelación.
function sendAppointmentEmail({ event, therapist, patient, appointment, statusLabel }) {
  const cat = APPT_CATEGORY_LABELS[appointment.category] || appointment.category || '—';
  const cuando = `${appointment.starts_at} a ${String(appointment.ends_at || '').slice(11, 16)} (hora de Guatemala)`;
  const esCancel = event === 'cancelada';
  const asunto = esCancel
    ? `Cita ${statusLabel ? statusLabel.toLowerCase() : 'cancelada'} — ${patient.full_name}`
    : `Cita agendada — ${patient.full_name}`;
  const cuerpoPaciente = esCancel
    ? `Le informamos que su cita del ${cuando} con ${therapist.full_name} fue ${statusLabel ? statusLabel.toLowerCase() : 'cancelada'}.`
    : `Se agendó su cita del ${cuando} con ${therapist.full_name}.\nModalidad: ${cat}.`;
  const cuerpoTerapeuta = esCancel
    ? `La cita del ${cuando} con ${patient.full_name} (${patient.code}) fue marcada como "${statusLabel || 'Cancelada'}".\nObservaciones: ${appointment.observaciones || '—'}`
    : `Agendó una cita para el ${cuando} con ${patient.full_name} (${patient.code}).\nModalidad: ${cat}.`;

  const jobs = [sendEmail({
    to: therapist.email,
    subject: `[DEI] ${asunto}`,
    text: [`Estimado/a ${therapist.full_name}:`, '', cuerpoTerapeuta, '', '— Sistema de Evaluación DEI'].join('\n'),
  })];
  if (patient.email) {
    jobs.push(sendEmail({
      to: patient.email,
      subject: `[DEI] ${asunto}`,
      text: [`Estimado/a ${patient.full_name}:`, '', cuerpoPaciente, '', 'Si necesita reprogramar o tiene dudas, comuníquese con su terapeuta.', '', '— Sistema de Evaluación DEI'].join('\n'),
    }));
  }
  return Promise.allSettled(jobs);
}

module.exports = { sendEmail, sendScreeningCompletedEmail, sendAppointmentEmail };
