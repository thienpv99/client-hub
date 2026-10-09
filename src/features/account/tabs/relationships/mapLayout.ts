// Layout of the relationship map (SPEC-CARE §6.4 "Quan hệ") — pure geometry, no React.
// Three columns read left → right:
//   New Era people  ──(who holds the relationship, coloured by strength)──▶  client people grouped by department
//   ──(reports-to arcs on the right edge of the client column)──  sister-company people ("Trong tập đoàn" chips).
// Not a force layout: every node has a fixed column; New Era people and chips sit at the average height of the people
// they connect to (barycentre), then overlaps are pushed apart — edges stay short and mostly horizontal, so the map
// reads like a diagram, not a hairball. Widths stretch between a compact (iPad landscape beside the sidebar) and a
// roomy setting; below the compact width the map scrolls sideways.

import type { DepartmentKey, Strength } from '@/domain/careTypes';
import { DEPARTMENT_KEYS } from '@/domain/careTypes';
import type { RelationEnd, RelationView, StakeholderView } from '@/services/careContract';
import type { UserRef } from '@/services/contract';

export type NeRole = 'am' | 'director' | 'member';

export interface NePerson {
  user: UserRef;
  role: NeRole;
}

export interface MapInput {
  accountId: string;
  people: StakeholderView[];
  /** New Era people, AM first */
  ne: NePerson[];
  relations: RelationView[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NeNode extends Box {
  key: string;
  user: UserRef;
  role: NeRole;
  holds: number;
}

export interface PersonNode extends Box {
  key: string;
  person: StakeholderView;
}

export interface GroupBox extends Box {
  key: string;
  department: DepartmentKey | null;
  count: number;
}

export interface ChipNode extends Box {
  key: string;
  end: RelationEnd;
  relations: RelationView[];
  /** the remote person is the relation's `from` end (they introduced / report to … the local person) */
  remoteIsFrom: boolean;
}

export type EdgeKind = 'hold' | 'reports' | 'peer' | 'cross';

export interface MapEdge {
  key: string;
  kind: EdgeKind;
  /** node keys at both ends (for highlighting) */
  a: string;
  b: string;
  d: string;
  strength?: Strength;
  /** arrow head at the manager's end of a reports-to arc */
  arrow?: string;
  /** small dot at the subordinate's end of a reports-to arc (which line belongs to whom) */
  dot?: { x: number; y: number };
}

export interface MapLayout {
  width: number;
  height: number;
  columns: { ne: Box; client: Box; cross: Box | null };
  ne: NeNode[];
  groups: GroupBox[];
  people: PersonNode[];
  chips: ChipNode[];
  edges: MapEdge[];
}

// ───────────────────────────── sizes ─────────────────────────────

/** room for the short name and a two-line role ("Phân tích nghiệp vụ (BA)" is never cut on an iPad) */
export const NE_H = 60;
export const PERSON_H = 76;
/** a narrow person column (iPad, a laptop with the sidebar): the job title may take two lines (review QV-02) */
export const PERSON_H_TALL = 92;
/** below this person-node width titles get two lines */
const PERSON_TALL_BELOW = 260;
/** room for a two-line name (a sister-company person is never cut), the company and a two-line relation phrase */
export const CHIP_H = 100;
const GROUP_HEAD = 28;
const GROUP_PAD = 8;
const NODE_GAP = 8;
const GROUP_GAP = 14;
const NE_GAP = 12;
const CHIP_GAP = 10;
/** horizontal room of the group box around the person nodes */
const GROUP_INSET = 8;

interface Widths {
  pad: number;
  ne: number;
  gapA: number;
  person: number;
  gapC: number;
  chip: number;
}

/** iPad portrait (≈658px beside a collapsed sidebar) fits without sideways scroll; the holder lines keep a 48px gap */
const COMPACT: Widths = { pad: 4, ne: 180, gapA: 40, person: 188, gapC: 18, chip: 150 };
const ROOMY: Widths = { pad: 16, ne: 196, gapA: 120, person: 288, gapC: 64, chip: 236 };
/** a few px short of the compact width: narrow the nodes rather than scroll by a sliver */
const MAX_SHRINK = 24;

const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);

function total(w: Widths, arcZone: number, cross: boolean): number {
  return w.pad * 2 + w.ne + w.gapA + w.person + arcZone + (cross ? w.gapC + w.chip : 0);
}

// ───────────────────────────── helpers ─────────────────────────────

/**
 * Each reports-to / peer arc gets its own lane (shortest span innermost, `ARC_BASE + lane × ARC_STEP` of bulge), so a
 * bundle of arcs from one manager reads as separate lines instead of one dotted band.
 */
const ARC_BASE = 14;
const ARC_STEP = 13;
/** arc ends fan out along the node's right edge, ±this many px around its middle */
const ANCHOR_SPREAD = 18;
const ANCHOR_STEP = 6;
/** links to sister companies leave a person low on its edge, clear of the arc anchors */
const CROSS_ANCHOR = 28;

function bulgeOfLane(lane: number): number {
  return ARC_BASE + lane * ARC_STEP;
}

/**
 * Stack items of one column near their wished centre (barycentre) without overlap: a forward pass pushes down, a
 * backward pass pulls the tail up when it overshoots the bottom. Items without a wish follow the others.
 */
function stack(wishes: (number | null)[], h: number, gap: number, bottom: number): number[] {
  const order = wishes.map((w, i) => ({ w, i })).sort((a, b) => (a.w ?? Infinity) - (b.w ?? Infinity) || a.i - b.i);
  const tops: number[] = new Array<number>(wishes.length).fill(0);
  let y = 0;
  for (const { w, i } of order) {
    const top = w === null ? y : Math.max(y, Math.round(w - h / 2));
    tops[i] = top;
    y = top + h + gap;
  }
  // pull up from the end when the column runs past the bottom of the tallest column
  let limit = Math.max(bottom, wishes.length * (h + gap) - gap);
  for (let k = order.length - 1; k >= 0; k -= 1) {
    const i = order[k].i;
    if (tops[i] + h > limit) tops[i] = Math.max(0, limit - h);
    limit = tops[i] - gap;
  }
  return tops;
}

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(24, (x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function arc(x: number, y1: number, y2: number, bulge: number): string {
  return `M ${x} ${y1} C ${x + bulge} ${y1}, ${x + bulge} ${y2}, ${x} ${y2}`;
}

/** a straight stub along the node's edge out of the arc zone, then the usual curve to the target */
function stubCurve(x0: number, y0: number, x1: number, x2: number, y2: number): string {
  const dx = Math.max(24, (x2 - x1) * 0.5);
  return `M ${x0} ${y0} L ${x1} ${y0} C ${x1 + dx} ${y0}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// ───────────────────────────── layout ─────────────────────────────

const DEPT_ORDER = new Map<DepartmentKey, number>(DEPARTMENT_KEYS.map((k, i) => [k, i]));
const INFLUENCE_ORDER = { decision_maker: 0, influencer: 1, gatekeeper: 2, user: 3 } as const;
const STRENGTH_ORDER = { strong: 0, warm: 1, cold: 2 } as const;

export function layoutMap(input: MapInput, containerWidth: number): MapLayout {
  // ── client column: department groups (executive first, unknown department last)
  const byDept = new Map<DepartmentKey | null, StakeholderView[]>();
  for (const p of input.people) {
    const list = byDept.get(p.department) ?? [];
    list.push(p);
    byDept.set(p.department, list);
  }
  const deptKeys = [...byDept.keys()].sort((a, b) => (a === null ? 99 : (DEPT_ORDER.get(a) ?? 50)) - (b === null ? 99 : (DEPT_ORDER.get(b) ?? 50)));

  // relations: local ↔ local (peer arcs) and local ↔ sister company (chips)
  const local = new Set(input.people.map((p) => p.contact_id));
  const crossRelations = input.relations.filter((r) => local.has(r.from.contact_id) !== local.has(r.to.contact_id));
  const peerRelations = input.relations.filter((r) => local.has(r.from.contact_id) && local.has(r.to.contact_id) && r.kind !== 'reports_to');
  const hasCross = crossRelations.length > 0;
  const reportPairs = input.people
    .filter((p) => p.reports_to_contact_id && local.has(p.reports_to_contact_id))
    .map((p) => ({ child: p.contact_id, manager: p.reports_to_contact_id as string }));
  const arcCount = reportPairs.length + peerRelations.length;
  // a cubic arc with both control points at +bulge reaches 0.75 × bulge to the right
  const arcZone = arcCount > 0 ? Math.round(bulgeOfLane(arcCount - 1) * 0.75) + 14 : 14;

  // ── widths: stretch between compact and roomy, then give the rest to the gaps and centre the drawing
  const minW = total(COMPACT, arcZone, hasCross);
  const maxW = total(ROOMY, arcZone, hasCross);
  const t = maxW > minW ? Math.min(1, Math.max(0, (containerWidth - minW) / (maxW - minW))) : 1;
  const w: Widths = {
    pad: lerp(COMPACT.pad, ROOMY.pad, t),
    ne: lerp(COMPACT.ne, ROOMY.ne, t),
    gapA: lerp(COMPACT.gapA, ROOMY.gapA, t),
    person: lerp(COMPACT.person, ROOMY.person, t),
    gapC: lerp(COMPACT.gapC, ROOMY.gapC, t),
    chip: lerp(COMPACT.chip, ROOMY.chip, t),
  };
  // just short of the compact width (iPad beside the sidebar): narrow the nodes a little instead of scrolling
  if (containerWidth > 0 && containerWidth < minW && minW - containerWidth <= MAX_SHRINK * (hasCross ? 2 : 1)) {
    const deficit = minW - containerWidth;
    const fromPerson = Math.min(MAX_SHRINK, deficit);
    w.person -= fromPerson;
    if (hasCross) w.chip -= Math.min(MAX_SHRINK, deficit - fromPerson);
  }
  const personH = w.person < PERSON_TALL_BELOW ? PERSON_H_TALL : PERSON_H;

  // vertical layout of the client column (the node height follows the column width)
  let y = 0;
  const groupRows: { key: DepartmentKey | null; top: number; people: StakeholderView[] }[] = [];
  for (const k of deptKeys) {
    const list = (byDept.get(k) ?? []).slice().sort(
      (a, b) =>
        INFLUENCE_ORDER[a.influence] - INFLUENCE_ORDER[b.influence] ||
        STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
        a.contact.full_name.localeCompare(b.contact.full_name, 'vi'),
    );
    groupRows.push({ key: k, top: y, people: list });
    y += GROUP_HEAD + list.length * personH + (list.length - 1) * NODE_GAP + GROUP_PAD + GROUP_GAP;
  }
  const clientBottom = Math.max(0, y - GROUP_GAP);
  const centerY = new Map<string, number>();
  for (const g of groupRows) {
    g.people.forEach((p, i) => centerY.set(p.contact_id, g.top + GROUP_HEAD + i * (personH + NODE_GAP) + personH / 2));
  }

  // arcs (reports-to inside the client + other same-company links): one lane each, shortest span innermost; their
  // ends fan out along each node's edge in the order of the other end, so no two arcs share an anchor point
  const arcs: { key: string; kind: 'reports' | 'peer'; a: string; b: string; lane: number }[] = [
    ...reportPairs.map((r) => ({ key: `rep:${r.child}`, kind: 'reports' as const, a: r.child, b: r.manager, lane: 0 })),
    ...peerRelations.map((r) => ({ key: `peer:${r.id}`, kind: 'peer' as const, a: r.from.contact_id, b: r.to.contact_id, lane: 0 })),
  ];
  const spanOf = (x: { a: string; b: string }): number => Math.abs((centerY.get(x.a) ?? 0) - (centerY.get(x.b) ?? 0));
  [...arcs].sort((x, y) => spanOf(x) - spanOf(y) || x.key.localeCompare(y.key)).forEach((x, i) => (x.lane = i));
  const anchor = new Map<string, number>();
  const ends = new Map<string, { arcKey: string; other: number }[]>();
  for (const x of arcs) {
    for (const [me, other] of [
      [x.a, x.b],
      [x.b, x.a],
    ] as const) {
      const list = ends.get(me) ?? [];
      list.push({ arcKey: x.key, other: centerY.get(other) ?? 0 });
      ends.set(me, list);
    }
  }
  for (const [me, list] of ends) {
    // top → bottom: the arcs going up first, then the ones going down; inside each, the farther arc (outer lane)
    // leaves on the outside of the nearer one — nested arcs never cross at their anchors
    const myY = centerY.get(me) ?? 0;
    list.sort((p, q) => {
      const pUp = p.other < myY;
      const qUp = q.other < myY;
      if (pUp !== qUp) return pUp ? -1 : 1;
      return q.other - p.other;
    });
    list.forEach((e, k) => {
      const offset = Math.max(-ANCHOR_SPREAD, Math.min(ANCHOR_SPREAD, Math.round((k - (list.length - 1) / 2) * ANCHOR_STEP)));
      anchor.set(`${e.arcKey}|${me}`, offset);
    });
  }
  let used = total(w, arcZone, hasCross);
  if (containerWidth > used) {
    const extra = containerWidth - used;
    const toA = Math.min(Math.round(extra * (hasCross ? 0.55 : 1)), 120);
    const toC = hasCross ? Math.min(Math.round(extra * 0.45), 80) : 0;
    w.gapA += toA;
    w.gapC += toC;
    used += toA + toC;
  }
  const width = Math.max(containerWidth, used);
  const left = w.pad + Math.max(0, Math.floor((width - used) / 2));
  const neX = left;
  const clientX = neX + w.ne + w.gapA;
  const crossX = clientX + w.person + arcZone + w.gapC;

  // ── nodes of the client column
  const groups: GroupBox[] = [];
  const people: PersonNode[] = [];
  for (const g of groupRows) {
    const h = GROUP_HEAD + g.people.length * personH + (g.people.length - 1) * NODE_GAP + GROUP_PAD;
    groups.push({ key: `g:${g.key ?? 'none'}`, department: g.key, count: g.people.length, x: clientX - GROUP_INSET, y: g.top, w: w.person + GROUP_INSET * 2, h });
    g.people.forEach((p, i) => {
      people.push({ key: `p:${p.contact_id}`, person: p, x: clientX, y: g.top + GROUP_HEAD + i * (personH + NODE_GAP), w: w.person, h: personH });
    });
  }

  // ── New Era column at the barycentre of the people each one holds
  const holds = new Map<string, string[]>();
  for (const p of input.people) {
    if (!p.ne_owner) continue;
    const list = holds.get(p.ne_owner.id) ?? [];
    list.push(p.contact_id);
    holds.set(p.ne_owner.id, list);
  }
  const neWishes = input.ne.map((n) => {
    const held = holds.get(n.user.id) ?? [];
    return held.length > 0 ? held.reduce((s, id) => s + (centerY.get(id) ?? 0), 0) / held.length : null;
  });
  const neTops = stack(neWishes, NE_H, NE_GAP, clientBottom);
  const ne: NeNode[] = input.ne.map((n, i) => ({
    key: `ne:${n.user.id}`,
    user: n.user,
    role: n.role,
    holds: (holds.get(n.user.id) ?? []).length,
    x: neX,
    y: neTops[i],
    w: w.ne,
    h: NE_H,
  }));

  // ── sister-company chips at the barycentre of the local people they link to (one chip per remote person)
  const chipMap = new Map<string, { end: RelationEnd; relations: RelationView[]; locals: string[]; remoteIsFrom: boolean }>();
  for (const r of crossRelations) {
    const remoteIsFrom = !local.has(r.from.contact_id);
    const remote = remoteIsFrom ? r.from : r.to;
    const mine = remoteIsFrom ? r.to : r.from;
    const entry = chipMap.get(remote.contact_id) ?? { end: remote, relations: [], locals: [], remoteIsFrom };
    entry.relations.push(r);
    entry.locals.push(mine.contact_id);
    chipMap.set(remote.contact_id, entry);
  }
  const chipList = [...chipMap.values()];
  const chipTops = stack(
    chipList.map((c) => c.locals.reduce((s, id) => s + (centerY.get(id) ?? 0), 0) / c.locals.length),
    CHIP_H,
    CHIP_GAP,
    clientBottom,
  );
  const chips: ChipNode[] = chipList.map((c, i) => ({
    key: `x:${c.end.contact_id}`,
    end: c.end,
    relations: c.relations,
    remoteIsFrom: c.remoteIsFrom,
    x: crossX,
    y: chipTops[i],
    w: w.chip,
    h: CHIP_H,
  }));

  // ── edges
  const edges: MapEdge[] = [];
  const neByUser = new Map(ne.map((n) => [n.user.id, n]));
  const personBy = new Map(people.map((p) => [p.person.contact_id, p]));
  for (const p of people) {
    const owner = p.person.ne_owner ? neByUser.get(p.person.ne_owner.id) : undefined;
    if (!owner) continue;
    edges.push({
      key: `hold:${owner.user.id}:${p.person.contact_id}`,
      kind: 'hold',
      a: owner.key,
      b: p.key,
      strength: p.person.strength,
      d: curve(owner.x + owner.w, owner.y + owner.h / 2, p.x, p.y + p.h / 2),
    });
  }
  const rightX = clientX + w.person;
  for (const x of arcs) {
    const a = personBy.get(x.a);
    const b = personBy.get(x.b);
    if (!a || !b) continue;
    const ya = a.y + a.h / 2 + (anchor.get(`${x.key}|${x.a}`) ?? 0);
    const yb = b.y + b.h / 2 + (anchor.get(`${x.key}|${x.b}`) ?? 0);
    const d = arc(rightX, ya, yb, bulgeOfLane(x.lane));
    if (x.kind === 'reports') {
      // a = the subordinate (a dot), b = the manager (an arrow head)
      edges.push({
        key: x.key,
        kind: 'reports',
        a: a.key,
        b: b.key,
        d,
        arrow: `M ${rightX + 6} ${yb - 3.5} L ${rightX + 1} ${yb} L ${rightX + 6} ${yb + 3.5}`,
        dot: { x: rightX + 2, y: ya },
      });
    } else {
      edges.push({ key: x.key, kind: 'peer', a: a.key, b: b.key, d });
    }
  }
  // links to sister companies leave below the arc anchors and run straight past the arc zone before curving away
  const chipBy = new Map(chips.map((c) => [c.end.contact_id, c]));
  const crossCount = new Map<string, number>();
  for (const r of crossRelations) {
    const remoteIsFrom = !local.has(r.from.contact_id);
    const chip = chipBy.get((remoteIsFrom ? r.from : r.to).contact_id);
    const mine = personBy.get((remoteIsFrom ? r.to : r.from).contact_id);
    if (!chip || !mine) continue;
    const k = crossCount.get(mine.key) ?? 0;
    crossCount.set(mine.key, k + 1);
    const ys = mine.y + mine.h / 2 + (ends.has(mine.person.contact_id) ? CROSS_ANCHOR - k * ANCHOR_STEP : k * ANCHOR_STEP);
    edges.push({
      key: `cross:${r.id}`,
      kind: 'cross',
      a: mine.key,
      b: chip.key,
      d: stubCurve(mine.x + mine.w, ys, rightX + arcZone, chip.x, chip.y + chip.h / 2),
    });
  }

  const height =
    Math.max(
      clientBottom,
      ...ne.map((n) => n.y + n.h),
      ...chips.map((c) => c.y + c.h),
      0,
    ) + 4;

  return {
    width,
    height,
    columns: {
      ne: { x: neX, y: 0, w: w.ne, h: height },
      client: { x: clientX - GROUP_INSET, y: 0, w: w.person + GROUP_INSET * 2, h: height },
      cross: hasCross ? { x: crossX, y: 0, w: w.chip, h: height } : null,
    },
    ne,
    groups,
    people,
    chips,
    edges,
  };
}

/** width of the arc zone for a given input (used to know when the map must scroll) */
export function mapMinWidth(input: MapInput): number {
  return layoutMap(input, 0).width;
}
