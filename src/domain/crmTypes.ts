// CRM / targeting entities (extension: Bán hàng · Khách hàng mục tiêu · Dự án).
// Internal-only data: never returned to client accounts.
import type { Health, ID, ISODate, ISODateTime, Salutation, SoftDelete, Stage, Tier } from './types';

/** Company size by headcount */
export type CompanySize = 'lt50' | '50_200' | '200_1000' | 'gt1000';
/** Annual revenue (VND): <50 tỷ · 50–200 tỷ · 200–1.000 tỷ · >1.000 tỷ */
export type RevenueBand = 'lt50b' | '50_200b' | '200b_1t' | 'gt1t';
export type LeadSource = 'referral' | 'event' | 'website' | 'outbound' | 'partner' | 'existing_customer';
/** Mới · Đã liên hệ · Quan tâm · Nuôi dưỡng · Không phù hợp · Đã chuyển cơ hội */
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'nurturing' | 'disqualified' | 'converted';

/** A target company not yet qualified as a customer account ("khách hàng mục tiêu"). */
export interface Lead extends SoftDelete {
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
  owner_id: ID | null;
  status: LeadStatus;
  tags: string[];
  /** what they need, in plain words */
  need_summary: string | null;
  /** rough budget, VND */
  budget_estimate: number | null;
  notes: string | null;
  disqualified_reason: string | null;
  converted_account_id: ID | null;
  converted_opportunity_id: ID | null;
  /** business group / ecosystem this company belongs to (see Ecosystem) */
  ecosystem_id?: ID | null;
  last_contacted_at: ISODateTime | null;
  next_follow_up_date: ISODate | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/** Targeting attributes of a customer/prospect ACCOUNT (1:1 with accounts; used for segments & upsell). */
export interface AccountProfile {
  /** 'prof_<account_id>' */
  id: ID;
  account_id: ID;
  province: string;
  size: CompanySize;
  revenue_band: RevenueBand;
  website: string | null;
  source: LeadSource;
  tags: string[];
  /** business group / ecosystem this account belongs to (see Ecosystem) */
  ecosystem_id?: ID | null;
}

/** Đủ điều kiện · Khảo sát nhu cầu · Đề xuất & báo giá · Đàm phán · Thắng · Thua */
export type OpportunityStage = 'qualified' | 'discovery' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Opportunity extends SoftDelete {
  id: ID;
  account_id: ID;
  name: string;
  /** expected contract value, VND incl. VAT */
  value: number;
  /** 0–100; defaults per stage (qualified 10, discovery 25, proposal 50, negotiation 75, won 100, lost 0) but editable */
  probability: number;
  stage: OpportunityStage;
  expected_close_date: ISODate;
  owner_id: ID;
  source: LeadSource;
  /** price items of interest (whitespace / products) */
  price_item_ids: ID[];
  next_step: string | null;
  next_step_date: ISODate | null;
  quote_id: ID | null;
  /** project created when won */
  project_id: ID | null;
  lost_reason: string | null;
  won_at: ISODateTime | null;
  lost_at: ISODateTime | null;
  stage_changed_at: ISODateTime;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type InteractionKind = 'call' | 'meeting' | 'email' | 'demo' | 'zalo' | 'note';
export type InteractionOutcome = 'positive' | 'neutral' | 'negative';

/** A CRM touchpoint (cuộc gọi, gặp mặt, email, demo…). Always internal. */
export interface Interaction extends SoftDelete {
  id: ID;
  kind: InteractionKind;
  occurred_at: ISODateTime;
  subject: string;
  summary: string;
  outcome: InteractionOutcome | null;
  account_id: ID | null;
  lead_id: ID | null;
  opportunity_id: ID | null;
  contact_id: ID | null;
  owner_id: ID;
  next_follow_up_date: ISODate | null;
  created_at: ISODateTime;
}

export interface SegmentCriteria {
  /** leads = prospects not yet customers; accounts = existing accounts (upsell / cross-sell) */
  scope: 'all' | 'leads' | 'accounts';
  industries?: string[];
  provinces?: string[];
  sizes?: CompanySize[];
  revenue_bands?: RevenueBand[];
  sources?: LeadSource[];
  tags?: string[];
  lead_statuses?: LeadStatus[];
  tiers?: Tier[];
  stages?: Stage[];
  health?: Health[];
  owner_ids?: ID[];
  /** 0–100 */
  min_fit_score?: number;
}

export interface Segment extends SoftDelete {
  id: ID;
  name: string;
  description: string;
  criteria: SegmentCriteria;
  owner_id: ID;
  /** visible to the whole team */
  shared: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/**
 * Business group / ecosystem ("hệ sinh thái", e.g. a conglomerate and its subsidiaries). Accounts and leads that
 * belong to the same ecosystem are linked on the client map — the cross-sell opportunity inside one group.
 * Membership lives on AccountProfile.ecosystem_id and Lead.ecosystem_id.
 */
export interface Ecosystem extends SoftDelete {
  id: ID;
  name: string;
  short_name: string;
  description: string;
  industry: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/** Ideal customer profile — drives the fit score of leads and accounts. */
export interface IcpProfile {
  id: ID;
  name: string;
  target_industries: string[];
  target_provinces: string[];
  target_sizes: CompanySize[];
  target_revenue_bands: RevenueBand[];
  /** relative weights, any positive numbers (normalised by the engine) */
  weights: { industry: number; size: number; revenue: number; province: number; engagement: number };
  updated_at: ISODateTime;
}
