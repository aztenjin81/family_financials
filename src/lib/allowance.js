const DEFAULT_WEEKLY_ALLOWANCE = 5;
const DEFAULT_ALLOWANCE_SPLIT = {
  spend: 0.5,
  save: 0.3,
  give: 0.2,
};

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function getAllowanceSplit(total = DEFAULT_WEEKLY_ALLOWANCE, split = DEFAULT_ALLOWANCE_SPLIT) {
  const weeklyAmount = roundCurrency(total);
  const spend = roundCurrency(weeklyAmount * (split.spend ?? DEFAULT_ALLOWANCE_SPLIT.spend));
  const save = roundCurrency(weeklyAmount * (split.save ?? DEFAULT_ALLOWANCE_SPLIT.save));
  const give = roundCurrency(weeklyAmount - spend - save);

  return {
    weeklyAmount,
    spend,
    save,
    give,
  };
}

export function formatAllowancePaidLabel(paidAt) {
  if (!paidAt) {
    return 'Unknown date';
  }

  const date = new Date(paidAt);

  if (Number.isNaN(date.getTime())) {
    return String(paidAt);
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function groupAllowancePayments(payments = []) {
  const grouped = new Map();

  for (const payment of payments) {
    const paidAt = payment.paidAt || payment.paid_at || null;
    const date = paidAt ? new Date(paidAt) : null;
    const key = date && !Number.isNaN(date.getTime()) ? date.toISOString() : 'unknown';

    if (!grouped.has(key)) {
      grouped.set(key, {
        paidAt: key,
        label: formatAllowancePaidLabel(key),
        entries: [],
        total: 0,
      });
    }

    const batch = grouped.get(key);
    const weeklyAmount = roundCurrency(payment.weeklyAmount ?? payment.weekly_amount ?? 0);
    const spendAmount = roundCurrency(payment.spendAmount ?? payment.spend_amount ?? 0);
    const saveAmount = roundCurrency(payment.saveAmount ?? payment.save_amount ?? 0);
    const giveAmount = roundCurrency(payment.giveAmount ?? payment.give_amount ?? 0);

    batch.entries.push({
      id: payment.id ?? null,
      memberSlug: payment.memberSlug ?? payment.member_slug ?? null,
      memberName: payment.memberName ?? payment.member_name ?? null,
      weeklyAmount,
      spendAmount,
      saveAmount,
      giveAmount,
    });
    batch.total = roundCurrency(batch.total + weeklyAmount);
  }

  return [...grouped.values()]
    .sort((left, right) => right.paidAt.localeCompare(left.paidAt))
    .map((batch) => ({
      ...batch,
      label: batch.total < 0 ? `${batch.label} · Reversal` : batch.label,
      entries: batch.entries.sort((left, right) => (left.memberName || '').localeCompare(right.memberName || '')),
    }));
}
