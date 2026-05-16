const MONTHS = new Map([
  ['Jan', 0],
  ['Feb', 1],
  ['Mar', 2],
  ['Apr', 3],
  ['May', 4],
  ['Jun', 5],
  ['Jul', 6],
  ['Aug', 7],
  ['Sep', 8],
  ['Oct', 9],
  ['Nov', 10],
  ['Dec', 11],
]);

function pad(value) {
  return String(value).padStart(2, '0');
}

function toUtcDate(value) {
  const normalized = normalizeDateInput(value);

  if (!normalized) {
    return null;
  }

  return new Date(`${normalized}T00:00:00Z`);
}

function formatShortDate(date) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date);
  const month = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
  const day = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);

  return `${weekday} ${month} ${day}`;
}

export function normalizeDateInput(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '';
    }

    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }

  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  return '';
}

export function parseTransactionDateLabel(label, asOfDate) {
  const text = String(label || '').trim();
  const normalizedAsOf = normalizeDateInput(asOfDate);

  if (!text) {
    return normalizedAsOf;
  }

  const isoDate = normalizeDateInput(text);

  if (isoDate) {
    return isoDate;
  }

  if (text.startsWith('Today')) {
    return normalizedAsOf;
  }

  const baseLabel = text.split('·')[0].trim();
  const match = baseLabel.match(/^([A-Za-z]{3}) ([A-Za-z]{3}) (\d{1,2})$/);

  if (!match) {
    return normalizedAsOf;
  }

  const monthIndex = MONTHS.get(match[2]);

  if (monthIndex == null) {
    return normalizedAsOf;
  }

  const referenceYear = normalizedAsOf ? Number(normalizedAsOf.slice(0, 4)) : new Date().getUTCFullYear();
  const date = new Date(Date.UTC(referenceYear, monthIndex, Number(match[3])));

  if (Number.isNaN(date.getTime())) {
    return normalizedAsOf;
  }

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function formatTransactionDayLabel(dateValue, asOfDate) {
  const normalizedDate = normalizeDateInput(dateValue);
  const normalizedAsOf = normalizeDateInput(asOfDate);
  const date = toUtcDate(normalizedDate);

  if (!date) {
    return '';
  }

  const formatted = formatShortDate(date);

  if (normalizedAsOf && normalizedDate === normalizedAsOf) {
    return `Today · ${formatted}`;
  }

  return formatted;
}
