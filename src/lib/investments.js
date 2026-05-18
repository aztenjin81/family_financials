function asNumber(value) {
  return Number(value || 0);
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function getHoldingValue(holding) {
  return asNumber(holding?.value ?? holding?.val);
}

function getHoldingChangePercent(holding) {
  return asNumber(holding?.daily_change_percent ?? holding?.d);
}

export function getHoldingDeltaAmount(holding) {
  const currentValue = getHoldingValue(holding);
  const percentChange = getHoldingChangePercent(holding);

  if (!Number.isFinite(currentValue) || !Number.isFinite(percentChange)) {
    return 0;
  }

  const previousValue = percentChange === -100
    ? 0
    : currentValue / (1 + percentChange / 100);

  return roundMoney(currentValue - previousValue);
}

export function getInvestmentPerformance(holdings = []) {
  if (!Array.isArray(holdings) || holdings.length === 0) {
    return {
      total: 0,
      delta: 0,
      deltaPct: 0,
    };
  }

  let currentTotal = 0;
  let previousTotal = 0;

  for (const holding of holdings) {
    const currentValue = getHoldingValue(holding);
    const percentChange = getHoldingChangePercent(holding);
    const previousValue = percentChange === -100
      ? 0
      : currentValue / (1 + percentChange / 100);

    currentTotal += currentValue;
    previousTotal += previousValue;
  }

  const delta = currentTotal - previousTotal;

  return {
    total: roundMoney(currentTotal),
    delta: roundMoney(delta),
    deltaPct: previousTotal ? roundMoney((delta / previousTotal) * 100) : 0,
  };
}
