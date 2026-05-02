const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const db = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { generateIndividualPDF, generateConsolidatedPDF, appendDisclaimer, drawWatermark } = require('../utils/pdf');

function createDoc() {
  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  drawWatermark(doc);
  doc.on('pageAdded', () => drawWatermark(doc));
  return doc;
}

function addPageNumbers(doc, darkPageIndexes) {
  const dark = new Set(darkPageIndexes || []);
  const total = doc.bufferedPageRange().count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    const label = `${i + 1}/${total}`;
    const pageW = doc.page.width;
    doc.fontSize(9).font('Helvetica-Bold');
    const textW = doc.widthOfString(label);
    const x = pageW - 40 - textW;
    const y = 12;
    const color = dark.has(i) ? '#FFFFFF' : '#333333';
    doc.fillOpacity(1).fillColor(color).text(label, x, y, { lineBreak: false });
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
  res.setHeader('Content-Disposition', `attachment; filename="resultado_${safeName}.pdf"`);
  doc.pipe(res);
  generateIndividualPDF(doc, response, event, answers);
  appendDisclaimer(doc);
  addPageNumbers(doc, doc._darkPages);
  doc.end();
});

router.get('/consolidated/:eventId', verifyToken, (req, res) => {
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

  const doc = createDoc();
  const safeName = (event.name || 'evento').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="consolidado_${safeName}.pdf"`);
  doc.pipe(res);
  generateConsolidatedPDF(doc, event, responsesWithAnswers, includeDetail, includeAnswers);
  appendDisclaimer(doc);
  addPageNumbers(doc, doc._darkPages);
  doc.end();
});

module.exports = router;
