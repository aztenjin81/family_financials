const AGE_BANDS = [
  {
    minAge: 0,
    maxAge: 6,
    label: 'Little helper',
    templates: [
      { label: 'Put shoes in the basket', reward: 0.25 },
      { label: 'Put toys away after playtime', reward: 0.50 },
      { label: 'Set napkins on the table', reward: 0.25 },
    ],
  },
  {
    minAge: 7,
    maxAge: 9,
    label: 'Early school-age helper',
    templates: [
      { label: 'Pack backpack after homework', reward: 1.00 },
      { label: 'Clear dinner dishes', reward: 1.00 },
      { label: 'Feed pet before school', reward: 0.50 },
    ],
  },
  {
    minAge: 10,
    maxAge: 12,
    label: 'Independent helper',
    templates: [
      { label: 'Run dishwasher before bed', reward: 1.00 },
      { label: 'Put away laundry', reward: 1.50 },
      { label: 'Wipe kitchen counters', reward: 1.00 },
    ],
  },
  {
    minAge: 13,
    maxAge: 17,
    label: 'Teen helper',
    templates: [
      { label: 'Take out trash and recycling', reward: 1.50 },
      { label: 'Vacuum the main floor', reward: 2.00 },
      { label: 'Help load and unload the dishwasher', reward: 1.00 },
    ],
  },
  {
    minAge: 18,
    maxAge: Number.POSITIVE_INFINITY,
    label: 'Launch helper',
    templates: [
      { label: 'Review scholarship checklist', reward: 3.00 },
      { label: 'Help Jason with reading log', reward: 2.00 },
      { label: 'Plan weekly family cleanup', reward: 2.00 },
    ],
  },
];

export function getSuggestedChoreTemplates(age) {
  const numericAge = Number(age);

  if (!Number.isFinite(numericAge)) {
    return [];
  }

  const band = AGE_BANDS.find((entry) => numericAge >= entry.minAge && numericAge <= entry.maxAge);

  if (!band) {
    return [];
  }

  return band.templates.map((template) => ({
    ...template,
    ageBand: band.label,
  }));
}
