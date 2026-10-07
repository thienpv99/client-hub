// Reference field lists per table. Typed as Record<keyof Row, true>, so the compiler rejects a missing or an
// extra key whenever src/domain/types.ts changes — seedChecks then compares every seeded row against them.

import type { Settings, TemplateMilestone } from '@/domain/types';
import type { RowOf, TableName } from '@/services/db';
import type { CrmTable } from './crmFieldKeys';

type Keys<T> = Record<keyof T, true>;

/** core tables; the CRM tables have their own list in crmFieldKeys.ts (CRM_TABLE_KEYS) */
export const TABLE_KEYS: { [T in Exclude<TableName, CrmTable>]: Keys<RowOf<T>> } = {
  users: { id: true, full_name: true, email: true, phone: true, org_type: true, account_id: true, role: true, can_view_cost: true, title: true, salutation: true, avatar_url: true, notification_pref: true, onboarded_at: true, invited_at: true, invited_by: true, last_login_at: true, status: true, password: true, deleted_at: true },
  accounts: { id: true, name: true, short_name: true, logo_url: true, brand_color: true, industry: true, tier: true, stage: true, am_id: true, health_override: true, health_override_reason: true, health_override_by: true, health_override_at: true, exec_summary: true, exec_summary_updated_at: true, email_domain: true, internal_notes: true, created_at: true, updated_at: true, deleted_at: true },
  contacts: { id: true, account_id: true, full_name: true, salutation: true, title: true, decision_role: true, email: true, phone: true, user_id: true, last_interaction_at: true, last_interaction_note: true, deleted_at: true },
  projects: { id: true, account_id: true, name: true, code: true, start_date: true, end_date: true, status: true, deleted_at: true },
  milestones: { id: true, project_id: true, name: true, order_no: true, planned_date: true, forecast_override_date: true, forecast_override_reason: true, status: true, completed_at: true, client_visible: true, description: true, deleted_at: true },
  tasks: { id: true, project_id: true, milestone_id: true, title: true, description: true, side: true, type: true, assignee_id: true, delegated_by: true, delegated_at: true, delegation_note: true, requires_owner: true, waiting_on: true, due_date: true, status: true, impact_text: true, client_visible: true, reminder_count: true, last_reminded_at: true, manual_unblock_reason: true, manual_unblocked_by: true, manual_unblocked_at: true, completed_at: true, quote_id: true, payment_schedule_id: true, revision: true, answer_text: true, created_by: true, created_at: true, updated_at: true, deleted_at: true },
  task_dependencies: { id: true, task_id: true, blocks_task_id: true, blocks_milestone_id: true, created_by: true, created_at: true },
  comments: { id: true, task_id: true, author_id: true, body: true, visibility: true, reply_to_id: true, created_at: true, deleted_at: true },
  files: { id: true, account_id: true, project_id: true, task_id: true, name: true, doc_key: true, version: true, mime: true, size: true, storage_path: true, visibility: true, kind: true, uploaded_by: true, uploaded_at: true, note: true, deleted_at: true },
  price_items: { id: true, code: true, name: true, unit: true, list_price: true, cost_price: true, category: true, active: true, description: true, deleted_at: true },
  account_prices: { id: true, account_id: true, price_item_id: true, negotiated_price: true, note: true },
  quotes: { id: true, account_id: true, project_id: true, code: true, title: true, version: true, parent_id: true, status: true, valid_until: true, discount_pct_total: true, approval_requested_at: true, approval_requested_by: true, director_approved_by: true, director_approved_at: true, approval_note: true, sent_at: true, sent_by: true, client_decision: true, client_decided_by: true, client_decided_at: true, client_note: true, notes: true, internal_note: true, created_by: true, created_at: true, updated_at: true, deleted_at: true },
  quote_lines: { id: true, quote_id: true, price_item_id: true, description: true, qty: true, unit_price: true, discount_pct: true, vat_rate: true, sort_order: true },
  contracts: { id: true, account_id: true, quote_id: true, code: true, title: true, value: true, signed_date: true, start_date: true, end_date: true, status: true, file_id: true, deleted_at: true },
  payment_schedules: { id: true, contract_id: true, name: true, percent: true, amount: true, milestone_id: true, due_date: true, status: true, invoice_no: true, invoiced_at: true, paid_at: true, client_reported_at: true, proof_file_id: true, auto_task_enabled: true, task_id: true, deleted_at: true },
  activities: { id: true, account_id: true, actor_id: true, action: true, target_type: true, target_id: true, params: true, visibility: true, created_at: true },
  notifications: { id: true, user_id: true, kind: true, title: true, body: true, link: true, account_id: true, task_id: true, urgent: true, read_at: true, created_at: true, dedupe_key: true },
  emails: { id: true, to_user_id: true, to_email: true, subject: true, body_text: true, link: true, kind: true, urgent: true, status: true, batch_key: true, created_at: true, sent_at: true, reason: true, task_ids: true },
  templates: { id: true, name: true, description: true, milestones: true },
};

/** keys that may be absent (optional properties of the TS type) */
export const OPTIONAL_KEYS: Partial<Record<TableName, string[]>> = { users: ['password'], emails: ['task_ids'] };

export const SETTINGS_KEYS: Keys<Settings> = {
  company_name: true,
  timezone: true,
  discount_approval_threshold_pct: true,
  escalation_overdue_days: true,
  reminder_days_before: true,
  overdue_reminder_per_day: true,
  max_emails_per_day: true,
  weekly_digest_weekday: true,
  weekly_digest_hour: true,
  payment_task_auto: true,
};

export const TEMPLATE_MILESTONE_KEYS: Keys<TemplateMilestone> = { name: true, offset_days: true, client_visible: true };
