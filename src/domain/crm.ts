// CRM / targeting rules (ARCHITECTURE §13) — pure functions, no db, no React.
// Fit score & grades, stage defaults, weighted values, segment matching, follow-up buckets,
// pipeline aggregates, whitespace and workload weeks. Tested by src/dev/crmTests.ts.

import type { Health, ID, ISODate, ISODateTime, Stage, Tier } from './types';
import type {
  CompanySize,
  IcpProfile,
  InteractionKind,
  InteractionOutcome,
  LeadSource,
  LeadStatus,
  OpportunityStage,
  RevenueBand,
  SegmentCriteria,
} from './crmTypes';
import type { FitBreakdown } from '@/services/crmContract';
import { dateOf } from './clock';
import { addDays, diffDays, monthOf, startOfWeek } from './dates';

// ───────────────────────────── enums ─────────────────────────────

export const OPPORTUNITY_STAGES: readonly OpportunityStage[] = ['qualified', 'discovery', 'proposal', 'negotiation', 'won', 'lost'];
export type OpenStage = Exclude<OpportunityStage, 'won' | 'lost'>;
/** pipeline order */
export const OPEN_STAGES: readonly OpenStage[] = ['qualified', 'discovery', 'proposal', 'negotiation'];
export const STAGE_PROBABILITY: Readonly<Record<OpportunityStage, number>> = {
  qualified: 10,
  discovery: 25,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
};

export const LEAD_STATUSES: readonly LeadStatus[] = ['new', 'contacted', 'interested', 'nurturing', 'disqualified', 'converted'];
/** "đang theo đuổi" */
export const OPEN_LEAD_STATUSES: readonly LeadStatus[] = ['new', 'contacted', 'interested', 'nurturing'];
export const COMPANY_SIZES: readonly CompanySize[] = ['lt50', '50_200', '200_1000', 'gt1000'];
export const REVENUE_BANDS: readonly RevenueBand[] = ['lt50b', '50_200b', '200b_1t', 'gt1t'];
export const LEAD_SOURCES: readonly LeadSource[] = ['referral', 'event', 'website', 'outbound', 'partner', 'existing_customer'];
export const INTERACTION_KINDS: readonly InteractionKind[] = ['call', 'meeting', 'email', 'demo', 'zalo', 'note'];
export const INTERACTION_OUTCOMES: readonly InteractionOutcome[] = ['positive', 'neutral', 'negative'];
const TIERS: readonly Tier[] = ['strategic', 'key', 'standard'];
const ACCOUNT_STAGES: readonly Stage[] = ['prospecting', 'negotiating', 'implementing', 'operating', 'paused'];
const HEALTHS: readonly Health[] = ['blocked', 'attention', 'on_track'];

export function isOpenStage(stage: OpportunityStage): stage is OpenStage {
  return stage !== 'won' && stage !== 'lost';
}

export function isOpenLead(status: LeadStatus): boolean {
  return OPEN_LEAD_STATUSES.includes(status);
}

/** default probability of a stage (moving a stage resets to it; it stays editable) */
export function defaultProbability(stage: OpportunityStage): number {
  return STAGE_PROBABILITY[stage] ?? 0;
}

/** 0–100, whole number (NaN → 0) */
export function clampProbability(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.min(100, Math.max(0, Math.round(p)));
}

/** value × probability / 100, whole VND */
export function weightedValue(value: number, probability: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value * clampProbability(probability)) / 100);
}

/** account stage after an opportunity reaches `oppStage` (negotiation: prospecting → negotiating; won → implementing) */
export function accountStageAfter(accountStage: Stage, oppStage: OpportunityStage): Stage {
  if (oppStage === 'negotiation' && accountStage === 'prospecting') return 'negotiating';
  if (oppStage === 'won' && (accountStage === 'prospecting' || accountStage === 'negotiating')) return 'implementing';
  return accountStage;
}

// ───────────────────────────── text helpers ─────────────────────────────

/** case / diacritics / spacing-insensitive form ('TP. Hồ Chí Minh' ≈ 'tp. ho chi minh') */
export function normalizeLabel(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function labelIn(value: string, list: readonly string[]): boolean {
  const v = normalizeLabel(value);
  return v !== '' && list.some((x) => normalizeLabel(x) === v);
}

/** trimmed, non-empty, unique (by normalized form) — first spelling wins */
export function cleanLabels(list: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list ?? []) {
    if (typeof raw !== 'string') continue;
    const s = raw.trim().replace(/\s+/g, ' ');
    const key = normalizeLabel(s);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** calendar date of an ISODate / ISODateTime, null when unreadable (never throws) */
export function safeDateOf(at: ISODateTime | ISODate | null | undefined): ISODate | null {
  if (!at || typeof at !== 'string') return null;
  if (at.length === 10) return /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : null;
  return Number.isNaN(new Date(at).getTime()) ? null : dateOf(at);
}

/** 'minh@saomai.vn' → 'saomai.vn' ('' when not an email) */
export function emailDomain(email: string): string {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec((email ?? '').trim().toLowerCase());
  return m ? m[1] : '';
}

/** free mailbox providers: their domain says nothing about the company */
const PUBLIC_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.com.vn',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'mail.com',
  'gmx.com',
]);

export function isPublicMailDomain(domain: string): boolean {
  return PUBLIC_MAIL_DOMAINS.has((domain ?? '').trim().toLowerCase());
}

/** 'https://www.saomai.vn/gioi-thieu' → 'saomai.vn' ('' when it is not a web address) */
export function websiteDomain(website: string | null | undefined): string {
  const raw = (website ?? '').trim().toLowerCase();
  if (!raw) return '';
  const m = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/\s]*@)?([^/:?#\s]+)/.exec(raw);
  const host = m ? m[1].replace(/^www\./, '').replace(/\.$/, '') : '';
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : '';
}

/**
 * Email domain of the account a lead converts into: the contact's email domain, unless that is a free mailbox
 * (gmail.com…) — then the website's domain, so client invites are not opened to every gmail address.
 * Falls back to the email domain when the lead has no usable website.
 */
export function companyDomain(email: string, website: string | null | undefined): string {
  const fromEmail = emailDomain(email);
  if (fromEmail && !isPublicMailDomain(fromEmail)) return fromEmail;
  return websiteDomain(website) || fromEmail;
}

const LEGAL_PREFIXES = ['tong cong ty', 'cong ty', 'tap doan', 'co phan', 'trach nhiem huu han', 'mot thanh vien', 'tnhh', 'mtv', 'cp', 'ctcp'];

/** 'Công ty CP Thực phẩm Sao Mai' → 'Sao Mai' (legal form dropped; long names keep their last two words) */
export function shortNameOf(companyName: string): string {
  let words = (companyName ?? '').trim().split(/\s+/).filter(Boolean);
  let changed = true;
  while (changed && words.length > 1) {
    changed = false;
    for (const prefix of LEGAL_PREFIXES) {
      const n = prefix.split(' ').length;
      if (words.length > n && normalizeLabel(words.slice(0, n).join(' ')) === prefix) {
        words = words.slice(n);
        changed = true;
        break;
      }
    }
  }
  if (words.length > 3) words = words.slice(-2);
  return words.join(' ') || (companyName ?? '').trim();
}

// ───────────────────────────── fit score ─────────────────────────────

export const FIT_IN = 100;
export const FIT_ADJACENT = 60;
export const FIT_OUT = 20;
export const PROVINCE_OUT = 40;
export const ENGAGEMENT_WINDOW_DAYS = 60;

export interface FitSubject {
  industry: string;
  province: string;
  size: CompanySize;
  revenue_band: RevenueBand;
}

export type FitIcp = Pick<IcpProfile, 'target_industries' | 'target_provinces' | 'target_sizes' | 'target_revenue_bands' | 'weights'>;

/** in the ICP 100, else 20 (an ICP without industries accepts every industry) */
export function industryScore(industry: string, targets: readonly string[]): number {
  if (targets.length === 0) return FIT_IN;
  return labelIn(industry, targets) ? FIT_IN : FIT_OUT;
}

/** in the ICP 100, else 40 (no target provinces = every province) */
export function provinceScore(province: string, targets: readonly string[]): number {
  if (targets.length === 0) return FIT_IN;
  return labelIn(province, targets) ? FIT_IN : PROVINCE_OUT;
}

/** ordered bands: in the ICP 100, next to a target band 60, else 20 (no targets = every band) */
export function bandScore<T extends string>(value: T, targets: readonly T[], order: readonly T[]): number {
  if (targets.length === 0) return FIT_IN;
  if (targets.includes(value)) return FIT_IN;
  const i = order.indexOf(value);
  if (i < 0) return FIT_OUT;
  return targets.some((t) => Math.abs(order.indexOf(t) - i) === 1 && order.indexOf(t) >= 0) ? FIT_ADJACENT : FIT_OUT;
}

export const sizeScore = (size: CompanySize, targets: readonly CompanySize[]): number => bandScore(size, targets, COMPANY_SIZES);
export const revenueScore = (band: RevenueBand, targets: readonly RevenueBand[]): number => bandScore(band, targets, REVENUE_BANDS);

/**
 * Interactions of the last 60 days (future ones ignored): none 0; the latest ≤ 7 days ago 100, ≤ 30 days 70,
 * ≤ 60 days 40; +5 for each further interaction in the window; max 100.
 */
export function engagementScore(occurred: readonly (ISODateTime | ISODate)[], today: ISODate): number {
  let count = 0;
  let latestAge = Number.POSITIVE_INFINITY;
  for (const at of occurred) {
    const day = safeDateOf(at);
    if (!day) continue;
    const age = diffDays(today, day);
    if (age < 0 || age > ENGAGEMENT_WINDOW_DAYS) continue;
    count += 1;
    if (age < latestAge) latestAge = age;
  }
  if (count === 0) return 0;
  const base = latestAge <= 7 ? 100 : latestAge <= 30 ? 70 : 40;
  return Math.min(100, base + 5 * (count - 1));
}

export function fitGrade(score: number): FitBreakdown['grade'] {
  return score >= 75 ? 'A' : score >= 50 ? 'B' : 'C';
}

type Weights = IcpProfile['weights'];
const WEIGHT_KEYS: readonly (keyof Weights)[] = ['industry', 'size', 'revenue', 'province', 'engagement'];

/** non-negative finite weights; all zero / invalid → equal weights */
export function normalizeWeights(w: Partial<Weights> | null | undefined): Weights {
  const out: Weights = { industry: 0, size: 0, revenue: 0, province: 0, engagement: 0 };
  let sum = 0;
  for (const k of WEIGHT_KEYS) {
    const n = Number(w?.[k]);
    out[k] = Number.isFinite(n) && n > 0 ? n : 0;
    sum += out[k];
  }
  if (sum <= 0) for (const k of WEIGHT_KEYS) out[k] = 1;
  return out;
}

/** score = Σ wᵢ·cᵢ / Σ wᵢ (rounded); grade A ≥ 75 · B 50–74 · C < 50 */
export function computeFit(subject: FitSubject, icp: FitIcp, interactionDates: readonly (ISODateTime | ISODate)[], today: ISODate): FitBreakdown {
  const parts = {
    industry: industryScore(subject.industry, icp.target_industries ?? []),
    size: sizeScore(subject.size, icp.target_sizes ?? []),
    revenue: revenueScore(subject.revenue_band, icp.target_revenue_bands ?? []),
    province: provinceScore(subject.province, icp.target_provinces ?? []),
    engagement: engagementScore(interactionDates, today),
  };
  const w = normalizeWeights(icp.weights);
  let num = 0;
  let den = 0;
  for (const k of WEIGHT_KEYS) {
    num += w[k] * parts[k];
    den += w[k];
  }
  const score = Math.round(num / den);
  return { score, ...parts, grade: fitGrade(score) };
}

// ───────────────────────────── segments ─────────────────────────────

export interface SegmentSubject {
  kind: 'lead' | 'account';
  industry: string;
  province: string;
  size: CompanySize;
  revenue_band: RevenueBand;
  source: LeadSource;
  tags: readonly string[];
  /** lead owner / account AM */
  owner_id: ID | null;
  fit_score: number;
  /** leads only */
  lead_status?: LeadStatus | null;
  /** accounts only */
  tier?: Tier | null;
  stage?: Stage | null;
  health?: Health | null;
}

function pick<T extends string>(list: readonly T[] | undefined, allowed: readonly T[]): T[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const out = [...new Set(list.filter((x) => allowed.includes(x)))];
  return out.length ? out : undefined;
}

/** drops unknown values and empty lists, dedupes, clamps min_fit_score to 0–100; unknown scope → 'all' */
export function normalizeCriteria(c: SegmentCriteria | null | undefined): SegmentCriteria {
  const src: Partial<SegmentCriteria> = c ?? {};
  const scope: SegmentCriteria['scope'] = src.scope === 'leads' || src.scope === 'accounts' ? src.scope : 'all';
  const out: SegmentCriteria = { scope };
  const labels = (list: string[] | undefined): string[] | undefined => {
    const clean = cleanLabels(list);
    return clean.length ? clean : undefined;
  };
  const industries = labels(src.industries);
  if (industries) out.industries = industries;
  const provinces = labels(src.provinces);
  if (provinces) out.provinces = provinces;
  const tags = labels(src.tags);
  if (tags) out.tags = tags;
  const sizes = pick(src.sizes, COMPANY_SIZES);
  if (sizes) out.sizes = sizes;
  const bands = pick(src.revenue_bands, REVENUE_BANDS);
  if (bands) out.revenue_bands = bands;
  const sources = pick(src.sources, LEAD_SOURCES);
  if (sources) out.sources = sources;
  const statuses = pick(src.lead_statuses, LEAD_STATUSES);
  if (statuses) out.lead_statuses = statuses;
  const tiers = pick(src.tiers, TIERS);
  if (tiers) out.tiers = tiers;
  const stages = pick(src.stages, ACCOUNT_STAGES);
  if (stages) out.stages = stages;
  const health = pick(src.health, HEALTHS);
  if (health) out.health = health;
  if (Array.isArray(src.owner_ids)) {
    const owners = [...new Set(src.owner_ids.filter((x) => typeof x === 'string' && x))];
    if (owners.length) out.owner_ids = owners;
  }
  const min = Number(src.min_fit_score);
  if (src.min_fit_score !== undefined && src.min_fit_score !== null && Number.isFinite(min) && min > 0) {
    out.min_fit_score = Math.min(100, Math.round(min));
  }
  return out;
}

/**
 * Does the subject belong to the segment? Every criterion that is set must hold (AND); a list matches when the
 * subject's value is in it (industries / provinces case- and diacritics-insensitive; tags: at least one in common).
 * Kind-specific criteria (lead_statuses: leads; tiers, stages, health: accounts) can only hold for their own kind,
 * so with scope 'all' setting one keeps the other kind out ("all · health blocked" = blocked accounts, no leads).
 * A lead segment without lead_statuses keeps open leads only (new · contacted · interested · nurturing).
 */
export function matchesSegment(s: SegmentSubject, criteria: SegmentCriteria): boolean {
  const c = criteria;
  if (c.scope === 'leads' && s.kind !== 'lead') return false;
  if (c.scope === 'accounts' && s.kind !== 'account') return false;
  if (c.industries?.length && !labelIn(s.industry, c.industries)) return false;
  if (c.provinces?.length && !labelIn(s.province, c.provinces)) return false;
  if (c.sizes?.length && !c.sizes.includes(s.size)) return false;
  if (c.revenue_bands?.length && !c.revenue_bands.includes(s.revenue_band)) return false;
  if (c.sources?.length && !c.sources.includes(s.source)) return false;
  if (c.tags?.length && !s.tags.some((tag) => labelIn(tag, c.tags ?? []))) return false;
  if (c.owner_ids?.length && (s.owner_id === null || !c.owner_ids.includes(s.owner_id))) return false;
  if (c.min_fit_score !== undefined && c.min_fit_score !== null && s.fit_score < c.min_fit_score) return false;
  if (s.kind === 'lead') {
    // a lead has no tier, account stage or project health: an account-only criterion keeps leads out
    if (c.tiers?.length || c.stages?.length || c.health?.length) return false;
    const status = s.lead_status ?? 'new';
    if (c.lead_statuses?.length) {
      if (!c.lead_statuses.includes(status)) return false;
    } else if (!isOpenLead(status)) {
      return false;
    }
  } else {
    // an account has no lead status: a lead-status criterion keeps accounts out
    if (c.lead_statuses?.length) return false;
    if (c.tiers?.length && (!s.tier || !c.tiers.includes(s.tier))) return false;
    if (c.stages?.length && (!s.stage || !c.stages.includes(s.stage))) return false;
    if (c.health?.length && (!s.health || !c.health.includes(s.health))) return false;
  }
  return true;
}

// ───────────────────────────── follow-ups ─────────────────────────────

export type FollowUpBucket = 'overdue' | 'today' | 'week' | 'later';
/** 'week' = the next 7 days after today */
export const FOLLOW_UP_WEEK_DAYS = 7;

/** overdue: date < today · today · week: today < date ≤ today + 7 · later */
export function followUpBucket(date: ISODate, today: ISODate): FollowUpBucket {
  if (date < today) return 'overdue';
  if (date === today) return 'today';
  return date <= addDays(today, FOLLOW_UP_WEEK_DAYS) ? 'week' : 'later';
}

// ───────────────────────────── pipeline aggregates ─────────────────────────────

export interface DealLike {
  stage: OpportunityStage;
  value: number;
  probability: number;
  expected_close_date: ISODate;
  created_at: ISODateTime;
  won_at: ISODateTime | null;
  lost_at: ISODateTime | null;
}

export function pipelineByStage(deals: readonly DealLike[]): { stage: OpenStage; count: number; value: number; weighted: number }[] {
  const rows = OPEN_STAGES.map((stage) => ({ stage, count: 0, value: 0, weighted: 0 }));
  for (const d of deals) {
    const row = rows.find((r) => r.stage === d.stage);
    if (!row) continue;
    row.count += 1;
    row.value += d.value;
    row.weighted += weightedValue(d.value, d.probability);
  }
  return rows;
}

/** 'YYYY-MM' + n months → 'YYYY-MM' */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/**
 * Next `months` months from the current one: weighted value of open deals by expected close month (a past expected
 * close date counts in the current month) + value won in that month.
 */
export function forecastByMonth(deals: readonly DealLike[], today: ISODate, months = 6): { month: string; weighted: number; won: number }[] {
  const first = monthOf(today);
  const rows = Array.from({ length: months }, (_, i) => ({ month: addMonths(first, i), weighted: 0, won: 0 }));
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  for (const d of deals) {
    if (isOpenStage(d.stage)) {
      const m = monthOf(d.expected_close_date) < first ? first : monthOf(d.expected_close_date);
      const row = byMonth.get(m);
      if (row) row.weighted += weightedValue(d.value, d.probability);
    } else if (d.stage === 'won') {
      const day = safeDateOf(d.won_at);
      const row = day ? byMonth.get(monthOf(day)) : undefined;
      if (row) row.won += d.value;
    }
  }
  return rows;
}

function within(at: ISODateTime | null, today: ISODate, days: number): boolean {
  const day = safeDateOf(at);
  if (!day) return false;
  const age = diffDays(today, day);
  return age >= 0 && age <= days;
}

/** won / (won + lost) closed in the last `days` days, % rounded (0 when nothing closed) */
export function winRate(deals: readonly DealLike[], today: ISODate, days = 180): number {
  let won = 0;
  let lost = 0;
  for (const d of deals) {
    if (d.stage === 'won' && within(d.won_at, today, days)) won += 1;
    else if (d.stage === 'lost' && within(d.lost_at, today, days)) lost += 1;
  }
  return won + lost === 0 ? 0 : Math.round((won * 100) / (won + lost));
}

/** average days from created_at to won_at of deals won in the last `days` days (0 when none) */
export function avgCycleDays(deals: readonly DealLike[], today: ISODate, days = 365): number {
  const cycles: number[] = [];
  for (const d of deals) {
    if (d.stage !== 'won' || !within(d.won_at, today, days)) continue;
    const won = safeDateOf(d.won_at);
    const created = safeDateOf(d.created_at);
    if (won && created) cycles.push(Math.max(0, diffDays(won, created)));
  }
  return cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : 0;
}

// ───────────────────────────── whitespace ─────────────────────────────

/** active items the account has not bought yet (bought = in an accepted quote) */
export function whitespaceItems<T extends { id: ID; active: boolean }>(items: readonly T[], bought: ReadonlySet<ID>): T[] {
  return items.filter((i) => i.active && !bought.has(i.id));
}

// ───────────────────────────── workload ─────────────────────────────

/** Mondays of the `n` weeks starting with the current one */
export function workloadWeeks(today: ISODate, n: number): ISODate[] {
  const first = startOfWeek(today);
  return Array.from({ length: Math.max(0, n) }, (_, i) => addDays(first, i * 7));
}

/** index of the week a task due on `due` counts in (overdue → 0), −1 beyond the last week */
export function workloadWeekIndex(due: ISODate, today: ISODate, n: number): number {
  if (n <= 0) return -1;
  if (due < today) return 0;
  const i = Math.floor(diffDays(due, startOfWeek(today)) / 7);
  return i < n ? Math.max(0, i) : -1;
}
