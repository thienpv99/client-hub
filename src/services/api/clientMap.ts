// "Bản đồ khách hàng" (client map): every company the viewer works with as a bubble sized by its value, plus one hub
// per business group (ecosystem) that has ≥ 2 VISIBLE members, linked to each of them — where the value is and where
// cross-selling inside a group is possible. CRM rules (ARCHITECTURE §13): director → everything; AM → the accounts
// they manage + the leads they own or the team pool; clients, "Xem như khách hàng" and members → forbidden.
// Values (VND): account contract = accountMoney().contract_value · pipeline = Σ weighted open deals · total = both;
// lead contract = 0 · pipeline = total = budget_estimate (stored as the node's pipeline_value). Hubs: Σ of members.
// Only OPEN leads are drawn: a converted lead is its prospect account already, a disqualified one is no target.

import type { Account, ID } from '@/domain/types';
import type { AccountProfile, Ecosystem, Lead, Opportunity } from '@/domain/crmTypes';
import { ApiError, type Viewer } from '@/services/contract';
import type { ClientMap, ClientMapLink, ClientMapMetric, ClientMapNode, ClientMapParams, CrmApi, EcosystemView } from '@/services/crmContract';
import { nowISO } from '@/domain/clock';
import { isOpenLead, isOpenStage, normalizeLabel, shortNameOf, weightedValue } from '@/domain/crm';
import { initials } from '@/domain/naming';
import { newId } from '@/lib/utils';
import { accountMoney } from '@/services/commercialViews';
import { assertWritable, requireViewer } from '@/services/context';
import {
  accountFit,
  assertCrmViewer,
  canSeeLead,
  forbidden,
  leadFit,
  managesAccount,
  notFound,
  profileOf,
  visibleAccounts,
  visibleLeads,
  visibleOpportunities,
} from '@/services/crmViews';
import { db } from '@/services/db';
import { logActivity } from '@/services/effects';
import { healthFor, userRefAny, userRefById } from '@/services/views';

const invalid = (key = 'errors.validation'): ApiError => new ApiError('validation', key);

// ───────────────────────────── pure assembly (tested in dev/crmTests) ─────────────────────────────

/** one company on the map before the metric is applied — already limited to what the viewer may see */
export type MapMember = Omit<ClientMapNode, 'id' | 'kind' | 'ref_id' | 'value' | 'href'> & { kind: 'account' | 'lead'; id: ID };

export type EcosystemInfo = Pick<Ecosystem, 'id' | 'name' | 'short_name' | 'description' | 'industry'>;

export const CLIENT_MAP_METRICS: readonly ClientMapMetric[] = ['contract_value', 'pipeline', 'total'];

/** neutral blue-grey bubbles for leads (white initials reach ≥ 4.5:1 on each) */
export const LEAD_COLORS: readonly string[] = ['#334155', '#3F4F66', '#475569', '#4A5B73', '#52627A', '#5A6B84'];

function hashOf(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** deterministic colour of a lead / lead-only hub */
export function neutralColor(id: ID): string {
  return LEAD_COLORS[hashOf(id) % LEAD_COLORS.length] ?? '#475569';
}

/** value of a company for the chosen metric (leads: contract 0, pipeline = total = budget) */
export function metricValue(m: Pick<MapMember, 'contract_value' | 'pipeline_value'>, metric: ClientMapMetric): number {
  if (metric === 'contract_value') return m.contract_value;
  if (metric === 'pipeline') return m.pipeline_value;
  return m.contract_value + m.pipeline_value;
}

export const mapNodeId = (m: Pick<MapMember, 'kind' | 'id'>): string => `${m.kind === 'account' ? 'acc' : 'lead'}:${m.id}`;

const hrefOf = (m: Pick<MapMember, 'kind' | 'id'>): string => (m.kind === 'account' ? `/app/accounts/${m.id}` : `/app/targets/leads/${m.id}`);

const sum = (list: readonly number[]): number => list.reduce((a, b) => a + b, 0);

function byTotal(a: MapMember, b: MapMember): number {
  return metricValue(b, 'total') - metricValue(a, 'total') || a.label.localeCompare(b.label, 'vi');
}

/** EcosystemView of `eco` over `members` (the viewer's visible companies; others are ignored) */
export function ecosystemViewOf(eco: EcosystemInfo, members: readonly MapMember[]): EcosystemView {
  const mine = members.filter((m) => m.ecosystem_id === eco.id).sort(byTotal);
  return {
    id: eco.id,
    name: eco.name,
    short_name: eco.short_name,
    description: eco.description,
    industry: eco.industry,
    account_count: mine.filter((m) => m.kind === 'account').length,
    lead_count: mine.filter((m) => m.kind === 'lead').length,
    contract_value: sum(mine.map((m) => m.contract_value)),
    potential_value: sum(mine.map((m) => m.pipeline_value)),
    members: mine.map((m) => ({ kind: m.kind, id: m.id, name: m.label })),
  };
}

/**
 * The map of `members` for `metric`: one bubble per company (value desc) + one hub per known ecosystem with ≥ 2 of
 * the members, linked hub → member. A company whose group has a single visible member floats free (ecosystem_id null
 * on its node), so the node, the links and `ecosystems` always agree. totals.value = Σ companies (hubs not counted).
 */
export function assembleClientMap(metric: ClientMapMetric, members: readonly MapMember[], ecosystems: readonly EcosystemInfo[]): ClientMap {
  const known = new Map(ecosystems.map((e) => [e.id, e]));
  const groups = new Map<ID, MapMember[]>();
  for (const m of members) {
    if (!m.ecosystem_id || !known.has(m.ecosystem_id)) continue;
    const list = groups.get(m.ecosystem_id);
    if (list) list.push(m);
    else groups.set(m.ecosystem_id, [m]);
  }
  const hubs: { eco: EcosystemInfo; list: MapMember[]; value: number }[] = [];
  for (const [id, list] of groups) {
    const eco = known.get(id);
    if (eco && list.length >= 2) hubs.push({ eco, list: [...list].sort(byTotal), value: sum(list.map((m) => metricValue(m, metric))) });
  }
  hubs.sort((a, b) => b.value - a.value || a.eco.name.localeCompare(b.eco.name, 'vi'));
  const hubIds = new Set(hubs.map((h) => h.eco.id));

  const nodes: ClientMapNode[] = members.map((m) => ({
    id: mapNodeId(m),
    kind: m.kind,
    ref_id: m.id,
    label: m.label,
    sublabel: m.sublabel,
    value: metricValue(m, metric),
    contract_value: m.contract_value,
    pipeline_value: m.pipeline_value,
    open_opportunities: m.open_opportunities,
    health: m.health,
    stage: m.stage,
    tier: m.tier,
    lead_status: m.lead_status,
    fit_grade: m.fit_grade,
    ecosystem_id: m.ecosystem_id && hubIds.has(m.ecosystem_id) ? m.ecosystem_id : null,
    logo: { ...m.logo },
    owner: m.owner,
    href: hrefOf(m),
  }));
  const totals: ClientMap['totals'] = {
    value: sum(nodes.map((n) => n.value)),
    accounts: members.filter((m) => m.kind === 'account').length,
    leads: members.filter((m) => m.kind === 'lead').length,
    ecosystems: hubs.length,
  };

  const links: ClientMapLink[] = [];
  for (const { eco, list, value } of hubs) {
    const hubId = `eco:${eco.id}`;
    const lead = list.find((m) => m.kind === 'account');
    nodes.push({
      id: hubId,
      kind: 'ecosystem',
      ref_id: eco.id,
      label: eco.name,
      // the member count is the UI's sentence (from `ecosystems`); the data layer gives the group's industry
      sublabel: eco.industry ?? '',
      value,
      contract_value: sum(list.map((m) => m.contract_value)),
      pipeline_value: sum(list.map((m) => m.pipeline_value)),
      open_opportunities: sum(list.map((m) => m.open_opportunities)),
      health: null,
      stage: null,
      tier: null,
      lead_status: null,
      fit_grade: null,
      ecosystem_id: eco.id,
      logo: { initials: initials(eco.short_name.trim() || eco.name), brand_color: lead ? lead.logo.brand_color : neutralColor(eco.id), logo_url: null },
      owner: null,
      href: null,
    });
    for (const m of list) links.push({ source: hubId, target: mapNodeId(m), kind: 'ecosystem' });
  }
  nodes.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'vi'));
  return { metric, nodes, links, ecosystems: hubs.map((h) => ecosystemViewOf(h.eco, h.list)), totals };
}

// ───────────────────────────── members from the db, for a viewer ─────────────────────────────

/** a lead that may sit in a group the viewer edits: visible (AM: own or team pool) and still open */
export function canGroupLead(l: Lead, v: Viewer): boolean {
  return canSeeLead(l, v) && isOpenLead(l.status);
}

function accountMember(a: Account, v: Viewer, open: readonly Opportunity[]): MapMember {
  return {
    kind: 'account',
    id: a.id,
    label: a.name,
    sublabel: a.industry,
    contract_value: accountMoney(a.id).contract_value,
    pipeline_value: sum(open.map((o) => weightedValue(o.value, o.probability))),
    open_opportunities: open.length,
    health: healthFor(a.id, v).value,
    stage: a.stage,
    tier: a.tier,
    lead_status: null,
    fit_grade: accountFit(a).grade,
    ecosystem_id: profileOf(a.id).ecosystem_id ?? null,
    logo: { initials: initials(a.short_name.trim() || a.name), brand_color: a.brand_color, logo_url: a.logo_url },
    owner: userRefAny(a.am_id),
  };
}

function leadMember(l: Lead): MapMember {
  return {
    kind: 'lead',
    id: l.id,
    label: l.company_name,
    sublabel: l.industry,
    contract_value: 0,
    pipeline_value: Math.max(0, Math.round(l.budget_estimate ?? 0)),
    open_opportunities: 0,
    health: null,
    stage: null,
    tier: null,
    lead_status: l.status,
    fit_grade: leadFit(l).grade,
    ecosystem_id: l.ecosystem_id ?? null,
    logo: { initials: initials(shortNameOf(l.company_name)), brand_color: neutralColor(l.id), logo_url: null },
    owner: userRefById(l.owner_id),
  };
}

/** the companies the viewer may see on the map (accounts + open leads), optionally narrowed to one owner */
export function mapMembers(v: Viewer, opts: { includeLeads?: boolean; ownerId?: ID } = {}): MapMember[] {
  const ownerId = opts.ownerId || null;
  const openByAccount = new Map<ID, Opportunity[]>();
  for (const o of visibleOpportunities(v)) {
    if (!isOpenStage(o.stage)) continue;
    const list = openByAccount.get(o.account_id);
    if (list) list.push(o);
    else openByAccount.set(o.account_id, [o]);
  }
  const out: MapMember[] = visibleAccounts(v)
    .filter((a) => !ownerId || a.am_id === ownerId)
    .map((a) => accountMember(a, v, openByAccount.get(a.id) ?? []));
  if (opts.includeLeads !== false) {
    for (const l of visibleLeads(v)) {
      if (!isOpenLead(l.status) || (ownerId && l.owner_id !== ownerId)) continue;
      out.push(leadMember(l));
    }
  }
  return out;
}

const liveEcosystems = (): Ecosystem[] => db.rows('ecosystems');

/** the viewer's map (sync; getClientMap wraps it) — throws forbidden for non-CRM viewers */
export function clientMapFor(v: Viewer, params: ClientMapParams = {}): ClientMap {
  assertCrmViewer(v);
  const metric = params.metric ?? 'total';
  if (!CLIENT_MAP_METRICS.includes(metric)) throw invalid();
  const members = mapMembers(v, { includeLeads: params.includeLeads !== false, ownerId: params.ownerId });
  return assembleClientMap(metric, members, liveEcosystems());
}

/**
 * A group the viewer may read the description of and rename: the director every group; an AM a group that holds at
 * least one company of hers (an account she manages, an open lead she owns) — never a group made only of other AMs'
 * customers and leads (or of team-pool leads).
 */
function canEditGroupFields(eco: Ecosystem, v: Viewer): boolean {
  if (v.role === 'director') return true;
  return (
    db.rows('account_profiles').some((p) => p.ecosystem_id === eco.id && !!db.find('accounts', p.account_id) && managesAccount(v, p.account_id)) ||
    db.rows('leads').some((l) => l.ecosystem_id === eco.id && l.owner_id === v.user.id && isOpenLead(l.status))
  );
}

/**
 * Every live group (so an AM can join an existing one), counted over the viewer's companies only. A group outside an
 * AM's reach (no company of hers in it) is listed by name only: no description, no industry.
 */
export function ecosystemsFor(v: Viewer): EcosystemView[] {
  assertCrmViewer(v);
  const members = mapMembers(v);
  return liveEcosystems()
    .map((e) => ecosystemViewOf(canEditGroupFields(e, v) ? e : { ...e, description: '', industry: null }, members))
    .sort((a, b) => b.contract_value + b.potential_value - (a.contract_value + a.potential_value) || a.name.localeCompare(b.name, 'vi'));
}

// ───────────────────────────── endpoints ─────────────────────────────

const NAME_MAX = 120;
const SHORT_NAME_MAX = 40;
const DESCRIPTION_MAX = 1000;

const text = (s: unknown): string => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '');

function idList(ids: unknown): ID[] {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string' || !x)) throw invalid();
  return [...new Set(ids as ID[])];
}

/** clients (incl. "Xem như khách hàng") get forbidden like for every CRM call; then the read-only guard */
function crmWriter(): Viewer {
  const v = requireViewer();
  if (v.org_type !== 'internal') throw forbidden();
  assertWritable(v);
  assertCrmViewer(v);
  return v;
}

function profileRow(accountId: ID): AccountProfile | undefined {
  return db.rows('account_profiles').find((p) => p.account_id === accountId);
}

/** companies in the group, all of them (also those out of the viewer's reach) — for the activity line */
function memberCount(ecoId: ID): number {
  return (
    db.rows('account_profiles').filter((p) => p.ecosystem_id === ecoId && db.find('accounts', p.account_id)).length +
    db.rows('leads').filter((l) => l.ecosystem_id === ecoId && l.status !== 'converted').length
  );
}

export const clientMapApi: Pick<CrmApi, 'getClientMap' | 'listEcosystems' | 'saveEcosystem'> = {
  async getClientMap(params) {
    const v = requireViewer();
    return clientMapFor(v, params ?? {});
  },

  async listEcosystems() {
    const v = requireViewer();
    return ecosystemsFor(v);
  },

  async saveEcosystem(input) {
    const v = crmWriter();
    if (!input || typeof input !== 'object') throw invalid();
    let name = text(input.name);
    let shortName = text(input.short_name);
    if (!name || !shortName) throw invalid('errors.name_required');
    let description = typeof input.description === 'string' ? input.description.trim() : '';
    let industry = text(input.industry) || null;
    if (name.length > NAME_MAX || shortName.length > SHORT_NAME_MAX || description.length > DESCRIPTION_MAX || (industry?.length ?? 0) > NAME_MAX) throw invalid();
    const accountIds = idList(input.account_ids);
    const leadIds = idList(input.lead_ids);

    const base = input.id ? db.find('ecosystems', input.id) : undefined;
    if (input.id && !base) throw notFound();
    if (base && !canEditGroupFields(base, v)) {
      // an AM outside the group may JOIN it (add her companies), not rename or rewrite it: the fields stay as stored —
      // she was listed the name only, so an empty description / industry means "unchanged"
      const sameDescription = description === '' || description === base.description;
      const sameIndustry = industry === null || industry === (base.industry ?? null);
      if (name !== base.name || shortName !== base.short_name || !sameDescription || !sameIndustry) throw forbidden();
      name = base.name;
      shortName = base.short_name;
      description = base.description;
      industry = base.industry ?? null;
    }
    const key = normalizeLabel(name);
    if (db.rows('ecosystems').some((e) => e.id !== base?.id && normalizeLabel(e.name) === key)) throw invalid();

    // every company named must be one the viewer may edit (AM: accounts they manage, leads they own / the pool)
    for (const id of accountIds) {
      if (!db.find('accounts', id)) throw notFound();
      if (!managesAccount(v, id)) throw forbidden();
    }
    const leads = leadIds.map((id) => {
      const l = db.find('leads', id);
      if (!l) throw notFound();
      if (!canSeeLead(l, v)) throw forbidden();
      // a converted lead is its account now; a disqualified one is off the map
      if (!isOpenLead(l.status)) throw invalid();
      return l;
    });

    const ecoId = base?.id ?? newId('eco');
    const wantAccounts = new Set(accountIds);
    const wantLeads = new Set(leadIds);
    // membership is replaced among the companies the viewer may edit; the others keep their group
    const dropAccounts = db.rows('account_profiles').filter((p) => p.ecosystem_id === ecoId && !wantAccounts.has(p.account_id) && managesAccount(v, p.account_id));
    const dropLeads = db.rows('leads').filter((l) => l.ecosystem_id === ecoId && !wantLeads.has(l.id) && canGroupLead(l, v));
    const addAccounts = accountIds.filter((id) => profileRow(id)?.ecosystem_id !== ecoId);
    const addLeads = leads.filter((l) => l.ecosystem_id !== ecoId);
    const fieldsChanged =
      !base || base.name !== name || base.short_name !== shortName || base.description !== description || (base.industry ?? null) !== industry;
    if (!fieldsChanged && dropAccounts.length + dropLeads.length + addAccounts.length + addLeads.length === 0) {
      return ecosystemsFor(v).find((e) => e.id === ecoId) ?? ecosystemViewOf(base ?? { id: ecoId, name, short_name: shortName, description, industry }, []);
    }

    const at = nowISO();
    db.batch(() => {
      if (base) db.update('ecosystems', base.id, { name, short_name: shortName, description, industry, updated_at: at });
      else db.insert('ecosystems', { id: ecoId, name, short_name: shortName, description, industry, created_at: at, updated_at: at, deleted_at: null });
      for (const p of dropAccounts) db.update('account_profiles', p.id, { ecosystem_id: null });
      for (const l of dropLeads) db.update('leads', l.id, { ecosystem_id: null });
      for (const id of addAccounts) {
        const row = profileRow(id);
        // an account set up without targeting attributes gets its profile row now (neutral defaults)
        if (row) db.update('account_profiles', row.id, { ecosystem_id: ecoId });
        else db.insert('account_profiles', { ...profileOf(id), ecosystem_id: ecoId });
      }
      for (const l of addLeads) db.update('leads', l.id, { ecosystem_id: ecoId });
      logActivity({
        account_id: null,
        actor_id: v.user.id,
        action: 'ecosystem.saved',
        target_type: 'settings',
        target_id: ecoId,
        params: { ecosystem: name, count: memberCount(ecoId) },
        visibility: 'internal',
      });
    });
    const saved = ecosystemsFor(v).find((e) => e.id === ecoId);
    if (!saved) throw notFound();
    return saved;
  },
};
