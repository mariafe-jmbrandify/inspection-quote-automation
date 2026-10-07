/**
 * Checks the LLM's scope of work before anything is priced or sent.
 * The AI output is treated as untrusted input.
 *
 * Hard errors (quote goes to manual review instead):
 *  - response truncated, not JSON, or wrong shape
 *  - service code not in the catalog (invented work)
 *  - quantity missing, zero, negative, fractional "each", or above the sanity cap
 *  - "evidence" not found word for word in the inspection notes (ungrounded)
 *
 * Warnings (quote continues, approver sees them):
 *  - low confidence, assumptions made, AI tried to include prices
 */
const PRICE_KEYS = ['price', 'rate', 'cost', 'total', 'amount'];

function normaliseForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractJson(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found in AI response');
  return JSON.parse(t.slice(start, end + 1));
}

function validateAiOutput(response, request, config) {
  const errors = [];
  const warnings = [];
  const fail = (msg) => ({ ok: false, errors: [msg], warnings, scope: null });

  if (!response || !Array.isArray(response.content)) return fail('AI response missing "content"');
  if (response.stop_reason === 'max_tokens') return fail('AI response was cut off (max_tokens); raise ai.maxTokens');

  const text = response.content
    .filter((c) => c && c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  let parsed;
  try {
    parsed = extractJson(text);
  } catch (e) {
    return fail('AI response is not valid JSON: ' + e.message);
  }

  if (!Array.isArray(parsed.lineItems) || parsed.lineItems.length === 0) {
    return fail('AI returned no line items');
  }
  if (parsed.lineItems.length > 15) errors.push(`Too many line items (${parsed.lineItems.length}, max 15)`);

  (request.flags || []).forEach((f) => warnings.push(f));
  const notes = normaliseForMatch(request.description);
  const lineItems = [];

  parsed.lineItems.forEach((item, i) => {
    const n = i + 1;
    if (!item || typeof item !== 'object') {
      errors.push(`Line ${n}: not an object`);
      return;
    }
    const svc = config.catalog[item.code];
    if (!svc) {
      errors.push(`Line ${n}: unknown service code "${item.code}"`);
      return;
    }
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) errors.push(`Line ${n} (${item.code}): quantity must be a positive number`);
    else if (svc.unit === 'each' && !Number.isInteger(qty)) errors.push(`Line ${n} (${item.code}): quantity must be a whole number`);
    else if (qty > svc.maxQty) errors.push(`Line ${n} (${item.code}): quantity ${qty} ${svc.unit} exceeds sanity cap of ${svc.maxQty}`);

    const evidence = normaliseForMatch(item.evidence);
    if (!evidence) errors.push(`Line ${n} (${item.code}): missing evidence`);
    else if (!notes.includes(evidence)) errors.push(`Line ${n} (${item.code}): evidence not found in the inspection notes`);

    if (PRICE_KEYS.some((k) => k in item)) warnings.push(`Line ${n}: AI included a price field; ignored (prices come from the rate table)`);

    lineItems.push({
      code: item.code,
      quantity: qty,
      location: String(item.location || '').slice(0, 120),
      evidence: String(item.evidence || '').slice(0, 300),
    });
  });

  const confidence = Number(parsed.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    errors.push('confidence must be a number between 0 and 1');
  } else if (confidence < config.ai.minConfidence) {
    warnings.push(`Low AI confidence (${confidence}); check quantities on site`);
  }

  const assumptions = Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String).slice(0, 10) : [];
  if (assumptions.length) warnings.push(`AI made ${assumptions.length} assumption(s)`);

  if (errors.length) return { ok: false, errors, warnings, scope: null };

  return {
    ok: true,
    errors: [],
    warnings,
    scope: {
      summary: String(parsed.summary || '').slice(0, 300),
      lineItems,
      confidence,
      assumptions,
      questionsForClient: Array.isArray(parsed.questionsForClient)
        ? parsed.questionsForClient.map(String).slice(0, 10)
        : [],
    },
  };
}

// ---- exports (removed by build) ----
module.exports = { validateAiOutput, extractJson, normaliseForMatch };
