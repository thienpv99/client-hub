// The one object the UI talks to. Merges every service module and wraps each async method:
// (opt-in) simulated latency → call → sanitizeOutgoing (RBAC defence in depth) → JSON clone → window.__CH_NET__ log.
//
// Latency: none by default — every call still resolves asynchronously (next macrotask), so the UI code paths are the
// ones of a real network, but a click answers at once. To test loading states, opt in per tab with `?latency=600`
// (kept in sessionStorage for the rest of that tab's session; `?latency=0` clears it) or for the whole browser with
// localStorage['clienthub.latency'] = '600'. `apiInFlight()` / `onApiActivity()` report calls in flight (top
// progress bar).

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

const LATENCY_KEY = 'clienthub.latency';
const MAX_LATENCY_MS = 10_000;

function parseLatency(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const ms = Number(raw);
  return Number.isFinite(ms) && ms >= 0 ? Math.min(MAX_LATENCY_MS, Math.round(ms)) : null;
}

/** `?latency=<ms>` of the page the tab was opened on, remembered for the tab (sessionStorage) */
function readTabLatency(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromUrl = parseLatency(new URLSearchParams(window.location.search).get('latency'));
    if (fromUrl !== null) {
      if (fromUrl > 0) window.sessionStorage.setItem(LATENCY_KEY, String(fromUrl));
      else window.sessionStorage.removeItem(LATENCY_KEY);
      return fromUrl;
    }
    return parseLatency(window.sessionStorage.getItem(LATENCY_KEY));
  } catch {
    return null;
  }
}

const tabLatency = readTabLatency();

/** Simulated latency of the next call: 0 unless a tester opted in (URL / sessionStorage / localStorage). */
function latencyMs(): number {
  if (tabLatency !== null) return tabLatency;
  try {
    return typeof window === 'undefined' ? 0 : (parseLatency(window.localStorage.getItem(LATENCY_KEY)) ?? 0);
  } catch {
    return 0;
  }
}

// next macrotask without the 4 ms clamp of nested setTimeout(0) (and not throttled in background tabs)
const macrotaskQueue: Array<() => void> = [];
let macrotaskChannel: MessageChannel | null = null;

function nextMacrotask(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    if (!macrotaskChannel) {
      macrotaskChannel = new MessageChannel();
      macrotaskChannel.port1.onmessage = () => {
        const next = macrotaskQueue.shift();
        if (next) next();
      };
    }
    macrotaskQueue.push(resolve);
    macrotaskChannel.port2.postMessage(null);
  });
}

// ---- calls in flight (top progress bar) ----
let inFlight = 0;
const activityListeners = new Set<(count: number) => void>();

function setInFlight(count: number): void {
  inFlight = Math.max(0, count);
  for (const cb of [...activityListeners]) {
    try {
      cb(inFlight);
    } catch (err) {
      console.error('[api] activity listener failed', err);
    }
  }
}

/** Number of api calls currently in flight. */
export function apiInFlight(): number {
  return inFlight;
}

/**
 * Called with the in-flight count whenever a call starts or settles. Listeners run synchronously inside the call, so
 * they must only schedule work (timers, DOM writes) — never set React state directly.
 */
export function onApiActivity(cb: (count: number) => void): () => void {
  activityListeners.add(cb);
  return () => {
    activityListeners.delete(cb);
  };
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
    setInFlight(inFlight + 1);
    try {
      const delay = latencyMs();
      await (delay > 0 ? sleep(delay) : nextMacrotask());
      return await settle(method, fn, args);
    } finally {
      setInFlight(inFlight - 1);
    }
  };
}

/** call → sanitizeOutgoing → JSON clone → __CH_NET__ log (unchanged contract) */
async function settle(method: string, fn: AnyFn, args: unknown[]): Promise<unknown> {
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
