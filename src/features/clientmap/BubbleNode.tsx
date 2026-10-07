// One bubble of the map (SVG). Geometry is in world units; text and strokes are sized in SCREEN pixels (divided by
// the zoom `k`) so labels stay legible (never below 11px) and rings stay crisp at any zoom. The content follows the
// on-screen radius R:
// - customers: soft health tint + ring + soft shadow; logo + name + value from 34px, the logo chip below;
// - hubs (cluster centres): the group's short name in full (two lines, or a pill under the bubble), value, count;
//   a group worth 0 in the chosen metric is a small dashed ring in muted colours (no blue fill);
// - targets: quiet — white ghost with a thin dashed ring, initials; once roomy their name and (muted) value, as they
//   share the customers' value scale.
import { memo } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Network, OctagonX, TriangleAlert } from 'lucide-react';
import type { Health } from '@/services/contract';
import type { ClientMapNode, EcosystemView } from '@/services/crmContract';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { shortNameOf } from '@/domain/crm';
import { R_DETAIL } from './mapModel';
import { fitSize, textWidth } from './textMeasure';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const RING: Record<Health, string> = {
  on_track: 'stroke-success',
  attention: 'stroke-warning',
  blocked: 'stroke-danger',
};

export interface BubbleHandlers {
  onFocus(id: string, visible: boolean): void;
  onBlur(id: string): void;
  onKeyDown(id: string, e: KeyboardEvent<SVGGElement>): void;
  onClick(id: string, e: MouseEvent<SVGGElement>): void;
}

export interface BubbleNodeProps {
  node: ClientMapNode;
  eco: EcosystemView | undefined;
  x: number;
  y: number;
  r: number;
  /** entrance animation: drawn size 0…1 */
  grow: number;
  /** view scale */
  k: number;
  /** id prefix of the <defs> (gradients, shadows) */
  defs: string;
  label: string;
  dimmed: boolean;
  hovered: boolean;
  focused: boolean;
  /** tooltip id while this bubble's tooltip is shown */
  describedBy: string | undefined;
  /** hubs: their ecosystem is the selected one (toggle button state) */
  selected?: boolean;
  handlers: BubbleHandlers;
}

// ───────────────────────────── label fitting ─────────────────────────────

interface Lines {
  lines: string[];
  size: number;
}

/** `text` on one line at the largest size in [min, max] that fits `width` */
function oneLine(text: string, max: number, min: number, width: number, weight: number): Lines | null {
  const size = fitSize(text, max, min, width, weight);
  return size === null ? null : { lines: [text], size };
}

/** `text` on two lines at the largest size in [min, max] that fits `width`; ties go to the most balanced break */
function twoLines(text: string, max: number, min: number, width: number, weight: number): Lines | null {
  const words = text.split(/\s+/).filter(Boolean);
  let best: (Lines & { wide: number }) | null = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const wide = Math.max(textWidth(a, 10, weight), textWidth(b, 10, weight));
    const size = fitSize(textWidth(a, 10, weight) >= textWidth(b, 10, weight) ? a : b, max, min, width, weight);
    if (size === null) continue;
    if (!best || size > best.size || (size === best.size && wide < best.wide)) best = { lines: [a, b], size, wide };
  }
  return best ? { lines: best.lines, size: best.size } : null;
}

/**
 * The company name at the largest legible size: the full name (one line, then two) or the short form
 * ('Ngân hàng Hợp Phát' → 'Hợp Phát'); a bigger short name beats a much smaller full one. Null when nothing fits whole.
 */
function nameLines(label: string, max: number, min: number, width: number, allowTwo: boolean, weight: number): Lines | null {
  const short = shortNameOf(label) || label;
  const options: { lines: Lines; score: number }[] = [];
  const add = (l: Lines | null, factor: number) => {
    if (l) options.push({ lines: l, score: l.size * factor });
  };
  add(oneLine(label, max, min, width, weight), 1.1);
  if (allowTwo) add(twoLines(label, max, min, width, weight), 1.04);
  if (short !== label) {
    add(oneLine(short, max, min, width, weight), 1);
    if (allowTwo) add(twoLines(short, max, min, width, weight), 0.94);
  }
  options.sort((a, b) => b.score - a.score);
  return options[0]?.lines ?? null;
}

// ───────────────────────────── content ─────────────────────────────

/** company initials on the brand colour (customers) */
function Avatar({ node, size, s }: { node: ClientMapNode; size: number; s: number }) {
  const fs = clamp(size * 0.4, 11, 15);
  return (
    <g>
      <rect
        x={(-size / 2) * s}
        y={(-size / 2) * s}
        width={size * s}
        height={size * s}
        rx={size * 0.28 * s}
        className="fill-primary"
        // brand_color is account data (not a design token), like AccountLogo
        style={node.logo.brand_color ? { fill: node.logo.brand_color } : undefined}
      />
      {node.logo.logo_url ? (
        <image
          href={node.logo.logo_url}
          x={(-size / 2) * s}
          y={(-size / 2) * s}
          width={size * s}
          height={size * s}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <text textAnchor="middle" dominantBaseline="central" fontSize={fs * s} className="fill-primary-foreground font-semibold">
          {node.logo.initials}
        </text>
      )}
    </g>
  );
}

function TextLines({ lines, top, cls, s }: { lines: Lines; top: number; cls: string; s: number }) {
  return (
    <>
      {lines.lines.map((line, i) => (
        <text
          key={i}
          y={(top + lines.size * 1.16 * (i + 0.5)) * s}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={lines.size * s}
          className={cls}
        >
          {line}
        </text>
      ))}
    </>
  );
}

function AccountContent({ node, R, s }: { node: ClientMapNode; R: number; s: number }) {
  if (R < 13) {
    return <circle r={R * 0.34 * s} className="fill-primary" style={node.logo.brand_color ? { fill: node.logo.brand_color } : undefined} />;
  }
  if (R < R_DETAIL) return <Avatar node={node} size={clamp(R * 1.08, 18, 34)} s={s} />;

  // from R 38: logo + name (one or two lines) + value. Smaller, or when the name only fits across the middle (wider
  // chord, 11–13px), the logo gives way to it — a name says more than a monogram ('Cỏ Xanh / Retail', phones).
  let width = R * 1.62 - 6;
  let name = R >= 38 ? nameLines(node.label, clamp(R * 0.2, 13, 22), 12, width, true, 600) : null;
  let roomy = false;
  if (!name) {
    const wide = R * 1.8 - 4;
    name = nameLines(node.label, clamp(R * 0.2, 11, 13), 11, wide, R >= 32, 600);
    if (name) {
      width = wide;
      roomy = true;
    }
  }
  const value = formatMoneyCompact(node.value);
  const vs = fitSize(value, clamp(R * 0.16, 11, 18), 11, width, 500) ?? 11;
  const av = clamp(R * 0.36, 20, 40);
  const gap = clamp(R * 0.07, 4, 8);
  const nameH = name ? name.lines.length * name.size * 1.16 : 0;
  const valueH = vs * 1.2;
  let showAvatar = true;
  let total = av + gap + nameH + 2 + valueH;
  if (roomy || total > R * 1.5) {
    showAvatar = false;
    total = nameH + 2 + valueH;
  }
  if (!name) {
    // too small for a whole name: logo + value
    const t2 = av + gap + valueH;
    const top2 = -t2 / 2;
    return (
      <>
        <g transform={`translate(0 ${(top2 + av / 2) * s})`}>
          <Avatar node={node} size={av} s={s} />
        </g>
        <text y={(top2 + av + gap + valueH / 2) * s} textAnchor="middle" dominantBaseline="central" fontSize={vs * s} className="tabular fill-muted-foreground font-medium">
          {value}
        </text>
      </>
    );
  }
  const top = -total / 2;
  const nameTop = top + (showAvatar ? av + gap : 0);
  return (
    <>
      {showAvatar ? (
        <g transform={`translate(0 ${(top + av / 2) * s})`}>
          <Avatar node={node} size={av} s={s} />
        </g>
      ) : null}
      <TextLines lines={name} top={nameTop} cls="fill-ink font-semibold" s={s} />
      <text y={(nameTop + nameH + 2 + valueH / 2) * s} textAnchor="middle" dominantBaseline="central" fontSize={vs * s} className="tabular fill-muted-foreground font-medium">
        {value}
      </text>
    </>
  );
}

function LeadContent({ node, R, s }: { node: ClientMapNode; R: number; s: number }) {
  if (R >= R_DETAIL) {
    // targets share the customers' value scale, so a roomy one names itself and says what it is worth, like a customer
    const width = R * 1.62 - 6;
    const name = nameLines(node.label, clamp(R * 0.19, 11, 15), 11, width, R >= 32, 500);
    if (name) {
      const nameH = name.lines.length * name.size * 1.16;
      const value = node.value > 0 ? formatMoneyCompact(node.value) : null;
      const vs = value ? fitSize(value, clamp(R * 0.15, 11, 14), 11, width, 500) : null;
      const valueH = vs !== null ? vs * 1.2 : 0;
      const withValue = value !== null && vs !== null && nameH + 2 + valueH <= R * 1.3;
      const top = -(nameH + (withValue ? 2 + valueH : 0)) / 2;
      return (
        <>
          <TextLines lines={name} top={top} cls="fill-muted-foreground font-medium" s={s} />
          {withValue ? (
            <text
              y={(top + nameH + 2 + valueH / 2) * s}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={(vs ?? 11) * s}
              className="tabular fill-caption font-medium"
            >
              {value}
            </text>
          ) : null}
        </>
      );
    }
  }
  if (R < 10) return null;
  const fs = clamp(R * 0.6, 11, 14);
  return (
    <text textAnchor="middle" dominantBaseline="central" fontSize={fs * s} className="fill-caption font-semibold">
      {node.logo.initials}
    </text>
  );
}

function HubContent({ node, eco, R, r, s }: { node: ClientMapNode; eco: EcosystemView | undefined; R: number; r: number; s: number }) {
  const label = eco?.short_name || node.label;
  const empty = node.value <= 0;
  const width = R * 1.5 - 8;
  const fs = clamp(R * 0.2, 13, 24);
  const value = formatMoneyCompact(node.value);
  const vs = fitSize(value, clamp(R * 0.17, 12, 19), 11, width, 600) ?? 11;
  let name = oneLine(label, fs, 12, width, 600) ?? twoLines(label, fs, 11, width, 600);
  // name + value must stack inside the disc (a small empty group's ring); otherwise the name goes in the pill below
  if (name && name.lines.length * name.size * 1.16 + 3 + vs * 1.2 > R * 1.5) name = null;
  const cs = clamp(R * 0.12, 11, 14);
  const count = eco ? t('clientmap.map.companies', { count: eco.account_count + eco.lead_count }) : node.sublabel;
  const nameH = name ? name.lines.length * name.size * 1.16 : 0;
  const valueH = vs * 1.2;
  const icon = 16;
  const withIcon = name !== null && R >= 76 && !empty;
  const withCount = R >= 56 && textWidth(count, cs, 500) <= width;
  const total = (withIcon ? icon + 6 : 0) + nameH + (name ? 3 : 0) + valueH + (withCount ? 2 + cs * 1.2 : 0);
  const top = -total / 2;
  const nameTop = top + (withIcon ? icon + 6 : 0);
  const valueY = nameTop + nameH + (name ? 3 : 0) + valueH / 2;

  // no room inside for the whole short name: it goes in a pill under the bubble (never cut)
  const pillSize = 12;
  const pillW = name ? 0 : textWidth(label, pillSize, 600) + 16;
  return (
    <>
      {withIcon ? (
        <Network x={(-icon / 2) * s} y={top * s} width={icon * s} height={icon * s} strokeWidth={2} className="text-primary" aria-hidden="true" />
      ) : null}
      {name ? <TextLines lines={name} top={nameTop} cls="fill-ink font-semibold" s={s} /> : null}
      <text
        y={valueY * s}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={vs * s}
        className={cn('tabular', empty ? 'fill-muted-foreground font-medium' : 'fill-primary font-semibold')}
      >
        {value}
      </text>
      {withCount ? (
        <text y={(valueY + valueH / 2 + 2 + cs * 0.6) * s} textAnchor="middle" dominantBaseline="central" fontSize={cs * s} className="fill-muted-foreground font-medium">
          {count}
        </text>
      ) : null}
      {name ? null : (
        <g transform={`translate(0 ${r + 15 * s})`}>
          <rect
            x={(-pillW / 2) * s}
            y={-11 * s}
            width={pillW * s}
            height={22 * s}
            rx={11 * s}
            className={cn('fill-card', empty ? 'stroke-border-strong' : 'stroke-primary-border')}
            strokeWidth={s}
          />
          <text textAnchor="middle" dominantBaseline="central" fontSize={pillSize * s} className={cn('font-semibold', empty ? 'fill-muted-foreground' : 'fill-primary')}>
            {label}
          </text>
        </g>
      )}
    </>
  );
}

/** status badge on the ring, top-right (warning / danger only): the ring colour is never the only cue */
function HealthMark({ health, r, s }: { health: Health; r: number; s: number }) {
  if (health === 'on_track') return null;
  const Icon = health === 'blocked' ? OctagonX : TriangleAlert;
  const danger = health === 'blocked';
  const d = r * Math.SQRT1_2;
  return (
    <g transform={`translate(${d} ${-d})`}>
      <circle r={10 * s} className={cn('fill-card', danger ? 'stroke-danger' : 'stroke-warning')} strokeWidth={1.5 * s} />
      <Icon x={-6.5 * s} y={-6.5 * s} width={13 * s} height={13 * s} strokeWidth={2.25} className={danger ? 'text-danger' : 'text-warning'} aria-hidden="true" />
    </g>
  );
}

// ───────────────────────────── bubble ─────────────────────────────

function BubbleNodeImpl(p: BubbleNodeProps) {
  const { node, r, k, defs } = p;
  const s = 1 / k;
  const R = r * k;
  const hub = node.kind === 'ecosystem';
  const lead = node.kind === 'lead';
  const role = hub || !node.href ? 'button' : 'link';
  const g = Math.max(0, p.grow);

  let disc: ReactNode;
  if (hub && node.value <= 0) {
    // a group worth nothing in this metric: a quiet dashed ring, no blue fill (mapModel keeps it small)
    disc = (
      <>
        <circle r={r} className="fill-subtle" fillOpacity={0.85} filter={p.hovered ? `url(#${defs}-lift)` : undefined} />
        <circle
          r={r - (p.selected ? 1.5 : 1) * s}
          fill="none"
          className={p.selected || p.hovered ? 'stroke-primary' : 'stroke-border-strong'}
          strokeWidth={(p.selected ? 3 : 1.5) * s}
          strokeDasharray={p.selected ? undefined : `${4 * s} ${3 * s}`}
        />
      </>
    );
  } else if (hub) {
    disc = (
      <>
        <circle r={r} className="fill-primary-soft" filter={`url(#${defs}-${p.hovered ? 'lift' : 'soft'})`} />
        <circle r={r} fill={`url(#${defs}-hub)`} />
        {/* a calm blue rim at rest (the soft fill already says "group"); full blue when looked at or selected */}
        <circle
          r={r - (p.selected ? 1.5 : 1) * s}
          fill="none"
          className="stroke-primary"
          strokeOpacity={p.selected || p.hovered ? 1 : 0.55}
          strokeWidth={(p.selected ? 3 : 2) * s}
        />
      </>
    );
  } else if (lead) {
    disc = (
      <>
        <circle r={r} className="fill-card" fillOpacity={0.78} filter={p.hovered ? `url(#${defs}-lift)` : undefined} />
        <circle
          r={r - 0.75 * s}
          fill="none"
          className="stroke-caption"
          strokeOpacity={p.hovered ? 0.8 : 0.5}
          strokeWidth={1.25 * s}
          strokeDasharray={`${3 * s} ${3 * s}`}
        />
      </>
    );
  } else {
    disc = (
      <>
        <circle r={r} className="fill-card" filter={`url(#${defs}-${p.hovered ? 'lift' : 'soft'})`} />
        {node.health ? <circle r={r} fill={`url(#${defs}-tint-${node.health})`} /> : null}
        <circle
          r={r - 1 * s}
          fill="none"
          className={node.health ? RING[node.health] : 'stroke-border-strong'}
          strokeWidth={(node.health ? 2 : 1.5) * s}
        />
      </>
    );
  }

  return (
    <g
      transform={`translate(${p.x} ${p.y})${g < 1 ? ` scale(${g})` : ''}`}
      data-node-id={node.id}
      tabIndex={0}
      role={role}
      aria-label={p.label}
      aria-describedby={p.describedBy}
      aria-pressed={hub ? Boolean(p.selected) : undefined}
      className={cn('cursor-pointer outline-none transition-opacity duration-200', p.dimmed && 'opacity-20')}
      onFocus={(e) => p.handlers.onFocus(node.id, e.currentTarget.matches(':focus-visible'))}
      onBlur={() => p.handlers.onBlur(node.id)}
      onKeyDown={(e) => p.handlers.onKeyDown(node.id, e)}
      onClick={(e) => p.handlers.onClick(node.id, e)}
    >
      <g className={cn('transition-transform duration-200 ease-out-quart', p.hovered && 'scale-[1.04]')} aria-hidden="true">
        {/* hit area of at least 44px on screen for small bubbles (touch) */}
        {R < 22 ? <circle r={22 * s} fill="transparent" /> : null}
        {p.focused ? <circle r={r + 5 * s} fill="none" className="stroke-primary" strokeWidth={2.5 * s} /> : null}
        {disc}
        {hub ? (
          <HubContent node={node} eco={p.eco} R={R} r={r} s={s} />
        ) : lead ? (
          <LeadContent node={node} R={R} s={s} />
        ) : (
          <AccountContent node={node} R={R} s={s} />
        )}
        {!hub && !lead && node.health ? <HealthMark health={node.health} r={r} s={s} /> : null}
      </g>
    </g>
  );
}

export const BubbleNode = memo(BubbleNodeImpl);

/** gradients + shadows shared by every bubble */
export function BubbleDefs({ id }: { id: string }) {
  // white core, the health colour gathering at the rim: reads as a soft tinted sphere, the ring stays the accent
  const tint = (key: string, token: string, rim: number) => (
    <radialGradient id={`${id}-${key}`} cx="50%" cy="40%" r="62%" fx="50%" fy="30%">
      <stop offset="0%" style={{ stopColor: `rgb(var(--${token}))`, stopOpacity: 0 }} />
      <stop offset="55%" style={{ stopColor: `rgb(var(--${token}))`, stopOpacity: rim * 0.25 }} />
      <stop offset="100%" style={{ stopColor: `rgb(var(--${token}))`, stopOpacity: rim }} />
    </radialGradient>
  );
  return (
    <defs>
      {tint('tint-on_track', 'success', 0.16)}
      {tint('tint-attention', 'warning', 0.2)}
      {tint('tint-blocked', 'danger', 0.18)}
      {tint('hub', 'primary', 0.14)}
      <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" style={{ floodColor: 'rgb(var(--ink))', floodOpacity: 0.08 }} />
      </filter>
      <filter id={`${id}-lift`} x="-40%" y="-40%" width="180%" height="190%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" style={{ floodColor: 'rgb(var(--ink))', floodOpacity: 0.16 }} />
      </filter>
    </defs>
  );
}
