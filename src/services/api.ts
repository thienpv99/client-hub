// The one object the UI talks to. Merges every service module and wraps each async method:
// simulated latency → call → sanitizeOutgoing (RBAC defence in depth) → JSON clone → window.__CH_NET__ log.

import type { Role } from '@/domain/types';
import { ApiError, type Api } from '@/services/contract';
import type { CrmApi } from '@/services/crmContract';
import { nowISO } from '@/domain/clock';
import { sleep } from '@/lib/utils';
import { getViewer, onViewerChange } from '@/services/context';
import { db } from '@/services/db';
import { sanitizeOutgoing } from '@/services/sanitize';
import { accountsApi } from '@/services/api/accounts';
import { clientMapApi } from '@/services/api/clientMap';
import { commercialApi } from '@/services/api/commercial';
import { crmApi } from '@/services/api/crm';
import { filesApi } from '@/services/api/files';
import { notifyApi } from '@/services/api/notify';
import { projectsApi } from '@/services/api/projects';
import { readsApi } from '@/services/api/reads';
import { roadmapApi } from '@/services/api/roadmap';
import { sessionApi } from '@/services/api/session';
import { settingsApi } from '@/services/api/settings';
import { tasksApi } from '@/services/api/tasks';

export interface NetLogEntry {
  method: string;
  role: Role | null;
  at: string;
  /** exactly what the UI received (after sanitize + JSON round-trip) */
  payload: unknown;
  /** ApiError code when the call failed */
  error?: string;
}

declare global {
  interface Window {
    __CH_NET__?: NetLogEntry[];
  }
}

const NET_LOG_LIMIT = 300;
const SYNC_METHODS: ReadonlySet<string> = new Set<keyof Api>(['getViewer', 'onViewerChange', 'onDataChange', 'listDemoLogins']);

let callCount = 0;

/** 80–220 ms, varied deterministically by a call counter */
function latencyMs(): number {
  callCount += 1;
  return 80 + ((callCount * 53) % 141);
}

function record(entry: NetLogEntry): void {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(window.__CH_NET__)) window.__CH_NET__ = [];
  const log = window.__CH_NET__;
  log.push(entry);
  if (log.length > NET_LOG_LIMIT) log.splice(0, log.length - NET_LOG_LIMIT);
}

type AnyFn = (...args: unknown[]) => unknown;

function wrapAsync(method: string, fn: AnyFn): AnyFn {
  return async (...args: unknown[]): Promise<unknown> => {
    await sleep(latencyMs());
    try {
      const result = await fn(...args);
      const viewer = getViewer();
      const clean = sanitizeOutgoing(result, viewer);
      const payload: unknown = clean === undefined ? undefined : JSON.parse(JSON.stringify(clean));
      record({ method, role: viewer ? viewer.role : null, at: nowISO(), payload });
      return payload;
    } catch (err) {
      const viewer = getViewer();
      const role = viewer ? viewer.role : null;
      if (err instanceof ApiError) {
        record({ method, role, at: nowISO(), payload: null, error: err.code });
        throw err;
      }
      console.error(`[api] ${method} failed`, err);
      record({ method, role, at: nowISO(), payload: null, error: 'unexpected' });
      throw new ApiError('conflict', 'errors.unexpected');
    }
  };
}

const modules: Record<string, object> = {
  sessionApi,
  readsApi,
  tasksApi,
  roadmapApi,
  accountsApi,
  filesApi,
  settingsApi,
  commercialApi,
  notifyApi,
  crmApi,
  projectsApi,
  clientMapApi,
};

/** dev guard: every Api method must come from exactly one module */
function checkModules(): void {
  const owner = new Map<string, string>();
  for (const [name, mod] of Object.entries(modules)) {
    for (const key of Object.keys(mod)) {
      const prev = owner.get(key);
      if (prev) console.error(`[api] method "${key}" is defined by both ${prev} and ${name}`);
      else owner.set(key, name);
    }
  }
}

/** the core contract (contract.ts) + the CRM / targeting / project-portfolio extension (crmContract.ts) */
export type FullApi = Api & CrmApi;

const impl: FullApi = {
  getViewer,
  onViewerChange,
  onDataChange: (cb: () => void) => db.subscribe(cb),
  ...sessionApi,
  ...readsApi,
  ...tasksApi,
  ...roadmapApi,
  ...accountsApi,
  ...filesApi,
  ...settingsApi,
  ...commercialApi,
  ...notifyApi,
  ...crmApi,
  ...projectsApi,
  ...clientMapApi,
};

function buildApi(source: FullApi): FullApi {
  checkModules();
  const out: Record<string, unknown> = {};
  for (const [name, member] of Object.entries(source as unknown as Record<string, unknown>)) {
    if (typeof member !== 'function') continue;
    out[name] = SYNC_METHODS.has(name) ? member : wrapAsync(name, member as AnyFn);
  }
  return out as unknown as FullApi;
}

export const api: Api & CrmApi = buildApi(impl);
