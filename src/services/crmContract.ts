// Contract of the CRM / targeting / project-portfolio extension.
// `api` (src/services/api.ts) implements `Api & CrmApi`. Every method here is INTERNAL ONLY:
// client viewers get ApiError('forbidden'). Members: project portfolio + workload only (read), no CRM.

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
} from '@/domain/crmTypes';
import type { Health, ID, ISODate, ISODateTime, ProjectStatus, Salutation, Stage, Tier } from '@/domain/types';
import type { AccountRef, MilestoneView, QuoteSummary, UserRef, WaitingCounts } from './contract';

// ───────────────────────────── Fit score ─────────────────────────────

export interface FitBreakdown {
  /** 0–100 overall */
  score: number;
  /** each component 0–100 before weighting */
  industry: number;
  size: number;
  revenue: number;
  province: number;
  /** recency/frequency of interactions in the last 60 days */
  engagement: number;
  /** 'A' ≥ 75 · 'B' 50–74 · 'C' < 50 */
  grade: 'A' | 'B' | 'C';
}

// ───────────────────────────── Leads (khách hàng mục tiêu) ─────────────────────────────

export interface LeadView {
  id: ID;
  company_name: string;
  industry: string;
  province: string;
  size: CompanySize;
  revenue_band: RevenueBand;
  website: string | null;
  contact_name: string;
  contact_title: string;
  contact_salutation: Salutation;
  contact_email: string;
  contact_phone: string | null;
  source: LeadSource;
  owner: UserRef | null;
  status: LeadStatus;
  tags: string[];
  need_summary: string | null;
  budget_estimate: number | null;
  notes: string | null;
  disqualified_reason: string | null;
  converted_account: AccountRef | null;
  converted_opportunity_id: ID | null;
  last_contacted_at: ISODateTime | null;
  next_follow_up_date: ISODate | null;
  /** next_follow_up_date < today */
  follow_up_overdue: boolean;
  fit: FitBreakdown;
  /** saved segments this lead belongs to */
  segment_ids: ID[];
  interaction_count: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface LeadDetail extends LeadView {
  interactions: InteractionView[];
}

export interface LeadFilter {
  status?: LeadStatus;
  /** open = new | contacted | interested | nurturing */
  openOnly?: boolean;
  ownerId?: ID;
  /** 'none' = unassigned */
  owner?: 'me' | 'none';
  segmentId?: ID;
  minFit?: number;
  search?: string;
}

export interface LeadInput {
  id?: ID;
  company_name: string;
  industry: string;
  province: string;
  size: CompanySize;
  revenue_band: RevenueBand;
  website: string | null;
  contact_name: string;
  contact_title: string;
  contact_salutation: Salutation;
  contact_email: string;
  contact_phone: string | null;
  source: LeadSource;
  owner_id: ID | null;
  tags: string[];
  need_summary: string | null;
  budget_estimate: number | null;
  notes: string | null;
  next_follow_up_date: ISODate | null;
}

/** Existing account seen as a target (upsell / cross-sell) */
export interface TargetAccountView extends AccountRef {
  industry: string;
  tier: Tier;
  stage: Stage;
  health: Health;
  am: UserRef;
  province: string;
  size: CompanySize;
  revenue_band: RevenueBand;
  tags: string[];
  fit: FitBreakdown;
  contract_value: number;
  /** active price items NOT yet bought by this account (whitespace) */
  whitespace: { price_item_id: ID; code: string; name: string }[];
  open_opportunities: number;
  segment_ids: ID[];
}

export interface SegmentView {
  id: ID;
  name: string;
  description: string;
  criteria: SegmentCriteria;
  owner: UserRef;
  shared: boolean;
  lead_count: number;
  account_count: number;
  /** Σ budget_estimate of leads + Σ open opportunity value of accounts */
  potential_value: number;
  avg_fit: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface SegmentMembers {
  leads: LeadView[];
  accounts: TargetAccountView[];
  lead_count: number;
  account_count: number;
  potential_value: number;
  avg_fit: number;
}

// ───────────────────────────── Opportunities (bán hàng) ─────────────────────────────

export interface OpportunityView {
  id: ID;
  account: AccountRef & { stage: Stage; industry: string };
  name: string;
  value: number;
  probability: number;
  /** value × probability / 100 */
  weighted_value: number;
  stage: OpportunityStage;
  expected_close_date: ISODate;
  /** expected_close_date < today and still open */
  close_overdue: boolean;
  owner: UserRef;
  source: LeadSource;
  products: { price_item_id: ID; code: string; name: string }[];
  next_step: string | null;
  next_step_date: ISODate | null;
  /** next_step_date < today and still open */
  next_step_overdue: boolean;
  quote: QuoteSummary | null;
  project_id: ID | null;
  lost_reason: string | null;
  won_at: ISODateTime | null;
  lost_at: ISODateTime | null;
  /** days since stage_changed_at */
  days_in_stage: number;
  last_interaction_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface OpportunityDetail extends OpportunityView {
  interactions: InteractionView[];
  contacts: { id: ID; full_name: string; title: string; salutation: Salutation; email: string; phone: string | null }[];
  /** stage history from the activity log, oldest first */
  stage_history: { stage: OpportunityStage; at: ISODateTime; by: UserRef | null }[];
}

export interface OpportunityFilter {
  stage?: OpportunityStage;
  openOnly?: boolean;
  ownerId?: ID;
  accountId?: ID;
  search?: string;
}

export interface OpportunityInput {
  account_id: ID;
  name: string;
  value: number;
  probability?: number;
  stage: OpportunityStage;
  expected_close_date: ISODate;
  owner_id: ID;
  source: LeadSource;
  price_item_ids: ID[];
  next_step: string | null;
  next_step_date: ISODate | null;
  quote_id: ID | null;
}

export interface CrmDashboard {
  /** open stages only, in pipeline order */
  pipeline: { stage: OpportunityStage; count: number; value: number; weighted: number }[];
  open_value: number;
  weighted_value: number;
  /** weighted value by expected close month for the next 6 months ('YYYY-MM') + won value in those months */
  forecast: { month: string; weighted: number; won: number }[];
  /** won / (won + lost) over the last 180 days, % */
  win_rate: number;
  won_value_ytd: number;
  /** number of deals behind won_value_ytd (won this calendar year) */
  won_count_ytd: number;
  /** average days from created_at to won_at, last 365 days */
  avg_cycle_days: number;
  leads: { open: number; new_this_month: number; converted_this_quarter: number };
  follow_ups: { overdue: number; today: number; this_week: number };
  top_opportunities: OpportunityView[];
  /** interactions per owner in the last 7 days */
  activity_week: { owner: UserRef; count: number }[];
}

export interface FollowUpItem {
  kind: 'lead' | 'opportunity';
  id: ID;
  title: string;
  subtitle: string;
  owner: UserRef | null;
  date: ISODate;
  overdue: boolean;
  href: string;
}

export interface WinInput {
  /** create a delivery project from a template (optional) */
  create_project: boolean;
  project_name: string;
  start_date: ISODate;
  template_id: ID | null;
  note?: string | null;
}

// ───────────────────────────── Interactions ─────────────────────────────

export interface InteractionView {
  id: ID;
  kind: InteractionKind;
  occurred_at: ISODateTime;
  subject: string;
  summary: string;
  outcome: InteractionOutcome | null;
  account: AccountRef | null;
  lead: { id: ID; company_name: string } | null;
  opportunity: { id: ID; name: string } | null;
  contact: { id: ID; full_name: string; title: string } | null;
  owner: UserRef;
  next_follow_up_date: ISODate | null;
  created_at: ISODateTime;
}

export interface InteractionInput {
  kind: InteractionKind;
  occurred_at: ISODateTime;
  subject: string;
  summary: string;
  outcome: InteractionOutcome | null;
  account_id: ID | null;
  lead_id: ID | null;
  opportunity_id: ID | null;
  contact_id: ID | null;
  /** sets the follow-up date on the lead / opportunity (next_step_date) too */
  next_follow_up_date: ISODate | null;
}

// ───────────────────────────── Project portfolio & workload ─────────────────────────────

export interface ProjectPortfolioRow {
  id: ID;
  name: string;
  code: string;
  status: ProjectStatus;
  account: AccountRef;
  am: UserRef;
  /** health of the project's own tasks/milestones (same rules as account health, scoped to the project) */
  health: Health;
  start_date: ISODate;
  end_date: ISODate;
  /** forecast of the final milestone */
  forecast_end_date: ISODate;
  /** max delay among not-done milestones */
  slip_days: number;
  progress_pct: number;
  milestones: MilestoneView[];
  next_milestone: MilestoneView | null;
  counts: WaitingCounts;
  open_tasks: number;
  done_tasks: number;
  /** internal people with open tasks on the project */
  team: UserRef[];
}

export interface WorkloadView {
  /** Monday of each week shown */
  weeks: ISODate[];
  people: {
    user: UserRef;
    open: number;
    overdue: number;
    blocked: number;
    /** open tasks due in each week (same order as weeks); overdue tasks count in the first week */
    per_week: number[];
    accounts: AccountRef[];
  }[];
}

// ───────────────────────────── API ─────────────────────────────

export interface CrmApi {
  getCrmDashboard(params?: { ownerId?: ID }): Promise<CrmDashboard>;
  listFollowUps(params?: { ownerId?: ID; range?: 'overdue' | 'today' | 'week' | 'all' }): Promise<FollowUpItem[]>;

  listOpportunities(filter?: OpportunityFilter): Promise<OpportunityView[]>;
  getOpportunity(id: ID): Promise<OpportunityDetail>;
  createOpportunity(input: OpportunityInput): Promise<OpportunityView>;
  updateOpportunity(id: ID, patch: Partial<OpportunityInput>): Promise<OpportunityView>;
  /** open stages only; use winOpportunity / loseOpportunity to close */
  moveOpportunityStage(id: ID, stage: Exclude<OpportunityStage, 'won' | 'lost'>): Promise<OpportunityView>;
  /** project_id = the deal's delivery project: created now (create_project), or the one kept from an earlier win
   *  (a reopened deal won again never gets a second project; create_project is then ignored) */
  winOpportunity(id: ID, input: WinInput): Promise<{ opportunity: OpportunityView; project_id: ID | null }>;
  /** reason required */
  loseOpportunity(id: ID, reason: string): Promise<OpportunityView>;
  /** won/lost → back to negotiation */
  reopenOpportunity(id: ID): Promise<OpportunityView>;

  listLeads(filter?: LeadFilter): Promise<LeadView[]>;
  getLead(id: ID): Promise<LeadDetail>;
  upsertLead(input: LeadInput): Promise<LeadView>;
  /** disqualified requires a reason */
  setLeadStatus(id: ID, status: Exclude<LeadStatus, 'converted'>, reason?: string): Promise<LeadView>;
  assignLeads(ids: ID[], ownerId: ID | null): Promise<{ updated: number }>;
  /** creates the prospect account (stage prospecting) + decision-maker contact + profile + opportunity */
  convertLead(id: ID, input: { opportunity_name: string; value: number; expected_close_date: ISODate; owner_id: ID; tier: Tier }): Promise<{ account_id: ID; opportunity_id: ID }>;

  listSegments(): Promise<SegmentView[]>;
  previewSegment(criteria: SegmentCriteria): Promise<SegmentMembers>;
  getSegmentMembers(id: ID): Promise<SegmentMembers>;
  saveSegment(input: { id?: ID; name: string; description: string; criteria: SegmentCriteria; shared: boolean }): Promise<SegmentView>;
  deleteSegment(id: ID): Promise<void>;
  /** existing customers only (account stage implementing · operating · paused): the upsell / cross-sell list */
  listTargetAccounts(params?: { minFit?: number; search?: string }): Promise<TargetAccountView[]>;
  getIcp(): Promise<IcpProfile>;
  /** director only */
  updateIcp(patch: Partial<Omit<IcpProfile, 'id' | 'updated_at'>>): Promise<IcpProfile>;
  /** distinct values present in data, for filter pickers */
  getTargetingOptions(): Promise<{ industries: string[]; provinces: string[]; tags: string[] }>;

  listInteractions(filter: { accountId?: ID; leadId?: ID; opportunityId?: ID; ownerId?: ID; limit?: number }): Promise<InteractionView[]>;
  logInteraction(input: InteractionInput): Promise<InteractionView>;

  listProjectPortfolio(filter?: { health?: Health; amId?: ID; status?: ProjectStatus; search?: string }): Promise<ProjectPortfolioRow[]>;
  getWorkload(params?: { weeks?: number }): Promise<WorkloadView>;

  /** "Bản đồ khách hàng": bubbles sized by value, linked by ecosystem (director + AM; AM sees own accounts/leads) */
  getClientMap(params?: ClientMapParams): Promise<ClientMap>;
  listEcosystems(): Promise<EcosystemView[]>;
  /** director / AM: create or rename an ecosystem and set its members (accounts + leads the viewer may edit) */
  saveEcosystem(input: { id?: ID; name: string; short_name: string; description: string; industry: string | null; account_ids: ID[]; lead_ids: ID[] }): Promise<EcosystemView>;
}

// ───────────────────────────── Client map (bản đồ khách hàng) ─────────────────────────────

/** what the bubble size represents */
export type ClientMapMetric = 'contract_value' | 'pipeline' | 'total';

export interface ClientMapParams {
  /** default 'total' */
  metric?: ClientMapMetric;
  /** include prospects (leads) as dashed bubbles; default true */
  includeLeads?: boolean;
  /** director: filter to one AM's accounts/leads */
  ownerId?: ID;
}

export interface ClientMapNode {
  /** 'acc:<id>' | 'lead:<id>' | 'eco:<id>' */
  id: string;
  kind: 'account' | 'lead' | 'ecosystem';
  ref_id: ID;
  label: string;
  /** industry, stage or "N công ty" for hubs */
  sublabel: string;
  /** VND for the chosen metric — accounts: contract value / weighted open pipeline / sum; leads: budget_estimate
   *  (pipeline & total) or 0 (contract_value); hubs: sum of members */
  value: number;
  contract_value: number;
  /** weighted value of open opportunities */
  pipeline_value: number;
  open_opportunities: number;
  health: Health | null;
  stage: Stage | null;
  tier: Tier | null;
  /** lead status for leads */
  lead_status: LeadStatus | null;
  fit_grade: 'A' | 'B' | 'C' | null;
  ecosystem_id: ID | null;
  logo: { initials: string; brand_color: string; logo_url: string | null };
  owner: UserRef | null;
  /** where a click goes: '/app/accounts/<id>', '/app/targets/leads/<id>', or null for hubs */
  href: string | null;
}

export interface ClientMapLink {
  source: string;
  target: string;
  kind: 'ecosystem';
}

export interface EcosystemView {
  id: ID;
  name: string;
  short_name: string;
  description: string;
  industry: string | null;
  account_count: number;
  lead_count: number;
  /** Σ contract value of member accounts */
  contract_value: number;
  /** Σ weighted pipeline of member accounts + Σ budget of member leads */
  potential_value: number;
  members: { kind: 'account' | 'lead'; id: ID; name: string }[];
}

export interface ClientMap {
  metric: ClientMapMetric;
  nodes: ClientMapNode[];
  links: ClientMapLink[];
  ecosystems: EcosystemView[];
  totals: { value: number; accounts: number; leads: number; ecosystems: number };
}