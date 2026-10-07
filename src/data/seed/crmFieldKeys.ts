// Reference field lists of the CRM tables (typed as Record<keyof Row, true>: the compiler rejects a missing or an
// extra key whenever src/domain/crmTypes.ts changes). seedChecks compares every seeded CRM row against them.
// `ecosystem_id` is optional on Lead / AccountProfile in the type, but the seed always writes it (null = standalone).

import type { IcpProfile, SegmentCriteria } from '@/domain/crmTypes';
import type { RowOf } from '@/services/db';

type Keys<T> = Record<keyof T, true>;

export type CrmTable = 'leads' | 'account_profiles' | 'opportunities' | 'interactions' | 'segments' | 'icp_profiles' | 'ecosystems';

export const CRM_TABLES: CrmTable[] = ['leads', 'account_profiles', 'opportunities', 'interactions', 'segments', 'icp_profiles', 'ecosystems'];

export const CRM_TABLE_KEYS: { [T in CrmTable]: Keys<RowOf<T>> } = {
  leads: { id: true, company_name: true, industry: true, province: true, size: true, revenue_band: true, website: true, contact_name: true, contact_title: true, contact_salutation: true, contact_email: true, contact_phone: true, source: true, owner_id: true, status: true, tags: true, need_summary: true, budget_estimate: true, notes: true, disqualified_reason: true, converted_account_id: true, converted_opportunity_id: true, ecosystem_id: true, last_contacted_at: true, next_follow_up_date: true, created_at: true, updated_at: true, deleted_at: true },
  account_profiles: { id: true, account_id: true, province: true, size: true, revenue_band: true, website: true, source: true, tags: true, ecosystem_id: true },
  opportunities: { id: true, account_id: true, name: true, value: true, probability: true, stage: true, expected_close_date: true, owner_id: true, source: true, price_item_ids: true, next_step: true, next_step_date: true, quote_id: true, project_id: true, lost_reason: true, won_at: true, lost_at: true, stage_changed_at: true, created_at: true, updated_at: true, deleted_at: true },
  interactions: { id: true, kind: true, occurred_at: true, subject: true, summary: true, outcome: true, account_id: true, lead_id: true, opportunity_id: true, contact_id: true, owner_id: true, next_follow_up_date: true, created_at: true, deleted_at: true },
  segments: { id: true, name: true, description: true, criteria: true, owner_id: true, shared: true, created_at: true, updated_at: true, deleted_at: true },
  icp_profiles: { id: true, name: true, target_industries: true, target_provinces: true, target_sizes: true, target_revenue_bands: true, weights: true, updated_at: true },
  ecosystems: { id: true, name: true, short_name: true, description: true, industry: true, created_at: true, updated_at: true, deleted_at: true },
};

/** every key a SegmentCriteria may carry (all optional except scope) */
export const SEGMENT_CRITERIA_KEYS: Keys<Required<SegmentCriteria>> = {
  scope: true,
  industries: true,
  provinces: true,
  sizes: true,
  revenue_bands: true,
  sources: true,
  tags: true,
  lead_statuses: true,
  tiers: true,
  stages: true,
  health: true,
  owner_ids: true,
  min_fit_score: true,
};

export const ICP_WEIGHT_KEYS: Keys<IcpProfile['weights']> = { industry: true, size: true, revenue: true, province: true, engagement: true };
