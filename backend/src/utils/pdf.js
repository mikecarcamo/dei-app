const PDFDocument = require('pdfkit');
const path = require('path');
const { TEMPERAMENT_LABELS } = require('./scoring');

const FIRMA_PATH = path.join(__dirname, 'FIRMASELLOMICH.png');
const LOGO_PATH = path.join(__dirname, 'Logo.png');

function drawWatermark(doc) {
  const w = 300;
  const h = 300;
  const x = (doc.page.width - w) / 2;
  const y = (doc.page.height - h) / 2;
  doc.save();
  doc.opacity(0.06);
  doc.image(LOGO_PATH, x, y, { fit: [w, h], align: 'center', valign: 'center' });
  doc.restore();
}

const COLORS = {
  primary: '#1565C0',
  secondary: '#424242',
  accent: '#E3F2FD',
  border: '#BBDEFB',
  text: '#212121',
  muted: '#757575',
  warning: '#FF6F00',
  success: '#2E7D32',
  white: '#FFFFFF',
  burnout: '#BF360C',
  burnoutAccent: '#FBE9E7',
  burnoutBorder: '#FFCCBC',
  nivelBajo: '#2E7D32',
  nivelMedio: '#FF6F00',
  nivelAlto: '#C62828',
};

const FOOTER_TEXT = 'Este resultado es orientativo y no constituye diagnóstico psicológico clínico.';

function drawFooter(doc) {
  doc.save();
  const y = doc.page.height - 22;
  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor(COLORS.warning)
    .text(FOOTER_TEXT, 40, y, { align: 'center', width: doc.page.width - 80, lineBreak: false });
  doc.restore();
}

function addPageFooters(doc) {
  // no-op: footers se aplican con applyFootersToAllPages al final
}

function drawDisclaimer(doc, y) {
  return drawBox(doc, y, FOOTER_TEXT, '#FFFDE7', '#F9A825');
}

function drawSignature(doc, y) {
  const maxW = 180;
  const x = (doc.page.width - maxW) / 2;
  doc.image(FIRMA_PATH, x, y, { fit: [maxW, 120] });
  return y + 130;
}

function appendDisclaimer(doc) {
  doc.flushPages();
  doc.moveDown(2);
  doc.fontSize(8).font('Helvetica-Oblique').fillColor(COLORS.warning)
    .text(FOOTER_TEXT, 40, null, { align: 'center', width: doc.page.width - 80 });
}

function drawHeader(doc, title, subtitle) {
  doc.rect(0, 0, doc.page.width, 90).fill(COLORS.primary);
  doc.fillColor(COLORS.white).fontSize(22).font('Helvetica-Bold').text(title, 40, 25, { align: 'center' });
  if (subtitle) {
    doc.fontSize(11).font('Helvetica').text(subtitle, 40, 55, { align: 'center', width: doc.page.width - 80 });
  }
  doc.fillColor(COLORS.text);
  return 110;
}

function drawSection(doc, y, label, value, labelWidth = 140) {
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.secondary).text(label, 40, y, { width: labelWidth });
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(value || '—', 40 + labelWidth, y, { width: doc.page.width - 80 - labelWidth });
  return y + 18;
}

function drawBox(doc, y, content, bgColor = COLORS.accent, borderColor = COLORS.border) {
  const boxWidth = doc.page.width - 80;
  const textHeight = doc.heightOfString(content, { width: boxWidth - 20, fontSize: 10 });
  const boxHeight = textHeight + 24;
  doc.rect(40, y, boxWidth, boxHeight).fill(bgColor).stroke(borderColor);
  doc.fillColor(COLORS.text).fontSize(10).font('Helvetica').text(content, 50, y + 12, { width: boxWidth - 20 });
  return y + boxHeight + 10;
}

function drawScoreBar(doc, y, label, score, total, color) {
  const maxWidth = 200;
  const pct = total > 0 ? (score / total) * 100 : 0;
  const barWidth = (pct / 100) * maxWidth;

  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(label, 40, y, { width: 110 });
  doc.rect(155, y + 2, maxWidth, 12).fill('#E0E0E0');
  if (barWidth > 0) doc.rect(155, y + 2, barWidth, 12).fill(color);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(`${score} (${pct.toFixed(1)}%)`, 365, y);
  return y + 20;
}

function drawBurnoutBar(doc, y, label, score, max, nivel, invertColors = false) {
  const maxWidth = 200;
  const pct = max > 0 ? (score / max) * 100 : 0;
  const barWidth = (pct / 100) * maxWidth;
  let nivelColor;
  if (invertColors) {
    nivelColor = nivel === 'BAJO' ? COLORS.nivelAlto : nivel === 'MEDIO' ? COLORS.nivelMedio : COLORS.nivelBajo;
  } else {
    nivelColor = nivel === 'ALTO' ? COLORS.nivelAlto : nivel === 'MEDIO' ? COLORS.nivelMedio : COLORS.nivelBajo;
  }
  const nivelLabel = nivel === 'ALTO' ? 'ALTO' : nivel === 'MEDIO' ? 'MEDIO' : 'BAJO';

  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(label, 40, y, { width: 140 });
  doc.rect(185, y + 2, maxWidth, 12).fill('#E0E0E0');
  if (barWidth > 0) doc.rect(185, y + 2, barWidth, 12).fill(nivelColor);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(nivelColor).text(`${score}/${max}  ${nivelLabel}`, 395, y);
  return y + 22;
}

function generateBurnoutPDF(doc, response, event) {
  const entityName = event.entity_name || '—';
  const submittedStr = response.submitted_at ? response.submitted_at.replace(' ', 'T') : null;
  const submittedAt = submittedStr ? new Date(submittedStr).toLocaleString('es-GT', { dateStyle: 'long', timeStyle: 'short' }) : '—';

  doc.rect(0, 0, doc.page.width, 90).fill(COLORS.burnout);
  doc.fillColor(COLORS.white).fontSize(20).font('Helvetica-Bold').text('Cuestionario Burnout (MBI) - Resultado Individual', 40, 22, { align: 'center' });
  doc.fontSize(11).font('Helvetica').text('Sistema de Evaluación DEI', 40, 56, { align: 'center', width: doc.page.width - 80 });
  doc.fillColor(COLORS.text);
  let y = 110;

  doc.rect(40, y, doc.page.width - 80, 1).fill(COLORS.burnoutBorder);
  y += 15;

  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.burnout).text('DATOS DEL PARTICIPANTE', 40, y);
  y += 20;
  y = drawSection(doc, y, 'Nombre completo:', response.participant_full_name);
  y = drawSection(doc, y, 'Entidad:', entityName);
  y = drawSection(doc, y, 'Evento:', event.name);
  y = drawSection(doc, y, 'Test:', event.test_name);
  y = drawSection(doc, y, 'Fecha de llenado:', submittedAt);

  y += 10;
  doc.rect(40, y, doc.page.width - 80, 1).fill(COLORS.burnoutBorder);
  y += 15;

  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.burnout).text('RESULTADOS POR DIMENSIÓN (MBI)', 40, y);
  y += 20;

  y = drawBurnoutBar(doc, y, 'Cansancio Emocional:', response.burnout_ce ?? 0, 54, response.burnout_ce_nivel || 'BAJO');
  y = drawBurnoutBar(doc, y, 'Despersonalización:', response.burnout_dp ?? 0, 30, response.burnout_dp_nivel || 'BAJO');
  y = drawBurnoutBar(doc, y, 'Realización Personal:', response.burnout_rp ?? 0, 48, response.burnout_rp_nivel || 'BAJO', true);

  y += 8;
  doc.rect(40, y, doc.page.width - 80, 1).fill(COLORS.burnoutBorder);
  y += 12;

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
    .text('Nota: En Cansancio Emocional y Despersonalización, puntuaciones ALTAS indican Burnout. En Realización Personal, puntuaciones BAJAS indican Burnout.', 40, y, { width: doc.page.width - 80 });
  y += 30;

  doc.rect(40, y, doc.page.width - 80, 1).fill(COLORS.burnoutBorder);
  y += 15;

  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.burnout).text('DIAGNÓSTICO', 40, y);
  y += 15;
  y = drawBox(doc, y, response.burnout_diagnostico || response.conclusion || '—', COLORS.burnoutAccent, COLORS.burnoutBorder);

  y += 10;
  y = drawDisclaimer(doc, y);
  drawSignature(doc, y);
}

function generateIndividualPDF(doc, response, event, answers) {
  if (event.test_type === 'BURNOUT') {
    return generateBurnoutPDF(doc, response, event);
  }

  const entityName = event.entity_name || '—';
  const submittedStr = response.submitted_at ? response.submitted_at.replace(' ', 'T') : null;
  const submittedAt = submittedStr ? new Date(submittedStr).toLocaleString('es-GT', { dateStyle: 'long', timeStyle: 'short' }) : '—';

  let y = drawHeader(doc, 'Test de Personalidad - Resultado Individual', 'Sistema de Evaluación DEI');

  doc.rect(40, y, doc.page.width - 80, 1).fill(COLORS.border);
  y += 15;

  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.primary).text('DATOS DEL PARTICIPANTE', 40, y);
  y += 20;

  y = drawSection(doc, y, 'Nombre completo:', response.participant_full_name);
  y = drawSection(doc, y, 'Entidad:', entityName);
  y = drawSection(doc, y, 'Evento:', event.name);
  y = drawSection(doc, y, 'Test:', event.test_name);
  y = drawSection(doc, y, 'Fecha de llenado:', submittedAt);

  y += 10;
  doc.rect(40, y, doc.page.width - 80, 1).fill(COLORS.border);
  y += 15;

  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.primary).text('RESULTADOS', 40, y);
  y += 20;

  const total = response.score_a + response.score_b + response.score_c + response.score_d;
  y = drawScoreBar(doc, y, 'Sanguíneo (A):', response.score_a, total, '#42A5F5');
  y = drawScoreBar(doc, y, 'Colérico (B):', response.score_b, total, '#EF5350');
  y = drawScoreBar(doc, y, 'Melancólico (C):', response.score_c, total, '#7E57C2');
  y = drawScoreBar(doc, y, 'Flemático (D):', response.score_d, total, '#66BB6A');

  y += 10;
  const dominantLabel = response.dominant_temperament || '—';
  const secLabel = response.secondary_temperament ? TEMPERAMENT_LABELS[response.secondary_temperament] || response.secondary_temperament : '—';

  doc.rect(40, y, doc.page.width - 80, 54).fill(COLORS.accent).stroke(COLORS.border);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary).text('Temperamento Dominante:', 55, y + 8);
  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.success).text(dominantLabel.includes('SANGUINEO') ? 'Sanguíneo' : dominantLabel.includes('COLERICO') ? 'Colérico' : dominantLabel.includes('MELANCOLICO') ? 'Melancólico' : dominantLabel.includes('FLEMATICO') ? 'Flemático' : dominantLabel, 250, y + 6);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.secondary).text('Temperamento Secundario:', 55, y + 30);
  doc.fontSize(11).font('Helvetica').fillColor(COLORS.text).text(secLabel.includes('SANGUINEO') ? 'Sanguíneo' : secLabel.includes('COLERICO') ? 'Colérico' : secLabel.includes('MELANCOLICO') ? 'Melancólico' : secLabel.includes('FLEMATICO') ? 'Flemático' : secLabel, 250, y + 30);
  y += 64;

  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.primary).text('CONCLUSIÓN', 40, y);
  y += 15;
  y = drawBox(doc, y, response.conclusion || '—');

  y = drawDisclaimer(doc, y + 10);
  drawSignature(doc, y);

  if (answers && answers.length > 0) {
    doc.addPage();
    let ay = drawHeader(doc, 'Detalle de Respuestas', response.participant_full_name);
    ay += 10;

    let section = '';
    for (const ans of answers) {
      if (ans.section !== section) {
        section = ans.section;
        doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.primary).text(
          section === 'FORTALEZAS' ? 'Fortalezas (Preguntas 1-20)' : 'Debilidades (Preguntas 21-40)', 40, ay
        );
        ay += 18;
      }

      if (ay > doc.page.height - 80) { doc.addPage(); ay = 50; }

      const bg = ans.number % 2 === 0 ? '#FAFAFA' : COLORS.white;
      doc.rect(40, ay - 2, doc.page.width - 80, 28).fill(bg);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.secondary).text(`${ans.number}.`, 42, ay + 2, { width: 20 });
      const optionsText = ans.options_summary || ans.question_text;
      doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(optionsText, 62, ay + 2, { width: 320 });
      const chosenText = ans.option_text || ans.selected_letter || '—';
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.primary).text(chosenText, 390, ay + 2, { width: 160 });
      ay += 30;
    }
  }

}

function drawEventDataSection(doc, y, event, responses, headerColor) {
  const generatedAt = new Date().toLocaleString('es-GT', { dateStyle: 'long', timeStyle: 'short' });
  doc.fontSize(13).font('Helvetica-Bold').fillColor(headerColor).text('DATOS DEL EVENTO', 40, y);
  y += 20;
  y = drawSection(doc, y, 'Evento:', event.name);
  y = drawSection(doc, y, 'Entidad:', event.entity_name || '—');
  y = drawSection(doc, y, 'Test:', event.test_name || '—');
  y = drawSection(doc, y, 'Período:', `${event.start_date} al ${event.end_date}`);
  y = drawSection(doc, y, 'Total de formularios:', String(responses.length));
  y = drawSection(doc, y, 'Fecha de generación:', generatedAt);
  y += 10;
  doc.rect(40, y, doc.page.width - 80, 1).fill(headerColor === COLORS.burnout ? COLORS.burnoutBorder : COLORS.border);
  y += 15;
  return y;
}

function formatFecha(str) {
  if (!str) return '—';
  const s = str.replace(' ', 'T');
  return new Date(s).toLocaleDateString('es-GT');
}

function drawAnswersDetail(doc, ay, answers) {
  let section = '';
  for (const ans of answers) {
    if (ans.section !== section) {
      section = ans.section;
      if (ay > doc.page.height - 100) { doc.addPage(); ay = 50; }
      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary).text(
        section === 'FORTALEZAS' ? 'Fortalezas (Preguntas 1-20)' : 'Debilidades (Preguntas 21-40)', 40, ay
      );
      ay += 18;
    }
    if (ay > doc.page.height - 80) { doc.addPage(); ay = 50; }
    const bg = ans.number % 2 === 0 ? '#FAFAFA' : COLORS.white;
    doc.rect(40, ay - 2, doc.page.width - 80, 28).fill(bg);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.secondary).text(`${ans.number}.`, 42, ay + 2, { width: 20 });
    const optionsText = ans.options_summary || ans.question_text;
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(optionsText, 62, ay + 2, { width: 320 });
    const chosenText = ans.option_text || ans.selected_letter || '—';
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.primary).text(chosenText, 390, ay + 2, { width: 160 });
    ay += 30;
  }
  return ay;
}

function generateConsolidatedPDF(doc, event, responses, includeDetail = false, includeAnswers = false) {
  const isBurnout = event.test_type === 'BURNOUT';

  if (isBurnout) {
    doc.rect(0, 0, doc.page.width, 90).fill(COLORS.burnout);
    doc.fillColor(COLORS.white).fontSize(20).font('Helvetica-Bold')
      .text('Reporte Consolidado - Burnout (MBI)', 40, 22, { align: 'center' });
    doc.fontSize(11).font('Helvetica')
      .text(event.name, 40, 56, { align: 'center', width: doc.page.width - 80 });
    doc.fillColor(COLORS.text);
    let y = 110;

    y = drawEventDataSection(doc, y, event, responses, COLORS.burnout);

    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.burnout).text('RESUMEN ESTADÍSTICO', 40, y);
    y += 20;

    const total = responses.length || 1;
    const nivelCount = (dim, nivel) => responses.filter(r => r[`burnout_${dim}_nivel`] === nivel).length;

    const subsecalas = [
      { label: 'CE Alto (riesgo)', count: nivelCount('ce', 'ALTO'), color: COLORS.nivelAlto },
      { label: 'CE Medio', count: nivelCount('ce', 'MEDIO'), color: COLORS.nivelMedio },
      { label: 'CE Bajo', count: nivelCount('ce', 'BAJO'), color: COLORS.nivelBajo },
      { label: 'DP Alto (riesgo)', count: nivelCount('dp', 'ALTO'), color: COLORS.nivelAlto },
      { label: 'DP Medio', count: nivelCount('dp', 'MEDIO'), color: COLORS.nivelMedio },
      { label: 'DP Bajo', count: nivelCount('dp', 'BAJO'), color: COLORS.nivelBajo },
      { label: 'RP Bajo (riesgo)', count: nivelCount('rp', 'BAJO'), color: COLORS.nivelAlto },
      { label: 'RP Medio', count: nivelCount('rp', 'MEDIO'), color: COLORS.nivelMedio },
      { label: 'RP Alto', count: nivelCount('rp', 'ALTO'), color: COLORS.nivelBajo },
    ];

    for (const s of subsecalas) {
      y = drawScoreBar(doc, y, s.label + ':', s.count, total, s.color);
    }

    y += 10;
    doc.rect(40, y, doc.page.width - 80, 1).fill(COLORS.burnoutBorder);
    y += 15;

    doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.burnout).text('LISTADO DE PARTICIPANTES', 40, y);
    y += 20;

    const colW = [25, 160, 65, 65, 65, 65, 65, 50];
    const colX = [40, 65, 225, 290, 355, 420, 485, 535];
    const hdrs = ['#', 'Nombre', 'CE', 'CE Niv.', 'DP', 'DP Niv.', 'RP Niv.', 'Fecha'];

    doc.rect(40, y, doc.page.width - 80, 20).fill(COLORS.burnout);
    doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold');
    hdrs.forEach((h, i) => doc.text(h, colX[i], y + 5, { width: colW[i] }));
    y += 22;

    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
      const bg = i % 2 === 0 ? COLORS.burnoutAccent : COLORS.white;
      doc.rect(40, y, doc.page.width - 80, 18).fill(bg);
      doc.fillColor(COLORS.text).fontSize(8).font('Helvetica');
      const nivelColor = (n, risk) => n === risk ? COLORS.nivelAlto : n === 'MEDIO' ? COLORS.nivelMedio : COLORS.nivelBajo;
      doc.text(String(i + 1), colX[0], y + 4, { width: colW[0] });
      doc.text(r.participant_full_name || '—', colX[1], y + 4, { width: colW[1] });
      doc.text(String(r.burnout_ce ?? '—'), colX[2], y + 4, { width: colW[2] });
      doc.fillColor(nivelColor(r.burnout_ce_nivel, 'ALTO')).font('Helvetica-Bold')
        .text(r.burnout_ce_nivel || '—', colX[3], y + 4, { width: colW[3] });
      doc.fillColor(COLORS.text).font('Helvetica')
        .text(String(r.burnout_dp ?? '—'), colX[4], y + 4, { width: colW[4] });
      doc.fillColor(nivelColor(r.burnout_dp_nivel, 'ALTO')).font('Helvetica-Bold')
        .text(r.burnout_dp_nivel || '—', colX[5], y + 4, { width: colW[5] });
      doc.fillColor(nivelColor(r.burnout_rp_nivel, 'BAJO')).font('Helvetica-Bold')
        .text(r.burnout_rp_nivel || '—', colX[6], y + 4, { width: colW[6] });
      doc.fillColor(COLORS.text).font('Helvetica')
        .text(formatFecha(r.submitted_at), colX[7], y + 4, { width: colW[7] });
      y += 20;
    }

    if (includeDetail && responses.length > 0) {
      for (const r of responses) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, 90).fill(COLORS.burnout);
        doc.fillColor(COLORS.white).fontSize(18).font('Helvetica-Bold')
          .text(r.participant_full_name, 40, 25, { align: 'center' });
        doc.fontSize(10).font('Helvetica')
          .text(event.name, 40, 56, { align: 'center', width: doc.page.width - 80 });
        doc.fillColor(COLORS.text);
        let dy = 110;
        const fechaLlenadoB = r.submitted_at ? new Date(r.submitted_at.replace(' ', 'T')).toLocaleString('es-GT', { dateStyle: 'long', timeStyle: 'short' }) : '—';
        dy = drawSection(doc, dy, 'Fecha de llenado:', fechaLlenadoB);
        dy += 5;
        dy = drawBurnoutBar(doc, dy, 'Cansancio Emocional:', r.burnout_ce ?? 0, 54, r.burnout_ce_nivel || 'BAJO');
        dy = drawBurnoutBar(doc, dy, 'Despersonalización:', r.burnout_dp ?? 0, 30, r.burnout_dp_nivel || 'BAJO');
        dy = drawBurnoutBar(doc, dy, 'Realización Personal:', r.burnout_rp ?? 0, 48, r.burnout_rp_nivel || 'BAJO', true);
        dy += 10;
        doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.burnout).text('Diagnóstico:', 40, dy);
        dy += 15;
        dy = drawBox(doc, dy, r.burnout_diagnostico || r.conclusion || '—', COLORS.burnoutAccent, COLORS.burnoutBorder);
        dy += 10;
        dy = drawDisclaimer(doc, dy);
        drawSignature(doc, dy);
      }
    }

    return;
  }

  // --- TEMPERAMENTO ---
  let y = drawHeader(doc, 'Reporte Consolidado por Evento', event.name);
  y = drawEventDataSection(doc, y, event, responses, COLORS.primary);

  const tempCounts = { SANGUINEO: 0, COLERICO: 0, MELANCOLICO: 0, FLEMATICO: 0, EMPATE: 0 };
  for (const r of responses) {
    const d = r.dominant_temperament || '';
    if (d.includes('SANGUINEO') && !d.includes('/')) tempCounts.SANGUINEO++;
    else if (d.includes('COLERICO') && !d.includes('/')) tempCounts.COLERICO++;
    else if (d.includes('MELANCOLICO') && !d.includes('/')) tempCounts.MELANCOLICO++;
    else if (d.includes('FLEMATICO') && !d.includes('/')) tempCounts.FLEMATICO++;
    else tempCounts.EMPATE++;
  }

  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.primary).text('RESUMEN ESTADÍSTICO', 40, y);
  y += 20;
  const total = responses.length || 1;
  y = drawScoreBar(doc, y, 'Sanguíneo:', tempCounts.SANGUINEO, total, '#42A5F5');
  y = drawScoreBar(doc, y, 'Colérico:', tempCounts.COLERICO, total, '#EF5350');
  y = drawScoreBar(doc, y, 'Melancólico:', tempCounts.MELANCOLICO, total, '#7E57C2');
  y = drawScoreBar(doc, y, 'Flemático:', tempCounts.FLEMATICO, total, '#66BB6A');
  if (tempCounts.EMPATE > 0) y = drawScoreBar(doc, y, 'Empate:', tempCounts.EMPATE, total, '#FFA726');

  y += 10;
  doc.rect(40, y, doc.page.width - 80, 1).fill(COLORS.border);
  y += 15;

  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.primary).text('LISTADO DE PARTICIPANTES', 40, y);
  y += 20;

  const colWidths = [30, 180, 130, 130, 60];
  const headers = ['#', 'Nombre Completo', 'Temperamento Dominante', 'Temperamento Secundario', 'Fecha'];
  const cols = [40, 70, 250, 380, 510];

  doc.rect(40, y, doc.page.width - 80, 20).fill(COLORS.primary);
  doc.fillColor(COLORS.white).fontSize(9).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, cols[i], y + 5, { width: colWidths[i] }));
  y += 22;

  for (let i = 0; i < responses.length; i++) {
    const r = responses[i];
    if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
    const bg = i % 2 === 0 ? COLORS.accent : COLORS.white;
    doc.rect(40, y, doc.page.width - 80, 18).fill(bg);
    doc.fillColor(COLORS.text).fontSize(8).font('Helvetica');
    const domLabel = (r.dominant_temperament || '—').replace('SANGUINEO', 'Sanguíneo').replace('COLERICO', 'Colérico').replace('MELANCOLICO', 'Melancólico').replace('FLEMATICO', 'Flemático');
    const secLabel = (r.secondary_temperament || '—').replace('SANGUINEO', 'Sanguíneo').replace('COLERICO', 'Colérico').replace('MELANCOLICO', 'Melancólico').replace('FLEMATICO', 'Flemático');
    doc.text(String(i + 1), cols[0], y + 4, { width: colWidths[0] });
    doc.text(r.participant_full_name, cols[1], y + 4, { width: colWidths[1] });
    doc.text(domLabel, cols[2], y + 4, { width: colWidths[2] });
    doc.text(secLabel, cols[3], y + 4, { width: colWidths[3] });
    doc.text(formatFecha(r.submitted_at), cols[4], y + 4, { width: colWidths[4] });
    y += 20;
  }

  if (includeDetail && responses.length > 0) {
    for (const r of responses) {
      doc.addPage();
      let dy = drawHeader(doc, r.participant_full_name, event.name);
      dy += 5;
      const fechaLlenado = r.submitted_at ? new Date(r.submitted_at.replace(' ', 'T')).toLocaleString('es-GT', { dateStyle: 'long', timeStyle: 'short' }) : '—';
      dy = drawSection(doc, dy, 'Fecha de llenado:', fechaLlenado);
      dy = drawSection(doc, dy, 'Temperamento Dom.:', (r.dominant_temperament || '').replace('SANGUINEO', 'Sanguíneo').replace('COLERICO', 'Colérico').replace('MELANCOLICO', 'Melancólico').replace('FLEMATICO', 'Flemático'));
      dy = drawSection(doc, dy, 'Temperamento Sec.:', (r.secondary_temperament || '').replace('SANGUINEO', 'Sanguíneo').replace('COLERICO', 'Colérico').replace('MELANCOLICO', 'Melancólico').replace('FLEMATICO', 'Flemático'));
      dy += 5;
      doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary).text('Conclusión:', 40, dy);
      dy += 15;
      dy = drawBox(doc, dy, r.conclusion || '—');
      dy += 10;
      dy = drawDisclaimer(doc, dy);
      drawSignature(doc, dy);

      if (includeAnswers && r.answers && r.answers.length > 0) {
        doc.addPage();
        let ay = drawHeader(doc, 'Detalle de Respuestas', r.participant_full_name);
        ay += 10;
        drawAnswersDetail(doc, ay, r.answers);
      }
    }
  }

}

module.exports = { generateIndividualPDF, generateConsolidatedPDF, appendDisclaimer, drawWatermark };
