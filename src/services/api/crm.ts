// CRM endpoints (ARCHITECTURE §13): dashboard, follow-ups, opportunities, leads, segments, ICP, interactions.
// Director / AM only (assertCrmViewer); every mutation: requireViewer → client/view-as refused → assertWritable →
// scope checks → validation → ONE db.batch (with its activity lines, visibility 'internal').

import type { Account, Contact, ID, ISODate, Salutation, Stage, Tier } from '@/domain/types';
import type { AccountProfile, IcpProfile, Interaction, Lead, LeadStatus, Opportunity, OpportunityStage, Segment } from '@/domain/crmTypes';
import { ApiError, type Viewer } from '@/services/contract';
import type { CrmApi, CrmDashboard, FollowUpItem, InteractionView, LeadInput, OpportunityInput, OpportunityView } from '@/services/crmContract';
import { atTime, dateOf, nowISO, todayISO } from '@/domain/clock';
import { addDays, isValidISODate, monthOf } from '@/domain/dates';
import {
  COMPANY_SIZES,
  INTERACTION_KINDS,
  INTERACTION_OUTCOMES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  OPPORTUNITY_STAGES,
  accountStageAfter,
  avgCycleDays,
  clampProbability,
  cleanLabels,
  companyDomain,
  defaultProbability,
  forecastByMonth,
  isOpenLead,
  isOpenStage,
  normalizeCriteria,
  normalizeLabel,
  normalizeWeights,
  pipelineByStage,
  REVENUE_BANDS,
  safeDateOf,
  shortNameOf,
  weightedValue,
  winRate,
} from '@/domain/crm';
import { hasKey, t } from '@/i18n';
import { newId } from '@/lib/utils';
import { assertWritable, requireViewer } from '@/services/context';
import {
  DEFAULT_ICP,
  accountInteractions,
  assertCrmViewer,
  canEditSegment,
  canSeeInteraction,
  canSeeLead,
  canSeeOpportunity,
  canSeeSegment,
  currentIcp,
  followUps,
  forbidden,
  interactionView,
  leadDetail,
  leadView,
  managesAccount,
  notFound,
  opportunityDetail,
  opportunityInteractions,
  opportunityView,
  profileOf,
  segmentMembers,
  segmentView,
  stageLabel,
  targetAccountView,
  visibleAccounts,
  visibleLeads,
  visibleOpportunities,
} from '@/services/crmViews';
import { db } from '@/services/db';
import { logActivity } from '@/services/effects';
import { fieldLabels, userRefAny } from '@/services/views';
import { insertProject } from '@/services/api/roadmap';

const invalid = (key = 'errors.validation'): ApiError => new ApiError('validation', key);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALUTATIONS: readonly Salutation[] = ['anh', 'chị'];
const TIERS: readonly Tier[] = ['strategic', 'key', 'standard'];
/** accounts that already buy from New Era (listTargetAccounts = upsell / cross-sell) */
const CUSTOMER_STAGES: readonly Stage[] = ['implementing', 'operating', 'paused'];
const BRAND_COLORS = ['#1D4ED8', '#0F766E', '#7C3AED', '#B45309', '#BE123C', '#0369A1', '#4D7C0F', '#334155'];

// ───────────────────────────── guards & small helpers ─────────────────────────────

function crmReader(): Viewer {
  const v = requireViewer();
  assertCrmViewer(v);
  return v;
}

/** clients (incl. "Xem như khách hàng") get forbidden like for every CRM read; then the usual read-only guard */
function crmWriter(): Viewer {
  const v = requireViewer();
  if (v.org_type !== 'internal') throw forbidden();
  assertWritable(v);
  assertCrmViewer(v);
  return v;
}

function loadOpportunity(id: ID, v: Viewer): Opportunity {
  const o = db.find('opportunities', id);
  if (!o) throw notFound();
  if (!canSeeOpportunity(o, v)) throw forbidden();
  return o;
}

function loadLead(id: ID, v: Viewer): Lead {
  const l = db.find('leads', id);
  if (!l) throw notFound();
  if (!canSeeLead(l, v)) throw forbidden();
  return l;
}

function loadSegment(id: ID, v: Viewer): Segment {
  const s = db.find('segments', id);
  if (!s) throw notFound();
  if (!canSeeSegment(s, v)) throw forbidden();
  return s;
}

/** active director / AM (owners of deals and leads) */
function assertSalesOwner(id: ID): void {
  const u = db.find('users', id);
  if (!u || u.org_type !== 'internal' || (u.role !== 'director' && u.role !== 'am') || u.status === 'disabled') {
    throw invalid('errors.invalid_am');
  }
}

function text(s: string | null | undefined): string {
  return (s ?? '').trim();
}

function optText(s: string | null | undefined): string | null {
  const v = text(s);
  return v ? v : null;
}

function optDate(d: ISODate | null | undefined): ISODate | null {
  if (d === null || d === undefined || d === '') return null;
  if (!isValidISODate(d)) throw invalid('errors.invalid_date');
  return d;
}

function money(n: unknown, allowNull: true): number | null;
function money(n: unknown, allowNull?: false): number;
function money(n: unknown, allowNull = false): number | null {
  if (allowNull && (n === null || n === undefined || n === '')) return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) throw invalid();
  return Math.round(v);
}

function changedKeys<T extends object>(before: T, patch: Partial<T>): (keyof T)[] {
  return (Object.keys(patch) as (keyof T)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(patch[k]));
}

function crmFields(ns: 'opportunity' | 'lead' | 'icp', keys: string[]): string {
  return keys.map((k) => (hasKey(`activity.${ns}.field.${k}`) ? t(`activity.${ns}.field.${k}`) : k)).join(', ');
}

function stageParams(stage: OpportunityStage): Record<string, string> {
  return { stage, stage_label: stageLabel(stage) };
}

function statusParams(status: LeadStatus): Record<string, string> {
  return { status, status_label: t(`activity.lead.status_label.${status}`) };
}

function logCrm(input: {
  account_id: ID | null;
  actor: Viewer;
  action: Parameters<typeof logActivity>[0]['action'];
  target_type: 'opportunity' | 'lead' | 'interaction' | 'account' | 'settings';
  target_id: ID;
  params: Record<string, string | number>;
}): void {
  logActivity({
    account_id: input.account_id,
    actor_id: input.actor.user.id,
    action: input.action,
    target_type: input.target_type,
    target_id: input.target_id,
    params: input.params,
    visibility: 'internal',
  });
}

/** moves the account forward when a deal reaches negotiation / is won (logged like an account edit) */
function advanceAccount(accountId: ID, stage: OpportunityStage, v: Viewer, at: string): void {
  const account = db.find('accounts', accountId);
  if (!account) return;
  const next = accountStageAfter(account.stage, stage);
  if (next === account.stage) return;
  db.update('accounts', accountId, { stage: next, updated_at: at });
  logCrm({ account_id: accountId, actor: v, action: 'account.updated', target_type: 'account', target_id: accountId, params: { fields: fieldLabels(['stage']) } });
}

// ───────────────────────────── opportunity input ─────────────────────────────

/** validated fields of `input` (only the keys present; `base` = current row on update) */
function opportunityFields(input: Partial<OpportunityInput>, base: Opportunity | null, v: Viewer): Partial<Opportunity> {
  const out: Partial<Opportunity> = {};
  const accountId = input.account_id ?? base?.account_id;
  if (!accountId) throw invalid();
  if (input.account_id !== undefined && input.account_id !== base?.account_id) {
    if (!db.find('accounts', input.account_id)) throw notFound();
    if (!managesAccount(v, input.account_id)) throw forbidden();
    out.account_id = input.account_id;
  }
  if (input.name !== undefined) {
    out.name = text(input.name);
    if (!out.name) throw invalid('errors.name_required');
  }
  if (input.value !== undefined) out.value = money(input.value);
  if (input.stage !== undefined) {
    if (!OPPORTUNITY_STAGES.includes(input.stage) || !isOpenStage(input.stage)) throw invalid();
    out.stage = input.stage;
  }
  if (input.probability !== undefined && input.probability !== null) {
    if (!Number.isFinite(Number(input.probability))) throw invalid();
    out.probability = clampProbability(Number(input.probability));
  }
  if (input.expected_close_date !== undefined) {
    if (!isValidISODate(input.expected_close_date)) throw invalid('errors.invalid_date');
    out.expected_close_date = input.expected_close_date;
  }
  if (input.owner_id !== undefined) {
    assertSalesOwner(input.owner_id);
    // like leads: an AM keeps a deal for themself; handing it to someone else is the director's call
    if (v.role === 'am' && input.owner_id !== v.user.id && input.owner_id !== base?.owner_id) throw forbidden();
    out.owner_id = input.owner_id;
  }
  if (input.source !== undefined) {
    if (!LEAD_SOURCES.includes(input.source)) throw invalid();
    out.source = input.source;
  }
  if (input.price_item_ids !== undefined) {
    const ids = [...new Set(input.price_item_ids ?? [])];
    if (ids.some((id) => !db.find('price_items', id))) throw invalid();
    out.price_item_ids = ids;
  }
  if (input.next_step !== undefined) out.next_step = optText(input.next_step);
  if (input.next_step_date !== undefined) out.next_step_date = optDate(input.next_step_date);
  const quoteId = input.quote_id !== undefined ? input.quote_id : base?.quote_id ?? null;
  if (quoteId) {
    const q = db.find('quotes', quoteId);
    if (!q || q.account_id !== accountId) throw invalid();
  }
  if (input.quote_id !== undefined) out.quote_id = input.quote_id || null;
  return out;
}

// ───────────────────────────── lead input ─────────────────────────────

function leadFields(input: LeadInput, base: Lead | undefined, v: Viewer): Omit<Lead, 'id' | 'status' | 'disqualified_reason' | 'converted_account_id' | 'converted_opportunity_id' | 'last_contacted_at' | 'created_at' | 'updated_at' | 'deleted_at'> {
  // update: a field left out keeps its stored value
  const pick = <K extends keyof LeadInput>(k: K): LeadInput[K] =>
    input[k] !== undefined ? input[k] : (base?.[k as keyof Lead] as unknown as LeadInput[K]);
  const company = text(pick('company_name'));
  const contactName = text(pick('contact_name'));
  if (!company || !contactName) throw invalid('errors.name_required');
  const industry = text(pick('industry'));
  const province = text(pick('province'));
  if (!industry || !province) throw invalid();
  const size = pick('size');
  const band = pick('revenue_band');
  const source = pick('source');
  if (!COMPANY_SIZES.includes(size) || !REVENUE_BANDS.includes(band) || !LEAD_SOURCES.includes(source)) throw invalid();
  const salutation = pick('contact_salutation');
  if (!SALUTATIONS.includes(salutation)) throw invalid('errors.salutation_required');
  const email = text(pick('contact_email')).toLowerCase();
  if (!EMAIL_RE.test(email)) throw invalid('errors.invalid_email');
  const ownerId = pick('owner_id') ?? null;
  if (ownerId !== null) {
    assertSalesOwner(ownerId);
    // an AM keeps leads for themself or leaves them in the team pool; the director assigns anyone
    if (v.role === 'am' && ownerId !== v.user.id && ownerId !== base?.owner_id) throw forbidden();
  }
  return {
    company_name: company,
    industry,
    province,
    size,
    revenue_band: band,
    website: optText(pick('website')),
    contact_name: contactName,
    contact_title: text(pick('contact_title')),
    contact_salutation: salutation,
    contact_email: email,
    contact_phone: optText(pick('contact_phone')),
    source,
    owner_id: ownerId,
    tags: cleanLabels(pick('tags') ?? []),
    need_summary: optText(pick('need_summary')),
    budget_estimate: money(pick('budget_estimate'), true),
    notes: optText(pick('notes')),
    next_follow_up_date: optDate(pick('next_follow_up_date')),
  };
}

function brandColorFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BRAND_COLORS[h % BRAND_COLORS.length];
}

function quarterStart(today: ISODate): ISODate {
  const [y, m] = today.split('-').map(Number);
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
}

const OPEN_FIRST = (a: OpportunityView, b: OpportunityView): number => {
  const ao = isOpenStage(a.stage) ? 0 : 1;
  const bo = isOpenStage(b.stage) ? 0 : 1;
  if (ao !== bo) return ao - bo;
  if (ao === 0) return a.expected_close_date.localeCompare(b.expected_close_date) || a.name.localeCompare(b.name, 'vi');
  return (b.won_at ?? b.lost_at ?? '').localeCompare(a.won_at ?? a.lost_at ?? '') || a.name.localeCompare(b.name, 'vi');
};

// ───────────────────────────── endpoints ─────────────────────────────

export const crmApi: Omit<CrmApi, 'listProjectPortfolio' | 'getWorkload' | 'getClientMap' | 'listEcosystems' | 'saveEcosystem'> = {
  async getCrmDashboard(params) {
    const v = crmReader();
    const ownerId = params?.ownerId;
    const today = todayISO();
    const opps = visibleOpportunities(v).filter((o) => !ownerId || o.owner_id === ownerId);
    const open = opps.filter((o) => isOpenStage(o.stage));
    const leads = visibleLeads(v).filter((l) => !ownerId || l.owner_id === ownerId);
    const items = followUps(v, ownerId);
    const year = today.slice(0, 4);
    const qStart = quarterStart(today);
    const convertedAt = (l: Lead): ISODate | null => {
      const o = l.converted_opportunity_id ? db.allRows('opportunities').find((x) => x.id === l.converted_opportunity_id) : undefined;
      return safeDateOf(o ? o.created_at : l.updated_at);
    };
    const weekAgo = addDays(today, -6);
    const perOwner = new Map<ID, number>();
    for (const i of db.rows('interactions')) {
      if (ownerId && i.owner_id !== ownerId) continue;
      const day = safeDateOf(i.occurred_at);
      if (!day || day < weekAgo || day > today || !canSeeInteraction(i, v)) continue;
      perOwner.set(i.owner_id, (perOwner.get(i.owner_id) ?? 0) + 1);
    }
    const wonThisYear = opps.filter((o) => o.stage === 'won' && (safeDateOf(o.won_at) ?? '').slice(0, 4) === year);
    const dashboard: CrmDashboard = {
      pipeline: pipelineByStage(open),
      open_value: open.reduce((s, o) => s + o.value, 0),
      weighted_value: open.reduce((s, o) => s + weightedValue(o.value, o.probability), 0),
      forecast: forecastByMonth(opps, today, 6),
      win_rate: winRate(opps, today, 180),
      won_value_ytd: wonThisYear.reduce((s, o) => s + o.value, 0),
      won_count_ytd: wonThisYear.length,
      avg_cycle_days: avgCycleDays(opps, today, 365),
      leads: {
        open: leads.filter((l) => isOpenLead(l.status)).length,
        new_this_month: leads.filter((l) => monthOf(safeDateOf(l.created_at) ?? '') === monthOf(today)).length,
        converted_this_quarter: leads.filter((l) => {
          const at = l.status === 'converted' ? convertedAt(l) : null;
          return at !== null && at >= qStart && at <= today;
        }).length,
      },
      follow_ups: {
        overdue: items.filter((x) => x.bucket === 'overdue').length,
        today: items.filter((x) => x.bucket === 'today').length,
        this_week: items.filter((x) => x.bucket === 'week').length,
      },
      top_opportunities: [...open]
        .sort((a, b) => weightedValue(b.value, b.probability) - weightedValue(a.value, a.probability) || b.value - a.value)
        .slice(0, 5)
        .map((o) => opportunityView(o, v)),
      activity_week: [...perOwner]
        .map(([id, count]) => ({ owner: userRefAny(id), count }))
        .sort((a, b) => b.count - a.count || a.owner.full_name.localeCompare(b.owner.full_name, 'vi')),
    };
    return dashboard;
  },

  async listFollowUps(params) {
    const v = crmReader();
    const range = params?.range ?? 'all';
    return followUps(v, params?.ownerId)
      .filter((x) => range === 'all' || x.bucket === range)
      .map(
        (x): FollowUpItem => ({ kind: x.kind, id: x.id, title: x.title, subtitle: x.subtitle, owner: x.owner, date: x.date, overdue: x.overdue, href: x.href }),
      );
  },

  async listOpportunities(filter) {
    const v = crmReader();
    const f = filter ?? {};
    const q = f.search ? normalizeLabel(f.search) : '';
    return visibleOpportunities(v)
      .filter((o) => !f.stage || o.stage === f.stage)
      .filter((o) => !f.openOnly || isOpenStage(o.stage))
      .filter((o) => !f.ownerId || o.owner_id === f.ownerId)
      .filter((o) => !f.accountId || o.account_id === f.accountId)
      .map((o) => opportunityView(o, v))
      .filter((o) => !q || normalizeLabel(`${o.name} ${o.account.name} ${o.account.short_name}`).includes(q))
      .sort(OPEN_FIRST);
  },

  async getOpportunity(id) {
    const v = crmReader();
    return opportunityDetail(loadOpportunity(id, v), v);
  },

  async createOpportunity(input) {
    const v = crmWriter();
    if (!input || !input.account_id) throw invalid();
    const account = db.find('accounts', input.account_id);
    if (!account) throw notFound();
    if (!managesAccount(v, account.id)) throw forbidden();
    const fields = opportunityFields(input, null, v);
    for (const k of ['name', 'value', 'stage', 'expected_close_date', 'owner_id', 'source'] as const) {
      if (fields[k] === undefined) throw invalid(k === 'name' ? 'errors.name_required' : 'errors.validation');
    }
    const stage = fields.stage as OpportunityStage;
    const at = nowISO();
    const row: Opportunity = {
      id: newId('opp'),
      account_id: account.id,
      name: fields.name as string,
      value: fields.value as number,
      probability: fields.probability ?? defaultProbability(stage),
      stage,
      expected_close_date: fields.expected_close_date as ISODate,
      owner_id: fields.owner_id as ID,
      source: fields.source as Opportunity['source'],
      price_item_ids: fields.price_item_ids ?? [],
      next_step: fields.next_step ?? null,
      next_step_date: fields.next_step_date ?? null,
      quote_id: fields.quote_id ?? null,
      project_id: null,
      lost_reason: null,
      won_at: null,
      lost_at: null,
      stage_changed_at: at,
      created_at: at,
      updated_at: at,
      deleted_at: null,
    };
    db.batch(() => {
      db.insert('opportunities', row);
      advanceAccount(account.id, stage, v, at);
      logCrm({ account_id: account.id, actor: v, action: 'opportunity.created', target_type: 'opportunity', target_id: row.id, params: { opportunity: row.name, ...stageParams(stage) } });
    });
    return opportunityView(db.get('opportunities', row.id), v);
  },

  async updateOpportunity(id, patch) {
    const v = crmWriter();
    const o = loadOpportunity(id, v);
    const fields = opportunityFields(patch ?? {}, o, v);
    const stageChange = fields.stage !== undefined && fields.stage !== o.stage;
    if (stageChange && !isOpenStage(o.stage)) throw invalid();
    if (stageChange && fields.probability === undefined) fields.probability = defaultProbability(fields.stage as OpportunityStage);
    const keys = changedKeys(o, fields);
    if (keys.length === 0) return opportunityView(o, v);
    const at = nowISO();
    db.batch(() => {
      const next = db.update('opportunities', id, { ...fields, ...(stageChange ? { stage_changed_at: at } : {}), updated_at: at });
      const others = keys.filter((k) => k !== 'stage' && !(stageChange && k === 'probability')).map(String);
      if (others.length) {
        logCrm({ account_id: next.account_id, actor: v, action: 'opportunity.updated', target_type: 'opportunity', target_id: id, params: { opportunity: next.name, fields: crmFields('opportunity', others) } });
      }
      if (stageChange) {
        advanceAccount(next.account_id, next.stage, v, at);
        logCrm({ account_id: next.account_id, actor: v, action: 'opportunity.stage_changed', target_type: 'opportunity', target_id: id, params: { opportunity: next.name, from: o.stage, ...stageParams(next.stage) } });
      }
    });
    return opportunityView(db.get('opportunities', id), v);
  },

  async moveOpportunityStage(id, stage) {
    const v = crmWriter();
    const o = loadOpportunity(id, v);
    if (!OPPORTUNITY_STAGES.includes(stage) || !isOpenStage(stage) || !isOpenStage(o.stage)) throw invalid();
    if (o.stage === stage) return opportunityView(o, v);
    const at = nowISO();
    db.batch(() => {
      db.update('opportunities', id, { stage, probability: defaultProbability(stage), stage_changed_at: at, updated_at: at });
      advanceAccount(o.account_id, stage, v, at);
      logCrm({ account_id: o.account_id, actor: v, action: 'opportunity.stage_changed', target_type: 'opportunity', target_id: id, params: { opportunity: o.name, from: o.stage, ...stageParams(stage) } });
    });
    return opportunityView(db.get('opportunities', id), v);
  },

  async winOpportunity(id, input) {
    const v = crmWriter();
    const o = loadOpportunity(id, v);
    if (!isOpenStage(o.stage)) throw invalid();
    const account = db.find('accounts', o.account_id);
    if (!account) throw notFound();
    // a deal reopened after a win keeps its delivery project: winning it again never starts a second one
    const existingProject = o.project_id && db.find('projects', o.project_id) ? o.project_id : null;
    const createProject = !!input?.create_project && existingProject === null;
    if (createProject && !managesAccount(v, account.id)) throw forbidden();
    const at = nowISO();
    const { result } = db.batch(() => {
      let projectId: ID | null = null;
      let projectName = '';
      if (createProject) {
        const p = insertProject(account, { name: input.project_name, start_date: input.start_date, template_id: input.template_id ?? null }, v.user.id);
        projectId = p.id;
        projectName = p.name;
      }
      db.update('opportunities', id, {
        stage: 'won',
        probability: 100,
        won_at: at,
        lost_at: null,
        lost_reason: null,
        stage_changed_at: at,
        updated_at: at,
        project_id: projectId ?? existingProject,
      });
      advanceAccount(account.id, 'won', v, at);
      const params: Record<string, string> = { opportunity: o.name, ...stageParams('won'), project: projectName };
      const note = optText(input?.note);
      if (note) params.note = note;
      logCrm({ account_id: account.id, actor: v, action: 'opportunity.won', target_type: 'opportunity', target_id: id, params });
      return projectId ?? existingProject;
    });
    return { opportunity: opportunityView(db.get('opportunities', id), v), project_id: result };
  },

  async loseOpportunity(id, reason) {
    const v = crmWriter();
    const o = loadOpportunity(id, v);
    const why = text(reason);
    if (!why) throw invalid('errors.reason_required');
    if (!isOpenStage(o.stage)) throw invalid();
    const at = nowISO();
    db.batch(() => {
      db.update('opportunities', id, { stage: 'lost', probability: 0, lost_at: at, lost_reason: why, won_at: null, stage_changed_at: at, updated_at: at });
      logCrm({ account_id: o.account_id, actor: v, action: 'opportunity.lost', target_type: 'opportunity', target_id: id, params: { opportunity: o.name, ...stageParams('lost'), reason: why } });
    });
    return opportunityView(db.get('opportunities', id), v);
  },

  async reopenOpportunity(id) {
    const v = crmWriter();
    const o = loadOpportunity(id, v);
    if (isOpenStage(o.stage)) throw invalid();
    const at = nowISO();
    db.batch(() => {
      db.update('opportunities', id, {
        stage: 'negotiation',
        probability: defaultProbability('negotiation'),
        won_at: null,
        lost_at: null,
        lost_reason: null,
        stage_changed_at: at,
        updated_at: at,
      });
      advanceAccount(o.account_id, 'negotiation', v, at);
      logCrm({ account_id: o.account_id, actor: v, action: 'opportunity.reopened', target_type: 'opportunity', target_id: id, params: { opportunity: o.name, ...stageParams('negotiation') } });
    });
    return opportunityView(db.get('opportunities', id), v);
  },

  // ── leads

  async listLeads(filter) {
    const v = crmReader();
    const f = filter ?? {};
    if (f.segmentId) loadSegment(f.segmentId, v);
    const q = f.search ? normalizeLabel(f.search) : '';
    return visibleLeads(v)
      .filter((l) => !f.status || l.status === f.status)
      .filter((l) => !f.openOnly || isOpenLead(l.status))
      .filter((l) => !f.ownerId || l.owner_id === f.ownerId)
      .filter((l) => f.owner !== 'me' || l.owner_id === v.user.id)
      .filter((l) => f.owner !== 'none' || l.owner_id === null)
      .filter((l) => !q || normalizeLabel([l.company_name, l.contact_name, l.contact_email, l.industry, l.province, ...(l.tags ?? [])].join(' ')).includes(q))
      .map((l) => leadView(l, v))
      .filter((l) => !f.segmentId || l.segment_ids.includes(f.segmentId))
      .filter((l) => f.minFit === undefined || f.minFit === null || l.fit.score >= f.minFit)
      .sort((a, b) => b.fit.score - a.fit.score || a.company_name.localeCompare(b.company_name, 'vi'));
  },

  async getLead(id) {
    const v = crmReader();
    return leadDetail(loadLead(id, v), v);
  },

  async upsertLead(input) {
    const v = crmWriter();
    if (!input) throw invalid();
    const base = input.id ? loadLead(input.id, v) : undefined;
    const fields = leadFields(input, base, v);
    const at = nowISO();
    if (!base) {
      const row: Lead = {
        id: newId('lead'),
        ...fields,
        status: 'new',
        disqualified_reason: null,
        converted_account_id: null,
        converted_opportunity_id: null,
        last_contacted_at: null,
        created_at: at,
        updated_at: at,
        deleted_at: null,
      };
      db.batch(() => {
        db.insert('leads', row);
        logCrm({ account_id: null, actor: v, action: 'lead.created', target_type: 'lead', target_id: row.id, params: { lead: row.company_name } });
      });
      return leadView(db.get('leads', row.id), v);
    }
    const keys = changedKeys(base, fields).map(String);
    if (keys.length === 0) return leadView(base, v);
    db.batch(() => {
      const next = db.update('leads', base.id, { ...fields, updated_at: at });
      const others = keys.filter((k) => k !== 'owner_id');
      if (others.length) {
        logCrm({ account_id: null, actor: v, action: 'lead.updated', target_type: 'lead', target_id: base.id, params: { lead: next.company_name, fields: crmFields('lead', others) } });
      }
      if (keys.includes('owner_id')) {
        logCrm({ account_id: null, actor: v, action: 'lead.assigned', target_type: 'lead', target_id: base.id, params: { lead: next.company_name, to: ownerName(next.owner_id) } });
      }
    });
    return leadView(db.get('leads', base.id), v);
  },

  async setLeadStatus(id, status, reason) {
    const v = crmWriter();
    const l = loadLead(id, v);
    // 'converted' only through convertLead
    if (!LEAD_STATUSES.includes(status) || (status as LeadStatus) === 'converted') throw invalid();
    if (l.status === 'converted') throw new ApiError('conflict', 'errors.conflict');
    const why = text(reason);
    if (status === 'disqualified' && !why) throw invalid('errors.reason_required');
    const disqualifiedReason = status === 'disqualified' ? why : null;
    if (l.status === status && l.disqualified_reason === disqualifiedReason) return leadView(l, v);
    const at = nowISO();
    db.batch(() => {
      db.update('leads', id, { status, disqualified_reason: disqualifiedReason, updated_at: at });
      const params: Record<string, string> = { lead: l.company_name, ...statusParams(status) };
      if (disqualifiedReason) params.reason = disqualifiedReason;
      logCrm({ account_id: null, actor: v, action: 'lead.status_changed', target_type: 'lead', target_id: id, params });
    });
    return leadView(db.get('leads', id), v);
  },

  async assignLeads(ids, ownerId) {
    const v = crmWriter();
    const target = ownerId ?? null;
    if (target !== null) {
      assertSalesOwner(target);
      if (v.role === 'am' && target !== v.user.id) throw forbidden();
    }
    const leads = [...new Set(ids ?? [])].map((id) => loadLead(id, v));
    // an AM may hand back to the team pool only the leads they own
    if (v.role === 'am' && target === null && leads.some((l) => l.owner_id !== null && l.owner_id !== v.user.id)) throw forbidden();
    const changed = leads.filter((l) => l.owner_id !== target);
    if (changed.length === 0) return { updated: 0 };
    const at = nowISO();
    db.batch(() => {
      for (const l of changed) {
        db.update('leads', l.id, { owner_id: target, updated_at: at });
        logCrm({ account_id: null, actor: v, action: 'lead.assigned', target_type: 'lead', target_id: l.id, params: { lead: l.company_name, to: ownerName(target) } });
      }
    });
    return { updated: changed.length };
  },

  async convertLead(id, input) {
    const v = crmWriter();
    const lead = loadLead(id, v);
    if (lead.status === 'converted') throw new ApiError('conflict', 'errors.conflict');
    if (lead.status === 'disqualified') throw invalid();
    const name = text(input?.opportunity_name);
    if (!name) throw invalid('errors.name_required');
    const value = money(input.value);
    if (!isValidISODate(input.expected_close_date)) throw invalid('errors.invalid_date');
    assertSalesOwner(input.owner_id);
    if (v.role === 'am' && input.owner_id !== v.user.id) throw forbidden();
    if (!TIERS.includes(input.tier)) throw invalid();
    // a free mailbox (gmail.com…) is not the company's domain: use the website's then (client invites check it)
    const domain = companyDomain(lead.contact_email, lead.website);
    if (!domain) throw invalid('errors.invalid_email');
    const at = nowISO();
    const { result } = db.batch(() => {
      const account: Account = {
        id: newId('acc'),
        name: lead.company_name,
        short_name: shortNameOf(lead.company_name),
        logo_url: null,
        brand_color: brandColorFor(lead.company_name),
        industry: lead.industry,
        tier: input.tier,
        stage: 'prospecting',
        am_id: input.owner_id,
        health_override: null,
        health_override_reason: null,
        health_override_by: null,
        health_override_at: null,
        exec_summary: '',
        exec_summary_updated_at: null,
        email_domain: domain,
        internal_notes: lead.notes,
        created_at: at,
        updated_at: at,
        deleted_at: null,
      };
      db.insert('accounts', account);
      const profile: AccountProfile = {
        id: `prof_${account.id}`,
        account_id: account.id,
        province: lead.province,
        size: lead.size,
        revenue_band: lead.revenue_band,
        website: lead.website,
        source: lead.source,
        tags: [...(lead.tags ?? [])],
      };
      db.insert('account_profiles', profile);
      const contact: Contact = {
        id: newId('ct'),
        account_id: account.id,
        full_name: lead.contact_name,
        salutation: lead.contact_salutation,
        title: lead.contact_title,
        decision_role: 'decision_maker',
        email: lead.contact_email,
        phone: lead.contact_phone,
        user_id: null,
        last_interaction_at: lead.last_contacted_at,
        last_interaction_note: null,
        deleted_at: null,
      };
      db.insert('contacts', contact);
      const opp: Opportunity = {
        id: newId('opp'),
        account_id: account.id,
        name,
        value,
        probability: defaultProbability('qualified'),
        stage: 'qualified',
        expected_close_date: input.expected_close_date,
        owner_id: input.owner_id,
        source: lead.source,
        price_item_ids: [],
        next_step: null,
        next_step_date: lead.next_follow_up_date,
        quote_id: null,
        project_id: null,
        lost_reason: null,
        won_at: null,
        lost_at: null,
        stage_changed_at: at,
        created_at: at,
        updated_at: at,
        deleted_at: null,
      };
      db.insert('opportunities', opp);
      // the touchpoints with the lead now count for the new account too (engagement, history)
      for (const i of db.rows('interactions')) {
        if (i.lead_id === lead.id && !i.account_id) db.update('interactions', i.id, { account_id: account.id });
      }
      // the lead follows its deal: owned by the new account's AM (a pool lead leaves the pool)
      db.update('leads', lead.id, {
        status: 'converted',
        owner_id: input.owner_id,
        next_follow_up_date: null,
        converted_account_id: account.id,
        converted_opportunity_id: opp.id,
        updated_at: at,
      });
      logCrm({ account_id: account.id, actor: v, action: 'account.created', target_type: 'account', target_id: account.id, params: { account: account.name } });
      logCrm({ account_id: account.id, actor: v, action: 'lead.converted', target_type: 'lead', target_id: lead.id, params: { lead: lead.company_name, account: account.name, opportunity: opp.name } });
      logCrm({ account_id: account.id, actor: v, action: 'opportunity.created', target_type: 'opportunity', target_id: opp.id, params: { opportunity: opp.name, ...stageParams('qualified') } });
      return { account_id: account.id, opportunity_id: opp.id };
    });
    return result;
  },

  // ── segments & targeting

  async listSegments() {
    const v = crmReader();
    return db
      .rows('segments')
      .filter((s) => canSeeSegment(s, v))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map((s) => segmentView(s, v));
  },

  async previewSegment(criteria) {
    const v = crmReader();
    return segmentMembers(normalizeCriteria(criteria), v);
  },

  async getSegmentMembers(id) {
    const v = crmReader();
    return segmentMembers(loadSegment(id, v).criteria, v);
  },

  async saveSegment(input) {
    const v = crmWriter();
    const name = text(input?.name);
    if (!name) throw invalid('errors.name_required');
    const criteria = normalizeCriteria(input.criteria);
    const description = text(input.description);
    const shared = !!input.shared;
    const at = nowISO();
    if (input.id) {
      const s = loadSegment(input.id, v);
      if (!canEditSegment(s, v)) throw forbidden();
      db.batch(() => db.update('segments', s.id, { name, description, criteria, shared, updated_at: at }));
      return segmentView(db.get('segments', s.id), v);
    }
    const row: Segment = { id: newId('seg'), name, description, criteria, owner_id: v.user.id, shared, created_at: at, updated_at: at, deleted_at: null };
    db.batch(() => db.insert('segments', row));
    return segmentView(db.get('segments', row.id), v);
  },

  async deleteSegment(id) {
    const v = crmWriter();
    const s = loadSegment(id, v);
    if (!canEditSegment(s, v)) throw forbidden();
    db.batch(() => db.softDelete('segments', id, nowISO()));
  },

  async listTargetAccounts(params) {
    const v = crmReader();
    const q = params?.search ? normalizeLabel(params.search) : '';
    const minFit = params?.minFit;
    // upsell / cross-sell targets are existing customers; prospects are worked through their opportunities
    return visibleAccounts(v)
      .filter((a) => CUSTOMER_STAGES.includes(a.stage))
      .filter((a) => !q ||normalizeLabel([a.name, a.short_name, a.industry, profileOf(a.id).province, ...(profileOf(a.id).tags ?? [])].join(' ')).includes(q))
      .map((a) => targetAccountView(a, v))
      .filter((a) => minFit === undefined || minFit === null || a.fit.score >= minFit)
      .sort((a, b) => b.fit.score - a.fit.score || a.name.localeCompare(b.name, 'vi'));
  },

  async getIcp() {
    crmReader();
    const icp = currentIcp();
    return { ...icp, weights: { ...icp.weights } };
  },

  async updateIcp(patch) {
    const v = crmWriter();
    if (v.role !== 'director') throw forbidden();
    const current = currentIcp();
    const next: IcpProfile = { ...current, weights: { ...current.weights } };
    const p = patch ?? {};
    if (p.name !== undefined) {
      next.name = text(p.name);
      if (!next.name) throw invalid('errors.name_required');
    }
    if (p.target_industries !== undefined) next.target_industries = cleanLabels(p.target_industries);
    if (p.target_provinces !== undefined) next.target_provinces = cleanLabels(p.target_provinces);
    if (p.target_sizes !== undefined) {
      if (!Array.isArray(p.target_sizes) || p.target_sizes.some((x) => !COMPANY_SIZES.includes(x))) throw invalid();
      next.target_sizes = COMPANY_SIZES.filter((x) => p.target_sizes?.includes(x));
    }
    if (p.target_revenue_bands !== undefined) {
      if (!Array.isArray(p.target_revenue_bands) || p.target_revenue_bands.some((x) => !REVENUE_BANDS.includes(x))) throw invalid();
      next.target_revenue_bands = REVENUE_BANDS.filter((x) => p.target_revenue_bands?.includes(x));
    }
    if (p.weights !== undefined) {
      const merged = { ...current.weights, ...p.weights };
      const values = Object.values(merged).map(Number);
      if (values.some((n) => !Number.isFinite(n) || n < 0) || values.every((n) => n === 0)) throw invalid();
      next.weights = normalizeWeights(merged);
    }
    const changed = (['name', 'target_industries', 'target_provinces', 'target_sizes', 'target_revenue_bands', 'weights'] as const).filter(
      (k) => JSON.stringify(current[k]) !== JSON.stringify(next[k]),
    );
    if (changed.length === 0) return { ...current, weights: { ...current.weights } };
    next.updated_at = nowISO();
    const icpId = current.id || DEFAULT_ICP.id;
    db.batch(() => {
      if (db.find('icp_profiles', current.id)) db.update('icp_profiles', current.id, next);
      else db.insert('icp_profiles', { ...next, id: icpId });
      // every fit score and segment membership moves with the ICP: keep who changed it and when
      logCrm({ account_id: null, actor: v, action: 'icp.updated', target_type: 'settings', target_id: icpId, params: { fields: crmFields('icp', [...changed]) } });
    });
    const saved = currentIcp();
    return { ...saved, weights: { ...saved.weights } };
  },

  async getTargetingOptions() {
    const v = crmReader();
    const icp = currentIcp();
    const leads = visibleLeads(v);
    const accounts = visibleAccounts(v);
    const sort = (list: string[]): string[] => cleanLabels(list).sort((a, b) => a.localeCompare(b, 'vi'));
    return {
      industries: sort([...accounts.map((a) => a.industry), ...leads.map((l) => l.industry), ...icp.target_industries]),
      provinces: sort([...accounts.map((a) => profileOf(a.id).province), ...leads.map((l) => l.province), ...icp.target_provinces]),
      tags: sort([...accounts.flatMap((a) => profileOf(a.id).tags ?? []), ...leads.flatMap((l) => l.tags ?? [])]),
    };
  },

  // ── interactions

  async listInteractions(filter) {
    const v = crmReader();
    const f = filter ?? {};
    if (f.leadId) loadLead(f.leadId, v);
    if (f.opportunityId) loadOpportunity(f.opportunityId, v);
    const limit = f.limit && f.limit > 0 ? Math.min(500, Math.round(f.limit)) : 100;
    const source: Interaction[] = f.accountId ? accountInteractions(f.accountId) : [...db.rows('interactions')].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    const out: InteractionView[] = [];
    for (const i of source) {
      if (f.leadId && i.lead_id !== f.leadId) continue;
      if (f.opportunityId && i.opportunity_id !== f.opportunityId) continue;
      if (f.ownerId && i.owner_id !== f.ownerId) continue;
      if (!canSeeInteraction(i, v)) continue;
      out.push(interactionView(i));
      if (out.length >= limit) break;
    }
    return out;
  },

  async logInteraction(input) {
    const v = crmWriter();
    if (!input || !INTERACTION_KINDS.includes(input.kind)) throw invalid();
    const occurred = typeof input.occurred_at === 'string' && isValidISODate(input.occurred_at) ? atTime(input.occurred_at, '09:00') : input.occurred_at;
    if (!safeDateOf(occurred)) throw invalid('errors.invalid_date');
    const at = nowISO();
    // a touchpoint is something that happened: never after now (a minute of clock skew tolerated)
    if (new Date(occurred).getTime() > new Date(at).getTime() + 60_000) throw invalid('errors.interaction_in_future');
    const subject = text(input.subject);
    if (!subject) throw invalid();
    if (input.outcome !== null && input.outcome !== undefined && !INTERACTION_OUTCOMES.includes(input.outcome)) throw invalid();
    const followUp = optDate(input.next_follow_up_date);
    const opp = input.opportunity_id ? loadOpportunity(input.opportunity_id, v) : undefined;
    const lead = input.lead_id ? loadLead(input.lead_id, v) : undefined;
    // a follow-up date lives on an open lead (next_follow_up_date) or an open deal (next_step_date) — the follow-up
    // list reads nothing else, so a date with neither would be silently lost
    const leadTakesFollowUp = !!lead && isOpenLead(lead.status);
    const oppTakesFollowUp = !!opp && isOpenStage(opp.stage);
    if (followUp && !leadTakesFollowUp && !oppTakesFollowUp) throw invalid('errors.follow_up_needs_target');
    const contact = input.contact_id ? db.find('contacts', input.contact_id) : undefined;
    if (input.contact_id && !contact) throw notFound();
    let accountId: ID | null = input.account_id ?? opp?.account_id ?? contact?.account_id ?? null;
    if (opp && accountId !== opp.account_id) throw invalid();
    if (contact && accountId !== contact.account_id) throw invalid();
    if (accountId) {
      if (!db.find('accounts', accountId)) throw notFound();
      if (!managesAccount(v, accountId) && !opp) throw forbidden();
    }
    if (!accountId && !lead) throw invalid();
    if (!accountId && lead?.converted_account_id) {
      // same rule as naming the account explicitly: the touchpoint lands in that account's history
      if (!managesAccount(v, lead.converted_account_id)) throw forbidden();
      accountId = lead.converted_account_id;
    }
    const row: Interaction = {
      id: newId('int'),
      kind: input.kind,
      occurred_at: occurred,
      subject,
      summary: text(input.summary),
      outcome: input.outcome ?? null,
      account_id: accountId,
      lead_id: lead ? lead.id : null,
      opportunity_id: opp ? opp.id : null,
      contact_id: contact ? contact.id : null,
      owner_id: v.user.id,
      next_follow_up_date: followUp,
      created_at: at,
      deleted_at: null,
    };
    const later = (prev: string | null): boolean => !prev || (safeDateOf(prev) ?? '') <= dateOf(occurred);
    // a backfilled (older) touchpoint does not replace the follow-up planned at a newer one, unless it is later
    const takesFollowUp = (newest: boolean, stored: ISODate | null): boolean => !!followUp && (newest || !stored || followUp > stored);
    const oppNewest = opp ? later(opportunityInteractions(opp.id)[0]?.occurred_at ?? null) : false;
    db.batch(() => {
      db.insert('interactions', row);
      if (lead) {
        const patch: Partial<Lead> = { updated_at: at };
        const newest = later(lead.last_contacted_at);
        if (newest) patch.last_contacted_at = occurred;
        if (leadTakesFollowUp && takesFollowUp(newest, lead.next_follow_up_date)) patch.next_follow_up_date = followUp;
        db.update('leads', lead.id, patch);
      }
      if (contact && later(contact.last_interaction_at)) {
        const note = row.summary ? `${subject}: ${row.summary}` : subject;
        db.update('contacts', contact.id, { last_interaction_at: occurred, last_interaction_note: note.length > 240 ? `${note.slice(0, 239)}…` : note });
      }
      if (opp && oppTakesFollowUp && takesFollowUp(oppNewest, opp.next_step_date)) {
        db.update('opportunities', opp.id, { next_step_date: followUp, updated_at: at });
      }
      logCrm({
        account_id: accountId,
        actor: v,
        action: 'interaction.logged',
        target_type: 'interaction',
        target_id: row.id,
        params: { subject, kind: row.kind, kind_label: t(`activity.interaction.kind_label.${row.kind}`) },
      });
    });
    return interactionView(db.get('interactions', row.id));
  },
};

function ownerName(id: ID | null): string {
  if (!id) return t('activity.lead.team_pool');
  const u = db.find('users', id) ?? db.allRows('users').find((x) => x.id === id);
  return u ? u.full_name : t('activity.unknown_user');
}
