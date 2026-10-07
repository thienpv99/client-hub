// Tiny i18n: every user-facing string lives in src/i18n/<lang>/<namespace>.ts.
// Usage: t('portal.home.greeting', { salutation: 'anh', name: 'Minh', count: 2 })
// Vietnamese is the only language today; add src/i18n/en/* with the same keys later.

import account from './vi/account';
import activity from './vi/activity';
import activityCommercial from './vi/activityCommercial';
import activityCrm from './vi/activityCrm';
import activityNotify from './vi/activityNotify';
import auth from './vi/auth';
import clientmap from './vi/clientmap';
import commercial from './vi/commercial';
import common from './vi/common';
import crm from './vi/crm';
import components from './vi/components';
import dashboard from './vi/dashboard';
import dev from './vi/dev';
import enums from './vi/enums';
import errors from './vi/errors';
import layout from './vi/layout';
import notify from './vi/notify';
import notifyTemplates from './vi/notifyTemplates';
import portal from './vi/portal';
import projects from './vi/projects';
import roadmap from './vi/roadmap';
import settings from './vi/settings';
import targets from './vi/targets';
import task from './vi/task';
import tasks from './vi/tasks';
import wizard from './vi/wizard';

type Dict = { [key: string]: string | Dict };

const vi: Dict = {
  account,
  // activity.* is split by owner; top-level keys (task, quote, payment, escalation…) must not collide
  activity: { ...(activity as Dict), ...(activityCommercial as Dict), ...(activityNotify as Dict), ...(activityCrm as Dict) },
  auth,
  clientmap,
  commercial,
  common,
  components,
  crm,
  dashboard,
  dev,
  enums,
  errors,
  layout,
  notify,
  notifyTemplates,
  portal,
  projects,
  roadmap,
  settings,
  targets,
  task,
  tasks,
  wizard,
} as unknown as Dict;

export const LOCALE = 'vi-VN';
export type TParams = Record<string, string | number | null | undefined>;

const warned = new Set<string>();

function lookup(key: string): string | Dict | undefined {
  let node: string | Dict | undefined = vi;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return node;
}

/** Translate a key. Missing keys return the key itself (and warn once in the console). */
export function t(key: string, params?: TParams): string {
  const value = lookup(key);
  if (typeof value !== 'string') {
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] missing key: ${key}`);
    }
    return key;
  }
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = params[name];
    return v === null || v === undefined ? match : String(v);
  });
}

/** true when the key exists (use for optional variants) */
export function hasKey(key: string): boolean {
  return typeof lookup(key) === 'string';
}

/** Capitalize the first letter (for salutations at sentence start: 'anh' → 'Anh'). */
export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
