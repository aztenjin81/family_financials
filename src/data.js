/* eslint-disable */
/* Fake data for the Harper Family — plausible household finance */

export const DATA = {
  family: 'The Czechowski Family',
  asOf: 'Monday, May 11, 2026',

  netWorth: {
    total: 487420.18,
    delta30: 4280,
    deltaPct: 0.89,
    history: [
      462000, 463500, 461800, 465200, 467900, 470100, 469800,
      472400, 473800, 475200, 478100, 479900, 481200, 480400,
      482900, 484100, 485600, 484900, 486200, 487420
    ],
  },

  monthSpend: { spent: 6842, budget: 9200, daysLeft: 20 },

  cashflow30: { incoming: 14820, outgoing: 11260, net: 3560 },

  accounts: [
    { group: 'Cash', items: [
      { name: 'Chase Joint Checking', sub: '••4421', icon: 'Bank', bal: 8420.55, owner: 'alex' },
      { name: 'Ally Savings', sub: 'High-yield 4.10% APY', icon: 'Vault', bal: 24180.00, owner: 'sam' },
      { name: 'Cash Reserve', sub: 'Emergency', icon: 'Vault', bal: 18200.00, owner: 'alex' },
    ]},
    { group: 'Credit', items: [
      { name: 'Apple Card', sub: 'Statement May 18', icon: 'Card', bal: -842.19, owner: 'sam' },
      { name: 'Chase Sapphire', sub: 'Statement May 22', icon: 'Card', bal: -2188.40, owner: 'alex' },
    ]},
    { group: 'Investments', items: [
      { name: 'Vanguard Brokerage', sub: 'Joint taxable', icon: 'Stock', bal: 84120.00, owner: 'alex' },
      { name: 'Fidelity 401(k) — John', sub: 'Pre-tax', icon: 'Stock', bal: 162400.00, owner: 'alex' },
      { name: 'Fidelity 401(k) — Sam', sub: 'Pre-tax', icon: 'Stock', bal: 98220.00, owner: 'sam' },
      { name: '529 — Mia', sub: 'NY Direct', icon: 'Stock', bal: 18420.00, owner: 'mia' },
      { name: '529 — Theo', sub: 'NY Direct', icon: 'Stock', bal: 11860.00, owner: 'theo' },
    ]},
    { group: 'Property & Debt', items: [
      { name: 'Home — 14 Maple St.', sub: 'Zillow est.', icon: 'Home', bal: 612000.00, owner: 'alex' },
      { name: 'Mortgage', sub: 'Wells Fargo · 5.85%', icon: 'Home', bal: -428400.00, owner: 'alex' },
      { name: '2022 Honda Odyssey', sub: 'KBB est.', icon: 'Car', bal: 28200.00, owner: 'sam' },
      { name: 'Auto Loan', sub: 'Honda Financial', icon: 'Car', bal: -12420.00, owner: 'sam' },
    ]},
  ],

  spending: [
    { cat: 'Groceries',       color: '#1F7A4D', spent: 1284, budget: 1400 },
    { cat: 'Dining out',      color: '#C94A2C', spent: 612, budget: 450 },
    { cat: 'Kids & school',   color: '#D9A322', spent: 488, budget: 600 },
    { cat: 'Gas & transit',   color: '#2B5FB8', spent: 322, budget: 400 },
    { cat: 'Subscriptions',   color: '#6B3A85', spent: 184, budget: 180 },
    { cat: 'Home & utilities',color: '#8A857A', spent: 940, budget: 1100 },
    { cat: 'Health',          color: '#1F7A4D', spent: 210, budget: 350 },
    { cat: 'Fun money',       color: '#D9A322', spent: 402, budget: 500 },
  ],

  // 90-day forecast, weekly buckets — pairs of (income, expense)
  forecast: [
    { week: 'W19', in: 0,    out: 1820 },
    { week: 'W20', in: 3700, out: 1240 },
    { week: 'W21', in: 0,    out: 2480 }, // mortgage week
    { week: 'W22', in: 3700, out: 1100 },
    { week: 'W23', in: 0,    out: 1340 },
    { week: 'W24', in: 3700, out: 1180 },
    { week: 'W25', in: 0,    out: 2480 },
    { week: 'W26', in: 3700, out: 1420 },
    { week: 'W27', in: 0,    out: 1820 }, // vacation
    { week: 'W28', in: 3700, out: 1280 },
    { week: 'W29', in: 0,    out: 1100 },
    { week: 'W30', in: 3700, out: 2480 },
  ],

  goals: [
    { name: 'Italy 2026',      current: 4820, target: 7500,  color: '#C94A2C', by: 'Aug 2026', owner: 'sam' },
    { name: 'Emergency fund',  current: 18200, target: 24000, color: '#1F7A4D', by: 'Dec 2026', owner: 'alex' },
    { name: "Mia's college",   current: 18420, target: 80000, color: '#D9A322', by: '2031',     owner: 'mia' },
    { name: 'New roof',        current: 2400,  target: 12000, color: '#2B5FB8', by: 'Spring 27', owner: 'alex' },
  ],

  transactions: [
    { day: 'Today · Mon May 11', items: [
      { emoji: '🛒', merch: 'Whole Foods Market', cat: 'Groceries', who: 'alex', amt: -142.18, time: '11:42 AM' },
      { emoji: '☕', merch: 'Blue Bottle Coffee', cat: 'Dining out', who: 'sam', amt: -6.75, time: '8:14 AM' },
    ]},
    { day: 'Sun May 10', items: [
      { emoji: '⛽', merch: 'Shell · Pump 4', cat: 'Gas', who: 'sam', amt: -54.20, time: '4:02 PM' },
      { emoji: '🎬', merch: 'AMC Theatres', cat: 'Fun', who: 'alex', amt: -48.00, time: '1:18 PM' },
      { emoji: '🍕', merch: "Joe's Pizza", cat: 'Dining out', who: 'alex', amt: -38.40, time: '12:40 PM' },
    ]},
    { day: 'Sat May 9 · payday', items: [
      { emoji: '💼', merch: 'Acme Corp — Payroll', cat: 'Income', who: 'alex', amt: 3712.40, time: '6:00 AM', income: true },
      { emoji: '🏠', merch: 'Mortgage Auto-Pay', cat: 'Housing', who: 'alex', amt: -2480.00, time: '6:00 AM' },
      { emoji: '🎒', merch: 'Target', cat: 'Kids', who: 'sam', amt: -68.94, time: '3:22 PM' },
    ]},
    { day: 'Fri May 8', items: [
      { emoji: '💡', merch: 'Con Edison', cat: 'Utilities', who: 'alex', amt: -148.20, time: '9:00 AM' },
      { emoji: '📱', merch: 'Verizon Wireless', cat: 'Bills', who: 'sam', amt: -184.99, time: '9:00 AM' },
    ]},
  ],

  bills: [
    { date: { m: 'May', d: 14 }, name: 'Netflix',         sub: 'Subscriptions', amt: 22.99, soon: true,  who: 'sam' },
    { date: { m: 'May', d: 18 }, name: 'Apple Card',      sub: 'Min. due $35',  amt: 842.19, soon: true,  who: 'sam' },
    { date: { m: 'May', d: 22 }, name: 'Internet — Verizon', sub: 'Autopay', amt: 79.99,  soon: false, who: 'alex' },
    { date: { m: 'Jun', d: 1  }, name: 'Mortgage',        sub: 'Wells Fargo',    amt: 2480.00, soon: false, who: 'alex' },
    { date: { m: 'Jun', d: 4  }, name: 'Auto Loan',       sub: 'Honda Financial', amt: 412.00, soon: false, who: 'sam' },
  ],

  investments: {
    total: 374000,
    delta: 1842.30,
    deltaPct: 0.49,
    holdings: [
      { tk: 'VTI',   name: 'Vanguard Total Market', val: 84200,  d: 0.62 },
      { tk: 'VXUS',  name: 'Vanguard Intl.',         val: 32100,  d: -0.18 },
      { tk: 'BND',   name: 'Vanguard Bonds',         val: 28400,  d: 0.04 },
      { tk: 'AAPL',  name: 'Apple Inc.',             val: 12400,  d: 1.42 },
      { tk: 'TSLA',  name: 'Tesla',                   val: 4220,   d: -2.10 },
    ],
  },

  debts: [
    { name: 'Mortgage',     paid: 71600,  total: 500000, apr: 5.85, pmt: 2480, end: 'Aug 2052' },
    { name: 'Auto Loan',    paid: 9580,   total: 22000,  apr: 6.20, pmt: 412,  end: 'Nov 2027' },
    { name: 'Apple Card',   paid: 0,      total: 842,    apr: 22.99, pmt: 35,  end: '—', revolving: true },
  ],

  kids: [
    {
      who: 'mia', name: 'Mia', age: 11,
      balance: 64.50,
      jars: { spend: 24.50, save: 30.00, give: 10.00 },
      chores: [
        { label: 'Empty dishwasher', reward: 1.00, done: true },
        { label: 'Walk Biscuit (mon/wed/fri)', reward: 3.00, done: true },
        { label: 'Finish reading log', reward: 2.00, done: false },
        { label: 'Tidy bedroom by Sunday', reward: 2.00, done: false },
      ],
    },
    {
      who: 'theo', name: 'Theo', age: 7,
      balance: 18.25,
      jars: { spend: 8.25, save: 8.00, give: 2.00 },
      chores: [
        { label: 'Feed Biscuit', reward: 0.50, done: true },
        { label: 'Brush teeth (no reminders!)', reward: 1.00, done: false },
        { label: 'Put away laundry', reward: 1.50, done: false },
      ],
    },
  ],

  insight: {
    text: "You're on track this month — but dining out is at 136% of budget with 20 days to go. Sam suggested moving Friday's planned takeout to a freezer-pizza night to save about $48.",
  },
};
