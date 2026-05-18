function asNumber(value) {
  return Number(value || 0);
}

function asNullableNumber(value) {
  if (value == null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function addMonthsUtc(date, months) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function formatMonthYear(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getDebtProjection(debt, asOfDate) {
  const paid = asNumber(debt?.paid ?? debt?.paid_amount);
  const total = asNumber(debt?.total ?? debt?.total_amount);
  const currentBalance = asNullableNumber(debt?.currentBalance ?? debt?.current_balance);
  const apr = asNumber(debt?.apr);
  const payment = asNumber(debt?.pmt ?? debt?.payment_amount);
  const remaining = currentBalance != null ? Math.max(currentBalance, 0) : Math.max(total - paid, 0);
  const progressPct = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const monthlyRate = apr / 100 / 12;

  if (!Number.isFinite(remaining) || !Number.isFinite(progressPct)) {
    return {
      remaining: 0,
      progressPct: 0,
      estimatedMonths: null,
      estimatedInterest: null,
      payoffLabel: 'Projection unavailable',
      status: 'unknown',
    };
  }

  if (remaining === 0) {
    return {
      remaining: 0,
      progressPct,
      estimatedMonths: 0,
      estimatedInterest: 0,
      payoffLabel: 'Paid off',
      status: 'paid',
    };
  }

  if (!Number.isFinite(payment) || payment <= 0) {
    return {
      remaining,
      progressPct,
      estimatedMonths: null,
      estimatedInterest: null,
      payoffLabel: 'No payment set',
      status: 'unknown',
    };
  }

  if (monthlyRate > 0 && payment <= remaining * monthlyRate) {
    return {
      remaining,
      progressPct,
      estimatedMonths: null,
      estimatedInterest: null,
      payoffLabel: 'Payment too low',
      status: 'warning',
    };
  }

  let balance = remaining;
  let interestTotal = 0;
  let months = 0;
  const startDate = asOfDate ? new Date(asOfDate) : new Date();

  while (balance > 0.005 && months < 600) {
    const interest = balance * monthlyRate;
    const nextBalance = balance + interest - payment;

    interestTotal += interest;
    months += 1;
    balance = nextBalance <= 0 ? 0 : nextBalance;
  }

  const projectedPayoff = addMonthsUtc(startDate, months);
  const payoffLabel = `${formatMonthYear(projectedPayoff)}`;

  return {
    remaining: roundMoney(remaining),
    progressPct: roundMoney(progressPct),
    estimatedMonths: months,
    estimatedInterest: roundMoney(interestTotal),
    payoffLabel,
    status: 'projected',
  };
}
