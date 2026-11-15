const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const db = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { generateIndividualPDF, generateConsolidatedPDF, generateClimaConsolidatedPDF, generateClimaIndividualPDF, generateComparativePDF, appendDisclaimer, drawWatermark } = require('../utils/pdf');
const { generateClimaAnalysis, generateClinicalAnalysis, generateComparativeAnalysis, TEMP_LABELS } = require('../utils/ai');

function createDoc() {
  const doc = new PDFDocument({ margin: 40, size: 'LETTER', bufferPages: true });
  drawWatermark(doc);
  doc.on('pageAdded', () => drawWatermark(doc));
  return doc;
}

function addPageNumbers(doc, darkPageIndexes) {
  const total = doc.bufferedPageRange().count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    const label = `${i + 1}/${total}`;
    const pageW = doc.page.width;
    doc.save();
    doc.font('Helvetica-Bold').fontSize(9);
    const textW = doc.widthOfString(label);
    const x = pageW - 44 - textW;
    const y = 8;
    // Fondo negro semitransparente siempre visible
    doc.fillOpacity(0.45).fillColor('#000000')
      .roundedRect(x - 3, y - 2, textW + 6, 15, 2).fill();
    // Texto blanco encima
    doc.fillOpacity(1).fillColor('#FFFFFF')
      .font('Helvetica-Bold').fontSize(9)
      .text(label, x, y, { lineBreak: false });
    doc.restore();
  }
  doc.flushPages();
}

router.get('/individual/:responseId', verifyToken, (req, res) => {
  const response = db.prepare(`SELECT * FROM responses WHERE id = ?`).get(req.params.responseId);
  if (!response) return res.status(404).json({ message: 'Respuesta no encontrada' });

  if (req.user.role !== 'ADMIN') {
    const event = db.prepare(`SELECT entity_id FROM events WHERE id = ?`).get(response.event_id);
    const assignedToEvent = db.prepare(`SELECT id FROM event_users WHERE event_id = ? AND user_id = ?`).get(response.event_id, req.user.id);
    if (!event || (event.entity_id !== req.user.entity_id && !assignedToEvent)) {
      return res.status(403).json({ message: 'Sin acceso' });
    }
  }

  const event = db.prepare(`
    SELECT ev.*, e.name as entity_name, t.name as test_name, t.test_type
    FROM events ev
    JOIN entities e ON ev.entity_id = e.id
    JOIN tests t ON ev.test_id = t.id
    WHERE ev.id = ?
  `).get(response.event_id);

  const rawAnswers = db.prepare(`
    SELECT ra.*, q.number, q.text as question_text, q.section,
           o.text as option_text, o.temperament
    FROM response_answers ra
    JOIN questions q ON ra.question_id = q.id
    LEFT JOIN options o ON ra.selected_option_id = o.id
    WHERE ra.response_id = ?
    ORDER BY q.number
  `).all(response.id);

  const answers = rawAnswers.map(ans => {
    const opts = db.prepare(`SELECT letter, text FROM options WHERE question_id = ? ORDER BY letter`).all(ans.question_id);
    const summary = opts.map(o => `${o.letter.toUpperCase()}) ${o.text}`).join('   ');
    return { ...ans, options_summary: summary };
  });

  const doc = createDoc();
  const safeName = (response.participant_full_name || 'resultado').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  const viewMode = req.query.view === 'true';
  res.setHeader('Content-Disposition', `${viewMode ? 'inline' : 'attachment'}; filename="resultado_${safeName}.pdf"`);
  doc.pipe(res);
  if (event.test_type === 'CLIMA') {
    generateClimaIndividualPDF(doc, response, event, answers);
  } else {
    generateIndividualPDF(doc, response, event, answers);
  }
  appendDisclaimer(doc);
  addPageNumbers(doc, doc._darkPages);
  doc.end();
});

router.get('/consolidated/:eventId', verifyToken, async (req, res) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EMPRESA') {
    return res.status(403).json({ message: 'Sin acceso' });
  }

  const event = db.prepare(`
    SELECT ev.*, e.name as entity_name, t.name as test_name, t.test_type
    FROM events ev
    JOIN entities e ON ev.entity_id = e.id
    JOIN tests t ON ev.test_id = t.id
    WHERE ev.id = ?
  `).get(req.params.eventId);

  if (!event) return res.status(404).json({ message: 'Evento no encontrado' });

  if (req.user.role === 'EMPRESA' && event.entity_id !== req.user.entity_id) {
    return res.status(403).json({ message: 'Sin acceso a este evento' });
  }

  const responses = db.prepare(`
    SELECT * FROM responses WHERE event_id = ? AND annulled = 0 ORDER BY participant_full_name COLLATE NOCASE ASC
  `).all(req.params.eventId);

  if (event.test_type === 'CLIMA') {
    const questions = db.prepare(`SELECT id, number, section, text, is_external FROM questions WHERE test_id = ? AND active = 1 ORDER BY number`).all(event.test_id);
    const indicatorStats = questions.map(q => {
      const avg = db.prepare(`
        SELECT AVG(ra.numeric_value) AS m FROM response_answers ra
        JOIN responses r ON ra.response_id = r.id
        WHERE r.event_id = ? AND r.annulled = 0 AND ra.question_id = ?
      `).get(req.params.eventId, q.id).m || 0;
      return { number: q.number, section: q.section, text: q.text, is_external: q.is_external, pct: (avg / 5) * 100 };
    });
    const sections = [...new Set(indicatorStats.map(s => s.section))];
    const factorStats = sections.map(sec => {
      const items = indicatorStats.filter(s => s.section === sec);
      return { section: sec, pct: items.reduce((a, b) => a + b.pct, 0) / items.length };
    });

    let aiAnalysis = null;
    if (responses.length > 0) {
      aiAnalysis = await generateClimaAnalysis(event, factorStats, indicatorStats, responses.length);
      if (aiAnalysis) {
        db.prepare(`UPDATE events SET ai_analysis = ? WHERE id = ?`).run(aiAnalysis, event.id);
      }
    }

    const detailParam = req.query.detail;
    const includeAnswers = detailParam === 'full';
    let responsesWithAnswers = responses;
    if (includeAnswers) {
      responsesWithAnswers = responses.map(r => {
        const answers = db.prepare(`
          SELECT ra.numeric_value, q.number, q.text as question_text, q.section
          FROM response_answers ra
          JOIN questions q ON ra.question_id = q.id
          WHERE ra.response_id = ?
          ORDER BY q.number
        `).all(r.id);
        return { ...r, answers };
      });
    }

    const doc = createDoc();
    const safeName = (event.name || 'evento').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    const viewMode = req.query.view === 'true';
    res.setHeader('Content-Disposition', `${viewMode ? 'inline' : 'attachment'}; filename="consolidado_clima_${safeName}.pdf"`);
    doc.pipe(res);
    generateClimaConsolidatedPDF(doc, event, indicatorStats, factorStats, responsesWithAnswers, aiAnalysis, includeAnswers);
    appendDisclaimer(doc);
    addPageNumbers(doc, doc._darkPages);
    doc.end();
    return;
  }

  const detailParam = req.query.detail;
  const includeDetail = detailParam === 'true' || detailParam === 'full';
  const includeAnswers = detailParam === 'full';

  let responsesWithAnswers = responses;
  if (includeAnswers) {
    responsesWithAnswers = responses.map(r => {
      const rawAnswers = db.prepare(`
        SELECT ra.*, q.number, q.text as question_text, q.section,
               o.text as option_text, o.temperament
        FROM response_answers ra
        JOIN questions q ON ra.question_id = q.id
        LEFT JOIN options o ON ra.selected_option_id = o.id
        WHERE ra.response_id = ?
        ORDER BY q.number
      `).all(r.id);
      const answers = rawAnswers.map(ans => {
        const opts = db.prepare(`SELECT letter, text FROM options WHERE question_id = ? ORDER BY letter`).all(ans.question_id);
        const options_summary = opts.map(o => `${o.letter.toUpperCase()}) ${o.text}`).join('   ');
        return { ...ans, options_summary };
      });
      return { ...r, answers };
    });
  }

  const aiAnalysis = responses.length > 0
    ? await generateClinicalAnalysis(event, event.test_type, responses)
    : null;

  const doc = createDoc();
  const safeName = (event.name || 'evento').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  const viewMode = req.query.view === 'true';
  res.setHeader('Content-Disposition', `${viewMode ? 'inline' : 'attachment'}; filename="consolidado_${safeName}.pdf"`);
  doc.pipe(res);
  generateConsolidatedPDF(doc, event, responsesWithAnswers, includeDetail, includeAnswers, aiAnalysis);
  appendDisclaimer(doc);
  addPageNumbers(doc, doc._darkPages);
  doc.end();
});

function loadEventWithType(eventId) {
  return db.prepare(`
    SELECT ev.*, e.name as entity_name, t.name as test_name, t.test_type
    FROM events ev
    JOIN entities e ON ev.entity_id = e.id
    JOIN tests t ON ev.test_id = t.id
    WHERE ev.id = ?
  `).get(eventId);
}

function checkReportAccess(req, res, event) {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EMPRESA') {
    res.status(403).json({ message: 'Sin acceso' });
    return false;
  }
  if (!event) {
    res.status(404).json({ message: 'Evento no encontrado' });
    return false;
  }
  if (req.user.role === 'EMPRESA' && event.entity_id !== req.user.entity_id) {
    res.status(403).json({ message: 'Sin acceso a este evento' });
    return false;
  }
  return true;
}

function getComparableEvents(event) {
  return db.prepare(`
    SELECT ev.id, ev.name, ev.start_date, ev.end_date, e.name as entity_name
    FROM events ev
    JOIN tests t ON ev.test_id = t.id
    JOIN entities e ON ev.entity_id = e.id
    WHERE ev.entity_id = ? AND t.test_type = ?
    ORDER BY ev.start_date DESC, ev.id DESC
    LIMIT 3
  `).all(event.entity_id, event.test_type);
}

function isComparativeEligible(event, siblings) {
  return siblings.length >= 2 && siblings[0].id === event.id;
}

function buildComparativeItems(siblings, testType) {
  return siblings.map(ev => {
    const responses = db.prepare(
      `SELECT * FROM responses WHERE event_id = ? AND annulled = 0`
    ).all(ev.id);
    const item = { ...ev, count: responses.length };

    if (testType === 'CLIMA') {
      const scored = responses.filter(r => r.clima_score != null);
      const avg = scored.length ? scored.reduce((a, r) => a + r.clima_score, 0) / scored.length : 0;
      item.metricPct = avg;
      item.tableMetric = `${avg.toFixed(2)}%`;
      item.line = `Evento #${ev.id} "${ev.name}" (${ev.start_date} a ${ev.end_date}): ${ev.count || responses.length} encuestas anónimas, ponderación general ${avg.toFixed(2)}%.`;
    } else if (testType === 'BURNOUT') {
      const inRisk = responses.filter(r => r.burnout_ce_nivel === 'ALTO' || r.burnout_dp_nivel === 'ALTO' || r.burnout_rp_nivel === 'BAJO').length;
      const pct = responses.length ? (inRisk / responses.length) * 100 : 0;
      const dist = (dim) => ['ALTO', 'MEDIO', 'BAJO'].map(n => responses.filter(r => r[`burnout_${dim}_nivel`] === n).length).join('/');
      item.metricPct = pct;
      item.tableMetric = `${pct.toFixed(1)}%`;
      item.line = `Evento #${ev.id} "${ev.name}" (${ev.start_date} a ${ev.end_date}): ${responses.length} evaluaciones, ${pct.toFixed(1)}% en niveles de riesgo. Distribución alto/medio/bajo — Cansancio Emocional: ${dist('ce')}, Despersonalización: ${dist('dp')}, Realización Personal: ${dist('rp')}.`;
    } else {
      const dist = { 'Sanguíneo': 0, 'Colérico': 0, 'Melancólico': 0, 'Flemático': 0, 'Empate': 0 };
      for (const r of responses) {
        const d = r.dominant_temperament || '';
        const key = TEMP_LABELS[d] || (d.includes('/') ? 'Empate' : null);
        if (key && dist[key] !== undefined) dist[key]++;
        else dist.Empate++;
      }
      const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
      item.dist = dist;
      item.tableMetric = top[1] > 0 ? `${top[0]} (${top[1]})` : '—';
      item.line = `Evento #${ev.id} "${ev.name}" (${ev.start_date} a ${ev.end_date}): ${responses.length} evaluaciones. Distribución de temperamento dominante — Sanguíneo: ${dist['Sanguíneo']}, Colérico: ${dist['Colérico']}, Melancólico: ${dist['Melancólico']}, Flemático: ${dist['Flemático']}, Empate: ${dist['Empate']}.`;
    }
    return item;
  });
}

router.get('/comparative-info/:eventId', verifyToken, (req, res) => {
  const event = loadEventWithType(req.params.eventId);
  if (!checkReportAccess(req, res, event)) return;
  const siblings = getComparableEvents(event);
  res.json({
    eligible: isComparativeEligible(event, siblings),
    count: siblings.length,
    test_type: event.test_type,
  });
});

router.get('/comparative/:eventId', verifyToken, async (req, res) => {
  const event = loadEventWithType(req.params.eventId);
  if (!checkReportAccess(req, res, event)) return;

  const siblings = getComparableEvents(event);
  if (!isComparativeEligible(event, siblings)) {
    return res.status(400).json({ message: 'Este evento no tiene reporte comparativo disponible' });
  }

  const items = buildComparativeItems(siblings, event.test_type);
  const aiAnalysis = await generateComparativeAnalysis(
    event.test_type, event.entity_name, items.map(i => ({ line: i.line }))
  );

  const doc = createDoc();
  const safeName = (event.entity_name || 'entidad').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  const viewMode = req.query.view === 'true';
  res.setHeader('Content-Disposition', `${viewMode ? 'inline' : 'attachment'}; filename="comparativo_${safeName}.pdf"`);
  doc.pipe(res);
  generateComparativePDF(doc, event.test_type, event.entity_name, items, aiAnalysis);
  appendDisclaimer(doc);
  addPageNumbers(doc, doc._darkPages);
  doc.end();
});

module.exports = router;
