/**
 * Offline stand-in for the LLM, used when config.aiMode === 'mock'.
 * Returns the same response shape as the Anthropic Messages API so the
 * rest of the workflow cannot tell the difference.
 *
 * It uses simple keyword rules, so it is NOT smart. It exists so the whole
 * workflow can be run and tested without an API key.
 *
 * Test hooks (put these in the description to exercise the safety checks):
 *   [[mock:bad-json]]       -> returns text that is not JSON
 *   [[mock:invented-code]]  -> returns a service code that is not in the catalog
 *   [[mock:ungrounded]]     -> returns evidence that is not in the notes
 */
const RULES = [
  { re: /crack/i, code: 'CONC_CRACK_REPAIR' },
  { re: /spall|patch|pothole/i, code: 'CONC_PATCH' },
  { re: /trip hazard|lifted|uneven/i, code: 'TRIP_HAZARD_GRIND' },
  { re: /paver/i, code: 'PAVER_RELAY' },
  { re: /tile/i, code: 'TILE_REPLACE' },
  { re: /joint|sealant/i, code: 'JOINT_RESEAL' },
  { re: /pressure clean|stain|grime/i, code: 'PRESSURE_CLEAN' },
  { re: /line marking|bay lines|car park lines/i, code: 'LINE_MARKING' },
];

function mockAi(request) {
  const text = request.description;
  const wrap = (obj) => ({
    id: 'mock_' + Date.now(),
    model: 'mock',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }],
  });

  if (text.includes('[[mock:bad-json]]')) return wrap('Sure! Here is the scope you asked for: crack repair, about 10m.');

  const sentences = text.split(/(?<=[.!?\n])\s+/).map((s) => s.trim()).filter(Boolean);
  const lineItems = [];
  const assumptions = [];
  const used = new Set();

  for (const sentence of sentences) {
    const rule = RULES.find((r) => r.re.test(sentence));
    if (!rule || used.has(rule.code)) continue;
    used.add(rule.code);
    const num = sentence.match(/(\d+(?:\.\d+)?)/);
    const quantity = num ? Number(num[1]) : 1;
    if (!num) assumptions.push(`No measurement given for ${rule.code}; assumed 1.`);
    lineItems.push({ code: rule.code, quantity, location: 'As described', evidence: sentence });
  }

  if (text.includes('[[mock:invented-code]]')) {
    lineItems.push({ code: 'EPOXY_FLAKE_FLOOR', quantity: 40, location: 'Lobby', evidence: sentences[0] });
  }
  if (text.includes('[[mock:ungrounded]]')) {
    lineItems.push({ code: 'PAVER_RELAY', quantity: 25, location: 'Entry', evidence: 'Pavers at the entry are sunken.' });
  }

  return wrap({
    summary: `Mock scope for ${request.property.address}`,
    lineItems,
    confidence: assumptions.length ? 0.5 : 0.8,
    assumptions,
    questionsForClient: [],
  });
}

// ---- exports (removed by build) ----
module.exports = { mockAi };
