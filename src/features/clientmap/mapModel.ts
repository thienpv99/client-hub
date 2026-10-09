// Pure helpers of the client map: bubble radii, labels, search, KPI figures and table rows.
import { isFeatureOn } from '@/config/features';
import type { ClientMap, ClientMapMetric, ClientMapNode, EcosystemView } from '@/services/crmContract';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { normalizeText } from '@/lib/utils';

export const METRICS: ClientMapMetric[] = ['total', 'contract_value', 'pipeline'];

export function isMetric(v: unknown): v is ClientMapMetric {
  return typeof v === 'string' && (METRICS as string[]).includes(v);
}

/**
 * the bubble size the map opens with: "Tổng giá trị" (contracts + weighted deals) while the sales module is on;
 * signed contracts only when it is off (SPEC-CARE §1) — a prospect must not look like a big client
 */
export function defaultMetric(): ClientMapMetric {
  return isFeatureOn('sales') ? 'total' : 'contract_value';
}

/**
 * metrics on offer: "Cơ hội" (pipeline) and "Tổng giá trị" (contracts + weighted pipeline) only while the sales module
 * is on — without it a prospect with no contract would still look worth billions (review QA-CARE-F6)
 */
export function isMetricAvailable(m: ClientMapMetric): boolean {
  return m === 'contract_value' || isFeatureOn('sales');
}

/** the "Tổng giá trị" money column / figure (it carries the weighted pipeline): sales module only */
export function showTotalValue(): boolean {
  return isFeatureOn('sales');
}

/**
 * smallest company bubble, customer or target (world px ≈ screen px once the map is fitted): the readability floor
 * of the logo chip / initials; only bubbles below it are not proportional to their value
 */
export const R_MIN_COMPANY = 14;
/** smallest hub: room for the group's short name and its value */
export const R_MIN_HUB = 40;
/** customer bubbles whose on-screen radius reaches this show their name + value (+ logo from 38) */
export const R_DETAIL = 30;
/** largest company (customer or target) ≈ this share of the canvas' short side (before the density check) */
const R_MAX_SHARE = 0.22;
/** a hub is at least this much wider than its widest member (+4px) … */
const HUB_OVER_MEMBER = 1.2;
/** … and the largest hub (the biggest group by value) reaches this × the largest company */
const HUB_TOP = 1.4;
/**
 * The hubs share one √ scale (group areas stay proportional to value). It grows past HUB_TOP when a group would
 * otherwise be narrower than its widest member — at most this factor, so one tiny group cannot inflate every hub.
 */
const HUB_SCALE_MAX = 2;
/** a group worth nothing in the chosen metric: a small, muted ring around its members (no full-size hub) */
export const R_EMPTY_HUB = 24;
/** share of the canvas the bubbles' area aims for; the fitted view then fills the card */
const DENSITY = 0.5;
/** keep in step with forceSim COLLIDE_PAD */
const PAD = 4;
/** short names longer than this are refused by the ecosystem form */
export const SHORT_NAME_MAX = 16;

/** drawn scale of a bubble during its entrance (`grow` 0…1): it fades in while growing from 60 % — a settle, no pop */
export function introScale(grow: number): number {
  return 0.6 + 0.4 * Math.max(0, Math.min(1, grow));
}

export function isCompany(n: ClientMapNode): boolean {
  return n.kind !== 'ecosystem';
}

/** member node id → hub node id, from the ecosystem links (either direction) */
export function hubIndex(map: Pick<ClientMap, 'nodes' | 'links'>): Map<string, string> {
  const kind = new Map(map.nodes.map((n) => [n.id, n.kind]));
  const out = new Map<string, string>();
  for (const l of map.links) {
    if (kind.get(l.source) === 'ecosystem' && kind.get(l.target) && kind.get(l.target) !== 'ecosystem') {
      out.set(l.target, l.source);
    } else if (kind.get(l.target) === 'ecosystem' && kind.get(l.source) && kind.get(l.source) !== 'ecosystem') {
      out.set(l.source, l.target);
    }
  }
  return out;
}

/**
 * Area ∝ value (r = rMax × √(value / max), never below a small readability floor):
 * - companies — customers AND targets — share ONE √ scale, against the most valuable company on the map, rMax ≤ 0.22
 *   × the canvas' short side. A target's value is its budget estimate (total / pipeline metrics; 0 in the contract
 *   one, so targets sit at their floor there): a 5 tỷ target is drawn bigger than a 0,9 tỷ customer, as the "Bảng"
 *   ranking says. Only bubbles below the shared floor (R_MIN_COMPANY) stop being proportional.
 * - hubs (ecosystems) are cluster containers on a scale of their own — the legend and the page subtitle say so: the
 *   centre of their cluster and always its biggest shape, and group areas stay proportional to each other: ONE √
 *   scale for every hub (r = k × √value), k = the scale that puts the biggest group at HUB_TOP × rMax (less when the
 *   biggest group is worth less than √-proportionally more than the biggest company), raised just enough that every
 *   group is HUB_OVER_MEMBER × wider (+4px) than its widest member (≤ HUB_SCALE_MAX × the base). So a group worth
 *   less is never drawn bigger than one worth more (Sao Bắc 4,1 tỷ vs Cỏ Xanh 5,6 tỷ); R_MIN_HUB keeps the short
 *   name legible on the smallest ones. A group worth 0 in the metric gets a small muted ring (R_EMPTY_HUB, still
 *   around its widest member) — BubbleNode draws it without the blue fill.
 * rMax shrinks until the bubbles cover about DENSITY of the canvas, so the fitted map fills it at every size.
 */
export function computeRadii(nodes: ClientMapNode[], hubOf: Map<string, string>, width: number, height: number): Map<string, number> {
  const out = new Map<string, number>();
  const companies = nodes.filter(isCompany);
  const hubs = nodes.filter((n) => n.kind === 'ecosystem');
  const maxOf = (list: ClientMapNode[]) => list.reduce((m, n) => Math.max(m, n.value), 0);
  // one value scale for every company, customer or target
  const maxCompany = maxOf(companies);
  const maxHub = maxOf(hubs);
  // the biggest group reaches HUB_TOP × rMax only when it is worth that much more than the biggest company
  // (contract metric: groups are often smaller than one customer's total; they stay the biggest of their cluster)
  const hubTop = maxCompany > 0 ? Math.min(HUB_TOP, Math.sqrt(maxHub / maxCompany)) : HUB_TOP;
  const sized = (v: number, max: number, top: number, floor: number) =>
    max > 0 ? Math.max(floor, top * Math.sqrt(Math.max(0, v) / max)) : floor;

  // a phone canvas (short side < 420) lowers the company and hub floors a little (never below 80 %): otherwise four
  // hubs of the same minimum size leave no room for the differences in value. Customers and targets share the floor
  // too, so a company worth less is never drawn bigger than one worth more.
  const fs = Math.min(1, Math.max(0.8, Math.min(width, height) / 420));
  const assign = (rMax: number) => {
    for (const n of companies) out.set(n.id, sized(n.value, maxCompany, rMax, R_MIN_COMPANY * fs));
    // room each hub needs around its widest member
    const room = new Map<string, number>();
    for (const n of nodes) {
      const hub = hubOf.get(n.id);
      if (hub) room.set(hub, Math.max(room.get(hub) ?? 0, out.get(n.id) ?? 0));
    }
    const roomOf = (id: string) => (room.get(id) ?? 0) * HUB_OVER_MEMBER + 4;
    // one √ scale for every hub: the default one, raised until each group clears its widest member
    const base = maxHub > 0 ? (rMax * hubTop) / Math.sqrt(maxHub) : 0;
    let k = base;
    for (const h of hubs) if (h.value > 0) k = Math.max(k, roomOf(h.id) / Math.sqrt(h.value));
    k = Math.min(k, base * HUB_SCALE_MAX);
    for (const h of hubs) {
      // the room term only bites when the cap above was reached (then the order of two groups may still flip)
      out.set(h.id, h.value > 0 ? Math.max(R_MIN_HUB * fs, roomOf(h.id), k * Math.sqrt(h.value)) : Math.max(R_EMPTY_HUB * fs, roomOf(h.id)));
    }
  };

  const floor = (R_MIN_COMPANY + 8) * fs;
  const target = Math.max(1, DENSITY * width * height);
  let rMax = Math.max(floor, R_MAX_SHARE * Math.min(width, height));
  for (let i = 0; i < 8; i++) {
    assign(rMax);
    let area = 0;
    for (const r of out.values()) area += Math.PI * (r + PAD) * (r + PAD);
    if (area <= target * 1.02 || rMax <= floor) break;
    rMax = Math.max(floor, rMax * Math.sqrt(target / area));
  }
  return out;
}

/** "3,2 tỷ đồng" — the compact money form with the words a screen reader should say */
export function spokenMoney(v: number): string {
  const words: Record<string, string> = {
    [t('common.money.currency')]: t('clientmap.a11y.currencyWord'),
    [t('common.money.billion')]: t('clientmap.a11y.billionWord'),
    [t('common.money.million')]: t('clientmap.a11y.millionWord'),
  };
  return formatMoneyCompact(v)
    .split(/\s+/)
    .map((w) => words[w] ?? w)
    .join(' ');
}

export function ecosystemsById(map: Pick<ClientMap, 'ecosystems'>): Map<string, EcosystemView> {
  return new Map(map.ecosystems.map((e) => [e.id, e]));
}

export function memberCount(eco: EcosystemView | undefined, fallback: string): string {
  return eco ? String(eco.account_count + (isFeatureOn('targets') ? eco.lead_count : 0)) : fallback;
}

export function nodeAriaLabel(n: ClientMapNode, eco: EcosystemView | undefined): string {
  const value = spokenMoney(n.value);
  if (n.kind === 'ecosystem') {
    return t('clientmap.a11y.hub', { name: eco?.name ?? n.label, count: memberCount(eco, n.sublabel), value });
  }
  if (n.kind === 'lead') {
    return n.fit_grade
      ? t('clientmap.a11y.lead', { name: n.label, value, grade: n.fit_grade })
      : t('clientmap.a11y.leadNoGrade', { name: n.label, value });
  }
  return n.health
    ? t('clientmap.a11y.account', { name: n.label, value, health: t(`enums.health.${n.health}`).toLowerCase() })
    : t('clientmap.a11y.accountNoHealth', { name: n.label, value });
}

export function matchesQuery(n: ClientMapNode, query: string): boolean {
  const q = normalizeText(query.trim());
  if (!q) return true;
  return normalizeText(`${n.label} ${n.sublabel}`).includes(q);
}

// ───────────────────────────── values per company ─────────────────────────────

/** weighted pipeline; a lead's pipeline is its budget estimate */
export function pipelineOf(n: ClientMapNode): number {
  return n.kind === 'lead' ? Math.max(n.pipeline_value, n.value) : n.pipeline_value;
}

export function totalOf(n: ClientMapNode): number {
  return n.contract_value + pipelineOf(n);
}

// ───────────────────────────── KPI strip ─────────────────────────────

export interface MapKpiData {
  value: number;
  /** Σ contract value / Σ pipeline (weighted deals + target budgets) of the companies on the map */
  contract: number;
  pipeline: number;
  companies: number;
  accounts: number;
  /** customers whose health is blocked or needs attention */
  accountsAtRisk: number;
  leads: number;
  ecosystems: number;
  /** companies that belong to an ecosystem shown on the map */
  ecoMembers: number;
  top: { name: string; value: number; share: number } | null;
}

export function mapKpis(map: ClientMap): MapKpiData {
  const hubOf = hubIndex(map);
  const companies = map.nodes.filter(isCompany);
  const ecos = ecosystemsById(map);
  let top: MapKpiData['top'] = null;
  for (const n of map.nodes) {
    if (isCompany(n)) continue;
    if (!top || n.value > top.value) {
      top = { name: ecos.get(n.ref_id)?.short_name || n.label, value: n.value, share: 0 };
    }
  }
  if (top) top.share = map.totals.value > 0 ? (top.value / map.totals.value) * 100 : 0;
  return {
    value: map.totals.value,
    contract: companies.reduce((sum, n) => sum + n.contract_value, 0),
    pipeline: companies.reduce((sum, n) => sum + pipelineOf(n), 0),
    companies: companies.length,
    accounts: map.totals.accounts,
    accountsAtRisk: companies.filter((n) => n.kind === 'account' && (n.health === 'blocked' || n.health === 'attention')).length,
    leads: map.totals.leads,
    ecosystems: map.totals.ecosystems,
    ecoMembers: companies.filter((n) => hubOf.has(n.id)).length,
    top,
  };
}

// ───────────────────────────── table rows ─────────────────────────────

export interface RankedRow {
  node: ClientMapNode;
  rank: number;
  contract: number;
  pipeline: number;
  total: number;
  eco: EcosystemView | null;
}

const collator = new Intl.Collator('vi');

export function rankedRows(map: ClientMap): RankedRow[] {
  const ecos = ecosystemsById(map);
  return map.nodes
    .filter(isCompany)
    .sort((a, b) => b.value - a.value || collator.compare(a.label, b.label))
    .map((node, i) => ({
      node,
      rank: i + 1,
      contract: node.contract_value,
      pipeline: pipelineOf(node),
      total: totalOf(node),
      eco: node.ecosystem_id ? ecos.get(node.ecosystem_id) ?? null : null,
    }));
}

export interface RowGroup {
  key: string;
  eco: EcosystemView | null;
  rows: RankedRow[];
  value: number;
  contract: number;
  pipeline: number;
  total: number;
}

/** groups by ecosystem (largest first), companies outside any ecosystem last */
export function groupedRows(rows: RankedRow[]): RowGroup[] {
  const groups = new Map<string, RowGroup>();
  for (const r of rows) {
    const key = r.eco?.id ?? '';
    const g = groups.get(key) ?? { key, eco: r.eco, rows: [], value: 0, contract: 0, pipeline: 0, total: 0 };
    g.rows.push(r);
    g.value += r.node.value;
    g.contract += r.contract;
    g.pipeline += r.pipeline;
    g.total += r.total;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.eco !== !b.eco) return a.eco ? -1 : 1;
    return b.value - a.value || collator.compare(a.eco?.name ?? '', b.eco?.name ?? '');
  });
}

export function ownerName(n: ClientMapNode): string {
  return n.owner?.full_name ?? t('clientmap.tooltip.noOwner');
}
