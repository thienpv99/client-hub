// Viewer-aware DTO builders + access rules of the CRM extension (ARCHITECTURE §13). All CRM data is internal:
// director → everything; AM → opportunities they own or on accounts they manage, leads they own + unassigned,
// own + shared segments; members and clients get nothing here (api/crm.ts throws forbidden first).
// Fit scores, interaction indexes and segment memberships are memoized per db.version.

import type { Account, ID, PriceItem } from '@/domain/types';
import type { AccountProfile, IcpProfile, Interaction, Lead, Opportunity, OpportunityStage, Segment, SegmentCriteria } from '@/domain/crmTypes';
import { ApiError, type AccountRef, type SearchResult, type Viewer } from './contract';
import type {
  FitBreakdown,
  FollowUpItem,
  InteractionView,
  LeadDetail,
  LeadView,
  OpportunityDetail,
  OpportunityView,
  SegmentMembers,
  SegmentView,
  TargetAccountView,
} from './crmContract';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import {
  computeFit,
  followUpBucket,
  isOpenLead,
  isOpenStage,
  matchesSegment,
  normalizeCriteria,
  safeDateOf,
  weightedValue,
  whitespaceItems,
  type FollowUpBucket,
  type SegmentSubject,
} from '@/domain/crm';
import { t } from '@/i18n';
import { accountMoney, quoteSummary } from './commercialViews';
import { db } from './db';
import { accessibleIds, accountRef, healthFor, userRefAny, userRefById } from './views';

export const forbidden = (): ApiError => new ApiError('forbidden', 'errors.forbidden');
export const notFound = (): ApiError => new ApiError('not_found', 'errors.not_found');

// ───────────────────────────── access ─────────────────────────────

/** director or AM signed in as themselves (clients, "Xem như khách hàng" and members are refused) */
export function isCrmViewer(v: Viewer): boolean {
  return v.org_type === 'internal' && !v.read_only && (v.role === 'director' || v.role === 'am');
}

export function assertCrmViewer(v: Viewer): void {
  if (!isCrmViewer(v)) throw forbidden();
}

const isDirector = (v: Viewer): boolean => v.role === 'director';

export function managesAccount(v: Viewer, accountId: ID): boolean {
  if (!isCrmViewer(v)) return false;
  return isDirector(v) || db.find('accounts', accountId)?.am_id === v.user.id;
}

export function canSeeOpportunity(o: Opportunity, v: Viewer): boolean {
  if (o.deleted_at || !isCrmViewer(v)) return false;
  return isDirector(v) || o.owner_id === v.user.id || managesAccount(v, o.account_id);
}

export function canSeeLead(l: Lead, v: Viewer): boolean {
  if (l.deleted_at || !isCrmViewer(v)) return false;
  if (isDirector(v) || l.owner_id === v.user.id) return true;
  // a converted lead belongs with its account (its AM), never with the team pool
  if (l.status === 'converted') return !!l.converted_account_id && managesAccount(v, l.converted_account_id);
  return l.owner_id === null;
}

export function canSeeSegment(s: Segment, v: Viewer): boolean {
  if (s.deleted_at || !isCrmViewer(v)) return false;
  return isDirector(v) || s.shared || s.owner_id === v.user.id;
}

export function canEditSegment(s: Segment, v: Viewer): boolean {
  return canSeeSegment(s, v) && (isDirector(v) || s.owner_id === v.user.id);
}

export function canSeeInteraction(i: Interaction, v: Viewer): boolean {
  if (i.deleted_at || !isCrmViewer(v)) return false;
  if (isDirector(v) || i.owner_id === v.user.id) return true;
  if (i.account_id && managesAccount(v, i.account_id)) return true;
  const lead = i.lead_id ? db.find('leads', i.lead_id) : undefined;
  if (lead && canSeeLead(lead, v)) return true;
  const opp = i.opportunity_id ? db.find('opportunities', i.opportunity_id) : undefined;
  return !!opp && canSeeOpportunity(opp, v);
}

// ───────────────────────────── ICP & profiles ─────────────────────────────

/** used until an ICP row exists (the director's first save stores it) */
export const DEFAULT_ICP: IcpProfile = {
  id: 'icp_default',
  name: 'ICP mặc định',
  target_industries: ['Bán lẻ', 'Ngân hàng', 'Sản xuất', 'Logistics'],
  target_provinces: ['TP. Hồ Chí Minh', 'Hà Nội'],
  target_sizes: ['200_1000', 'gt1000'],
  target_revenue_bands: ['200b_1t', 'gt1t'],
  weights: { industry: 30, size: 20, revenue: 20, province: 10, engagement: 20 },
  updated_at: '2026-01-01T00:00:00.000+07:00',
};

export function currentIcp(): IcpProfile {
  return db.rows('icp_profiles')[0] ?? DEFAULT_ICP;
}

// ───────────────────────────── memoized indexes ─────────────────────────────

interface Index {
  key: string;
  profiles: Map<ID, AccountProfile>;
  byLead: Map<ID, Interaction[]>;
  byAccount: Map<ID, Interaction[]>;
  byOpp: Map<ID, Interaction[]>;
  items: Map<ID, PriceItem>;
  leadFit: Map<ID, FitBreakdown>;
  accountFit: Map<ID, FitBreakdown>;
  bought: Map<ID, Set<ID>>;
  memberships: Map<string, { leads: Map<ID, ID[]>; accounts: Map<ID, ID[]> }>;
}

let index: Index | null = null;

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function idx(): Index {
  const key = `${db.version}|${todayISO()}`;
  if (index && index.key === key) return index;
  const next: Index = {
    key,
    profiles: new Map(),
    byLead: new Map(),
    byAccount: new Map(),
    byOpp: new Map(),
    items: new Map(db.allRows('price_items').map((p) => [p.id, p])),
    leadFit: new Map(),
    accountFit: new Map(),
    bought: new Map(),
    memberships: new Map(),
  };
  for (const p of db.rows('account_profiles')) next.profiles.set(p.account_id, p);
  const oppAccount = new Map<ID, ID>(db.rows('opportunities').map((o) => [o.id, o.account_id]));
  const newest = [...db.rows('interactions')].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  for (const i of newest) {
    if (i.lead_id) push(next.byLead, i.lead_id, i);
    if (i.opportunity_id) push(next.byOpp, i.opportunity_id, i);
    const accountId = i.account_id ?? (i.opportunity_id ? oppAccount.get(i.opportunity_id) : undefined);
    if (accountId) push(next.byAccount, accountId, i);
  }
  index = next;
  return next;
}

/** interactions newest first */
export const leadInteractions = (leadId: ID): Interaction[] => idx().byLead.get(leadId) ?? [];
export const accountInteractions = (accountId: ID): Interaction[] => idx().byAccount.get(accountId) ?? [];
export const opportunityInteractions = (oppId: ID): Interaction[] => idx().byOpp.get(oppId) ?? [];

/** targeting attributes of an account (neutral defaults when no profile was recorded yet) */
export function profileOf(accountId: ID): AccountProfile {
  return (
    idx().profiles.get(accountId) ?? {
      id: `prof_${accountId}`,
      account_id: accountId,
      province: '',
      size: '50_200',
      revenue_band: '50_200b',
      website: null,
      source: 'referral',
      tags: [],
    }
  );
}

export function leadFit(l: Lead): FitBreakdown {
  const ix = idx();
  let fit = ix.leadFit.get(l.id);
  if (!fit) {
    fit = computeFit(l, currentIcp(), leadInteractions(l.id).map((i) => i.occurred_at), todayISO());
    ix.leadFit.set(l.id, fit);
  }
  return fit;
}

export function accountFit(a: Account): FitBreakdown {
  const ix = idx();
  let fit = ix.accountFit.get(a.id);
  if (!fit) {
    const p = profileOf(a.id);
    fit = computeFit(
      { industry: a.industry, province: p.province, size: p.size, revenue_band: p.revenue_band },
      currentIcp(),
      accountInteractions(a.id).map((i) => i.occurred_at),
      todayISO(),
    );
    ix.accountFit.set(a.id, fit);
  }
  return fit;
}

/** price items bought by the account (lines of its accepted quotes) */
function boughtItems(accountId: ID): Set<ID> {
  const ix = idx();
  let set = ix.bought.get(accountId);
  if (!set) {
    const accepted = new Set(db.rows('quotes').filter((q) => q.account_id === accountId && q.status === 'accepted').map((q) => q.id));
    set = new Set(db.rows('quote_lines').filter((l) => accepted.has(l.quote_id)).map((l) => l.price_item_id));
    ix.bought.set(accountId, set);
  }
  return set;
}

function itemRef(id: ID): { price_item_id: ID; code: string; name: string } | null {
  const item = idx().items.get(id);
  return item ? { price_item_id: item.id, code: item.code, name: item.name } : null;
}

// ───────────────────────────── segments ─────────────────────────────

export function visibleLeads(v: Viewer): Lead[] {
  return db.rows('leads').filter((l) => canSeeLead(l, v));
}

export function visibleAccounts(v: Viewer): Account[] {
  if (!isCrmViewer(v)) return [];
  const ids = accessibleIds(v);
  return db.rows('accounts').filter((a) => ids.has(a.id));
}

export function visibleOpportunities(v: Viewer): Opportunity[] {
  return db.rows('opportunities').filter((o) => canSeeOpportunity(o, v));
}

function leadSubject(l: Lead): SegmentSubject {
  return {
    kind: 'lead',
    industry: l.industry,
    province: l.province,
    size: l.size,
    revenue_band: l.revenue_band,
    source: l.source,
    tags: l.tags ?? [],
    owner_id: l.owner_id,
    fit_score: leadFit(l).score,
    lead_status: l.status,
  };
}

function accountSubject(a: Account, v: Viewer): SegmentSubject {
  const p = profileOf(a.id);
  return {
    kind: 'account',
    industry: a.industry,
    province: p.province,
    size: p.size,
    revenue_band: p.revenue_band,
    source: p.source,
    tags: p.tags ?? [],
    owner_id: a.am_id,
    fit_score: accountFit(a).score,
    tier: a.tier,
    stage: a.stage,
    health: healthFor(a.id, v).value,
  };
}

/** segment ids (visible to the viewer) each visible lead / account belongs to */
function memberships(v: Viewer): { leads: Map<ID, ID[]>; accounts: Map<ID, ID[]> } {
  const ix = idx();
  const key = `${v.role}|${v.user.id}`;
  let m = ix.memberships.get(key);
  if (!m) {
    m = { leads: new Map(), accounts: new Map() };
    const segments = db.rows('segments').filter((s) => canSeeSegment(s, v));
    if (segments.length) {
      const criteria = segments.map((s) => ({ id: s.id, c: normalizeCriteria(s.criteria) }));
      for (const l of visibleLeads(v)) {
        const subject = leadSubject(l);
        m.leads.set(l.id, criteria.filter((x) => matchesSegment(subject, x.c)).map((x) => x.id));
      }
      for (const a of visibleAccounts(v)) {
        const subject = accountSubject(a, v);
        m.accounts.set(a.id, criteria.filter((x) => matchesSegment(subject, x.c)).map((x) => x.id));
      }
    }
    ix.memberships.set(key, m);
  }
  return m;
}

/** members of a criteria set among what the viewer may see (best fit first) */
function matchMembers(criteria: SegmentCriteria, v: Viewer): { leads: Lead[]; accounts: Account[] } {
  const c = normalizeCriteria(criteria);
  const byFit = <T>(fit: (x: T) => number, name: (x: T) => string) => (a: T, b: T): number =>
    fit(b) - fit(a) || name(a).localeCompare(name(b), 'vi');
  const leads = visibleLeads(v)
    .filter((l) => matchesSegment(leadSubject(l), c))
    .sort(byFit<Lead>((l) => leadFit(l).score, (l) => l.company_name));
  const accounts = visibleAccounts(v)
    .filter((a) => matchesSegment(accountSubject(a, v), c))
    .sort(byFit<Account>((a) => accountFit(a).score, (a) => a.name));
  return { leads, accounts };
}

function openPipelineValue(accountId: ID, v: Viewer): number {
  return visibleOpportunities(v)
    .filter((o) => o.account_id === accountId && isOpenStage(o.stage))
    .reduce((sum, o) => sum + o.value, 0);
}

function stats(m: { leads: Lead[]; accounts: Account[] }, v: Viewer): Omit<SegmentMembers, 'leads' | 'accounts'> {
  const scores = [...m.leads.map((l) => leadFit(l).score), ...m.accounts.map((a) => accountFit(a).score)];
  const potential =
    m.leads.reduce((sum, l) => sum + (l.budget_estimate ?? 0), 0) + m.accounts.reduce((sum, a) => sum + openPipelineValue(a.id, v), 0);
  return {
    lead_count: m.leads.length,
    account_count: m.accounts.length,
    potential_value: potential,
    avg_fit: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
  };
}

export function segmentMembers(criteria: SegmentCriteria, v: Viewer): SegmentMembers {
  const m = matchMembers(criteria, v);
  return {
    leads: m.leads.map((l) => leadView(l, v)),
    accounts: m.accounts.map((a) => targetAccountView(a, v)),
    ...stats(m, v),
  };
}

export function segmentView(s: Segment, v: Viewer): SegmentView {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    criteria: normalizeCriteria(s.criteria),
    owner: userRefAny(s.owner_id),
    shared: s.shared,
    ...stats(matchMembers(s.criteria, v), v),
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}

// ───────────────────────────── leads & target accounts ─────────────────────────────

function accountRefOrNull(id: ID | null): AccountRef | null {
  if (!id) return null;
  const a = db.find('accounts', id) ?? db.allRows('accounts').find((x) => x.id === id);
  return a ? accountRef(a) : null;
}

export function leadView(l: Lead, v: Viewer): LeadView {
  const today = todayISO();
  return {
    id: l.id,
    company_name: l.company_name,
    industry: l.industry,
    province: l.province,
    size: l.size,
    revenue_band: l.revenue_band,
    website: l.website,
    contact_name: l.contact_name,
    contact_title: l.contact_title,
    contact_salutation: l.contact_salutation,
    contact_email: l.contact_email,
    contact_phone: l.contact_phone,
    source: l.source,
    owner: userRefById(l.owner_id),
    status: l.status,
    tags: [...(l.tags ?? [])],
    need_summary: l.need_summary,
    budget_estimate: l.budget_estimate,
    notes: l.notes,
    disqualified_reason: l.disqualified_reason,
    converted_account: accountRefOrNull(l.converted_account_id),
    converted_opportunity_id: l.converted_opportunity_id,
    last_contacted_at: l.last_contacted_at,
    next_follow_up_date: l.next_follow_up_date,
    follow_up_overdue: isOpenLead(l.status) && !!l.next_follow_up_date && l.next_follow_up_date < today,
    fit: { ...leadFit(l) },
    segment_ids: [...(memberships(v).leads.get(l.id) ?? [])],
    interaction_count: leadInteractions(l.id).length,
    created_at: l.created_at,
    updated_at: l.updated_at,
  };
}

export function leadDetail(l: Lead, v: Viewer): LeadDetail {
  return { ...leadView(l, v), interactions: leadInteractions(l.id).map((i) => interactionView(i)) };
}

export function targetAccountView(a: Account, v: Viewer): TargetAccountView {
  const p = profileOf(a.id);
  const bought = boughtItems(a.id);
  const items = [...idx().items.values()].filter((i) => !i.deleted_at);
  return {
    ...accountRef(a),
    industry: a.industry,
    tier: a.tier,
    stage: a.stage,
    health: healthFor(a.id, v).value,
    am: userRefAny(a.am_id),
    province: p.province,
    size: p.size,
    revenue_band: p.revenue_band,
    tags: [...(p.tags ?? [])],
    fit: { ...accountFit(a) },
    contract_value: accountMoney(a.id).contract_value,
    whitespace: whitespaceItems(items, bought)
      .sort((x, y) => x.code.localeCompare(y.code))
      .map((i) => ({ price_item_id: i.id, code: i.code, name: i.name })),
    open_opportunities: visibleOpportunities(v).filter((o) => o.account_id === a.id && isOpenStage(o.stage)).length,
    segment_ids: [...(memberships(v).accounts.get(a.id) ?? [])],
  };
}

// ───────────────────────────── opportunities & interactions ─────────────────────────────

export function stageLabel(stage: OpportunityStage): string {
  return t(`activity.opportunity.stage_label.${stage}`);
}

export function opportunityView(o: Opportunity, v: Viewer): OpportunityView {
  const today = todayISO();
  const a = db.find('accounts', o.account_id) ?? db.allRows('accounts').find((x) => x.id === o.account_id);
  const open = isOpenStage(o.stage);
  const quote = o.quote_id ? db.find('quotes', o.quote_id) : undefined;
  const changed = safeDateOf(o.stage_changed_at) ?? safeDateOf(o.created_at) ?? today;
  const last = opportunityInteractions(o.id)[0];
  return {
    id: o.id,
    account: {
      ...(a ? accountRef(a) : { id: o.account_id, name: '', short_name: '', logo_url: null, brand_color: '#64748B' }),
      stage: a ? a.stage : 'prospecting',
      industry: a ? a.industry : '',
    },
    name: o.name,
    value: o.value,
    probability: o.probability,
    weighted_value: weightedValue(o.value, o.probability),
    stage: o.stage,
    expected_close_date: o.expected_close_date,
    close_overdue: open && o.expected_close_date < today,
    owner: userRefAny(o.owner_id),
    source: o.source,
    products: (o.price_item_ids ?? []).map(itemRef).filter((x): x is NonNullable<typeof x> => x !== null),
    next_step: o.next_step,
    next_step_date: o.next_step_date,
    next_step_overdue: open && !!o.next_step_date && o.next_step_date < today,
    quote: quote ? quoteSummary(quote, v) : null,
    project_id: o.project_id && db.find('projects', o.project_id) ? o.project_id : null,
    lost_reason: o.lost_reason,
    won_at: o.won_at,
    lost_at: o.lost_at,
    days_in_stage: Math.max(0, diffDays(today, changed)),
    last_interaction_at: last ? last.occurred_at : null,
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
}

const STAGE_ACTIONS: Partial<Record<string, OpportunityStage>> = {
  'opportunity.won': 'won',
  'opportunity.lost': 'lost',
  'opportunity.reopened': 'negotiation',
};

function stageHistory(o: Opportunity): OpportunityDetail['stage_history'] {
  const out: OpportunityDetail['stage_history'] = [];
  const rows = db
    .rows('activities')
    .filter((a) => a.target_type === 'opportunity' && a.target_id === o.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const a of rows) {
    const param = typeof a.params.stage === 'string' ? (a.params.stage as OpportunityStage) : undefined;
    const stage = a.action === 'opportunity.created' || a.action === 'opportunity.stage_changed' ? param : STAGE_ACTIONS[a.action];
    if (stage) out.push({ stage, at: a.created_at, by: a.actor_id ? userRefAny(a.actor_id) : null });
  }
  if (out.length === 0) out.push({ stage: o.stage, at: o.stage_changed_at || o.created_at, by: null });
  return out;
}

export function opportunityDetail(o: Opportunity, v: Viewer): OpportunityDetail {
  const contacts = db
    .rows('contacts')
    .filter((c) => c.account_id === o.account_id)
    .map((c) => ({ id: c.id, full_name: c.full_name, title: c.title, salutation: c.salutation, email: c.email, phone: c.phone }));
  return {
    ...opportunityView(o, v),
    interactions: opportunityInteractions(o.id).map((i) => interactionView(i)),
    contacts,
    stage_history: stageHistory(o),
  };
}

export function interactionView(i: Interaction): InteractionView {
  const lead = i.lead_id ? db.find('leads', i.lead_id) ?? db.allRows('leads').find((x) => x.id === i.lead_id) : undefined;
  const opp = i.opportunity_id ? db.find('opportunities', i.opportunity_id) ?? db.allRows('opportunities').find((x) => x.id === i.opportunity_id) : undefined;
  const contact = i.contact_id ? db.find('contacts', i.contact_id) : undefined;
  return {
    id: i.id,
    kind: i.kind,
    occurred_at: i.occurred_at,
    subject: i.subject,
    summary: i.summary,
    outcome: i.outcome,
    account: accountRefOrNull(i.account_id ?? (opp ? opp.account_id : null)),
    lead: lead ? { id: lead.id, company_name: lead.company_name } : null,
    opportunity: opp ? { id: opp.id, name: opp.name } : null,
    contact: contact ? { id: contact.id, full_name: contact.full_name, title: contact.title } : null,
    owner: userRefAny(i.owner_id),
    next_follow_up_date: i.next_follow_up_date,
    created_at: i.created_at,
  };
}

// ───────────────────────────── follow-ups & search ─────────────────────────────

/** open leads with a follow-up date + open opportunities with a next-step date, earliest first */
export function followUps(v: Viewer, ownerId?: ID): (FollowUpItem & { bucket: FollowUpBucket })[] {
  const today = todayISO();
  const out: (FollowUpItem & { bucket: FollowUpBucket })[] = [];
  for (const l of visibleLeads(v)) {
    if (!isOpenLead(l.status) || !l.next_follow_up_date) continue;
    if (ownerId && l.owner_id !== ownerId) continue;
    out.push({
      kind: 'lead',
      id: l.id,
      title: l.company_name,
      subtitle: [l.contact_name, l.contact_title].filter(Boolean).join(' · '),
      owner: userRefById(l.owner_id),
      date: l.next_follow_up_date,
      overdue: l.next_follow_up_date < today,
      href: `/app/targets/leads/${l.id}`,
      bucket: followUpBucket(l.next_follow_up_date, today),
    });
  }
  for (const o of visibleOpportunities(v)) {
    if (!isOpenStage(o.stage) || !o.next_step_date) continue;
    if (ownerId && o.owner_id !== ownerId) continue;
    const a = db.find('accounts', o.account_id);
    out.push({
      kind: 'opportunity',
      id: o.id,
      title: o.name,
      subtitle: [a ? a.name : '', o.next_step ?? ''].filter(Boolean).join(' · '),
      owner: userRefById(o.owner_id),
      date: o.next_step_date,
      overdue: o.next_step_date < today,
      href: `/app/crm/opportunities/${o.id}`,
      bucket: followUpBucket(o.next_step_date, today),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title, 'vi'));
}

/** quick-search entries for director / AM (reads.ts search) */
export function crmSearchEntries(v: Viewer): { result: SearchResult; text: string; order: number }[] {
  if (!isCrmViewer(v)) return [];
  const out: { result: SearchResult; text: string; order: number }[] = [];
  for (const o of visibleOpportunities(v)) {
    const a = db.find('accounts', o.account_id);
    out.push({
      result: {
        type: 'opportunity',
        id: o.id,
        title: o.name,
        subtitle: [a ? a.name : '', stageLabel(o.stage)].filter(Boolean).join(' · '),
        href: `/app/crm/opportunities/${o.id}`,
      },
      text: `${o.name} ${a ? `${a.name} ${a.short_name}` : ''}`,
      order: 4,
    });
  }
  for (const l of visibleLeads(v)) {
    out.push({
      result: {
        type: 'lead',
        id: l.id,
        title: l.company_name,
        subtitle: [l.industry, l.province, t(`activity.lead.status_label.${l.status}`)].filter(Boolean).join(' · '),
        href: `/app/targets/leads/${l.id}`,
      },
      text: `${l.company_name} ${l.contact_name} ${l.contact_email}`,
      order: 5,
    });
  }
  return out;
}
