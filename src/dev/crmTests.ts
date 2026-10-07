// CRM domain self tests (src/domain/crm.ts) — pure, no db — plus the client map ("Bản đồ khách hàng"): its pure
// assembly on hand-built members, then the AM scoping of services/api/clientMap.ts on the current demo db (read only).
// Run in the browser: (await import('/src/dev/crmTests')).runCrmTests().filter(r => !r.ok)

import type { ID, ISODate } from '@/domain/types';
import type { OpportunityStage, SegmentCriteria } from '@/domain/crmTypes';
import { ApiError, type Viewer } from '@/services/contract';
import { CLIENT_MAP_METRICS, assembleClientMap, clientMapFor, ecosystemViewOf, metricValue, type EcosystemInfo, type MapMember } from '@/services/api/clientMap';
import { toUserRef } from '@/services/context';
import { db } from '@/services/db';
import { ECOSYSTEM_SPECS } from '@/data/seed/ecosystems';
import { addDays } from '@/domain/dates';
import {
  OPPORTUNITY_STAGES,
  accountStageAfter,
  addMonths,
  avgCycleDays,
  bandScore,
  cleanLabels,
  COMPANY_SIZES,
  companyDomain,
  computeFit,
  defaultProbability,
  emailDomain,
  engagementScore,
  fitGrade,
  followUpBucket,
  forecastByMonth,
  industryScore,
  isOpenStage,
  isPublicMailDomain,
  matchesSegment,
  normalizeCriteria,
  normalizeWeights,
  pipelineByStage,
  provinceScore,
  revenueScore,
  shortNameOf,
  sizeScore,
  websiteDomain,
  weightedValue,
  whitespaceItems,
  winRate,
  workloadWeekIndex,
  workloadWeeks,
  type DealLike,
  type FitIcp,
  type SegmentSubject,
} from '@/domain/crm';
import { assert, assertEqual, createSuite, type TestResult } from '@/dev/testkit';

/** a Tuesday */
const TODAY: ISODate = '2026-10-06';
const at = (d: ISODate): string => `${d}T09:00:00.000+07:00`;
const ago = (n: number): string => at(addDays(TODAY, -n));

const ICP: FitIcp = {
  target_industries: ['Bán lẻ', 'Ngân hàng'],
  target_provinces: ['TP. Hồ Chí Minh'],
  target_sizes: ['200_1000'],
  target_revenue_bands: ['200b_1t'],
  weights: { industry: 30, size: 20, revenue: 20, province: 10, engagement: 20 },
};

function lead(over: Partial<SegmentSubject> = {}): SegmentSubject {
  return {
    kind: 'lead',
    industry: 'Bán lẻ',
    province: 'TP. Hồ Chí Minh',
    size: '200_1000',
    revenue_band: '200b_1t',
    source: 'referral',
    tags: ['omnichannel'],
    owner_id: 'u_am_ha',
    fit_score: 80,
    lead_status: 'interested',
    ...over,
  };
}

function account(over: Partial<SegmentSubject> = {}): SegmentSubject {
  return { ...lead(), kind: 'account', lead_status: null, tier: 'strategic', stage: 'implementing', health: 'on_track', ...over };
}

function deal(over: Partial<DealLike>): DealLike {
  return { stage: 'qualified', value: 0, probability: 10, expected_close_date: TODAY, created_at: at(TODAY), won_at: null, lost_at: null, ...over };
}

const crit = (c: Omit<SegmentCriteria, 'scope'> & { scope?: SegmentCriteria['scope'] }): SegmentCriteria => ({ scope: 'all', ...c });

// ── client map fixtures: group A has 3 visible members, group B only one, one lead names an unknown group
function member(kind: MapMember['kind'], id: ID, over: Partial<MapMember> = {}): MapMember {
  const account = kind === 'account';
  return {
    kind,
    id,
    label: id,
    sublabel: 'Bán lẻ',
    contract_value: 0,
    pipeline_value: 0,
    open_opportunities: 0,
    health: account ? 'on_track' : null,
    stage: account ? 'implementing' : null,
    tier: account ? 'key' : null,
    lead_status: account ? null : 'interested',
    fit_grade: 'B',
    ecosystem_id: null,
    logo: { initials: 'XX', brand_color: '#334155', logo_url: null },
    owner: null,
    ...over,
  };
}

const MAP_ECOS: EcosystemInfo[] = [
  { id: 'eco_a', name: 'Tập đoàn A', short_name: 'Nhóm A', description: '', industry: 'Bán lẻ' },
  { id: 'eco_b', name: 'Tập đoàn B', short_name: 'Nhóm B', description: '', industry: null },
];

const MAP_MEMBERS: MapMember[] = [
  member('account', 'acc_1', { contract_value: 1000, pipeline_value: 300, open_opportunities: 2, ecosystem_id: 'eco_a', logo: { initials: 'A1', brand_color: '#0F766E', logo_url: null } }),
  member('lead', 'lead_1', { pipeline_value: 500, ecosystem_id: 'eco_a' }),
  member('lead', 'lead_2', { pipeline_value: 200, ecosystem_id: 'eco_a' }),
  member('account', 'acc_2', { contract_value: 800, ecosystem_id: 'eco_b' }),
  member('account', 'acc_3', { contract_value: 50, pipeline_value: 20 }),
  member('lead', 'lead_3', { pipeline_value: 100, ecosystem_id: 'eco_gone' }),
];

/** a signed-in (not view-as) viewer for a seeded user, built like services/context does */
function viewerOf(userId: ID): Viewer | null {
  const u = db.find('users', userId);
  if (!u) return null;
  return {
    user: { ...toUserRef(u), account_id: u.account_id, notification_pref: u.notification_pref, onboarded_at: u.onboarded_at },
    role: u.role,
    org_type: u.org_type,
    account_id: u.account_id,
    can_view_cost: u.role === 'director' || (u.role === 'am' && u.can_view_cost),
    read_only: false,
    impersonating: null,
    remember_device: false,
  };
}

const OPEN_LEAD_STATUSES = ['new', 'contacted', 'interested', 'nurturing'];

export function runCrmTests(): TestResult[] {
  const s = createSuite('crm');

  // ── stages & weighted values
  s.test('stage default probabilities: 10 · 25 · 50 · 75 · 100 · 0', () => {
    const got = OPPORTUNITY_STAGES.map((st) => [st, defaultProbability(st)]);
    assertEqual(got, [['qualified', 10], ['discovery', 25], ['proposal', 50], ['negotiation', 75], ['won', 100], ['lost', 0]], 'defaults');
  });

  s.test('open stages are the four pipeline stages', () => {
    const open = OPPORTUNITY_STAGES.filter((st: OpportunityStage) => isOpenStage(st));
    assertEqual(open, ['qualified', 'discovery', 'proposal', 'negotiation'], 'open stages');
  });

  s.test('weighted value = value × probability / 100, whole VND, probability clamped', () => {
    assertEqual(weightedValue(1_200_000_000, 75), 900_000_000, '75 %');
    assertEqual(weightedValue(333, 33), 110, 'rounded');
    assertEqual(weightedValue(1000, 140), 1000, 'clamped to 100');
    assertEqual(weightedValue(1000, -5), 0, 'clamped to 0');
    assertEqual(weightedValue(1000, Number.NaN), 0, 'NaN → 0');
  });

  s.test('account stage follows the deal: negotiation & won', () => {
    assertEqual(accountStageAfter('prospecting', 'negotiation'), 'negotiating', 'prospecting → negotiating');
    assertEqual(accountStageAfter('implementing', 'negotiation'), 'implementing', 'customer stays');
    assertEqual(accountStageAfter('prospecting', 'proposal'), 'prospecting', 'proposal keeps prospecting');
    assertEqual(accountStageAfter('negotiating', 'won'), 'implementing', 'won → implementing');
    assertEqual(accountStageAfter('prospecting', 'won'), 'implementing', 'won from prospecting');
    assertEqual(accountStageAfter('operating', 'won'), 'operating', 'operating untouched');
  });

  // ── fit components
  s.test('industry: in ICP 100 (case / diacritics insensitive), else 20', () => {
    assertEqual(industryScore('bán lẻ', ICP.target_industries), 100, 'lower case');
    assertEqual(industryScore('BAN LE', ICP.target_industries), 100, 'no diacritics');
    assertEqual(industryScore('Bất động sản', ICP.target_industries), 20, 'outside');
    assertEqual(industryScore('Bất động sản', []), 100, 'no target industries = every industry');
  });

  s.test('province: in ICP 100, else 40', () => {
    assertEqual(provinceScore('tp. hồ chí minh', ICP.target_provinces), 100, 'in');
    assertEqual(provinceScore('Đà Nẵng', ICP.target_provinces), 40, 'out');
  });

  s.test('size: in ICP 100, adjacent band 60, else 20', () => {
    assertEqual(sizeScore('200_1000', ICP.target_sizes), 100, 'in');
    assertEqual(sizeScore('50_200', ICP.target_sizes), 60, 'smaller neighbour');
    assertEqual(sizeScore('gt1000', ICP.target_sizes), 60, 'larger neighbour');
    assertEqual(sizeScore('lt50', ICP.target_sizes), 20, 'two bands away');
  });

  s.test('revenue: adjacent on both sides, far bands 20, several targets', () => {
    assertEqual(revenueScore('gt1t', ICP.target_revenue_bands), 60, 'above');
    assertEqual(revenueScore('50_200b', ICP.target_revenue_bands), 60, 'below');
    assertEqual(revenueScore('lt50b', ICP.target_revenue_bands), 20, 'far');
    assertEqual(revenueScore('lt50b', ['50_200b', 'gt1t']), 60, 'adjacent to one of several targets');
    assertEqual(bandScore('lt50', [], COMPANY_SIZES), 100, 'no targets');
  });

  s.test('engagement: nothing in the last 60 days → 0 (old and future ignored)', () => {
    assertEqual(engagementScore([], TODAY), 0, 'none');
    assertEqual(engagementScore([ago(61), ago(90)], TODAY), 0, 'older than 60 days');
    assertEqual(engagementScore([at(addDays(TODAY, 3))], TODAY), 0, 'future meeting');
  });

  s.test('engagement recency: ≤ 7 days 100, ≤ 30 days 70, ≤ 60 days 40', () => {
    assertEqual(engagementScore([ago(0)], TODAY), 100, 'today');
    assertEqual(engagementScore([ago(7)], TODAY), 100, '7 days');
    assertEqual(engagementScore([ago(8)], TODAY), 70, '8 days');
    assertEqual(engagementScore([ago(30)], TODAY), 70, '30 days');
    assertEqual(engagementScore([ago(31)], TODAY), 40, '31 days');
    assertEqual(engagementScore([ago(60)], TODAY), 40, '60 days');
    assertEqual(engagementScore([addDays(TODAY, -2)], TODAY), 100, 'plain ISO dates accepted');
  });

  s.test('engagement frequency: +5 per extra interaction in the window, max 100', () => {
    assertEqual(engagementScore([ago(20), ago(25), ago(40), ago(59), ago(61)], TODAY), 85, '70 + 3 × 5 (the 61-day one ignored)');
    assertEqual(engagementScore([ago(3), ago(4), ago(5), ago(6)], TODAY), 100, 'capped at 100');
    assertEqual(engagementScore([ago(45), ago(50)], TODAY), 45, '40 + 5');
  });

  s.test('fit score = Σ wᵢ·cᵢ / Σ wᵢ, rounded, with grade', () => {
    const perfect = computeFit({ industry: 'Bán lẻ', province: 'TP. Hồ Chí Minh', size: '200_1000', revenue_band: '200b_1t' }, ICP, [ago(1)], TODAY);
    assertEqual(perfect, { score: 100, industry: 100, size: 100, revenue: 100, province: 100, engagement: 100, grade: 'A' }, 'perfect fit');
    const mixed = computeFit({ industry: 'Bất động sản', province: 'Đà Nẵng', size: '50_200', revenue_band: '200b_1t' }, ICP, [], TODAY);
    // (30·20 + 20·60 + 20·100 + 10·40 + 20·0) / 100 = 42
    assertEqual([mixed.score, mixed.grade], [42, 'C'], 'mixed fit');
  });

  s.test('grades: A ≥ 75 · B 50–74 · C < 50', () => {
    assertEqual([fitGrade(100), fitGrade(75), fitGrade(74), fitGrade(50), fitGrade(49), fitGrade(0)], ['A', 'A', 'B', 'B', 'C', 'C'], 'bands');
  });

  s.test('weights are relative (×10 gives the same score); zero / negative weights → equal weights', () => {
    const subject = { industry: 'Ngân hàng', province: 'Hà Nội', size: 'gt1000' as const, revenue_band: 'gt1t' as const };
    const a = computeFit(subject, ICP, [ago(10)], TODAY);
    const b = computeFit(subject, { ...ICP, weights: { industry: 300, size: 200, revenue: 200, province: 100, engagement: 200 } }, [ago(10)], TODAY);
    assertEqual(a.score, b.score, 'scale invariant');
    assertEqual(normalizeWeights({ industry: 0, size: 0, revenue: 0, province: 0, engagement: 0 }), { industry: 1, size: 1, revenue: 1, province: 1, engagement: 1 }, 'all zero');
    assertEqual(normalizeWeights({ industry: -3, size: 2, revenue: Number.NaN, province: 1, engagement: 1 }).industry, 0, 'negative ignored');
    const equal = computeFit(subject, { ...ICP, weights: { industry: 0, size: 0, revenue: 0, province: 0, engagement: 0 } }, [ago(10)], TODAY);
    // components 100 · 60 · 60 · 40 · 70 → 330 / 5 = 66
    assertEqual(equal.score, 66, 'equal weights');
  });

  // ── segments
  s.test('segment scope: leads-only / accounts-only / all', () => {
    assert(matchesSegment(lead(), crit({ scope: 'leads' })), 'lead in a lead segment');
    assert(!matchesSegment(account(), crit({ scope: 'leads' })), 'account not in a lead segment');
    assert(!matchesSegment(lead(), crit({ scope: 'accounts' })), 'lead not in an account segment');
    assert(matchesSegment(account(), crit({})) && matchesSegment(lead(), crit({})), 'all');
  });

  s.test('segment industries & provinces (case / diacritics insensitive)', () => {
    assert(matchesSegment(lead(), crit({ industries: ['ban le', 'Logistics'] })), 'industry match');
    assert(!matchesSegment(lead({ industry: 'Sản xuất' }), crit({ industries: ['Bán lẻ'] })), 'industry miss');
    assert(matchesSegment(lead(), crit({ provinces: ['tp. ho chi minh'] })), 'province match');
    assert(!matchesSegment(lead({ province: 'Hà Nội' }), crit({ provinces: ['TP. Hồ Chí Minh'] })), 'province miss');
  });

  s.test('segment sizes & revenue bands', () => {
    assert(matchesSegment(lead(), crit({ sizes: ['200_1000', 'gt1000'] })), 'size in');
    assert(!matchesSegment(lead({ size: 'lt50' }), crit({ sizes: ['200_1000'] })), 'size out');
    assert(matchesSegment(lead(), crit({ revenue_bands: ['200b_1t'] })), 'revenue in');
    assert(!matchesSegment(lead({ revenue_band: 'gt1t' }), crit({ revenue_bands: ['200b_1t'] })), 'revenue out');
  });

  s.test('segment sources & tags (at least one tag in common)', () => {
    assert(matchesSegment(lead(), crit({ sources: ['referral', 'event'] })), 'source in');
    assert(!matchesSegment(lead({ source: 'website' }), crit({ sources: ['referral'] })), 'source out');
    assert(matchesSegment(lead({ tags: ['ERP', 'Omnichannel'] }), crit({ tags: ['omnichannel', 'loyalty'] })), 'tag in common');
    assert(!matchesSegment(lead({ tags: [] }), crit({ tags: ['omnichannel'] })), 'no tags');
  });

  s.test('segment owners & minimum fit', () => {
    assert(matchesSegment(lead(), crit({ owner_ids: ['u_am_ha'] })), 'owner in');
    assert(!matchesSegment(lead({ owner_id: null }), crit({ owner_ids: ['u_am_ha'] })), 'unassigned lead has no owner');
    assert(matchesSegment(account({ owner_id: 'u_am_ha' }), crit({ owner_ids: ['u_am_ha'] })), 'account AM');
    assert(matchesSegment(lead({ fit_score: 60 }), crit({ min_fit_score: 60 })), 'fit = min');
    assert(!matchesSegment(lead({ fit_score: 59 }), crit({ min_fit_score: 60 })), 'fit below min');
  });

  s.test('lead statuses: default open leads only; explicit list wins; keeps accounts out', () => {
    assert(!matchesSegment(lead({ lead_status: 'converted' }), crit({})), 'converted lead out by default');
    assert(!matchesSegment(lead({ lead_status: 'disqualified' }), crit({})), 'disqualified lead out by default');
    assert(matchesSegment(lead({ lead_status: 'disqualified' }), crit({ lead_statuses: ['disqualified'] })), 'explicitly asked');
    assert(!matchesSegment(lead({ lead_status: 'new' }), crit({ lead_statuses: ['interested'] })), 'status miss');
    assert(!matchesSegment(account(), crit({ lead_statuses: ['interested'] })), 'scope all: an account has no lead status');
  });

  s.test('tiers, stages & health: accounts only (scope all keeps leads out)', () => {
    assert(matchesSegment(account(), crit({ tiers: ['strategic'], stages: ['implementing'], health: ['on_track'] })), 'all match');
    assert(!matchesSegment(account({ tier: 'standard' }), crit({ tiers: ['strategic'] })), 'tier miss');
    assert(!matchesSegment(account({ stage: 'operating' }), crit({ stages: ['implementing'] })), 'stage miss');
    assert(!matchesSegment(account({ health: 'blocked' }), crit({ health: ['on_track'] })), 'health miss');
    assert(!matchesSegment(lead(), crit({ health: ['blocked'] })), 'scope all + health: no leads');
    assert(!matchesSegment(lead(), crit({ tiers: ['standard'] })) && !matchesSegment(lead(), crit({ stages: ['prospecting'] })), 'tier / stage: no leads');
    assert(matchesSegment(account({ health: 'blocked' }), crit({ health: ['blocked'] })), 'scope all + health: the blocked account');
  });

  s.test('normalizeCriteria drops unknown values and empty lists, clamps min fit', () => {
    const raw = {
      scope: 'xyz',
      industries: [' Bán lẻ ', 'bán lẻ', ''],
      sizes: ['200_1000', 'huge'],
      tags: [],
      health: ['blocked', 'red'],
      min_fit_score: 140,
    } as unknown as SegmentCriteria;
    assertEqual(normalizeCriteria(raw), { scope: 'all', industries: ['Bán lẻ'], sizes: ['200_1000'], health: ['blocked'], min_fit_score: 100 }, 'normalized');
  });

  // ── follow-ups
  s.test('follow-up buckets: overdue < today · today · next 7 days · later', () => {
    assertEqual(followUpBucket(addDays(TODAY, -1), TODAY), 'overdue', 'yesterday');
    assertEqual(followUpBucket(TODAY, TODAY), 'today', 'today');
    assertEqual(followUpBucket(addDays(TODAY, 1), TODAY), 'week', 'tomorrow');
    assertEqual(followUpBucket(addDays(TODAY, 7), TODAY), 'week', 'in 7 days');
    assertEqual(followUpBucket(addDays(TODAY, 8), TODAY), 'later', 'in 8 days');
  });

  // ── pipeline aggregates
  s.test('pipeline by stage: open stages only, count / value / weighted', () => {
    const rows = pipelineByStage([
      deal({ stage: 'qualified', value: 100, probability: 10 }),
      deal({ stage: 'negotiation', value: 1000, probability: 75 }),
      deal({ stage: 'negotiation', value: 400, probability: 50 }),
      deal({ stage: 'won', value: 9999, probability: 100 }),
    ]);
    assertEqual(rows.map((r) => r.stage), ['qualified', 'discovery', 'proposal', 'negotiation'], 'pipeline order');
    assertEqual(rows[3], { stage: 'negotiation', count: 2, value: 1400, weighted: 950 }, 'negotiation row');
    assertEqual(rows[1].count, 0, 'empty stage');
  });

  s.test('forecast: 6 months from now, past close dates in the current month, won by month', () => {
    const rows = forecastByMonth(
      [
        deal({ stage: 'proposal', value: 100, probability: 50, expected_close_date: '2026-09-20' }),
        deal({ stage: 'discovery', value: 200, probability: 25, expected_close_date: '2027-01-15' }),
        deal({ stage: 'negotiation', value: 500, probability: 75, expected_close_date: '2027-05-01' }),
        deal({ stage: 'won', value: 300, probability: 100, won_at: at('2026-10-02') }),
        deal({ stage: 'lost', value: 700, probability: 0, lost_at: at('2026-10-03') }),
      ],
      TODAY,
      6,
    );
    assertEqual(rows.map((r) => r.month), ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'], 'months (year rollover)');
    assertEqual(rows[0], { month: '2026-10', weighted: 50, won: 300 }, 'current month');
    assertEqual(rows[3].weighted, 50, 'January');
    assertEqual(addMonths('2026-12', 1), '2027-01', 'addMonths rollover');
  });

  s.test('win rate over 180 days and average sales cycle', () => {
    const deals = [
      deal({ stage: 'won', won_at: at('2026-09-01'), created_at: at('2026-08-01') }),
      deal({ stage: 'won', won_at: at('2026-08-10'), created_at: at('2026-07-01') }),
      deal({ stage: 'lost', lost_at: at('2026-08-01') }),
      deal({ stage: 'won', won_at: at('2025-12-01'), created_at: at('2025-11-01') }),
      deal({ stage: 'proposal' }),
    ];
    assertEqual(winRate(deals, TODAY, 180), 67, '2 won / 3 closed in window');
    assertEqual(winRate([deal({})], TODAY, 180), 0, 'nothing closed');
    // 31 and 40 days won in the last 365 days, plus 30 days (2025-12-01) → (31 + 40 + 30) / 3 = 33.7
    assertEqual(avgCycleDays(deals, TODAY, 365), 34, 'average cycle');
    assertEqual(avgCycleDays([deal({})], TODAY), 0, 'none won');
  });

  // ── whitespace & workload
  s.test('whitespace: active items not bought yet', () => {
    const items = [
      { id: 'p1', active: true },
      { id: 'p2', active: true },
      { id: 'p3', active: false },
    ];
    assertEqual(whitespaceItems(items, new Set(['p1'])).map((i) => i.id), ['p2'], 'only p2');
  });

  s.test('workload weeks start on Monday; overdue counts in the first week', () => {
    assertEqual(workloadWeeks(TODAY, 3), ['2026-10-05', '2026-10-12', '2026-10-19'], 'Mondays');
    assertEqual(workloadWeekIndex('2026-09-20', TODAY, 6), 0, 'overdue → week 0');
    assertEqual(workloadWeekIndex('2026-10-04', TODAY, 6), 0, 'last Sunday (overdue) → week 0');
    assertEqual(workloadWeekIndex('2026-10-11', TODAY, 6), 0, 'this Sunday');
    assertEqual(workloadWeekIndex('2026-10-12', TODAY, 6), 1, 'next Monday');
    assertEqual(workloadWeekIndex('2026-11-15', TODAY, 6), 5, 'last day of week 6');
    assertEqual(workloadWeekIndex('2026-11-16', TODAY, 6), -1, 'beyond the horizon');
  });

  // ── text helpers used by convertLead / filters
  s.test('short names, email domains and clean labels', () => {
    assertEqual(shortNameOf('Công ty CP Thực phẩm Sao Mai'), 'Sao Mai', 'legal form dropped, last two words');
    assertEqual(shortNameOf('Tập đoàn Hưng Phát'), 'Hưng Phát', 'group');
    assertEqual(shortNameOf('Logistics Đông Dương'), 'Logistics Đông Dương', 'short names kept');
    assertEqual(emailDomain(' Minh@SaoMai.vn '), 'saomai.vn', 'domain');
    assertEqual(emailDomain('not-an-email'), '', 'invalid');
    assertEqual(cleanLabels([' Hà Nội', 'ha noi', 'Đà  Nẵng', '']), ['Hà Nội', 'Đà Nẵng'], 'deduped, trimmed');
  });

  s.test('company domain of a converted lead: email domain, website domain for a free mailbox', () => {
    assertEqual(companyDomain('minh@saomai.vn', 'https://www.other.vn'), 'saomai.vn', 'company email wins');
    assertEqual(companyDomain('minh.sm@gmail.com', 'https://www.SaoMai.vn/gioi-thieu'), 'saomai.vn', 'free mailbox → website');
    assertEqual(companyDomain('minh@yahoo.com.vn', 'saomai.com.vn'), 'saomai.com.vn', 'website without scheme');
    assertEqual(companyDomain('minh@gmail.com', null), 'gmail.com', 'no website: email domain kept');
    assertEqual(companyDomain('minh@gmail.com', 'không có'), 'gmail.com', 'unreadable website: email domain kept');
    assertEqual(websiteDomain('http://user@www.hungphat.vn:8080/x?y'), 'hungphat.vn', 'host only');
    assert(isPublicMailDomain('Gmail.com') && !isPublicMailDomain('saomai.vn'), 'free mailbox list');
  });

  // ── client map (bản đồ khách hàng): pure assembly
  s.test('client map · value per metric: account contract / weighted pipeline / both; lead 0 / budget / budget', () => {
    const acc = MAP_MEMBERS[0];
    const lead = MAP_MEMBERS[1];
    assertEqual(CLIENT_MAP_METRICS.map((m) => metricValue(acc, m)), [1000, 300, 1300], 'account');
    assertEqual(CLIENT_MAP_METRICS.map((m) => metricValue(lead, m)), [0, 500, 500], 'lead');
    for (const metric of CLIENT_MAP_METRICS) {
      const map = assembleClientMap(metric, MAP_MEMBERS, MAP_ECOS);
      assertEqual(map.metric, metric, 'metric echoed');
      for (const m of MAP_MEMBERS) {
        const node = map.nodes.find((n) => n.ref_id === m.id && n.kind === m.kind);
        assert(node, `node of ${m.id}`);
        assertEqual(node.value, metricValue(m, metric), `${metric} · ${m.id}`);
        assertEqual([node.contract_value, node.pipeline_value], [m.contract_value, m.pipeline_value], `${m.id} parts kept`);
      }
    }
  });

  s.test('client map · a hub sums its visible members for every metric', () => {
    for (const metric of CLIENT_MAP_METRICS) {
      const map = assembleClientMap(metric, MAP_MEMBERS, MAP_ECOS);
      const hub = map.nodes.find((n) => n.id === 'eco:eco_a');
      assert(hub && hub.kind === 'ecosystem' && hub.ref_id === 'eco_a', `hub of group A (${metric})`);
      const members = MAP_MEMBERS.filter((m) => m.ecosystem_id === 'eco_a');
      assertEqual(hub.value, members.reduce((sum, m) => sum + metricValue(m, metric), 0), `hub value (${metric})`);
      assertEqual([hub.contract_value, hub.pipeline_value, hub.open_opportunities], [1000, 1000, 2], 'hub parts');
      assertEqual([hub.sublabel, hub.href, hub.owner, hub.health, hub.lead_status], ['Bán lẻ', null, null, null, null], 'hub fields');
      assertEqual(hub.logo, { initials: 'NA', brand_color: '#0F766E', logo_url: null }, 'hub logo: group initials, colour of its largest account');
    }
  });

  s.test('client map · hubs and links only for groups with ≥ 2 visible members', () => {
    const map = assembleClientMap('total', MAP_MEMBERS, MAP_ECOS);
    assertEqual(map.nodes.filter((n) => n.kind === 'ecosystem').map((n) => n.id), ['eco:eco_a'], 'one hub');
    assertEqual(
      map.links.map((l) => `${l.source}>${l.target}`).sort(),
      ['eco:eco_a>acc:acc_1', 'eco:eco_a>lead:lead_1', 'eco:eco_a>lead:lead_2'],
      'hub → each member',
    );
    assert(map.links.every((l) => l.kind === 'ecosystem'), 'link kind');
    const byRef = (id: ID) => map.nodes.find((n) => n.ref_id === id);
    assertEqual([byRef('acc_1')?.ecosystem_id, byRef('acc_2')?.ecosystem_id, byRef('lead_3')?.ecosystem_id], ['eco_a', null, null], 'lone / unknown group members float free');
    assertEqual(map.ecosystems.map((e) => [e.id, e.account_count, e.lead_count, e.contract_value, e.potential_value]), [['eco_a', 1, 2, 1000, 1000]], 'ecosystems of the map');
    assertEqual(map.totals, { value: 1300 + 500 + 200 + 800 + 70 + 100, accounts: 3, leads: 3, ecosystems: 1 }, 'totals (hubs not counted)');
    assertEqual([byRef('acc_1')?.href, byRef('lead_1')?.href], ['/app/accounts/acc_1', '/app/targets/leads/lead_1'], 'links to the account / lead pages');
    // the same group seen by someone who sees only one of its members: no hub, no link
    const one = assembleClientMap('total', MAP_MEMBERS.filter((m) => m.id !== 'lead_1' && m.id !== 'lead_2'), MAP_ECOS);
    assert(one.links.length === 0 && one.ecosystems.length === 0 && !one.nodes.some((n) => n.kind === 'ecosystem'), 'single visible member → no hub');
  });

  s.test('client map · nodes by value desc; a group view counts only the members given', () => {
    const map = assembleClientMap('pipeline', MAP_MEMBERS, MAP_ECOS);
    assert(map.nodes.every((n, i) => i === 0 || map.nodes[i - 1].value >= n.value), 'sorted by value');
    assertEqual(map.nodes[0].id, 'eco:eco_a', 'the group is the biggest bubble');
    const leadsOnly = ecosystemViewOf(MAP_ECOS[0], MAP_MEMBERS.filter((m) => m.kind === 'lead'));
    assertEqual([leadsOnly.account_count, leadsOnly.lead_count, leadsOnly.contract_value, leadsOnly.potential_value], [0, 2, 0, 700], 'visible members only');
    assertEqual(leadsOnly.members.map((m) => m.id), ['lead_1', 'lead_2'], 'members by value');
  });

  // ── client map on the demo db (read only): scoping by viewer
  s.test('client map · AM scope: own accounts, own + pool open leads, hubs only for groups with ≥ 2 visible', () => {
    const profiles = new Map(db.rows('account_profiles').map((p) => [p.account_id, p]));
    for (const id of ['u_am_ha', 'u_am_ducanh']) {
      const v = viewerOf(id);
      assert(v && v.role === 'am', `demo AM ${id}`);
      const map = clientMapFor(v);
      const nodes = new Map(map.nodes.map((n) => [n.id, n]));
      for (const n of map.nodes) {
        if (n.kind === 'account') assert(db.find('accounts', n.ref_id)?.am_id === id && n.owner?.id === id, `${id}: account ${n.ref_id} is not theirs`);
        if (n.kind === 'lead') {
          const l = db.find('leads', n.ref_id);
          assert(l && (l.owner_id === id || l.owner_id === null) && OPEN_LEAD_STATUSES.includes(l.status), `${id}: lead ${n.ref_id} out of scope`);
        }
      }
      // expected hubs re-derived from the rows: groups with ≥ 2 companies this AM can see
      const seen = new Map<ID, number>();
      for (const a of db.rows('accounts')) {
        const eco = profiles.get(a.id)?.ecosystem_id;
        if (a.am_id === id && eco) seen.set(eco, (seen.get(eco) ?? 0) + 1);
      }
      for (const l of db.rows('leads')) {
        if (l.ecosystem_id && (l.owner_id === id || l.owner_id === null) && OPEN_LEAD_STATUSES.includes(l.status)) seen.set(l.ecosystem_id, (seen.get(l.ecosystem_id) ?? 0) + 1);
      }
      const expected = db.rows('ecosystems').filter((e) => (seen.get(e.id) ?? 0) >= 2).map((e) => `eco:${e.id}`).sort();
      const hubs = map.nodes.filter((n) => n.kind === 'ecosystem');
      assertEqual(hubs.map((n) => n.id).sort(), expected, `${id}: hubs`);
      for (const hub of hubs) {
        const targets = map.links.filter((l) => l.source === hub.id).map((l) => nodes.get(l.target));
        assert(targets.length >= 2 && targets.every((x) => x !== undefined && x.ecosystem_id === hub.ref_id), `${id}: links of ${hub.id}`);
        assertEqual(hub.value, targets.reduce((sum, x) => sum + (x ? x.value : 0), 0), `${id}: ${hub.id} = Σ members`);
      }
    }
  });

  s.test('client map · director sees every account and open lead; metric / leads / owner filters; clients refused', () => {
    const v = viewerOf('u_director');
    assert(v && v.role === 'director', 'demo director');
    const map = clientMapFor(v);
    assertEqual(map.metric, 'total', 'default metric');
    assertEqual(map.totals.accounts, db.rows('accounts').length, 'every account');
    assertEqual(map.totals.leads, db.rows('leads').filter((l) => OPEN_LEAD_STATUSES.includes(l.status)).length, 'every open lead');
    const accountsOnly = clientMapFor(v, { includeLeads: false, metric: 'contract_value' });
    assert(!accountsOnly.nodes.some((n) => n.kind === 'lead'), 'includeLeads false');
    assert(accountsOnly.nodes.filter((n) => n.kind === 'account').every((n) => n.value === n.contract_value), 'contract metric');
    const duc = clientMapFor(v, { ownerId: 'u_am_ducanh' });
    assert(duc.nodes.filter((n) => n.kind !== 'ecosystem').every((n) => n.owner?.id === 'u_am_ducanh'), 'owner filter');
    for (const who of ['u_client_minh', 'u_client_lan', 'u_member_tuan']) {
      const outsider = viewerOf(who);
      assert(outsider, `demo user ${who}`);
      let code = 'none';
      try {
        clientMapFor(outsider);
      } catch (err) {
        code = err instanceof ApiError ? err.code : 'unexpected';
      }
      assertEqual(code, 'forbidden', `${who} refused`);
    }
  });

  s.test('client map · demo groups (fresh data): Đức Anh sees Cỏ Xanh through two leads, Thịnh An only as a lone lead', () => {
    const owners: Record<ID, ID | null> = { lead_phoxanh: null, lead_nhanhoa: null, lead_coxanh_logistics: 'u_am_ducanh', lead_coxanh_foods: 'u_am_ha', lead_thinhan_securities: 'u_am_ha' };
    const pristine =
      ECOSYSTEM_SPECS.every(
        (e) =>
          !!db.find('ecosystems', e.id) &&
          e.accounts.every((a) => db.rows('account_profiles').find((p) => p.account_id === a)?.ecosystem_id === e.id) &&
          e.leads.every((l) => db.find('leads', l)?.ecosystem_id === e.id),
      ) && Object.entries(owners).every(([id, owner]) => db.find('leads', id)?.owner_id === owner);
    if (!pristine) return; // the demo data was edited in this browser: the generic scoping tests above still apply
    const hubTargets = (map: ReturnType<typeof clientMapFor>, eco: ID): string[] => map.links.filter((l) => l.source === `eco:${eco}`).map((l) => l.target).sort();
    const duc = viewerOf('u_am_ducanh');
    const ha = viewerOf('u_am_ha');
    const dir = viewerOf('u_director');
    assert(duc && ha && dir, 'demo users');
    const dm = clientMapFor(duc);
    assertEqual(hubTargets(dm, 'eco_coxanh'), ['lead:lead_coxanh_logistics', 'lead:lead_phoxanh'], 'Đức Anh · Cỏ Xanh hub');
    assertEqual(hubTargets(dm, 'eco_giongan'), ['acc:acc_giongan', 'lead:lead_ngannang', 'lead:lead_nganphong'], 'Đức Anh · Gió Ngàn hub');
    assert(!dm.nodes.some((n) => n.id === 'eco:eco_thinhan') && dm.nodes.find((n) => n.id === 'lead:lead_nhanhoa')?.ecosystem_id === null, 'Đức Anh · Thịnh An: one visible member, no hub');
    const hm = clientMapFor(ha);
    assertEqual(hm.ecosystems.map((e) => e.id).sort(), ['eco_coxanh', 'eco_saobac', 'eco_thinhan'], 'Hà · three groups');
    assertEqual(hubTargets(hm, 'eco_coxanh'), ['acc:acc_coxanh', 'lead:lead_coxanh_foods', 'lead:lead_phoxanh'], 'Hà · Cỏ Xanh without Đức Anh’s lead');
    const all = clientMapFor(dir);
    assertEqual(all.totals.ecosystems, 4, 'director · 4 groups');
    assertEqual(hubTargets(all, 'eco_coxanh').length, 4, 'director · the whole Cỏ Xanh group');
    for (const id of ['acc_thientruong', 'acc_haidang']) {
      assert(all.nodes.find((n) => n.id === `acc:${id}`)?.ecosystem_id === null && !all.links.some((l) => l.target === `acc:${id}`), `${id} stands alone`);
    }
  });

  return s.results;
}
