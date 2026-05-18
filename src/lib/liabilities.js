function normalizeText(value) {
  return String(value ?? '').trim();
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pickApr(aprs = []) {
  const normalized = Array.isArray(aprs) ? aprs : [];
  const preferred = normalized.find((item) => normalizeText(item?.apr_type).toLowerCase() === 'purchase_apr')
    || normalized[0]
    || null;

  if (!preferred) {
    return { apr: null, aprType: null, interestChargeAmount: null };
  }

  return {
    apr: asNumber(preferred.apr_percentage),
    aprType: normalizeText(preferred.apr_type) || null,
    interestChargeAmount: asNumber(preferred.interest_charge_amount),
  };
}

function formatMonthDayLabel(dateInput) {
  const date = new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatMonthLabel(dateInput) {
  const date = new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
}

function toDateOnly(dateInput) {
  const date = new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function daysUntil(dateInput, asOfDate) {
  const dueDate = new Date(dateInput);
  const asOf = new Date(asOfDate || new Date().toISOString().slice(0, 10));

  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(asOf.getTime())) {
    return null;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((dueDate.getTime() - asOf.getTime()) / msPerDay);
}

export function buildPlaidLiabilitySnapshot({
  account,
  liability,
  itemId,
  ownerSlug = 'john',
  asOfDate = null,
} = {}) {
  const accountType = normalizeText(account?.type).toLowerCase();
  const accountSubtype = normalizeText(account?.subtype).toLowerCase();
  const currentBalance = asNumber(account?.balances?.current);
  const creditLimit = asNumber(account?.balances?.limit);
  const minimumPaymentAmount = asNumber(liability?.minimum_payment_amount ?? liability?.next_monthly_payment);
  const nextPaymentDueDate = normalizeText(liability?.next_payment_due_date) || null;
  const lastStatementBalance = asNumber(liability?.last_statement_balance);
  const lastStatementIssueDate = normalizeText(liability?.last_statement_issue_date) || null;
  const lastPaymentAmount = asNumber(liability?.last_payment_amount);
  const lastPaymentDate = normalizeText(liability?.last_payment_date) || null;
  const originationPrincipalAmount = asNumber(liability?.origination_principal_amount);
  const nextMonthlyPayment = asNumber(liability?.next_monthly_payment);
  const { apr, aprType, interestChargeAmount } = pickApr(liability?.aprs || (liability?.interest_rate ? [{
    apr_percentage: liability.interest_rate.percentage,
    apr_type: liability.interest_rate.type,
    interest_charge_amount: null,
  }] : []));
  const liabilityType = accountType || normalizeText(liability?.type).toLowerCase() || null;

  let totalAmount = null;
  let paidAmount = null;

  if (accountType === 'credit') {
    totalAmount = creditLimit ?? lastStatementBalance ?? currentBalance;
    paidAmount = totalAmount != null && currentBalance != null ? Math.max(totalAmount - currentBalance, 0) : 0;
  } else if (accountType === 'loan') {
    totalAmount = originationPrincipalAmount ?? lastStatementBalance ?? currentBalance;
    paidAmount = totalAmount != null && currentBalance != null ? Math.max(totalAmount - currentBalance, 0) : 0;
  }

  const dueLabel = nextPaymentDueDate ? formatMonthDayLabel(nextPaymentDueDate) : null;
  const monthLabel = nextPaymentDueDate ? formatMonthLabel(nextPaymentDueDate) : null;
  const dueDay = nextPaymentDueDate ? new Date(nextPaymentDueDate).getUTCDate() : null;

  return {
    provider: 'plaid',
    externalItemId: itemId,
    externalAccountId: account?.account_id,
    ownerSlug,
    accountType: accountType || null,
    accountSubtype: accountSubtype || null,
    liabilityType,
    name: normalizeText(account?.name),
    subtitle: normalizeText(account?.official_name) || normalizeText(account?.mask) || null,
    currentBalance,
    creditLimit,
    totalAmount,
    paidAmount,
    minimumPaymentAmount,
    nextPaymentDueDate: toDateOnly(nextPaymentDueDate),
    nextPaymentDueMonth: monthLabel,
    nextPaymentDueDay: dueDay,
    nextPaymentDueLabel: dueLabel,
    lastStatementBalance,
    lastStatementIssueDate: toDateOnly(lastStatementIssueDate),
    lastPaymentAmount,
    lastPaymentDate: toDateOnly(lastPaymentDate),
    apr,
    aprType,
    interestChargeAmount,
    nextMonthlyPayment,
    originationPrincipalAmount,
    isOverdue: Boolean(liability?.is_overdue),
    daysUntilDue: nextPaymentDueDate ? daysUntil(nextPaymentDueDate, asOfDate) : null,
  };
}

export function buildPlaidLiabilityBillRow(snapshot) {
  const dueLabel = snapshot.nextPaymentDueLabel || 'Due soon';
  const amount = snapshot.minimumPaymentAmount ?? snapshot.nextMonthlyPayment ?? snapshot.lastStatementBalance ?? 0;

  return {
    provider: snapshot.provider,
    externalItemId: snapshot.externalItemId,
    externalAccountId: snapshot.externalAccountId,
    ownerSlug: snapshot.ownerSlug,
    memberSlug: snapshot.ownerSlug,
    monthLabel: snapshot.nextPaymentDueMonth || 'Soon',
    dayOfMonth: snapshot.nextPaymentDueDay || 1,
    name: snapshot.name,
    subtitle: [
      snapshot.minimumPaymentAmount != null ? `Minimum due $${snapshot.minimumPaymentAmount.toFixed(2)}` : null,
      snapshot.lastStatementBalance != null ? `Statement $${snapshot.lastStatementBalance.toFixed(2)}` : null,
      dueLabel ? `Due ${dueLabel}` : null,
    ].filter(Boolean).join(' · ') || null,
    amount,
    isSoon: Boolean(snapshot.daysUntilDue != null && snapshot.daysUntilDue <= 7),
    status: 'upcoming',
  };
}

export function buildPlaidLiabilityDebtRow(snapshot) {
  const total = snapshot.totalAmount ?? snapshot.currentBalance ?? 0;
  const paid = snapshot.paidAmount ?? Math.max(total - (snapshot.currentBalance ?? 0), 0);

  return {
    provider: snapshot.provider,
    externalItemId: snapshot.externalItemId,
    externalAccountId: snapshot.externalAccountId,
    ownerSlug: snapshot.ownerSlug,
    name: snapshot.name,
    paid,
    total,
    currentBalance: snapshot.currentBalance,
    creditLimit: snapshot.creditLimit,
    minimumPaymentAmount: snapshot.minimumPaymentAmount,
    nextPaymentDueDate: snapshot.nextPaymentDueDate,
    nextPaymentDueLabel: snapshot.nextPaymentDueLabel,
    lastStatementBalance: snapshot.lastStatementBalance,
    lastStatementIssueDate: snapshot.lastStatementIssueDate,
    lastPaymentAmount: snapshot.lastPaymentAmount,
    lastPaymentDate: snapshot.lastPaymentDate,
    apr: snapshot.apr,
    aprType: snapshot.aprType,
    interestChargeAmount: snapshot.interestChargeAmount,
    pmt: snapshot.minimumPaymentAmount ?? snapshot.nextMonthlyPayment ?? 0,
    end: snapshot.nextPaymentDueLabel || snapshot.nextPaymentDueDate || null,
    revolving: snapshot.accountType === 'credit',
    liabilityType: snapshot.liabilityType,
  };
}
