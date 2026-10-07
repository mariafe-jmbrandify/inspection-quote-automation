/**
 * Validates and normalises an incoming inspection request (webhook body).
 * Nothing downstream runs unless this returns valid: true.
 *
 * Returns { valid, errors, request, dedupKey }
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_DESCRIPTION = 5000;
const MIN_DESCRIPTION = 20;
// Text that looks like someone trying to instruct the AI. Not blocked (could be
// innocent), but the reviewer is warned. Real protection is that the AI cannot
// set prices and a person approves every quote.
const INSTRUCTION_LIKE = /ignore (all |any )?(previous|prior|above) instructions|system prompt|you are now|disregard (the|all) rules/i;

function cleanText(value, maxLen) {
  if (value === undefined || value === null) return '';
  // Strip control characters (keep newlines and tabs), collapse runs of spaces.
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function normalisePhone(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+61')) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '+61' + digits.slice(1);
  return digits;
}

// FNV-1a 32-bit hash. Small, dependency-free, deterministic.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function validateRequest(body, config) {
  const errors = [];
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  if (!b) {
    return { valid: false, errors: ['Body must be a JSON object'], request: null, dedupKey: null };
  }

  const customer = b.customer || {};
  const property = b.property || {};

  const request = {
    externalId: cleanText(b.externalId, 100),
    customer: {
      name: cleanText(customer.name, 120),
      email: cleanText(customer.email, 200).toLowerCase(),
      phone: normalisePhone(customer.phone),
      company: cleanText(customer.company, 160),
    },
    property: {
      address: cleanText(property.address, 250),
      city: cleanText(property.city, 60),
      siteType: cleanText(property.siteType, 60),
    },
    description: cleanText(b.description, MAX_DESCRIPTION + 1),
    photos: Array.isArray(b.photos) ? b.photos.slice(0, 10).map((p) => cleanText(p, 500)) : [],
    receivedAt: new Date().toISOString(),
  };

  if (!request.customer.name) errors.push('customer.name is required');
  if (!request.customer.email) errors.push('customer.email is required');
  else if (!EMAIL_RE.test(request.customer.email)) errors.push('customer.email is not a valid email');
  if (!request.property.address) errors.push('property.address is required');

  if (!request.property.city) {
    errors.push('property.city is required');
  } else {
    const match = config.serviceAreas.find(
      (a) => a.toLowerCase() === request.property.city.toLowerCase()
    );
    if (!match) errors.push(`property.city must be one of: ${config.serviceAreas.join(', ')}`);
    else request.property.city = match;
  }

  if (request.description.length < MIN_DESCRIPTION) {
    errors.push(`description must be at least ${MIN_DESCRIPTION} characters`);
  } else if (request.description.length > MAX_DESCRIPTION) {
    errors.push(`description must be at most ${MAX_DESCRIPTION} characters`);
  }

  const badPhoto = request.photos.find((p) => !/^https:\/\//i.test(p));
  if (badPhoto !== undefined) errors.push('photos must be https:// URLs');

  if (errors.length) return { valid: false, errors, request: null, dedupKey: null };

  const dedupKey = request.externalId
    ? 'ext:' + request.externalId
    : 'h:' +
      fnv1a(
        [request.customer.email, request.property.address.toLowerCase(), request.description.toLowerCase()].join('|')
      );

  request.flags = INSTRUCTION_LIKE.test(request.description)
    ? ['Notes contain instruction-like text (possible prompt injection); check every line item']
    : [];

  // Short human-readable reference used in the CRM deal title and messages.
  request.ref = 'INSP-' + fnv1a(dedupKey).toUpperCase().slice(0, 6);

  return { valid: true, errors: [], request, dedupKey };
}

// ---- exports (removed by build) ----
module.exports = { validateRequest, cleanText, normalisePhone, fnv1a };
