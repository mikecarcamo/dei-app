const { COLORS, drawHeader, drawSection, drawBox } = require('./pdf');
const { INSTRUMENTS } = require('./screening');

const DISCLAIMER = 'Este tamizaje es una herramienta de apoyo y NO constituye un diagnóstico. Requiere evaluación y criterio de un profesional de salud mental.';
const SUPPORT_LABEL = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' };

function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str.replace(' ', 'T')).toLocaleString('es-GT', { dateStyle: 'long', timeStyle: 'short' });
}

function ensureSpace(doc, y, needed = 80) {
  if (y + needed > doc.page.height - 50) { doc.addPage(); return 50; }
  return y;
}

function heading(doc, y, text, color = COLORS.primary) {
  y = ensureSpace(doc, y, 40);
  doc.fontSize(12).font('Helvetica-Bold').fillColor(color).text(text, 40, y);
  return y + 18;
}

function paragraph(doc, y, text, opts = {}) {
  const w = doc.page.width - 80 - (opts.indent || 0);
  doc.fontSize(opts.size || 10).font(opts.font || 'Helvetica');
  const h = doc.heightOfString(text, { width: w });
  y = ensureSpace(doc, y, h + 6);
  doc.fillColor(opts.color || COLORS.text).text(text, 40 + (opts.indent || 0), y, { width: w, align: opts.align || 'left' });
  return y + h + (opts.gap ?? 6);
}

function bulletList(doc, y, label, items) {
  if (!items || items.length === 0) return y;
  y = paragraph(doc, y, label, { font: 'Helvetica-Bold', size: 9, color: COLORS.secondary, gap: 2, indent: 10 });
  for (const it of items) y = paragraph(doc, y, `• ${it}`, { size: 9, indent: 20, gap: 2 });
  return y + 4;
}

function generateScreeningPDF(doc, { screening, patient, therapist, crisisResources }) {
  const results = JSON.parse(screening.results || '[]');
  const params = JSON.parse(screening.params || '{}');
  const ai = screening.ai_result ? JSON.parse(screening.ai_result) : null;
  const reasons = JSON.parse(screening.risk_reasons || '[]');

  let y = drawHeader(doc, 'Tamizaje Clínico', `Paciente ${patient.code}`);
  y = drawSection(doc, y, 'Código de paciente:', patient.code);
  y = drawSection(doc, y, 'Paciente:', patient.full_name);
  y = drawSection(doc, y, 'Terapeuta:', therapist.full_name);
  y = drawSection(doc, y, 'Fecha del tamizaje:', fmtDateTime(screening.screened_at));
  y = drawSection(doc, y, 'No. de tamizaje:', `#${screening.id}`);
  y += 6;
  y = drawBox(doc, y, DISCLAIMER, '#FFFDE7', '#F9A825');

  if (screening.risk_alert) {
    y = ensureSpace(doc, y, 120);
    const text = `ALERTA DE RIESGO (${(screening.risk_level || '').toUpperCase()})\n${reasons.map(r => `• ${r}`).join('\n')}\n\n${crisisResources || ''}`;
    doc.fontSize(10).font('Helvetica-Bold');
    const h = doc.heightOfString(text, { width: doc.page.width - 100 }) + 16;
    doc.rect(40, y, doc.page.width - 80, h).fill('#FFEBEE');
    doc.rect(40, y, 4, h).fill(COLORS.nivelAlto);
    doc.fillColor(COLORS.nivelAlto).text(text, 52, y + 8, { width: doc.page.width - 100 });
    y += h + 12;
  }

  y = heading(doc, y, 'RESULTADOS DE INSTRUMENTOS');
  for (const r of results) {
    y = ensureSpace(doc, y, 30);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(r.name, 40, y, { width: 360 });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.primary)
      .text(r.code === 'CSSRS' ? r.severity : `${r.score}/${r.max} · ${r.severity}`, 400, y, { width: doc.page.width - 440, align: 'right' });
    y += Math.max(16, doc.heightOfString(r.name, { width: 360 }) + 4);
  }
  y += 6;

  const paramRows = [
    ['Motivo de consulta', patient.consultation_reason],
    ['Síntomas físicos', params.sintomas_fisicos],
    ['Síntomas emocionales', params.sintomas_emocionales],
    ['Duración de los síntomas', params.duracion],
    ['Afectación del funcionamiento', params.funcionamiento],
    ['Consumo de sustancias', [params.consumo_sustancias, params.consumo_detalle].filter(Boolean).join(' — ')],
    ['Riesgo suicida reportado', params.riesgo_suicida === 'si' ? 'Sí' : params.riesgo_suicida === 'no' ? 'No' : null],
    ['Riesgo homicida reportado', params.riesgo_homicida === 'si' ? 'Sí' : params.riesgo_homicida === 'no' ? 'No' : null],
    ['Observaciones', params.observaciones],
  ].filter(([, v]) => v);
  if (paramRows.length) {
    y = heading(doc, y, 'PARÁMETROS DE LA EVALUACIÓN');
    for (const [k, v] of paramRows) y = paragraph(doc, y, `${k}: ${v}`, { size: 9.5, gap: 3 });
    y += 6;
  }

  y = heading(doc, y, 'CONCLUSIÓN Y PANORAMA INICIAL (IA)');
  if (!ai) {
    y = paragraph(doc, y, 'El análisis de IA no está disponible para este tamizaje.', { font: 'Helvetica-Oblique', color: COLORS.muted });
  } else {
    if (ai.resumen) y = paragraph(doc, y, ai.resumen, { align: 'justify' });
    if (ai.conclusion) y = paragraph(doc, y, ai.conclusion, { align: 'justify', font: 'Helvetica-Bold' });

    y = heading(doc, y + 4, 'HIPÓTESIS PARA REVISIÓN PROFESIONAL');
    if (!ai.hipotesis || ai.hipotesis.length === 0) {
      y = paragraph(doc, y, 'No se sugieren hipótesis diagnósticas con la información disponible.', { font: 'Helvetica-Oblique' });
    }
    for (const h of ai.hipotesis || []) {
      y = ensureSpace(doc, y, 60);
      y = paragraph(doc, y, `${h.codigo_cie10} — ${h.nombre} (nivel de apoyo: ${SUPPORT_LABEL[h.nivel_de_apoyo] || h.nivel_de_apoyo})`, { font: 'Helvetica-Bold', color: COLORS.primary, gap: 3 });
      y = bulletList(doc, y, 'Criterios que se cumplen:', h.criterios_que_se_cumplen);
      y = bulletList(doc, y, 'Criterios que faltan:', h.criterios_que_faltan);
      y = bulletList(doc, y, 'Diagnósticos diferenciales:', h.diagnosticos_diferenciales);
      y = bulletList(doc, y, 'Preguntas sugeridas para aclarar:', h.preguntas_sugeridas_para_aclarar);
    }
    if (ai.recomendaciones?.length) {
      y = heading(doc, y + 4, 'RECOMENDACIONES');
      ai.recomendaciones.forEach((r, i) => { y = paragraph(doc, y, `${i + 1}. ${r}`, { gap: 3 }); });
    }
    if (ai.limitaciones) {
      y = heading(doc, y + 4, 'LIMITACIONES');
      y = paragraph(doc, y, ai.limitaciones, { align: 'justify' });
    }
  }

  if (screening.notes) {
    y = heading(doc, y + 4, 'NOTAS DEL PROFESIONAL');
    y = paragraph(doc, y, screening.notes, { align: 'justify' });
  }

  // Detalle de respuestas
  doc.addPage();
  y = 50;
  y = heading(doc, y, 'DETALLE DE RESPUESTAS');
  for (const r of results) {
    const inst = INSTRUMENTS[r.code];
    if (!inst) continue;
    y = heading(doc, y + 4, inst.name, COLORS.secondary);
    inst.questions.forEach((q, i) => {
      const label = inst.scale.find(s => s.value === r.answers[i])?.label || '—';
      doc.fontSize(9).font('Helvetica');
      const h = Math.max(14, doc.heightOfString(q, { width: 360 }) + 4);
      y = ensureSpace(doc, y, h);
      doc.fillColor(COLORS.secondary).font('Helvetica-Bold').text(`${i + 1}.`, 40, y, { width: 20 });
      doc.fillColor(COLORS.text).font('Helvetica').text(q, 60, y, { width: 360 });
      doc.fillColor(COLORS.primary).font('Helvetica-Bold').text(`${r.answers[i]} — ${label}`, 430, y, { width: doc.page.width - 470 });
      y += h;
    });
  }

  // Firma del terapeuta
  y = ensureSpace(doc, y + 30, 80);
  const lineW = 220;
  const x = (doc.page.width - lineW) / 2;
  doc.moveTo(x, y + 40).lineTo(x + lineW, y + 40).strokeColor(COLORS.secondary).stroke();
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(therapist.full_name, x, y + 46, { width: lineW, align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted).text('Firma y sello del profesional', x, y + 60, { width: lineW, align: 'center' });
}

module.exports = { generateScreeningPDF, DISCLAIMER };
