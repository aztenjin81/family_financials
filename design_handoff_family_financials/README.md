# Handoff: Hearth — Family Financials Dashboard

## Overview

**Hearth** is a high-fidelity family finance dashboard, designed as a self-hosted alternative to Mint. The hero view is the household **Overview**: net worth, monthly spending vs. budget, projected cashflow, accounts, goals, transactions, bills, investments, debt payoff, and a kids' allowance / chores zone. The product is designed around a four-person family (two adults + two kids) with shared visibility, per-member attribution on every dollar, and a Robinhood-style **hide-balances** toggle so the screen is safe to show on a TV or in a coffee shop.

## About the Design Files

The files in this bundle are **design references created in HTML/React** — a working prototype showing the intended look, behavior, and information architecture. They are **not production code to copy directly**.

Your task is to **recreate these designs in the target codebase's environment** (Next.js, Remix, SvelteKit, etc.) using its established patterns, component library, and data layer — or, if no environment exists yet, pick the most appropriate stack for the project and implement there. The prototype uses inline Babel-compiled JSX with hand-rolled CSS so the reference is easy to inspect; the real implementation should use whatever component primitives, styling system (Tailwind / CSS-in-JS / vanilla), and data-fetching solution the host codebase prefers.

## Fidelity

**High-fidelity.** Every color, font, spacing value, and interaction is specified. Recreate pixel-perfectly using the codebase's existing libraries — match the visual treatment exactly, but adapt the implementation to fit local conventions.

---

## Screens / Views

There is currently **one screen**: the **Overview** dashboard. Top-bar tabs for `Overview / Budget / Accounts / Goals / Investments / Kids` are wired as state but only Overview has content; treat the others as future scope.

### Overall layout

- **Max content width**: 1480 px, centered, with 28 px horizontal padding and 22 px / 80 px top/bottom.
- **Background**: warm paper cream (`--paper: #F2EEE3`)
- **Grid structure** (top → bottom):
  1. **Top bar** — brand, tab pill group (centered), action cluster (right)
  2. **Greeting strip** — "Good morning, Alex." + date label + quick-action buttons
  3. **AI insight banner** (dark, full-width) — optional, dismissible
  4. **Hero row** — 3 cards in a `1.4fr 1fr 1fr` grid: Net Worth · This Month · 30-day Cashflow
  5. **Main row** — 3 columns `280px 1fr 320px`: Accounts rail · (Spending + Forecast stacked) · Goals
  6. **Bottom row** — 3 columns `1.2fr 1fr 1fr`: Transactions · Bills · (Investments + Debt stacked)
  7. **Kids zone** — full-width card with two inner panels (Mia / Theo)
  8. **Footer** — muted meta line
- **Gap between cards**: 16 px both axes
- **Gap between row sections**: 16–22 px

### Component-level specs

Every card uses the same shell:
- `background: #FBF8F0` (--card)
- `border: 1px solid rgba(21,20,15,0.10)` (--line)
- `border-radius: 14px`
- `padding: 18px 20px`
- `box-shadow: 0 1px 0 rgba(21,20,15,0.04), 0 2px 8px rgba(21,20,15,0.04)`

Each card has a header with:
- A small uppercase label (11px, letter-spacing 0.14em, color `--mute #6F695C`)
- A serif title (Instrument Serif 22px, line-height 1.22, with `<em>` for accent italics)
- An optional right-side control (range toggle / tag / link / icon button)

#### 1. Top bar

- Height: ~58 px, bottom border 1px line, 18 px bottom margin
- **Left — brand**: "Hearth" in Instrument Serif 30 px with a red italic dot (`<em>·</em>`). Below: uppercase label "THE HARPER FAMILY" 12px, letter-spacing 0.12em, color --mute.
- **Center — tab pills**: rounded 999px container `background: --card`, `border: 1px solid --line`, padding 4 px. Each tab is a pill button 13 px / 500 weight; active tab is `background: --ink #15140F`, color paper. Inactive: transparent, color --mute, hover → --ink.
- **Right — actions**: 36×36 px icon buttons (search, bell with red dot, eye toggle), then a 1×22 line divider, then a stack of four 32 px circular member avatars overlapped by -8 px with a 2px paper border. Each avatar shows the member's initial in Instrument Serif on their assigned color.

#### 2. Greeting

- Date label (uppercase 11px) → h1 Instrument Serif 44 px, weight 400, line-height 1.12, letter-spacing -0.02em, text-wrap balance. "Alex." set as `<em>` in `--red`. Below: muted 13 px subtitle.
- Right: two action buttons — outline-style "Add transaction" and filled-dark "Reconcile accounts". Both ~32 px tall, font-size 12 px / 500 weight, with --line border, padding 0 14 px.

#### 3. AI insight banner

- `background: --ink`, color: --paper, border-radius 14 px, padding 16px 20px, 18 px bottom margin.
- 36×36 gold icon tile (rounded 8 px, `--gold #D9A322`) with serif italic `✦` glyph.
- Body text 13 px / 1.45 line-height; "Heads up · " label in gold.
- Right: ghost button (transparent, 1px white-alpha border) + primary button (gold fill, ink text).

#### 4. Hero — Net Worth card

- Tall card (~200 px), flex column.
- Header: label "Net worth", muted "Combined household · 11 accounts" + a range-toggle pill group on the right with options `1M / 3M / 6M / 1Y / ALL`. Active option: white fill with subtle shadow inside a `--paper-2` track. Font: Geist Mono 11 px.
- Figure: huge serif money `$487,420.18` — Instrument Serif 56 px / line-height 1, letter-spacing -0.02em, with cents as a subscripted span at 0.55em font-size, lifted via vertical-align 0.4em.
- Delta pill: `↑ +$4,280` in a green pill (`--green #1F7A4D` on `--green-2 #E5EFE2`), 12 px Geist Mono, padding 2px 7px, radius 999.
- Sparkline: 70 px tall, ink stroke 1.4 px, area fill `rgba(31,122,77,0.10)`, with a 2 px dot on the last point. Pinned to bottom of card via `margin-top: auto`.

#### 5. Hero — This Month spend

- Layout: ring chart (100 px diameter, 11 px stroke, red progress on `--paper-2` track) next to a stat block.
- Inside ring: centered "75%" (18 px / 600 weight) and "of budget" muted 11 px.
- Right block: `$6,842` med serif (28 px), "of $9,200 budgeted" muted 11 px, then "$2,358 left for 20 days".
- Top-right header tag: small "on track" pill in `--green-2 / --green`, 10 px uppercase letter-spacing 0.08em.

#### 6. Hero — 30-day Cashflow (dark)

- Same card shell but `background: --ink`, color: --paper, border: --ink.
- Top-right: "healthy" tag in `rgba(217,163,34,0.18)` background, gold text.
- Big serif `+$3,560` (forced sign), 56 px.
- Two-column grid below: muted "Incoming" label + green `+$14,820` (16 px Geist Mono); "Outgoing" label + red `−$11,260`.

#### 7. Accounts rail

- Card aligned to start of row.
- Header: label "Accounts" + serif title "Where the *money* lives" + 28 px `+` icon button.
- For each group (`Cash / Credit / Investments / Property & Debt`):
  - Section head: dashed-bottom row with uppercase label and item count
  - Account rows: grid `28px 1fr auto` — icon tile (28 px rounded 7 px, `--paper-2` background), name + sub, balance. Row padding 10 px 8 px, hover background `--paper-2`, radius 8 px.
  - Account icons (single-stroke 14 px line-art): Bank, Card, Vault, Home, Stock, Car (SVG defined in `components.jsx`).
- Negative balances render in red with a forced `−` sign.
- Footer: muted line + a pulsing red dot + "Synced 4 min ago" (red dot animates via `pulse-dot` keyframe, 1.6s ease-in-out infinite).

#### 8. Spending by category

- Header: serif "Budgets vs. actuals" + right-aligned `total $X of $Y`.
- Rows: grid `148px 1fr 140px` — category name with 10×10 color swatch, bar, values.
- Bar track: 22 px tall, radius 6 px, `--paper-2` fill.
- Bar fill: category color, width = `min(100%, spent/budget)`, with percentage label inside (Geist Mono 11 px, paper color, padded 8 px from left). When `spent > budget`, fill switches to a `repeating-linear-gradient(-45deg, --red 0 6px, #B0411F 6px 12px)` candy-stripe in white.
- Values column right-aligned: `$1,284 / $1,400` Geist Mono 12 px, denominator muted.

Categories in order with colors:
| Category | Color | Spent | Budget |
|---|---|---|---|
| Groceries | #1F7A4D | 1284 | 1400 |
| Dining out | #C94A2C | 612 | 450 (over) |
| Kids & school | #D9A322 | 488 | 600 |
| Gas & transit | #2B5FB8 | 322 | 400 |
| Subscriptions | #6B3A85 | 184 | 180 (over) |
| Home & utilities | #8A857A | 940 | 1100 |
| Health | #1F7A4D | 210 | 350 |
| Fun money | #D9A322 | 402 | 500 |

#### 9. Cashflow forecast chart

- 12-week bar+line combo chart, SVG viewBox `0 0 720 220`, preserveAspectRatio none.
- Padding `{ l: 54, r: 16, t: 24, b: 32 }`.
- 3 horizontal grid lines (dashed 2 4 in --line color) at 0 / 50% / 100% of max.
- Y-axis labels: Geist Mono 11 px, mute color, `$Xk` rounded, hidden as `•••` when balances are hidden.
- For each week: grouped bars — income (`--green`, opacity 0.85) and expense (`--red`, opacity 0.85), bar width = 0.35 × bucket width, radius 2 px.
- Running-balance line overlay: ink stroke 1.6 px with 2.5 px dots (card fill, ink stroke) at every week.
- Vertical dashed "TODAY" indicator with a small 10 px label.
- X-axis labels render every other bucket only.
- Legend in card header: three swatches (green square / red square / ink line) with labels "Income / Expenses / Projected balance" at 11 px.

#### 10. Goals card

- Header: serif "What we're *saving for*" + 28 px `+` icon button.
- Goal rows separated by 1 px lines:
  - Top: 20 px owner avatar + serif goal name (18 px, line-height 1.15, white-space nowrap with ellipsis, max-width 180px) — left side; percentage 12 px Geist Mono mute — right.
  - Bar: 8 px tall, radius 999 px, track `--paper-2`, fill in goal color.
  - Meta row: 11 px Geist Mono mute — `$current / $target` on left, `by <date>` on right.

Goals: Italy 2026 (red, Sam), Emergency fund (green, Alex), Mia's college (gold, Mia), New roof (blue, Alex).

#### 11. Transactions card

- Header: serif "Latest *transactions*" + muted "View all →" link.
- Day groups: uppercase 10 px label (e.g. "TODAY · MON MAY 11") with dashed bottom border, and a right-aligned forced-sign daily total in Geist Mono.
- Transaction row: grid `32px 1fr auto auto` — emoji tile (32 px, `--paper-2` background, radius 8 px, 16 px emoji), merchant 13 px / 500 weight, meta row (11 px muted: category · time · member chip with 8 px colored dot), amount (Geist Mono 13 px, cents shown, green for income, forced minus sign otherwise).
- 1 px bottom border per row except last.

#### 12. Bills card

- Header: serif "Next *14 days*" + muted "$X total".
- Bill row: grid `44px 1fr auto` — date tile / details / amount.
- Date tile: 44 px wide, rounded 8 px, white background with --line border, padding 4 px 0. Inner: month abbreviation 9 px uppercase letter-spacing 0.1em in red, and day in Instrument Serif 18 px. "Due soon" bills swap the date tile to `--red-2` background with `--red` border.
- Details: bill name 13 px / 500, sub-line 11 px muted with owner chip.

#### 13. Investments card

- Header: label "Investments" + serif "Portfolio *today*" + a delta pill on the right.
- Total: 28 px serif money + muted "+$1,842.30 · 0.49% today".
- Holdings row: grid `1fr auto auto` — ticker (Geist Mono 12 px 600) + name (11 px muted), value, percent delta pill.

Holdings: VTI 84200 (+0.62%), VXUS 32100 (-0.18%), BND 28400 (+0.04%), AAPL 12400 (+1.42%), TSLA 4220 (-2.10%).

#### 14. Debt card

- Header: label "Debt payoff" + serif "Climbing *down*" + a warn tag "3 active" (`--gold-2` / `#8a6611`).
- Per-debt block:
  - Top row: name 13 px / 500 + APR (Geist Mono 12 px).
  - Bar: 6 px tall, radius 999, ink fill on `--paper-2` track.
  - Meta: 11 px Geist Mono — "$X paid of $Y" left, "$Z/mo · <end date>" right (with "min " prefix on revolving accounts).

Debts: Mortgage 71600/500000 @ 5.85% → 2480/mo until Aug 2052; Auto Loan 9580/22000 @ 6.20% → 412/mo until Nov 2027; Apple Card 0/842 @ 22.99% revolving → min 35/mo.

#### 15. Kids zone

- Full-width card, 22 px / 24 px padding.
- Header: label + serif title "*The little* Harpers" (24 px) + two action buttons on right (`History` ghost, `Pay weekly allowance` primary gold).
- Inner grid: two equal columns, 18 px gap.
- **Kid panel** (each kid):
  - White inner card, --line border, radius 12 px, 16/18 px padding.
  - Head: 44 px member avatar + name in Instrument Serif italic 22 px + meta line "Age N · weekly allowance $X.XX".
  - Balance row: dashed top and bottom borders, muted "Balance" label + 28 px serif money.
  - Three jars in equal-column grid (Spend / Save / Give), each on `--paper` background radius 8 px: tiny uppercase label 9 px letter-spacing 0.1em + 13 px Geist Mono amount.
  - Chore list: rows of `16px 1fr auto` — checkbox 16×16 (1.5 px ink border, radius 4 px; when done: ink fill with paper checkmark), label (line-through + mute when done), reward `+$X.XX` in green Geist Mono 11 px 600.

Mia (11): balance $64.50, jars 24.50/30/10, chores: Empty dishwasher ($1, done), Walk Biscuit ($3, done), Reading log ($2), Tidy bedroom ($2).
Theo (7): balance $18.25, jars 8.25/8/2, chores: Feed Biscuit ($0.50, done), Brush teeth ($1), Put away laundry ($1.50).

---

## Interactions & Behavior

### Hide-balances toggle (THE killer feature)
- Eye icon in the top-right action cluster.
- When **on**, every monetary value renders as `$••••••` (count of dots roughly proportional to the digit count of the value, min 4).
- Cents drop entirely when hidden.
- All charts that show $ axis labels (forecast Y-axis) also swap to `•••`.
- Sparklines stay visible (the *shape* of the trend isn't sensitive — only the absolute numbers are). This is the same trade-off Robinhood makes.
- Toggle state is component-level (`useState` in `App`) — implement as a single shared store/context in the real app so it works across routes.

### Chore checkboxes
- Click anywhere on the checkbox to toggle. State is keyed by `kidIndex-choreIndex` in a flat object.
- Done state: filled ink box with paper checkmark, label line-through and muted, reward stays green.

### Tab pills
- State only; only "Overview" has content. Active tab → ink/paper inversion.

### Range toggle on Net Worth
- Pill segmented control: 1M / 3M / 6M / 1Y / ALL. State only in the prototype — wire to chart data range in real app.

### Account rows
- Hover → `--paper-2` background. No click handler in prototype; should link to account detail view.

### AI insight banner
- Dismissible (Tweaks panel toggles visibility but the in-card "Dismiss" button should hide it for the session in real impl).

### Animations
- `pulse-dot` keyframe: opacity 1 → 0.3 → 1 over 1.6s ease-in-out infinite (sync indicator).
- No page-level transitions or scroll behaviors. Keep it calm.

---

## State Management

Minimum store shape:
```ts
{
  // global
  hidden: boolean,                 // hide-balances toggle
  activeTab: 'Overview' | ...,

  // per-card local
  nwRange: '1M' | '3M' | '6M' | '1Y' | 'ALL',
  chores: Record<string, boolean>, // key: `${kidIdx}-${choreIdx}`

  // theme tweaks (debug/admin only)
  accentColor: string,
  paperColor: string,
  showInsight: boolean,
}
```

Real data fetching: every section currently reads from `DATA` in `data.jsx`. In the real app, split into endpoints:
- `GET /api/networth?range=1Y` → `{ total, delta30, deltaPct, history[] }`
- `GET /api/accounts` → grouped accounts
- `GET /api/spending?month=2026-05` → categories with spent/budget
- `GET /api/forecast?weeks=12` → weekly in/out projections
- `GET /api/goals`, `GET /api/transactions?limit=N`, `GET /api/bills?days=14`
- `GET /api/investments` → total + holdings
- `GET /api/debts`
- `GET /api/kids` with chores
- `GET /api/insight` (LLM-backed nudge)

---

## Design Tokens

```css
/* Surfaces */
--paper:    #F2EEE3   /* page background */
--paper-2:  #ECE6D6   /* recessed tracks, hover */
--card:     #FBF8F0   /* card background */
--card-2:   #FFFFFF   /* nested white surfaces */
--ink:      #15140F   /* primary text + dark surfaces */
--ink-2:    #2A2823
--mute:     #6F695C   /* secondary text */
--mute-2:   #A39B89   /* tertiary text */
--line:     rgba(21,20,15,0.10)
--line-2:   rgba(21,20,15,0.18)

/* Family palette */
--green:    #1F7A4D   /* income / positive */
--green-2:  #E5EFE2
--red:      #C94A2C   /* spending / alert / brand accent */
--red-2:    #F6E2D8
--gold:     #D9A322   /* highlight / kids */
--gold-2:   #F5EAC4
--blue:     #2B5FB8   /* investments */
--blue-2:   #DDE5F4
--plum:     #6B3A85
--plum-2:   #ECDFF1

/* Member colors */
--m-alex: #1F7A4D   (green)
--m-sam:  #2B5FB8   (blue)
--m-mia:  #D9A322   (gold)
--m-theo: #C94A2C   (red)

/* Type */
--serif: "Instrument Serif", "EB Garamond", Georgia, serif
--sans:  "Geist", "Söhne", system-ui, sans-serif
--mono:  "Geist Mono", "JetBrains Mono", ui-monospace, monospace

/* Radii */
--radius:    14px
--radius-sm:  8px

/* Shadow */
--shadow-card: 0 1px 0 rgba(21,20,15,0.04), 0 2px 8px rgba(21,20,15,0.04)
```

### Type scale

| Use | Family | Size | Weight | LH | LS |
|---|---|---|---|---|---|
| Display h1 (greeting) | serif | 44 | 400 | 1.12 | -0.02em |
| Hero numbers (`.money.big`) | serif | 56 | 400 | 1.0 | -0.02em |
| Money med (`.money.med`) | serif | 28 | 400 | 1.0 | -0.02em |
| Card title | serif | 22 | 400 | 1.22 | -0.01em |
| Kid name | serif italic | 22 | 400 | 1.0 | -0.01em |
| Goal name | serif | 18 | 400 | 1.15 | -0.01em |
| Bill day | serif | 18 | 400 | 1.0 | — |
| Body text | sans | 13 | 400 | 1.4 | — |
| Tiny / muted | sans | 11 | 400 | 1.4 | — |
| Card label (uppercase) | sans | 11 | 600 | 1.0 | 0.14em |
| Money inline | mono | 12–14 | 400 | 1.0 | -0.01em |
| Tag (uppercase) | sans | 10 | 600 | — | 0.08em |
| Chart axis | mono | 11 | 400 | — | — |

Mono should use `font-variant-numeric: tabular-nums` everywhere $ values appear, so columns of numbers align without manual padding.

### Spacing scale

- 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 28 / 40 (px)
- Card padding standard: 18 / 20 (vertical / horizontal)
- Grid gaps: 16 (cards), 22 (sections)

### Border radii
- 4 (chore checkboxes)
- 6 (spend bars)
- 7–8 (small chips, account icons, bill date tile)
- 12 (kid inner panels)
- 14 (cards, banners)
- 999 (pills, member avatars, bars)

---

## Assets

- **Fonts** (Google Fonts): Instrument Serif (regular + italic), Geist (400/500/600/700), Geist Mono (400/500/600). Self-host these in production.
- **Icons**: hand-rolled inline SVG line-icons (single-stroke, 1.6 px, rounded caps). Defined in `components.jsx` under `Icon`. The icon vocabulary is: Eye (open + slashed), Bell, Search, Plus, Bank, Card (CC), Vault, Home, Stock (line chart), Car. If your codebase uses Lucide / Heroicons / Phosphor, swap to those — but stay consistent with stroke weight (1.6 px) and rounded caps.
- **Emoji**: used in transaction rows as inline merchant icons. In production, prefer real merchant logos / category icons.
- **No raster assets**.

---

## Files in this bundle

| File | Purpose |
|---|---|
| `Family Financials.html` | Root HTML, loads fonts + React + Babel + the JSX modules |
| `styles.css` | All visual system tokens and card/component styles |
| `app.jsx` | Top-level `App` component, shell, top bar, greeting, layout grid, Tweaks panel wiring |
| `sections.jsx` | All section panels (Net Worth, Spend, Cashflow, Accounts, Spending, Forecast, Goals, Transactions, Bills, Investments, Debt, Kids) |
| `components.jsx` | Atoms: `MoneyV` (the hide-balances-aware money component), `Avatar`, `MemberDot`, `Delta`, `Sparkline`, `Ring`, `Icon` set, `FAMILY` map |
| `data.jsx` | All seed data — replace with real API calls |
| `tweaks-panel.jsx` | Floating panel used to demo theme/density tweaks; not part of the real product UI |

Open `Family Financials.html` in any modern browser (or serve the folder over a local static server). No build step.

---

## Implementation notes for the dev

1. **Start with `MoneyV`.** The hide-balances feature only works because every single dollar value goes through one component that knows how to censor itself. Build this first as a shared `<Money value={n} hidden cents serif size />` primitive and use it religiously. Anywhere a raw `${value}` slips into the JSX is a bug.
2. **Per-member color attribution is a system, not a decoration.** The four hex codes in `--m-*` should be referenced everywhere a member appears (avatar, txn chip, goal owner, bill owner, kid panel). Keep them centralized.
3. **Cards are flat — no decorative gradients, no shadows beyond the spec.** Resist the urge to add depth; the system relies on type and color contrast, not chrome.
4. **The serif italic is the brand.** Every card title has one italic word, and the greeting has one italic name. This is intentional rhythm; don't italicize whole phrases.
5. **Currency formatting**: always en-US with thousands separators; cents shown only on big hero figures, kid balances, and transaction amounts.
6. **Responsive**: the current design is desktop-only (`max-width: 1480` and fixed multi-column grids). Mobile is out of scope for this handoff — see "next steps" with the user before tackling.
