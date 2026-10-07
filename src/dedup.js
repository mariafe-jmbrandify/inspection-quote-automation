/**
 * Idempotency guard. Remembers which requests were already accepted so a
 * double-submitted form or a retried webhook does not create a second quote.
 *
 * `store` is n8n's workflow static data ($getWorkflowStaticData('global')),
 * which n8n saves between production executions. Plain object, so it is
 * testable without n8n.
 */
const MAX_KEYS = 5000;

function checkDuplicate(store, key, nowMs, windowHours) {
  if (!store.seen || typeof store.seen !== 'object') store.seen = {};
  const windowMs = windowHours * 3600 * 1000;

  // Prune expired keys so the store cannot grow forever.
  for (const [k, ts] of Object.entries(store.seen)) {
    if (nowMs - ts > windowMs) delete store.seen[k];
  }

  const firstSeen = store.seen[key];
  if (firstSeen !== undefined) {
    return { duplicate: true, firstSeenAt: new Date(firstSeen).toISOString() };
  }

  store.seen[key] = nowMs;

  // Hard cap: drop the oldest entries if we are over the limit.
  const keys = Object.keys(store.seen);
  if (keys.length > MAX_KEYS) {
    keys
      .sort((a, b) => store.seen[a] - store.seen[b])
      .slice(0, keys.length - MAX_KEYS)
      .forEach((k) => delete store.seen[k]);
  }

  return { duplicate: false, firstSeenAt: new Date(nowMs).toISOString() };
}

// ---- exports (removed by build) ----
module.exports = { checkDuplicate, MAX_KEYS };
