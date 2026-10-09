// Reference field lists of the care tables (typed as Record<keyof Row, true>: the compiler rejects a missing or an
// extra key whenever src/domain/careTypes.ts changes). seedChecks compares every seeded care row against them.

import type { RowOf } from '@/services/db';

type Keys<T> = Record<keyof T, true>;

export type CareTable = 'deployments' | 'account_departments' | 'stakeholders' | 'relation_links' | 'change_requests' | 'care_plans';

export const CARE_TABLES: CareTable[] = ['deployments', 'account_departments', 'stakeholders', 'relation_links', 'change_requests', 'care_plans'];

export const CARE_TABLE_KEYS: { [T in CareTable]: Keys<RowOf<T>> } = {
  deployments: { id: true, account_id: true, project_id: true, name: true, category: true, summary: true, status: true, go_live_date: true, departments: true, active_users: true, contract_value: true, adoption: true, notes: true, owner_id: true, created_at: true, updated_at: true, deleted_at: true },
  account_departments: { id: true, account_id: true, department: true, status: true, need_note: true, opportunity_note: true, opportunity_category: true, est_value: true, contact_id: true, ne_owner_id: true, next_step: true, next_step_due: true, updated_at: true },
  stakeholders: { id: true, contact_id: true, account_id: true, department: true, influence: true, stance: true, strength: true, ne_owner_id: true, reports_to_contact_id: true, notes: true, updated_at: true },
  relation_links: { id: true, from_contact_id: true, to_contact_id: true, kind: true, note: true, created_at: true },
  change_requests: { id: true, code: true, account_id: true, project_id: true, deployment_id: true, title: true, description: true, source: true, requested_by_contact_id: true, requested_by_user_id: true, received_at: true, status: true, priority: true, triaged_at: true, owner_id: true, promised_date: true, plan_ref: true, task_id: true, client_note: true, internal_note: true, decline_reason: true, done_at: true, created_at: true, updated_at: true, deleted_at: true },
  care_plans: { id: true, account_id: true, cadence_days: true, next_action: true, next_action_due: true, next_action_owner_id: true, updated_at: true },
};
