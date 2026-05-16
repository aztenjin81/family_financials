const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toUtcDate(value) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  if (typeof value === 'string') {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }
  }

  const parsed = new Date(value);
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function formatMonthDay(date) {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function formatDateRangeLabel(start, days) {
  const startDate = toUtcDate(start);
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + days - 1);

  if (startDate.getUTCMonth() === endDate.getUTCMonth()) {
    return `${formatMonthDay(startDate)}-${endDate.getUTCDate()}`;
  }

  return `${formatMonthDay(startDate)}-${formatMonthDay(endDate)}`;
}

export function formatBillsWindowLabel(start, days = 14) {
  return `Next ${days} days · ${formatDateRangeLabel(start, days)}`;
}
