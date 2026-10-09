// Defence in depth (ARCHITECTURE §6): every api result passes through here before reaching the UI.
// Views already filter per viewer; this strips anything that slipped through.

import type { Viewer } from './contract';

/** Keys a client account must never receive, wherever they appear. */
export const CLIENT_FORBIDDEN_KEYS: readonly string[] = [
  'cost_price',
  'cost_total',
  'margin',
  'margin_pct',
  'internal_notes',
  'internal_note',
  'health_override_reason',
  'manual_unblock_reason',
  'manual_unblocked_by',
  // client care refocus (SPEC-CARE §5): the expansion map, people, relations, care plans and request flags are New
  // Era's own working data — none of these keys exists in a client DTO
  'plan_ref',
  'adoption',
  'stakeholders',
  'relations',
  'relation_links',
  'key_people',
  'care',
  'care_plan',
  'cadence_days',
  'next_action',
  'next_action_due',
  'next_action_owner',
  'expansion',
  'flags',
  'debt_reason',
  'debt_reasons',
  'need_note',
  'opportunity_note',
  'est_value',
  'influence',
  'stance',
  'strength',
];

/**
 * Keys a client never receives inside a Deployment-shaped object ({ go_live_date, category, … }): the contract value,
 * the adoption read-out, internal notes and New Era's owner. (`notes` / `owner` are fine elsewhere, e.g. quotes.)
 */
export const CLIENT_FORBIDDEN_DEPLOYMENT_KEYS: readonly string[] = ['contract_value', 'notes', 'owner', 'owner_id', 'can_edit'];

/**
 * Keys a client never receives inside a ChangeRequest-shaped object ({ received_at, promised_date, … }): New Era's
 * triage (owner, plan, linked task, priority, source, internal note, flags). Clients keep code, title, description,
 * status (client wording), received, promised date, client note, decline reason, done.
 */
export const CLIENT_FORBIDDEN_REQUEST_KEYS: readonly string[] = [
  'owner',
  'owner_id',
  'task',
  'task_id',
  'triaged_at',
  'priority',
  'priority_label',
  'source',
  'source_label',
  'requested_by',
  'requested_by_user_id',
  'requested_by_contact_id',
  'deployment',
  'deployment_id',
  'client_status_label',
  'can',
];

/** Inside a Deployment-shaped object, internal viewers outside the commercial module (members) get no contract value. */
export const MEMBER_FORBIDDEN_DEPLOYMENT_KEYS: readonly string[] = ['contract_value'];

const has = (obj: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** a deployment (DeploymentView / ClientDeploymentView / raw row) */
export function isDeploymentShaped(obj: Record<string, unknown>): boolean {
  return has(obj, 'go_live_date') && has(obj, 'category');
}

/** a change request (ChangeRequestView / ClientChangeRequestView / raw row) */
export function isChangeRequestShaped(obj: Record<string, unknown>): boolean {
  return has(obj, 'received_at') && has(obj, 'promised_date');
}

/**
 * Keys a client must never receive inside a HealthInfo-shaped object (an object that also has `overridden`):
 * the AM's reason for overriding the account health is internal. The same key on a MilestoneView is the reason
 * of a manual forecast, which clients DO see (SPEC 5.4 "lý do nếu lùi").
 */
export const CLIENT_FORBIDDEN_HEALTH_KEYS: readonly string[] = ['override_reason'];

/** Keys an internal viewer without cost permission must never receive. */
export const COST_KEYS: readonly string[] = ['cost_price', 'cost_total', 'margin', 'margin_pct'];

/** Never leaves the service layer, whoever asks. */
const ALWAYS_FORBIDDEN: readonly string[] = ['password'];

/**
 * CRM activity lines (deals, leads, touchpoints — ARCHITECTURE §13) are for the director and AMs only. They are
 * logged 'internal' (so clients never get them); this also keeps them out of an internal member's activity feeds.
 */
export const CRM_ACTION_PREFIXES: readonly string[] = ['opportunity.', 'lead.', 'interaction.'];

/** an activity-shaped element ({ action, target_type, … }) of the CRM extension */
export function isCrmActivity(item: unknown): boolean {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
  const row = item as Record<string, unknown>;
  return typeof row.action === 'string' && typeof row.target_type === 'string' && CRM_ACTION_PREFIXES.some((p) => (row.action as string).startsWith(p));
}

/**
 * Care activity lines that belong to the director and AMs (SPEC-CARE §5: members get no expansion, relationship or
 * care data): the expansion map, people, relations and care plans. Deployment and change-request lines stay.
 */
export const CARE_MANAGER_ACTION_PREFIXES: readonly string[] = ['department.', 'stakeholder.', 'relation.', 'care_plan.'];

/** an activity-shaped element only the director / AMs may read (CRM or the manager-only care lines) */
export function isManagerOnlyActivity(item: unknown): boolean {
  if (isCrmActivity(item)) return true;
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
  const row = item as Record<string, unknown>;
  return typeof row.action === 'string' && typeof row.target_type === 'string' && CARE_MANAGER_ACTION_PREFIXES.some((p) => (row.action as string).startsWith(p));
}

/** true for objects shaped like HealthInfo ({ value, auto, overridden, override_reason?, reasons }) */
export function isHealthShaped(obj: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(obj, 'overridden');
}

/** Is `key` of `obj` forbidden for a client viewer? (shared by the sanitizer and the RBAC scan) */
export function isClientForbiddenKey(obj: Record<string, unknown>, key: string): boolean {
  if (CLIENT_FORBIDDEN_KEYS.includes(key)) return true;
  if (CLIENT_FORBIDDEN_DEPLOYMENT_KEYS.includes(key) && isDeploymentShaped(obj)) return true;
  if (CLIENT_FORBIDDEN_REQUEST_KEYS.includes(key) && isChangeRequestShaped(obj)) return true;
  return CLIENT_FORBIDDEN_HEALTH_KEYS.includes(key) && isHealthShaped(obj);
}

interface Rules {
  forbidden: Set<string>;
  /** client rules: drop array elements that are internal-only, and the health-only keys inside HealthInfo */
  dropHidden: boolean;
  /** everyone but the director / AM: drop CRM activity elements (and the manager-only care lines) */
  dropCrm: boolean;
  /** internal viewers outside the commercial module (members): no contract value on deployments */
  memberLimits: boolean;
}

/**
 * Deep copy of `value` filtered for `viewer`:
 * - client viewers (and no viewer at all): drop CLIENT_FORBIDDEN_KEYS, CLIENT_FORBIDDEN_HEALTH_KEYS inside
 *   HealthInfo-shaped objects (whose `auto` becomes `value` and `overridden` false), and array elements with
 *   `visibility === 'internal'` or `client_visible === false`;
 * - internal viewers without cost permission: drop COST_KEYS;
 * - everyone except a director / AM (clients, view-as, internal members): drop CRM activity elements and the
 *   manager-only care lines (department / stakeholder / relation / care plan);
 * - care (SPEC-CARE §5): clients lose CLIENT_FORBIDDEN_DEPLOYMENT_KEYS inside deployments and
 *   CLIENT_FORBIDDEN_REQUEST_KEYS inside change requests; internal members lose a deployment's contract value.
 */
export function sanitizeOutgoing<T>(value: T, viewer: Viewer | null): T {
  const restrictive = viewer === null || viewer.org_type === 'client';
  const noCost = viewer === null || viewer.org_type === 'client' || !viewer.can_view_cost;
  const crmViewer = viewer !== null && viewer.org_type === 'internal' && (viewer.role === 'director' || viewer.role === 'am');
  const forbidden = new Set<string>(ALWAYS_FORBIDDEN);
  if (restrictive) CLIENT_FORBIDDEN_KEYS.forEach((k) => forbidden.add(k));
  else if (noCost) COST_KEYS.forEach((k) => forbidden.add(k));
  return walk(value, { forbidden, dropHidden: restrictive, dropCrm: !crmViewer, memberLimits: !restrictive && !crmViewer }) as T;
}

function isHiddenElement(item: unknown): boolean {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
  const row = item as Record<string, unknown>;
  return row.visibility === 'internal' || row.client_visible === false;
}

function walk(value: unknown, rules: Rules): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      if (rules.dropHidden && isHiddenElement(item)) continue;
      if (rules.dropCrm && isManagerOnlyActivity(item)) continue;
      out.push(walk(item, rules));
    }
    return out;
  }
  if (value instanceof Date) return new Date(value.getTime());
  const obj = value as Record<string, unknown>;
  const health = rules.dropHidden && isHealthShaped(obj);
  const deployment = (rules.dropHidden || rules.memberLimits) && isDeploymentShaped(obj);
  const request = rules.dropHidden && isChangeRequestShaped(obj);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(obj)) {
    if (rules.forbidden.has(key)) continue;
    if (health && CLIENT_FORBIDDEN_HEALTH_KEYS.includes(key)) continue;
    if (deployment && (rules.dropHidden ? CLIENT_FORBIDDEN_DEPLOYMENT_KEYS : MEMBER_FORBIDDEN_DEPLOYMENT_KEYS).includes(key)) continue;
    if (request && CLIENT_FORBIDDEN_REQUEST_KEYS.includes(key)) continue;
    out[key] = walk(child, rules);
  }
  if (health) {
    // whether New Era set the colour by hand is internal too: a client gets the effective colour only
    if ('value' in out) out.auto = out.value;
    out.overridden = false;
  }
  return out;
}
