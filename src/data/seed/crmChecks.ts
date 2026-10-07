// Integrity checks for the CRM seed (called by checkSeed): links resolve, derived fields agree with the
// interactions, converted leads ↔ prospect accounts ↔ opportunities are consistent, segments have members,
// and the demo mix is there (all lead statuses, fit grades A/B/C, overdue / today follow-ups, won & lost deals).
// Row shapes (every field of crmTypes.ts, nothing else) are checked by seedChecks with crmFieldKeys.ts.

import type { Health, ID, ISODate } from '@/domain/types';
import type { CompanySize, IcpProfile, Interaction, RevenueBand, SegmentCriteria } from '@/domain/crmTypes';
import type { DbData } from '@/services/db';
import { addDays, diffDays } from '@/domain/dates';
import { dateOf } from '@/domain/clock';
import { quoteGrandTotal } from './catalog';
import { accountSlice, computeHealth } from './scenarioChecks';
import { ICP_WEIGHT_KEYS, SEGMENT_CRITERIA_KEYS } from './crmFieldKeys';
import { ORIGINAL_ACCOUNT_IDS, PROSPECT_ACCOUNT_IDS } from './crmAccounts';
import { STAGE_PROBABILITY } from './crmDeals';
import { STANDALONE_ACCOUNT_IDS } from './ecosystems';

type Seed = Omit<DbData, 'meta'>;

const SIZES: CompanySize[] = ['lt50', '50_200', '200_1000', 'gt1000'];
const REVENUES: RevenueBand[] = ['lt50b', '50_200b', '200b_1t', 'gt1t'];
const SOURCES = ['referral', 'event', 'website', 'outbound', 'partner', 'existing_customer'];
const LEAD_STATUSES = ['new', 'contacted', 'interested', 'nurturing', 'disqualified', 'converted'];
const OPEN_LEAD = new Set(['new', 'contacted', 'interested', 'nurturing']);
const STAGES = ['qualified', 'discovery', 'proposal', 'negotiation', 'won', 'lost'];
const KINDS = ['call', 'meeting', 'email', 'demo', 'zalo', 'note'];
const OUTCOMES = ['positive', 'neutral', 'negative'];
const PHONE = /^0\d{3} \d{3} \d{3}$/;

// ───────────────────────────── fit score (ARCHITECTURE §13, stand-alone copy) ─────────────────────────────

function bandScore<T extends string>(value: T, targets: T[], order: T[]): number {
  if (targets.includes(value)) return 100;
  const i = order.indexOf(value);
  return targets.some((t) => Math.abs(order.indexOf(t) - i) === 1) ? 60 : 20;
}

function engagementScore(items: Interaction[], today: ISODate): number {
  const ages = items.map((x) => diffDays(today, dateOf(x.occurred_at))).filter((a) => a >= 0 && a <= 60);
  if (!ages.length) return 0;
  const newest = Math.min(...ages);
  const base = newest <= 7 ? 100 : newest <= 30 ? 70 : 40;
  return Math.min(100, base + 5 * (ages.length - 1));
}

export function seedFit(
  icp: IcpProfile,
  x: { industry: string; province: string; size: CompanySize; revenue_band: RevenueBand },
  items: Interaction[],
  today: ISODate,
): { score: number; grade: 'A' | 'B' | 'C' } {
  const w = icp.weights;
  const parts = {
    industry: icp.target_industries.includes(x.industry) ? 100 : 20,
    size: bandScore(x.size, icp.target_sizes, SIZES),
    revenue: bandScore(x.revenue_band, icp.target_revenue_bands, REVENUES),
    province: icp.target_provinces.includes(x.province) ? 100 : 40,
    engagement: engagementScore(items, today),
  };
  const total = w.industry + w.size + w.revenue + w.province + w.engagement;
  const score = Math.round((w.industry * parts.industry + w.size * parts.size + w.revenue * parts.revenue + w.province * parts.province + w.engagement * parts.engagement) / total);
  return { score, grade: score >= 75 ? 'A' : score >= 50 ? 'B' : 'C' };
}

// ───────────────────────────── checks ─────────────────────────────

export function checkCrm(data: Seed, today: ISODate): string[] {
  const errors: string[] = [];
  const expect = (cond: unknown, m: string): void => {
    if (!cond) errors.push(`crm: ${m}`);
  };
  for (const t of ['leads', 'account_profiles', 'opportunities', 'interactions', 'segments', 'icp_profiles', 'ecosystems'] as const) {
    if (!Array.isArray(data[t])) return [`crm: table ${t} missing`];
  }
  const by = <T extends { id: ID }>(rows: T[]): Map<ID, T> => new Map(rows.map((r) => [r.id, r]));
  const users = by(data.users);
  const accounts = by(data.accounts);
  const contacts = by(data.contacts);
  const leads = by(data.leads);
  const opps = by(data.opportunities);
  const quotes = by(data.quotes);
  const projects = by(data.projects);
  const priceItems = by(data.price_items);
  const isStaff = (id: ID | null | undefined, roles = ['director', 'am']): boolean => !!id && roles.includes(users.get(id)?.role ?? '');
  const ixOf = (pred: (x: Interaction) => boolean): Interaction[] => data.interactions.filter(pred);
  const newest = (items: Interaction[]): Interaction | undefined => items.reduce<Interaction | undefined>((m, x) => (!m || x.occurred_at > m.occurred_at ? x : m), undefined);
  const quoteTotal = (id: ID): number => quoteGrandTotal(data.quote_lines.filter((l) => l.quote_id === id), quotes.get(id)?.discount_pct_total ?? 0);
  const profileOf = (accountId: ID) => data.account_profiles.find((p) => p.account_id === accountId);
  const healthOf = (accountId: ID): Health => accounts.get(accountId)?.health_override ?? computeHealth(accountSlice(data, accountId), today).color;

  // ── ICP
  expect(data.icp_profiles.length === 1, 'exactly one ICP profile');
  const icp = data.icp_profiles[0];
  if (!icp) return errors;
  expect(icp.target_industries.join('|') === 'Bán lẻ|Ngân hàng|Sản xuất|Logistics', 'ICP industries');
  expect(icp.target_provinces.join('|') === 'Hà Nội|TP. Hồ Chí Minh|Bình Dương|Đà Nẵng', 'ICP provinces');
  expect(icp.target_sizes.join('|') === '200_1000|gt1000' && icp.target_revenue_bands.join('|') === '200b_1t|gt1t', 'ICP sizes / revenue bands');
  const w = icp.weights;
  expect(Object.keys(w).sort().join() === Object.keys(ICP_WEIGHT_KEYS).sort().join(), 'ICP weight keys');
  expect(w.industry === 30 && w.size === 20 && w.revenue === 20 && w.province === 10 && w.engagement === 20, 'ICP weights 30/20/20/10/20');

  // ── prospect accounts & profiles
  expect(ORIGINAL_ACCOUNT_IDS.every((id) => accounts.has(id)), 'the six original accounts exist');
  const extra = data.accounts.filter((a) => !ORIGINAL_ACCOUNT_IDS.includes(a.id)).map((a) => a.id).sort();
  expect(extra.join() === [...PROSPECT_ACCOUNT_IDS].sort().join(), `extra accounts must be exactly the prospects (got ${extra.join()})`);
  expect(PROSPECT_ACCOUNT_IDS.length >= 2 && PROSPECT_ACCOUNT_IDS.length <= 3, '2–3 prospect accounts');
  for (const id of PROSPECT_ACCOUNT_IDS) {
    const a = accounts.get(id);
    const where = `prospect ${id}`;
    if (!a) continue;
    expect(a.stage === 'prospecting' || a.stage === 'negotiating', `${where}: stage prospecting / negotiating`);
    expect(a.am_id === 'u_am_ha' || a.am_id === 'u_am_ducanh', `${where}: AM is Hà or Đức Anh`);
    expect(a.health_override === null && healthOf(id) === 'on_track', `${where}: must be on track`);
    expect(!data.users.some((u) => u.account_id === id), `${where}: no login users`);
    expect(!data.projects.some((p) => p.account_id === id), `${where}: no projects / tasks`);
    expect(!data.quotes.some((q) => q.account_id === id) && !data.contracts.some((k) => k.account_id === id), `${where}: no quotes / contracts`);
    const cts = data.contacts.filter((ct) => ct.account_id === id);
    expect(cts.length >= 1 && cts.length <= 2 && cts.every((ct) => ct.user_id === null && ct.email.endsWith(`@${a.email_domain}`) && PHONE.test(ct.phone ?? '')), `${where}: 1–2 contacts on the domain, no login`);
    expect(cts.some((ct) => ct.decision_role === 'decision_maker'), `${where}: a decision maker contact`);
    const open = data.opportunities.filter((o) => o.account_id === id && o.stage !== 'won' && o.stage !== 'lost');
    expect(open.length >= 1, `${where}: an open opportunity`);
    expect((a.stage === 'negotiating') === open.some((o) => o.stage === 'negotiation'), `${where}: stage negotiating ⇔ a deal in negotiation`);
  }
  const profiled = new Set<ID>();
  for (const p of data.account_profiles) {
    const where = `account_profiles/${p.id}`;
    expect(p.id === `prof_${p.account_id}` && accounts.has(p.account_id), `${where}: id / account`);
    expect(!profiled.has(p.account_id), `${where}: second profile for the account`);
    profiled.add(p.account_id);
    expect(SIZES.includes(p.size) && REVENUES.includes(p.revenue_band) && SOURCES.includes(p.source) && p.province.trim(), `${where}: enums / province`);
    expect(p.tags.length > 0 && p.tags.every((t) => t.trim()), `${where}: tags`);
  }
  for (const a of data.accounts) expect(profiled.has(a.id), `account ${a.id}: no profile`);

  // ── leads
  for (const l of data.leads) {
    const where = `leads/${l.id}`;
    const items = ixOf((x) => x.lead_id === l.id);
    const last = newest(items);
    const open = OPEN_LEAD.has(l.status);
    expect(LEAD_STATUSES.includes(l.status) && SIZES.includes(l.size) && REVENUES.includes(l.revenue_band) && SOURCES.includes(l.source), `${where}: enums`);
    expect(l.owner_id === null || isStaff(l.owner_id), `${where}: owner must be an AM / director or nobody`);
    expect(l.contact_email.includes('@') && (l.contact_phone === null || PHONE.test(l.contact_phone)) && l.contact_name.trim() && l.contact_title.trim(), `${where}: contact fields`);
    expect(l.need_summary && l.tags.length > 0, `${where}: need summary / tags`);
    expect((l.status === 'disqualified') === !!l.disqualified_reason?.trim(), `${where}: disqualified ⇔ reason`);
    expect((l.status === 'converted') === (l.converted_account_id !== null && l.converted_opportunity_id !== null), `${where}: converted ⇔ account + opportunity`);
    if (!open) expect(l.next_follow_up_date === null, `${where}: closed lead with a follow-up date`);
    if (l.status === 'new') expect(items.length === 0 && l.last_contacted_at === null, `${where}: a new lead has no contact yet`);
    else expect(items.length > 0, `${where}: ${l.status} without any interaction`);
    expect(l.last_contacted_at === (last ? last.occurred_at : null), `${where}: last_contacted_at ≠ latest interaction`);
    if (open && last) expect(last.next_follow_up_date === l.next_follow_up_date, `${where}: follow-up ≠ latest interaction's follow-up`);
    expect(l.updated_at >= l.created_at && (!l.last_contacted_at || l.updated_at >= l.last_contacted_at), `${where}: updated_at`);
    for (const x of items) expect(x.occurred_at >= l.created_at, `${where}: interaction ${x.id} before the lead existed`);
    if (l.status !== 'converted') continue;
    const a = l.converted_account_id ? accounts.get(l.converted_account_id) : undefined;
    const o = l.converted_opportunity_id ? opps.get(l.converted_opportunity_id) : undefined;
    const prof = a ? profileOf(a.id) : undefined;
    if (!a || !o || !prof) {
      expect(false, `${where}: converted account / opportunity / profile missing`);
      continue;
    }
    expect(PROSPECT_ACCOUNT_IDS.includes(a.id) && a.am_id === l.owner_id && l.contact_email.endsWith(`@${a.email_domain}`), `${where}: prospect account, AM = owner, email domain`);
    expect(a.name === l.company_name && a.industry === l.industry, `${where}: account name / industry`);
    expect(prof.province === l.province && prof.size === l.size && prof.revenue_band === l.revenue_band && prof.source === l.source && prof.website === l.website, `${where}: profile ≠ lead`);
    expect(data.contacts.some((ct) => ct.account_id === a.id && ct.decision_role === 'decision_maker' && ct.email === l.contact_email && ct.full_name === l.contact_name), `${where}: decision maker contact = lead contact`);
    expect(o.account_id === a.id && o.owner_id === l.owner_id && o.source === l.source && o.created_at === a.created_at, `${where}: opportunity created with the account`);
    expect(items.every((x) => x.occurred_at <= a.created_at) && l.updated_at === a.created_at, `${where}: lead touchpoints after the conversion`);
  }
  const count = (s: string): number => data.leads.filter((l) => l.status === s).length;
  expect(data.leads.length >= 20 && data.leads.length <= 35, `20–35 leads (has ${data.leads.length})`);
  expect(count('new') >= 5 && count('contacted') >= 4 && count('interested') >= 4 && count('nurturing') >= 3 && count('disqualified') === 2, 'lead status mix');
  expect(count('converted') === PROSPECT_ACCOUNT_IDS.length, 'one converted lead per prospect account');
  const openLeads = data.leads.filter((l) => OPEN_LEAD.has(l.status));
  expect(openLeads.filter((l) => l.owner_id === null).length >= 4, 'several unassigned leads (team pool)');
  expect(['u_am_ha', 'u_am_ducanh'].every((id) => data.leads.some((l) => l.owner_id === id)), 'leads owned by Hà and Đức Anh');
  const fu = (pred: (d: ISODate) => boolean): number => openLeads.filter((l) => l.next_follow_up_date !== null && pred(l.next_follow_up_date)).length;
  expect(fu((d) => d < today) === 2 && fu((d) => d === today) === 2, 'lead follow-ups: 2 overdue and 2 today');
  expect(fu((d) => d > today && d <= addDays(today, 7)) >= 3 && fu((d) => d > addDays(today, 7)) >= 2 && openLeads.some((l) => !l.next_follow_up_date), 'lead follow-ups: this week, later and none');
  const grades = new Set(data.leads.map((l) => seedFit(icp, l, ixOf((x) => x.lead_id === l.id), today).grade));
  expect(grades.has('A') && grades.has('B') && grades.has('C'), `fit grades A/B/C must all occur among leads (got ${[...grades].join()})`);
  const industries = new Set(data.leads.map((l) => l.industry));
  for (const ind of ['Bán lẻ', 'Ngân hàng', 'Sản xuất', 'Năng lượng', 'Bất động sản', 'Logistics', 'Y tế', 'Giáo dục', 'F&B', 'Bảo hiểm', 'Dược phẩm']) expect(industries.has(ind), `a lead in ${ind}`);
  const provinces = new Set(data.leads.map((l) => l.province));
  for (const p of ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Bình Dương', 'Đồng Nai', 'Cần Thơ']) expect(provinces.has(p), `a lead in ${p}`);

  // ── opportunities
  let edited = 0;
  for (const o of data.opportunities) {
    const where = `opportunities/${o.id}`;
    const a = accounts.get(o.account_id);
    if (!a) {
      expect(false, `${where}: account ${o.account_id} missing`);
      continue;
    }
    const open = o.stage !== 'won' && o.stage !== 'lost';
    expect(STAGES.includes(o.stage) && SOURCES.includes(o.source), `${where}: enums`);
    expect(o.owner_id === a.am_id && isStaff(o.owner_id), `${where}: owner must be the account's AM`);
    expect(o.value > 0 && o.probability >= 0 && o.probability <= 100, `${where}: value / probability`);
    if (open && o.probability !== STAGE_PROBABILITY[o.stage]) edited += 1;
    if (!open) expect(o.probability === STAGE_PROBABILITY[o.stage], `${where}: won 100 / lost 0`);
    expect(o.price_item_ids.length > 0 && o.price_item_ids.every((id) => priceItems.has(id)), `${where}: price items`);
    // a won first deal may predate its account record (the account was set up when the quote was prepared)
    expect((o.created_at >= a.created_at || o.stage === 'won') && o.stage_changed_at >= o.created_at && o.updated_at >= o.stage_changed_at, `${where}: created / stage_changed / updated order`);
    if (o.quote_id) {
      const q = quotes.get(o.quote_id);
      expect(q && q.account_id === o.account_id, `${where}: quote of another account / missing`);
      if (q && o.stage !== 'won') expect(o.value === quoteTotal(q.id), `${where}: value ≠ quote total`);
    }
    if (o.project_id) expect(projects.get(o.project_id)?.account_id === o.account_id, `${where}: project of another account / missing`);
    if (o.stage === 'won') {
      expect(o.won_at && o.won_at === o.stage_changed_at && !o.lost_at && !o.lost_reason && o.project_id, `${where}: won fields`);
      const k = data.contracts.find((x) => x.account_id === o.account_id && x.value === o.value && x.signed_date === (o.won_at ? dateOf(o.won_at) : ''));
      expect(k && (!o.quote_id || k.quote_id === o.quote_id), `${where}: no signed contract with this value on the won day`);
      expect(o.won_at && diffDays(today, dateOf(o.won_at)) <= 365 && o.expected_close_date === dateOf(o.won_at), `${where}: won within the last year, closed that day`);
    } else if (o.stage === 'lost') {
      expect(o.lost_at && o.lost_at === o.stage_changed_at && o.lost_reason?.trim() && !o.won_at, `${where}: lost fields`);
    } else {
      expect(!o.won_at && !o.lost_at && !o.lost_reason && o.next_step && o.next_step_date, `${where}: open deal needs a next step, no close fields`);
      const last = newest(ixOf((x) => x.opportunity_id === o.id));
      if (last) expect(last.next_follow_up_date === o.next_step_date, `${where}: next_step_date ≠ latest interaction's follow-up`);
      expect(o.expected_close_date >= addDays(today, -30) && o.expected_close_date <= addDays(today, 183), `${where}: expected close within −30 d … +6 months`);
    }
  }
  const ops = data.opportunities;
  const openOps = ops.filter((o) => o.stage !== 'won' && o.stage !== 'lost');
  expect(ops.length >= 12 && ops.length <= 14, `12–14 opportunities (has ${ops.length})`);
  expect(['qualified', 'discovery', 'proposal', 'negotiation'].every((s) => openOps.some((o) => o.stage === s)), 'every open stage has a deal');
  const won = ops.filter((o) => o.stage === 'won').length;
  expect(won >= 2 && won <= 3 && ops.filter((o) => o.stage === 'lost').length === 2, '2–3 won and 2 lost deals');
  expect(edited >= 1 && edited <= 2, `1–2 open deals with an edited probability (has ${edited})`);
  expect(openOps.some((o) => o.expected_close_date < today) && openOps.some((o) => o.expected_close_date > addDays(today, 90)), 'expected closes: one slipped, some months ahead');
  expect(openOps.some((o) => (o.next_step_date ?? '') < today) && openOps.some((o) => o.next_step_date === today), 'next steps: overdue and today');
  const deal = (account: ID, stage: string, pred: (o: (typeof ops)[number]) => boolean = () => true): boolean => ops.some((o) => o.account_id === account && o.stage === stage && pred(o));
  expect(deal('acc_thinhan', 'negotiation', (o) => o.name.startsWith('Giai đoạn 2') && o.quote_id === 'q_thinhan_p2_v2' && quotes.get('q_thinhan_p2_v2')?.status === 'pending_approval'), 'Thịnh An phase 2 in negotiation on the pending quote v2');
  expect(deal('acc_coxanh', 'proposal', (o) => o.name === 'Phụ lục mở rộng 20 người dùng' && quotes.get(o.quote_id ?? '')?.status === 'sent'), 'Cỏ Xanh annex in proposal on the sent quote');
  expect(deal('acc_maytrang', 'discovery') && deal('acc_haidang', 'qualified') && deal('acc_thientruong', 'proposal'), 'Mây Trắng discovery · Hải Đăng qualified · Thiên Trường proposal');

  // ── interactions
  const from = addDays(today, -60);
  for (const x of data.interactions) {
    const where = `interactions/${x.id}`;
    expect(KINDS.includes(x.kind) && (x.outcome === null || OUTCOMES.includes(x.outcome)), `${where}: kind / outcome`);
    expect(isStaff(x.owner_id), `${where}: owner must be Hà, Đức Anh or Nam`);
    expect(x.subject.trim() && x.summary.trim(), `${where}: subject / summary`);
    expect(dateOf(x.occurred_at) >= from && x.created_at >= x.occurred_at, `${where}: within the last 60 days, created after it happened`);
    expect(x.account_id !== null || x.lead_id !== null, `${where}: linked to nothing`);
    const a = x.account_id ? accounts.get(x.account_id) : undefined;
    const l = x.lead_id ? leads.get(x.lead_id) : undefined;
    const o = x.opportunity_id ? opps.get(x.opportunity_id) : undefined;
    const ct = x.contact_id ? contacts.get(x.contact_id) : undefined;
    // a converted lead's earlier touchpoints carry its new account too (as convertLead does) and predate it
    const preConversion = !!l && l.converted_account_id !== null && l.converted_account_id === x.account_id;
    if (x.account_id) expect(a && (preConversion ? x.occurred_at <= a.created_at : x.occurred_at >= a.created_at), `${where}: account missing / not yet created`);
    if (x.lead_id) expect(l && x.occurred_at >= l.created_at, `${where}: lead missing / not yet created`);
    if (x.lead_id && x.account_id) expect(preConversion, `${where}: lead and account do not match`);
    if (l?.status === 'converted') expect(preConversion, `${where}: touchpoint of a converted lead without its account`);
    if (x.opportunity_id) expect(o && o.account_id === x.account_id && x.occurred_at >= o.created_at, `${where}: opportunity missing / of another account / not yet created`);
    if (x.contact_id) expect(ct && ct.account_id === x.account_id && ct.last_interaction_at && ct.last_interaction_at >= x.occurred_at, `${where}: contact missing / other account / its last_interaction_at is older`);
  }
  const ix = data.interactions;
  expect(ix.length >= 40 && ix.length <= 65, `40–65 interactions (has ${ix.length})`);
  expect(KINDS.every((k) => ix.some((x) => x.kind === k)), 'every interaction kind occurs');
  expect(['u_am_ha', 'u_am_ducanh', 'u_director'].every((id) => ix.some((x) => x.owner_id === id)), 'interactions by Hà, Đức Anh and Nam');

  // ── segments
  expect(data.segments.length === 4 && data.segments.every((s) => s.shared && isStaff(s.owner_id)), '4 shared segments owned by staff');
  for (const s of data.segments) {
    const where = `segments/${s.id}`;
    expect(Object.keys(s.criteria).every((k) => k in SEGMENT_CRITERIA_KEYS), `${where}: unknown criteria key`);
    const members = segmentMembers(s.criteria);
    expect(members.leads + members.accounts > 0, `${where}: no members`);
  }

  // ── ecosystems (business groups linked on the client map): 4 groups of 3–5 companies mixing accounts and open
  //    leads; every ecosystem_id resolves; Thiên Trường and Hải Đăng stand alone; one group spans both AMs
  const ecos = by(data.ecosystems);
  const ecoOk = (id: ID | null | undefined): boolean => id === null || (id !== undefined && ecos.has(id));
  expect(data.ecosystems.length === 4, `4 ecosystems (has ${data.ecosystems.length})`);
  const ownersOf = new Map<ID, Set<ID | null>>();
  for (const e of data.ecosystems) {
    const where = `ecosystems/${e.id}`;
    expect(e.name.trim() && e.short_name.trim() && e.description.trim() && e.deleted_at === null, `${where}: name / short name / description`);
    expect(e.updated_at >= e.created_at, `${where}: updated_at before created_at`);
    const memberAccounts = data.account_profiles.filter((p) => p.ecosystem_id === e.id).map((p) => accounts.get(p.account_id));
    const memberLeads = data.leads.filter((l) => l.ecosystem_id === e.id);
    const n = memberAccounts.length + memberLeads.length;
    expect(n >= 3 && n <= 5, `${where}: 3–5 members (has ${n})`);
    expect(memberAccounts.length >= 1 && memberLeads.length >= 1, `${where}: must mix accounts and leads`);
    expect(memberLeads.every((l) => OPEN_LEAD.has(l.status)), `${where}: member leads must be open (closed leads are not on the map)`);
    ownersOf.set(e.id, new Set([...memberAccounts.map((a) => a?.am_id ?? null), ...memberLeads.map((l) => l.owner_id)]));
  }
  for (const p of data.account_profiles) expect(ecoOk(p.ecosystem_id), `account_profiles/${p.id}: ecosystem_id ${String(p.ecosystem_id)} does not resolve`);
  for (const l of data.leads) expect(ecoOk(l.ecosystem_id), `leads/${l.id}: ecosystem_id ${String(l.ecosystem_id)} does not resolve`);
  expect(STANDALONE_ACCOUNT_IDS.every((id) => profileOf(id)?.ecosystem_id === null), 'Thiên Trường and Hải Đăng stand alone');
  expect([...ownersOf.values()].some((o) => o.has('u_am_ha') && o.has('u_am_ducanh')), 'an ecosystem spans companies of both AMs (AM scoping on the map)');

  // ── CRM activity lines: internal; every deal's history starts with its creation and ends in its current stage
  const crmActs = data.activities.filter((a) => /^(lead|opportunity|interaction)\./.test(a.action));
  for (const a of crmActs) expect(a.visibility === 'internal', `activities/${a.id}: CRM activity must be internal`);
  for (const o of data.opportunities) {
    const acts = data.activities.filter((a) => a.target_type === 'opportunity' && a.target_id === o.id).sort((x, y) => x.created_at.localeCompare(y.created_at));
    const first = acts[0];
    const last = acts[acts.length - 1];
    if (!first || !last) {
      expect(false, `opportunities/${o.id}: no activity history`);
      continue;
    }
    const lastStage = last.action === 'opportunity.won' ? 'won' : last.action === 'opportunity.lost' ? 'lost' : last.params.stage;
    expect(first.action === 'opportunity.created' && first.created_at === o.created_at, `opportunities/${o.id}: history must start with opportunity.created at created_at`);
    expect(lastStage === o.stage && last.created_at === o.stage_changed_at, `opportunities/${o.id}: history must end in the current stage at stage_changed_at`);
    expect(acts.every((a) => a.account_id === o.account_id && a.params.opportunity === o.name), `opportunities/${o.id}: history account / name`);
  }
  for (const l of data.leads.filter((x) => x.status === 'converted')) {
    const a = l.converted_account_id ? accounts.get(l.converted_account_id) : undefined;
    expect(a && data.activities.some((x) => x.action === 'lead.converted' && x.target_id === l.id && x.account_id === a.id && x.created_at === a.created_at), `leads/${l.id}: no lead.converted activity`);
  }
  return errors;

  // same semantics as domain/crm.ts matchesSegment: AND across fields, any value within a field, at least one tag in
  // common; leads = open leads unless lead_statuses says otherwise; tiers / stages / health keep leads out and
  // lead_statuses keeps accounts out (a kind cannot meet the other kind's criteria)
  function segmentMembers(cr: SegmentCriteria): { leads: number; accounts: number } {
    const accountOnly = !!(cr.tiers?.length || cr.stages?.length || cr.health?.length);
    const leadOnly = !!cr.lead_statuses?.length;
    const has = <T>(list: T[] | undefined, v: T | undefined): boolean => !list || list.length === 0 || (v !== undefined && list.includes(v));
    const anyTag = (tags: string[]): boolean => !cr.tags || cr.tags.length === 0 || cr.tags.some((t) => tags.includes(t));
    const common = (x: { industry: string; province: string; size: CompanySize; revenue_band: RevenueBand; source: string; tags: string[]; owner: ID | null }): boolean =>
      has(cr.industries, x.industry) && has(cr.provinces, x.province) && has(cr.sizes, x.size) && has(cr.revenue_bands, x.revenue_band) && has(cr.sources as string[] | undefined, x.source) && anyTag(x.tags) && has(cr.owner_ids, x.owner ?? undefined);
    let nLeads = 0;
    let nAccounts = 0;
    if (cr.scope !== 'accounts' && !accountOnly) {
      for (const l of data.leads) {
        const statusOk = cr.lead_statuses?.length ? cr.lead_statuses.includes(l.status) : OPEN_LEAD.has(l.status);
        if (!statusOk || !common({ ...l, owner: l.owner_id })) continue;
        if (cr.min_fit_score !== undefined && seedFit(icp, l, ixOf((x) => x.lead_id === l.id), today).score < cr.min_fit_score) continue;
        nLeads += 1;
      }
    }
    if (cr.scope !== 'leads' && !leadOnly) {
      for (const a of data.accounts) {
        const p = profileOf(a.id);
        if (!p) continue;
        if (!common({ industry: a.industry, province: p.province, size: p.size, revenue_band: p.revenue_band, source: p.source, tags: p.tags, owner: a.am_id })) continue;
        if (!has(cr.tiers, a.tier) || !has(cr.stages, a.stage) || !has(cr.health, healthOf(a.id))) continue;
        if (cr.min_fit_score !== undefined && seedFit(icp, { industry: a.industry, ...p }, ixOf((x) => x.account_id === a.id), today).score < cr.min_fit_score) continue;
        nAccounts += 1;
      }
    }
    return { leads: nLeads, accounts: nAccounts };
  }
}
