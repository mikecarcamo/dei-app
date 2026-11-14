const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function classify(pct, isExternal) {
  if (pct >= 90) return 'Excelente';
  if (pct >= 80) return 'Bueno';
  if (pct >= 66) return 'Regular';
  return isExternal ? 'Amenaza' : 'Desfavorable';
}

async function generateClimaAnalysis(event, factorStats, indicatorStats, responsesCount) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const overall = factorStats.length
    ? factorStats.reduce((a, f) => a + f.pct, 0) / factorStats.length
    : 0;

  const factorsText = factorStats
    .map(f => `- ${f.section}: ${f.pct.toFixed(1)}% (${classify(f.pct)})`)
    .join('\n');

  const weak = indicatorStats.filter(s => s.pct < 66).sort((a, b) => a.pct - b.pct).slice(0, 8);
  const strong = indicatorStats.filter(s => s.pct >= 80).sort((a, b) => b.pct - a.pct).slice(0, 8);
  const threats = weak.filter(s => s.is_external);
  const weaknesses = weak.filter(s => !s.is_external);

  const prompt = `Eres un consultor senior en clima organizacional. Redacta un análisis profesional en español para el reporte consolidado de una encuesta de clima laboral.

Contexto:
- Evento: ${event.name}
- Entidad: ${event.entity_name}
- Dirigido a: ${event.target_audience || 'Colaboradores'}
- Formularios respondidos: ${responsesCount}
- Ponderación general: ${overall.toFixed(2)}% (${classify(overall)})

Ponderación por factor:
${factorsText}

Indicadores más altos:
${strong.map(s => `- [${s.section}] ${s.text}: ${s.pct.toFixed(1)}%`).join('\n') || '- Ninguno'}

Indicadores por debajo de 66% (debilidades internas):
${weaknesses.map(s => `- [${s.section}] ${s.text}: ${s.pct.toFixed(1)}%`).join('\n') || '- Ninguno'}

Indicadores externos por debajo de 66% (amenazas):
${threats.map(s => `- [${s.section}] ${s.text}: ${s.pct.toFixed(1)}%`).join('\n') || '- Ninguno'}

Estructura el texto EXACTAMENTE con estos títulos en mayúsculas, cada uno seguido de sus párrafos:
RESUMEN EJECUTIVO
FORTALEZAS
ÁREAS DE OPORTUNIDAD
AMENAZAS EXTERNAS
RECOMENDACIONES

Reglas:
- Espanol formal y profesional, orientado a gerencia de recursos humanos.
- Máximo 450 palabras en total.
- Texto plano: NO uses markdown, asteriscos, numerales ni viñetas con símbolos. Las recomendaciones numéralas como "1.", "2.", etc. en líneas separadas.
- No inventes datos que no estén en el contexto.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1400,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error('Groq API error:', resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('Groq request failed:', e.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { generateClimaAnalysis };
