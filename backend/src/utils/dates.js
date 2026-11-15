// Guatemala: UTC-6 fijo, sin horario de verano.
const GT_OFFSET_MS = 6 * 60 * 60 * 1000;

function nowGT() {
  return new Date(Date.now() - GT_OFFSET_MS);
}

// 'YYYY-MM-DD' en hora de Guatemala
function todayGT() {
  return nowGT().toISOString().split('T')[0];
}

// 'YYYY-MM-DD HH:mm:ss' en hora de Guatemala
function timestampGT() {
  return nowGT().toISOString().replace('T', ' ').substring(0, 19);
}

module.exports = { todayGT, timestampGT, nowGT };
