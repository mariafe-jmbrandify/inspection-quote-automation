/**
 * Builds every message the workflow sends (approval requests, outcomes,
 * alerts) and formats it for the configured channel.
 */
function money(n, currency) {
  return (currency === 'AUD' ? 'A$' : '') + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatForChannel(n, channel) {
  const linkText = (fmt) => (n.links || []).map(fmt).join('  |  ');
  const body = [n.title, '', ...(n.lines || [])].join('\n');
  switch (channel) {
    case 'slack':
    case 'googlechat':
      return { text: [body, linkText((l) => `<${l.url}|${l.label}>`)].filter(Boolean).join('\n\n') };
    case 'discord':
      return { content: [body, linkText((l) => `[${l.label}](${l.url})`)].filter(Boolean).join('\n\n').slice(0, 2000) };
    default:
      return { title: n.title, severity: n.severity || 'info', text: (n.lines || []).join('\n'), links: n.links || [], sentAt: new Date().toISOString() };
  }
}

function buildApprovalRequest({ request, scope, quote, warnings, resumeUrl, token, expiresAt }) {
  const c = quote.currency;
  const sep = resumeUrl.includes('?') ? '&' : '?';
  const link = (decision) => `${resumeUrl}${sep}decision=${decision}&token=${encodeURIComponent(token)}`;
  const lines = [
    `Customer: ${request.customer.name}${request.customer.company ? ' (' + request.customer.company + ')' : ''} <${request.customer.email}>`,
    `Site: ${request.property.address}, ${request.property.city}`,
    `AI summary: ${scope.summary || '-'} (confidence ${scope.confidence})`,
    '',
    ...quote.lines.map((l) => `- ${l.description}: ${l.quantity} ${l.unit} x ${money(l.rate, c)} = ${money(l.lineTotal, c)}`),
    '',
    `Subtotal ${money(quote.subtotal, c)} | GST ${money(quote.gst, c)} | Total ${money(quote.total, c)}`,
  ];
  if (quote.highValue) lines.push('', 'HIGH VALUE: needs senior sign-off.');
  if (warnings.length) lines.push('', 'Check before approving:', ...warnings.map((w) => `! ${w}`));
  if (scope.assumptions.length) lines.push('', 'AI assumptions:', ...scope.assumptions.map((a) => `? ${a}`));
  lines.push('', `Expires: ${expiresAt}`);

  return {
    title: `Quote ${request.ref} needs approval: ${money(quote.total, c)}`,
    severity: quote.highValue || warnings.length ? 'warning' : 'info',
    lines,
    links: [
      { label: 'Approve', url: link('approve') },
      { label: 'Reject', url: link('reject') },
    ],
  };
}

// ---- exports (removed by build) ----
module.exports = { formatForChannel, buildApprovalRequest, money };
