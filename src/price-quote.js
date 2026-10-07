/**
 * Prices a validated scope from the rate table. Deterministic: same scope
 * and rates always give the same quote. All maths is done in whole cents
 * to avoid floating-point rounding errors.
 */
const toCents = (dollars) => Math.round(dollars * 100);
const toDollars = (cents) => cents / 100;

function priceQuote(scope, config) {
  const lines = scope.lineItems.map((item) => {
    const svc = config.catalog[item.code];
    if (!svc) throw new Error(`priceQuote: unknown code ${item.code} (validator should have caught this)`);
    const lineCents = Math.round(toCents(svc.rate) * item.quantity);
    return {
      code: item.code,
      description: svc.label + (item.location ? ` (${item.location})` : ''),
      quantity: item.quantity,
      unit: svc.unit,
      rate: svc.rate,
      lineTotal: toDollars(lineCents),
      _cents: lineCents,
    };
  });

  let subtotalCents = lines.reduce((sum, l) => sum + l._cents, 0);
  const minCents = toCents(config.pricing.minimumCharge);
  if (subtotalCents < minCents) {
    const adj = minCents - subtotalCents;
    lines.push({
      code: 'MIN_CHARGE_ADJ',
      description: 'Minimum job charge adjustment',
      quantity: 1,
      unit: 'each',
      rate: toDollars(adj),
      lineTotal: toDollars(adj),
      _cents: adj,
    });
    subtotalCents = minCents;
  }

  const gstCents = Math.round(subtotalCents * config.pricing.gstRate);
  const totalCents = subtotalCents + gstCents;

  return {
    currency: config.crm.currency,
    lines: lines.map(({ _cents, ...rest }) => rest),
    subtotal: toDollars(subtotalCents),
    gst: toDollars(gstCents),
    total: toDollars(totalCents),
    highValue: toDollars(totalCents) > config.pricing.highValueThreshold,
  };
}

// ---- exports (removed by build) ----
module.exports = { priceQuote };
