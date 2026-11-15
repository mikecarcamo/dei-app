const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

async function callGroq(prompt, { system, json = false, timeoutMs = 20000, temperature = 0.4 } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const messages = system
    ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature,
        max_tokens: 6000,
        reasoning_effort: 'low',
        include_reasoning: false,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
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

const SCREENING_PROMPT_VERSION = 'tamizaje-v1';
let clinicalKnowledge = null;

function loadClinicalKnowledge() {
  if (clinicalKnowledge !== null) return clinicalKnowledge;
  try {
    const raw = require('fs').readFileSync(
      require('path').join(__dirname, '../../knowledge/clinical-mental-health/SKILL.md'), 'utf8'
    );
    clinicalKnowledge = raw.replace(/^---[\s\S]*?---\s*/, '').replace(/^More therapy AI tools.*$/m, '').trim();
  } catch (e) {
    console.error('No se pudo cargar SKILL.md clínico:', e.message);
    clinicalKnowledge = '';
  }
  return clinicalKnowledge;
}

function extractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { /* intenta extraer el primer objeto */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch (e) { return null; }
}

function asStringArray(v) {
  return Array.isArray(v) ? v.map(x => String(x)).filter(Boolean) : [];
}

function validateScreeningOutput(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const hipotesis = (Array.isArray(obj.hipotesis) ? obj.hipotesis : []).map(h => ({
    codigo_dsm5: String(h?.codigo_dsm5 || ''),
    codigo_cie10: String(h?.codigo_cie10 || ''),
    nombre: String(h?.nombre || ''),
    nivel_de_apoyo: ['alto', 'medio', 'bajo'].includes(String(h?.nivel_de_apoyo).toLowerCase()) ? String(h.nivel_de_apoyo).toLowerCase() : 'bajo',
    criterios_que_se_cumplen: asStringArray(h?.criterios_que_se_cumplen),
    criterios_que_faltan: asStringArray(h?.criterios_que_faltan),
    diagnosticos_diferenciales: asStringArray(h?.diagnosticos_diferenciales),
    preguntas_sugeridas_para_aclarar: asStringArray(h?.preguntas_sugeridas_para_aclarar),
  }));
  return {
    resumen: String(obj.resumen || ''),
    conclusion: String(obj.conclusion || ''),
    hipotesis,
    recomendaciones: asStringArray(obj.recomendaciones),
    limitaciones: String(obj.limitaciones || ''),
  };
}

// context: datos anonimizados (sin nombre ni contacto)
async function generateScreeningAnalysis(context, whitelist) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const system = `Eres un asistente de apoyo clínico para psicólogos y terapeutas. Tu función es ofrecer un PANORAMA INICIAL a partir de un tamizaje; NO diagnosticas. Redactas siempre como "hipótesis para revisión profesional", nunca afirmas que el paciente "tiene" un trastorno.

Base de conocimiento clínica (parafraseada, úsala como referencia):
${loadClinicalKnowledge()}

Reglas obligatorias:
- Responde SOLO con un objeto JSON válido, sin texto adicional.
- Usa únicamente códigos de esta lista permitida (CIE-10-MC usada por el DSM-5-TR); si ninguno aplica, deja "hipotesis" vacío:
${whitelist.map(w => `${w.code} = ${w.name}`).join('\n')}
- Los puntajes y severidades ya fueron calculados por el sistema: no los recalcules ni los contradigas.
- No copies texto literal del DSM; describe los criterios con tus propias palabras.
- No recomiendes medicación; si procede, sugiere derivación a psiquiatría.
- Español formal y profesional, sin abreviaturas ni siglas salvo los nombres de los instrumentos.`;

  const prompt = `Datos del tamizaje (anonimizados):
${JSON.stringify(context, null, 2)}

Devuelve un JSON con esta forma exacta:
{
  "resumen": "panorama clínico inicial en 1-2 párrafos",
  "conclusion": "conclusión orientativa del tamizaje en 1 párrafo",
  "hipotesis": [
    {
      "codigo_dsm5": "código de la lista",
      "codigo_cie10": "mismo código de la lista",
      "nombre": "nombre del trastorno",
      "nivel_de_apoyo": "alto | medio | bajo",
      "criterios_que_se_cumplen": ["..."],
      "criterios_que_faltan": ["..."],
      "diagnosticos_diferenciales": ["..."],
      "preguntas_sugeridas_para_aclarar": ["..."]
    }
  ],
  "recomendaciones": ["..."],
  "limitaciones": "limitaciones de este tamizaje"
}`;

  const raw = await callGroq(prompt, { system, json: true, timeoutMs: 45000, temperature: 0.2 });
  const parsed = validateScreeningOutput(extractJson(raw));
  if (!parsed) return null;
  return { ...parsed, model: GROQ_MODEL, prompt_version: SCREENING_PROMPT_VERSION };
}

module.exports = { generateClimaAnalysis, generateClinicalAnalysis, generateComparativeAnalysis, generateScreeningAnalysis, TEMP_LABELS };
