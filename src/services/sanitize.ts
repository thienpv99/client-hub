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
];

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

/** true for objects shaped like HealthInfo ({ value, auto, overridden, override_reason?, reasons }) */
export function isHealthShaped(obj: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(obj, 'overridden');
}

/** Is `key` of `obj` forbidden for a client viewer? (shared by the sanitizer and the RBAC scan) */
export function isClientForbiddenKey(obj: Record<string, unknown>, key: string): boolean {
  if (CLIENT_FORBIDDEN_KEYS.includes(key)) return true;
  return CLIENT_FORBIDDEN_HEALTH_KEYS.includes(key) && isHealthShaped(obj);
}

interface Rules {
  forbidden: Set<string>;
  /** client rules: drop array elements that are internal-only, and the health-only keys inside HealthInfo */
  dropHidden: boolean;
  /** everyone but the director / AM: drop CRM activity elements */
  dropCrm: boolean;
}

/**
 * Deep copy of `value` filtered for `viewer`:
 * - client viewers (and no viewer at all): drop CLIENT_FORBIDDEN_KEYS, CLIENT_FORBIDDEN_HEALTH_KEYS inside
 *   HealthInfo-shaped objects, and array elements with `visibility === 'internal'` or `client_visible === false`;
 * - internal viewers without cost permission: drop COST_KEYS;
 * - everyone except a director / AM (clients, view-as, internal members): drop CRM activity elements.
 */
export function sanitizeOutgoing<T>(value: T, viewer: Viewer | null): T {
  const restrictive = viewer === null || viewer.org_type === 'client';
  const noCost = viewer === null || viewer.org_type === 'client' || !viewer.can_view_cost;
  const crmViewer = viewer !== null && viewer.org_type === 'internal' && (viewer.role === 'director' || viewer.role === 'am');
  const forbidden = new Set<string>(ALWAYS_FORBIDDEN);
  if (restrictive) CLIENT_FORBIDDEN_KEYS.forEach((k) => forbidden.add(k));
  else if (noCost) COST_KEYS.forEach((k) => forbidden.add(k));
  return walk(value, { forbidden, dropHidden: restrictive, dropCrm: !crmViewer }) as T;
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
      if (rules.dropCrm && isCrmActivity(item)) continue;
      out.push(walk(item, rules));
    }
    return out;
  }
  if (value instanceof Date) return new Date(value.getTime());
  const obj = value as Record<string, unknown>;
  const health = rules.dropHidden && isHealthShaped(obj);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(obj)) {
    if (rules.forbidden.has(key)) continue;
    if (health && CLIENT_FORBIDDEN_HEALTH_KEYS.includes(key)) continue;
    out[key] = walk(child, rules);
  }
  return out;
}
