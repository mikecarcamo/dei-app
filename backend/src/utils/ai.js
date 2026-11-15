const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

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
        max_tokens: 6000,
        reasoning_effort: 'low',
        include_reasoning: false,
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

  const prompt = `Eres un psicólogo clínico organizacional senior. Redacta un análisis profesional en español para el reporte consolidado de una encuesta de clima laboral, con enfoque de psicología clínica organizacional: bienestar psicológico, salud mental ocupacional, factores de riesgo psicosocial y clima emocional del grupo.

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

  return callGroq(prompt);
}

async function generateClinicalAnalysis(event, testType, responses) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || responses.length === 0) return null;

  let resultsText;
  let instrumentDesc;
  if (testType === 'BURNOUT') {
    instrumentDesc = 'Cuestionario Burnout MBI (Maslach Burnout Inventory) con subescalas: Cansancio Emocional (riesgo si nivel ALTO), Despersonalización (riesgo si ALTO) y Realización Personal (riesgo si BAJO).';
    resultsText = responses.map(r =>
      `- ${r.participant_full_name}: Cansancio Emocional ${r.burnout_ce ?? '—'} (${r.burnout_ce_nivel || '—'}), Despersonalización ${r.burnout_dp ?? '—'} (${r.burnout_dp_nivel || '—'}), Realización Personal ${r.burnout_rp ?? '—'} (${r.burnout_rp_nivel || '—'})`
    ).join('\n');
  } else {
    instrumentDesc = 'Test de Personalidad de cuatro temperamentos (Sanguíneo, Colérico, Melancólico, Flemático) con puntuaciones A-D y temperamento dominante/secundario.';
    resultsText = responses.map(r =>
      `- ${r.participant_full_name}: dominante ${r.dominant_temperament || '—'}, secundario ${r.secondary_temperament || '—'}, puntajes A=${r.score_a ?? 0} B=${r.score_b ?? 0} C=${r.score_c ?? 0} D=${r.score_d ?? 0}`
    ).join('\n');
  }

  const prompt = `Eres un psicólogo clínico senior. Redacta un análisis profesional en español con enfoque de psicología clínica para el reporte consolidado de un evento de evaluación psicológica.

Contexto:
- Evento: ${event.name}
- Entidad: ${event.entity_name}
- Instrumento: ${instrumentDesc}
- Total de participantes: ${responses.length}

Resultados por participante:
${resultsText}

Estructura el texto EXACTAMENTE con estos títulos en mayúsculas, cada uno seguido de sus párrafos:
RESUMEN EJECUTIVO
HALLAZGOS CLÍNICOS
PERSONAS QUE NECESITAN APOYO
RECOMENDACIONES

Reglas:
- En PERSONAS QUE NECESITAN APOYO lista con nombre completo a quienes muestren indicadores de riesgo clínico o emocional que ameriten apoyo terapéutico o canalización a psicología; justifica brevemente cada caso. Si nadie lo requiere, indícalo explícitamente.
- Español formal y profesional, con prudencia clínica: orientativo, no diagnóstico definitivo.
- Máximo 450 palabras en total.
- Texto plano: NO uses markdown, asteriscos ni viñetas con símbolos. Las recomendaciones numéralas como "1.", "2.", etc. en líneas separadas.
- NO uses abreviaturas ni siglas; escribe siempre los nombres completos de las subescalas o variables (por ejemplo "Realización Personal", nunca "RP").
- No inventes datos que no estén en el contexto.`;

  return callGroq(prompt);
}

const TEMP_LABELS = { SANGUINEO: 'Sanguíneo', COLERICO: 'Colérico', MELANCOLICO: 'Melancólico', FLEMATICO: 'Flemático', EMPATE: 'Empate' };

async function generateComparativeAnalysis(testType, entityName, summaries) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || summaries.length < 2) return null;

  const instrumentDesc = {
    CLIMA: 'Encuesta de Clima Laboral (ponderación porcentual por factor, escala 1-5)',
    BURNOUT: 'Cuestionario Burnout MBI (Cansancio Emocional, Despersonalización, Realización Personal)',
    PERSONALIDAD: 'Test de Personalidad de cuatro temperamentos (Sanguíneo, Colérico, Melancólico, Flemático)',
    TEMPERAMENTO: 'Test de Personalidad de cuatro temperamentos (Sanguíneo, Colérico, Melancólico, Flemático)',
  }[testType] || testType;

  const lines = summaries.map(s => `- ${s.line}`).join('\n');

  const prompt = `Eres un psicólogo clínico organizacional senior. Redacta un análisis comparativo profesional en español de la evolución de una entidad a través de varios eventos de evaluación psicológica con el mismo instrumento, con enfoque de psicología clínica organizacional.

Contexto:
- Entidad: ${entityName}
- Instrumento: ${instrumentDesc}
- Eventos comparados (del más reciente al más antiguo): ${summaries.length}

Resumen por evento:
${lines}

Estructura el texto EXACTAMENTE con estos títulos en mayúsculas, cada uno seguido de sus párrafos:
RESUMEN EJECUTIVO
COMPARACIÓN ENTRE EVENTOS
HALLAZGOS CLÍNICOS
RECOMENDACIONES

Reglas:
- En COMPARACIÓN ENTRE EVENTOS indica explícitamente si los resultados mejoraron o empeoraron respecto al evento anterior y en qué aspectos o indicadores ocurrió el cambio, citando las cifras de cada evento.
- Español formal y profesional, con prudencia clínica: orientativo, no diagnóstico definitivo.
- Máximo 450 palabras en total.
- Texto plano: NO uses markdown, asteriscos ni viñetas con símbolos. Las recomendaciones numéralas como "1.", "2.", etc. en líneas separadas.
- NO uses abreviaturas ni siglas; escribe siempre los nombres completos.
- No inventes datos que no estén en el contexto.`;

  return callGroq(prompt);
}

module.exports = { generateClimaAnalysis, generateClinicalAnalysis, generateComparativeAnalysis, TEMP_LABELS };
