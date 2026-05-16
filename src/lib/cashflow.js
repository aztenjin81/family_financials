export function getCashflowStatus(cashflow) {
  const incoming = Number(cashflow?.incoming);
  const outgoing = Number(cashflow?.outgoing);
  const net = Number.isFinite(Number(cashflow?.net))
    ? Number(cashflow.net)
    : incoming - outgoing;

  if (!Number.isFinite(incoming) || !Number.isFinite(outgoing) || !Number.isFinite(net)) {
    return { key: 'unknown', label: 'Cashflow unavailable', tagClass: 'warn' };
  }

  if (net <= 0) {
    return { key: 'negative', label: 'Cashflow negative', tagClass: 'alert' };
  }

  const cushion = outgoing > 0 ? net / outgoing : 1;

  if (cushion < 0.15 || net < 500) {
    return { key: 'tight', label: 'Thin cushion', tagClass: 'warn' };
  }

  return { key: 'healthy', label: 'Healthy', tagClass: 'ok' };
}
