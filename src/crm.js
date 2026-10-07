/**
 * Pipedrive helpers. The workflow searches for an existing deal with the
 * same reference before creating one, so a retry or replay never creates
 * a duplicate deal.
 */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function dealTitle(request) {
  return `[${request.ref}] ${request.property.address}, ${request.property.city}`;
}

function buildDealPayload(request, quote) {
  return {
    title: dealTitle(request),
    value: quote.subtotal, // ex GST, matching how most pipelines report value
    currency: quote.currency,
  };
}

function buildNotePayload(dealId, request, scope, quote, warnings) {
  const rows = quote.lines
    .map((l) => `<li>${escapeHtml(l.description)}: ${l.quantity} ${l.unit} x ${l.rate} = <b>${l.lineTotal}</b></li>`)
    .join('');
  const content = [
    `<p><b>AI-drafted quote ${escapeHtml(request.ref)}</b> (approved by a reviewer)</p>`,
    `<p>Contact: ${escapeHtml(request.customer.name)}, ${escapeHtml(request.customer.email)}${request.customer.phone ? ', ' + escapeHtml(request.customer.phone) : ''}</p>`,
    `<ul>${rows}</ul>`,
    `<p>Subtotal ${quote.subtotal} + GST ${quote.gst} = <b>${quote.total} ${quote.currency}</b></p>`,
    warnings.length ? `<p>Warnings: ${warnings.map(escapeHtml).join('; ')}</p>` : '',
    scope.questionsForClient.length ? `<p>Questions for client: ${scope.questionsForClient.map(escapeHtml).join('; ')}</p>` : '',
    `<p>Original notes:</p><blockquote>${escapeHtml(request.description)}</blockquote>`,
  ].join('');
  return { deal_id: dealId, content };
}

/** Returns the id of a deal whose title contains our reference, or null. */
function findExistingDeal(searchResponse, ref) {
  if (!searchResponse || searchResponse.success === false) {
    throw new Error('Pipedrive search failed: ' + JSON.stringify(searchResponse).slice(0, 300));
  }
  const items = (searchResponse.data && searchResponse.data.items) || [];
  const hit = items.find((i) => i.item && String(i.item.title || '').includes(`[${ref}]`));
  return hit ? hit.item.id : null;
}

// ---- exports (removed by build) ----
module.exports = { dealTitle, buildDealPayload, buildNotePayload, findExistingDeal, escapeHtml };
