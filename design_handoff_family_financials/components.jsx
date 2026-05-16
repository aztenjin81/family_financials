/* eslint-disable */
/* Shared atoms: Money, Avatar, Card, Sparkline, Ring */

const FAMILY = {
  alex: { name: 'Alex', initial: 'A', color: 'var(--m-alex)' },
  sam:  { name: 'Sam',  initial: 'S', color: 'var(--m-sam)' },
  mia:  { name: 'Mia',  initial: 'M', color: 'var(--m-mia)' },
  theo: { name: 'Theo', initial: 'T', color: 'var(--m-theo)' },
};

function fmt(n, opts = {}) {
  const { cents = false, sign = false } = opts;
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const cents2 = Math.round((abs - whole) * 100).toString().padStart(2, '0');
  const s = whole.toLocaleString('en-US');
  let out = '$' + s;
  if (cents) out += '.' + cents2;
  if (sign) out = (n < 0 ? '−' : '+') + out;
  return out;
}

function Money({ value, size = 'sm', serif = false, hidden = false, cents = false, sign = false, className = '' }) {
  const cls = `money ${size === 'big' ? 'big' : size === 'med' ? 'med' : 'sm'} ${serif ? 'serif' : ''} ${hidden ? 'hidden' : ''} ${className}`;
  if (hidden) {
    // Show roughly proportional dots so layout doesn't jump too hard
    const digitCount = Math.max(4, String(Math.floor(Math.abs(value))).length);
    return <span className={cls}>{'$' + '•'.repeat(digitCount)}</span>;
  }
  const abs = Math.abs(value);
  const whole = Math.floor(abs);
  const c = Math.round((abs - whole) * 100).toString().padStart(2, '0');
  return (
    <span className={cls}>
      {sign && <span className="sign">{value < 0 ? '−' : '+'}</span>}
      $${''}
      <span>{whole.toLocaleString('en-US').replace('$','')}</span>
      {cents && <span className="cents">.{c}</span>}
    </span>
  );
}

// Avoid the literal "$$" issue above — use a cleaner Money component
function MoneyV({ value, size = 'sm', serif = false, hidden = false, cents = false, sign = false, className = '', forceSign = false }) {
  const cls = ['money', size, serif ? 'serif' : '', hidden ? 'hidden' : '', className].filter(Boolean).join(' ');
  if (hidden) {
    const digitCount = Math.max(4, String(Math.floor(Math.abs(value))).length);
    // Add commas-ish: just show dots
    return <span className={cls}>{'$' + '•'.repeat(digitCount)}</span>;
  }
  const neg = value < 0;
  const abs = Math.abs(value);
  const whole = Math.floor(abs);
  const c = Math.round((abs - whole) * 100).toString().padStart(2, '0');
  const wholeStr = whole.toLocaleString('en-US');
  return (
    <span className={cls}>
      {(forceSign || neg) && <span className="sign">{neg ? '−' : '+'}</span>}
      {'$' + wholeStr}
      {cents && <span className="cents">.{c}</span>}
    </span>
  );
}

function Avatar({ who, size = 32, style = {} }) {
  const m = FAMILY[who];
  if (!m) return null;
  return (
    <span
      className="avatar"
      style={{ background: m.color, width: size, height: size, fontSize: size * 0.45, ...style }}
      title={m.name}
    >
      {m.initial}
    </span>
  );
}

function MemberDot({ who }) {
  const m = FAMILY[who];
  if (!m) return null;
  return <span className="member-chip"><span className="member-dot" style={{ background: m.color }}></span>{m.name}</span>;
}

function Delta({ value, suffix = '', kind = 'auto' }) {
  const k = kind === 'auto' ? (value > 0 ? 'up' : value < 0 ? 'down' : 'flat') : kind;
  const arrow = k === 'up' ? '↑' : k === 'down' ? '↓' : '·';
  return (
    <span className={`delta ${k}`}>
      {arrow} {value > 0 ? '+' : value < 0 ? '−' : ''}{Math.abs(value).toLocaleString()}{suffix}
    </span>
  );
}

function Sparkline({ data, color = 'var(--ink)', fill = 'rgba(21,20,15,0.06)', height = 60 }) {
  const w = 100;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 4 - ((v - min) / range) * (h - 8);
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={area} fill={fill} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2" fill={color} />
    </svg>
  );
}

function Ring({ value, total, size = 96, stroke = 10, color = 'var(--ink)', track = 'var(--paper-2)', children }) {
  const pct = Math.min(1, value / total);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', textAlign: 'center'
      }}>
        {children}
      </div>
    </div>
  );
}

// SVG icons (single-stroke, hand-drawn-ish)
const Icon = {
  Eye: ({ open = true, size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <line x1="4" y1="20" x2="20" y2="4" />}
    </svg>
  ),
  Bell: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  Search: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  Plus: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Bank: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 3 3 9h18l-9-6Z" /></svg>,
  Card: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>,
  Vault: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="13" cy="12" r="3.5" /><path d="M13 8.5V7M13 17v-1.5M16.5 12H18M8 12h1.5" /></svg>,
  Home: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /></svg>,
  Stock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,17 9,11 13,15 21,7" /><polyline points="15,7 21,7 21,13" /></svg>,
  Car: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13h18l-2-5H5l-2 5Z" /><path d="M3 13v5h2v-2h14v2h2v-5" /><circle cx="7.5" cy="14.5" r="1.2" /><circle cx="16.5" cy="14.5" r="1.2" /></svg>,
};

Object.assign(window, { FAMILY, MoneyV, Avatar, MemberDot, Delta, Sparkline, Ring, Icon });
