/**
 * Human approval step. Nothing reaches the CRM or the customer without a
 * person clicking Approve.
 *
 * The n8n resume URL contains the execution ID, which is guessable, so each
 * quote also gets a random one-time token. A wrong or missing token fails
 * closed: the quote is NOT approved and the team is alerted.
 */
function generateToken() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * @param resumed  the item the Wait node outputs. Resumed by a click it has
 *                 { query: { decision, token } }. Resumed by timeout it has no query.
 */
function checkDecision(resumed, expectedToken) {
  const query = resumed && resumed.query;
  if (!query || query.decision === undefined) {
    return { status: 'expired', approved: false, reason: 'No decision before the approval window closed' };
  }
  if (!safeEqual(query.token, expectedToken)) {
    return { status: 'invalid_token', approved: false, reason: 'Approval link token did not match; quote held for safety' };
  }
  if (query.decision === 'approve') return { status: 'approved', approved: true, reason: 'Approved by reviewer' };
  if (query.decision === 'reject') return { status: 'rejected', approved: false, reason: 'Rejected by reviewer' };
  return { status: 'invalid_decision', approved: false, reason: `Unknown decision "${String(query.decision).slice(0, 20)}"` };
}

// ---- exports (removed by build) ----
module.exports = { generateToken, safeEqual, checkDecision };
