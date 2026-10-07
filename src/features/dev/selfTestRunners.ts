// Loads and runs each self-test suite. Modules are imported lazily so a missing suite never breaks the page.
import type { Viewer } from '@/services/contract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { t } from '@/i18n';

export type SuiteId = 'domain' | 'crm' | 'rbac' | 'sso' | 'seed' | 'api';

/** suites that sign in as other people (the previous session is put back afterwards) */
const SWITCHES_SESSION: ReadonlySet<SuiteId> = new Set<SuiteId>(['rbac', 'sso', 'api']);

export interface CheckRow {
  suite?: string;
  name: string;
  ok: boolean;
  detail?: string;
}

export interface SuiteOutcome {
  rows: CheckRow[];
  ms: number;
  /** the suite could not be loaded or threw */
  error: string | null;
  /** rbac only: whether the previous session was put back */
  sessionRestored?: boolean;
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

/** Accepts TestResult[] and the other shapes a check function may reasonably return. */
export function normalizeResults(raw: unknown): CheckRow[] {
  if (Array.isArray(raw)) {
    return raw.map((item, i): CheckRow => {
      if (typeof item === 'string') return { name: item, ok: false };
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const ok =
          typeof o.ok === 'boolean'
            ? o.ok
            : typeof o.pass === 'boolean'
              ? o.pass
              : typeof o.passed === 'boolean'
                ? o.passed
                : !('error' in o);
        const name = str(o.name) ?? str(o.check) ?? str(o.title) ?? str(o.message) ?? `#${i + 1}`;
        const detailRaw = str(o.detail) ?? str(o.details) ?? str(o.error) ?? (str(o.message) !== name ? str(o.message) : undefined);
        return { suite: str(o.suite), name, ok, detail: detailRaw };
      }
      return { name: String(item), ok: false };
    });
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const key of ['results', 'checks', 'tests']) {
      if (Array.isArray(o[key])) return normalizeResults(o[key]);
    }
    for (const key of ['problems', 'errors', 'failures', 'issues']) {
      const list = o[key];
      if (Array.isArray(list)) {
        return list.map((p): CheckRow => (typeof p === 'string' ? { name: p, ok: false } : { name: JSON.stringify(p), ok: false }));
      }
    }
    if (typeof o.ok === 'boolean') return [{ name: str(o.name) ?? str(o.message) ?? 'ok', ok: o.ok, detail: str(o.detail) }];
  }
  if (typeof raw === 'boolean') return [{ name: 'ok', ok: raw }];
  return [];
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function sameSession(a: Viewer | null, b: Viewer | null): boolean {
  return (
    (a?.user.id ?? null) === (b?.user.id ?? null) &&
    (a?.impersonating?.account_id ?? null) === (b?.impersonating?.account_id ?? null)
  );
}

/** Put back the session that was active before the RBAC suite logged in as other roles. */
async function restoreSession(before: Viewer | null): Promise<boolean> {
  if (sameSession(before, api.getViewer())) return true;
  try {
    if (!before) {
      await api.logout();
      return api.getViewer() === null;
    }
    if (before.impersonating) {
      await api.loginDemo(before.impersonating.by.role);
      await api.startViewAsClient(before.impersonating.account_id);
    } else {
      await api.loginDemo(before.role);
    }
    return sameSession(before, api.getViewer());
  } catch (err) {
    console.warn('[selftest] session restore failed', err);
    return false;
  }
}

async function load(id: SuiteId): Promise<unknown> {
  switch (id) {
    case 'domain': {
      const m = await import('@/dev/domainTests');
      return m.runDomainTests();
    }
    case 'crm': {
      // pure CRM / client-map checks + the AM scoping of the client map on the current demo data (read only)
      const m = await import('@/dev/crmTests');
      return m.runCrmTests();
    }
    case 'rbac': {
      const m = await import('@/dev/rbacTests');
      return await m.runRbacTests();
    }
    case 'sso': {
      // Google ID-token checks with a generated test key + loginWithGoogle on a private copy of the db
      const m = await import('@/dev/ssoTests');
      return await m.runSsoTests();
    }
    case 'seed': {
      // checkSeed(data, today) returns the list of problems; [] = everything holds
      const [seed, checks] = await Promise.all([import('@/data/seed'), import('@/data/seedChecks')]);
      const today = todayISO();
      const problems: unknown = checks.checkSeed(seed.buildSeed(today), today);
      if (Array.isArray(problems) && problems.length === 0) return [{ name: t('dev.seedAllGood'), ok: true }];
      return Array.isArray(problems) ? problems.map((p) => ({ name: String(p), ok: false })) : problems;
    }
    case 'api': {
      // every read method as every demo role + the demo scenario checks, on a private copy of the db (db.isolated)
      const m = await import('@/dev/apiSmoke');
      return await m.runApiSmoke();
    }
    default: {
      const never: never = id;
      throw new Error(`unknown suite ${String(never)}`);
    }
  }
}

export async function runSuite(id: SuiteId): Promise<SuiteOutcome> {
  const start = performance.now();
  const before = SWITCHES_SESSION.has(id) ? api.getViewer() : null;
  let rows: CheckRow[] = [];
  let error: string | null = null;
  try {
    rows = normalizeResults(await load(id));
  } catch (err) {
    console.error(`[selftest] ${id} failed`, err);
    error = errorText(err);
  }
  const outcome: SuiteOutcome = { rows, ms: Math.round(performance.now() - start), error };
  if (SWITCHES_SESSION.has(id)) outcome.sessionRestored = await restoreSession(before);
  return outcome;
}
