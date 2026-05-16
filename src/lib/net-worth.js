const RANGE_WINDOW_SIZES = {
  '1M': 2,
  '3M': 4,
  '6M': 7,
  '1Y': 13,
  ALL: Number.POSITIVE_INFINITY,
};

const RANGE_LABELS = {
  '1M': 'vs. 1 month ago',
  '3M': 'vs. 3 months ago',
  '6M': 'vs. 6 months ago',
  '1Y': 'vs. 1 year ago',
  ALL: 'vs. first sample',
};

export function getNetWorthWindow(history = [], range = '1Y') {
  const values = history.filter((value) => Number.isFinite(value));
  const size = RANGE_WINDOW_SIZES[range] ?? RANGE_WINDOW_SIZES['1Y'];

  if (!values.length) {
    return {
      history: [0, 0],
      total: 0,
      delta: 0,
      deltaPct: 0,
      label: RANGE_LABELS[range] ?? RANGE_LABELS['1Y'],
    };
  }

  const selected = size === Number.POSITIVE_INFINITY ? values.slice() : values.slice(-size);
  const windowHistory = selected.length >= 2 ? selected : [selected[0], selected[0]];
  const total = windowHistory.at(-1) ?? 0;
  const baseline = windowHistory[0] ?? total;
  const delta = total - baseline;

  return {
    history: windowHistory,
    total,
    delta,
    deltaPct: baseline ? (delta / baseline) * 100 : 0,
    label: RANGE_LABELS[range] ?? RANGE_LABELS['1Y'],
  };
}
