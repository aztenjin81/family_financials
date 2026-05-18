import { normalizeDateInput, parseTransactionDateLabel } from './transaction-date.js';

function normalizeCategory(value) {
  return String(value ?? '').trim();
}

function normalizeAmountFilter(value) {
  if (value == null || value === '') {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function flattenTransactionGroups(groups = [], asOfDate) {
  return groups.flatMap((group, groupIndex) => {
    const groupDate = group.date || parseTransactionDateLabel(group.day, asOfDate);

    return (group.items ?? []).map((item, itemIndex) => ({
      ...item,
      dayLabel: group.day,
      date: item.postedDate || groupDate,
      groupIndex,
      itemIndex,
    }));
  });
}

export function filterTransactionRows(groups = [], filters = {}, asOfDate) {
  const merchant = String(filters.merchant ?? '').trim().toLowerCase();
  const memberSlug = String(filters.memberSlug ?? '').trim();
  const category = String(filters.category ?? '').trim();
  const dateFrom = normalizeDateInput(filters.dateFrom);
  const dateTo = normalizeDateInput(filters.dateTo);
  const amountMin = normalizeAmountFilter(filters.amountMin);
  const amountMax = normalizeAmountFilter(filters.amountMax);

  return flattenTransactionGroups(groups, asOfDate)
    .filter((row) => {
      if (memberSlug && row.who !== memberSlug) {
        return false;
      }

      if (category && row.cat !== category) {
        return false;
      }

      if (merchant && !String(row.merch ?? '').toLowerCase().includes(merchant)) {
        return false;
      }

      if (dateFrom && row.date < dateFrom) {
        return false;
      }

      if (dateTo && row.date > dateTo) {
        return false;
      }

      const absAmount = Math.abs(Number(row.amt) || 0);

      if (amountMin != null && absAmount < amountMin) {
        return false;
      }

      if (amountMax != null && absAmount > amountMax) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      if (left.date !== right.date) {
        return right.date.localeCompare(left.date);
      }

      if (left.groupIndex !== right.groupIndex) {
        return left.groupIndex - right.groupIndex;
      }

      return left.itemIndex - right.itemIndex;
    });
}

export function buildTransactionCategoryOptions(dashboardData) {
  const categories = new Set();

  for (const category of dashboardData.spending ?? []) {
    const name = normalizeCategory(category.cat ?? category.name);
    if (name) {
      categories.add(name);
    }
  }

  for (const group of dashboardData.transactions ?? []) {
    for (const transaction of group.items ?? []) {
      const name = normalizeCategory(transaction.cat);
      if (name) {
        categories.add(name);
      }
    }
  }

  return [...categories].sort((left, right) => left.localeCompare(right));
}
