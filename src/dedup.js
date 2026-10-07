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
  // Work on a copy and assign it back at the end. n8n only saves static data
  // when a top-level property is replaced; adding a key inside the existing
  // object is NOT detected, so the new key would silently be lost.
  const seen = store.seen && typeof store.seen === 'object' ? { ...store.seen } : {};
  const windowMs = windowHours * 3600 * 1000;

  // Prune expired keys so the store cannot grow forever.
  for (const [k, ts] of Object.entries(seen)) {
    if (nowMs - ts > windowMs) delete seen[k];
  }

  const firstSeen = seen[key];
  if (firstSeen !== undefined) {
    store.seen = seen;
    return { duplicate: true, firstSeenAt: new Date(firstSeen).toISOString() };
  }

  seen[key] = nowMs;

  // Hard cap: drop the oldest entries if we are over the limit.
  const keys = Object.keys(seen);
  if (keys.length > MAX_KEYS) {
    keys
      .sort((a, b) => seen[a] - seen[b])
      .slice(0, keys.length - MAX_KEYS)
      .forEach((k) => delete seen[k]);
  }

  store.seen = seen;
  return { duplicate: false, firstSeenAt: new Date(nowMs).toISOString() };
}

// ---- exports (removed by build) ----
module.exports = { checkDuplicate, MAX_KEYS };
