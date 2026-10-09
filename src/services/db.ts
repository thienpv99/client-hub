// In-browser mock database: tables of plain rows, persisted to localStorage,
// with change tracking (for 5-second undo) and a change event (for UI refetch).
// Only service modules (src/services/**) may import this file. UI code must use `api`.

import type {
  Account,
  AccountPrice,
  Activity,
  AppNotification,
  Contact,
  Contract,
  DbMeta,
  EmailMessage,
  FileItem,
  ID,
  Milestone,
  PaymentSchedule,
  PriceItem,
  Project,
  ProjectTemplate,
  Quote,
  QuoteLine,
  Settings,
  Task,
  TaskComment,
  TaskDependency,
  User,
} from '@/domain/types';
import type { AccountProfile, Ecosystem, IcpProfile, Interaction, Lead, Opportunity, Segment } from '@/domain/crmTypes';
import type { AccountDepartment, CarePlan, ChangeRequest, Deployment, RelationLink, Stakeholder } from '@/domain/careTypes';
import { todayISO } from '@/domain/clock';
import { buildSeed, SEED_VERSION } from '@/data/seed';

export interface DbData {
  users: User[];
  accounts: Account[];
  contacts: Contact[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  task_dependencies: TaskDependency[];
  comments: TaskComment[];
  files: FileItem[];
  price_items: PriceItem[];
  account_prices: AccountPrice[];
  quotes: Quote[];
  quote_lines: QuoteLine[];
  contracts: Contract[];
  payment_schedules: PaymentSchedule[];
  activities: Activity[];
  notifications: AppNotification[];
  emails: EmailMessage[];
  templates: ProjectTemplate[];
  // CRM / targeting extension (internal only)
  leads: Lead[];
  account_profiles: AccountProfile[];
  opportunities: Opportunity[];
  interactions: Interaction[];
  segments: Segment[];
  icp_profiles: IcpProfile[];
  ecosystems: Ecosystem[];
  // client care refocus (SPEC-CARE §2) — deployments + CRs reach clients only through client-safe views
  deployments: Deployment[];
  account_departments: AccountDepartment[];
  stakeholders: Stakeholder[];
  relation_links: RelationLink[];
  change_requests: ChangeRequest[];
  care_plans: CarePlan[];
  settings: Settings;
  meta: DbMeta;
}

export type TableName = Exclude<keyof DbData, 'settings' | 'meta'>;
export type RowOf<T extends TableName> = DbData[T][number];

export const TABLES: TableName[] = [
  'users',
  'accounts',
  'contacts',
  'projects',
  'milestones',
  'tasks',
  'task_dependencies',
  'comments',
  'files',
  'price_items',
  'account_prices',
  'quotes',
  'quote_lines',
  'contracts',
  'payment_schedules',
  'activities',
  'notifications',
  'emails',
  'templates',
  'leads',
  'account_profiles',
  'opportunities',
  'interactions',
  'segments',
  'icp_profiles',
  'ecosystems',
  'deployments',
  'account_departments',
  'stakeholders',
  'relation_links',
  'change_requests',
  'care_plans',
];

/** Tables added after the first release: tolerated when missing in stored/seeded data (filled with []). */
const OPTIONAL_TABLES: TableName[] = [
  'leads',
  'account_profiles',
  'opportunities',
  'interactions',
  'segments',
  'icp_profiles',
  'ecosystems',
  'deployments',
  'account_departments',
  'stakeholders',
  'relation_links',
  'change_requests',
  'care_plans',
];

function withAllTables(d: DbData): DbData {
  for (const t of OPTIONAL_TABLES) if (!Array.isArray(d[t])) (d as unknown as Record<string, unknown[]>)[t] = [];
  return d;
}

interface Change {
  table: TableName | 'settings' | 'meta';
  id: ID;
  /** row before the first change in this batch (null = did not exist) */
  before: unknown | null;
}

/** Opaque record of a batch, used to undo it. */
export interface ChangeSet {
  changes: Change[];
}

const STORAGE_KEY = 'clienthub.db.v1';

let data: DbData = loadOrSeed();
let version = 0;
let batchDepth = 0;
let dirty = false;
let tracking: Map<string, Change> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
/** > 0 while self tests run on a private copy (db.isolated): no storage writes, other tabs' writes ignored */
let isolation = 0;
const listeners = new Set<() => void>();

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function loadOrSeed(): DbData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DbData;
      if (
        parsed?.meta?.seed_version === SEED_VERSION &&
        TABLES.every((t) => OPTIONAL_TABLES.includes(t) || Array.isArray(parsed[t]))
      )
        return withAllTables(parsed);
    }
  } catch {
    // storage unavailable or corrupted → reseed
  }
  return freshSeed();
}

function freshSeed(): DbData {
  const seeded = buildSeed(todayISO());
  return withAllTables({
    ...seeded,
    meta: { seed_version: SEED_VERSION, seeded_for: todayISO(), last_sweep_date: null, generation: Date.now() },
  } as DbData);
}

function generationOf(d: DbData): number {
  return d.meta?.generation ?? 0;
}

function persistNow(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  if (isolation > 0) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded / private mode — the demo keeps working in memory
  }
}

function persistSoon(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = isolation > 0 ? null : setTimeout(persistNow, 150);
}

function notifyListeners(): void {
  for (const cb of [...listeners]) {
    try {
      cb();
    } catch (err) {
      console.error('[db] listener failed', err);
    }
  }
}

function emit(): void {
  version += 1;
  persistSoon();
  notifyListeners();
}

function touched(): void {
  if (batchDepth > 0) dirty = true;
  else emit();
}

function track(table: Change['table'], id: ID, before: unknown | null): void {
  if (!tracking) return;
  const key = `${table}:${id}`;
  if (!tracking.has(key)) tracking.set(key, { table, id, before: before === null ? null : clone(before) });
}

function tableRows<T extends TableName>(table: T): RowOf<T>[] {
  return data[table] as RowOf<T>[];
}

function isLive(row: unknown): boolean {
  return !(row as { deleted_at?: string | null }).deleted_at;
}

export const db = {
  /** monotonically increasing; changes on every committed mutation */
  get version(): number {
    return version;
  },

  get settings(): Settings {
    return data.settings;
  },

  get meta(): DbMeta {
    return data.meta;
  },

  /** live rows (soft-deleted rows excluded). Treat as read-only — mutate via update(). */
  rows<T extends TableName>(table: T): RowOf<T>[] {
    return tableRows(table).filter(isLive);
  },

  /** every row including soft-deleted */
  allRows<T extends TableName>(table: T): RowOf<T>[] {
    return tableRows(table);
  },

  find<T extends TableName>(table: T, id: ID | null | undefined): RowOf<T> | undefined {
    if (!id) return undefined;
    const row = tableRows(table).find((r) => (r as { id: ID }).id === id);
    return row && isLive(row) ? row : undefined;
  },

  /** like find() but throws when missing */
  get<T extends TableName>(table: T, id: ID): RowOf<T> {
    const row = db.find(table, id);
    if (!row) throw new Error(`[db] ${table}/${id} not found`);
    return row;
  },

  insert<T extends TableName>(table: T, row: RowOf<T>): RowOf<T> {
    const id = (row as { id: ID }).id;
    track(table, id, null);
    (data[table] as RowOf<T>[]).push(row);
    touched();
    return row;
  },

  update<T extends TableName>(table: T, id: ID, patch: Partial<RowOf<T>>): RowOf<T> {
    const rows = data[table] as RowOf<T>[];
    const idx = rows.findIndex((r) => (r as { id: ID }).id === id);
    if (idx < 0) throw new Error(`[db] ${table}/${id} not found`);
    track(table, id, rows[idx]);
    const next = { ...rows[idx], ...patch } as RowOf<T>;
    rows[idx] = next;
    touched();
    return next;
  },

  softDelete<T extends TableName>(table: T, id: ID, at: string): void {
    db.update(table, id, { deleted_at: at } as unknown as Partial<RowOf<T>>);
  },

  /** physical delete — only for undo / cleanup of rows created moments ago */
  hardDelete<T extends TableName>(table: T, id: ID): void {
    const rows = data[table] as RowOf<T>[];
    const idx = rows.findIndex((r) => (r as { id: ID }).id === id);
    if (idx < 0) return;
    track(table, id, rows[idx]);
    rows.splice(idx, 1);
    touched();
  },

  updateSettings(patch: Partial<Settings>): Settings {
    track('settings', 'settings', data.settings);
    data.settings = { ...data.settings, ...patch };
    touched();
    return data.settings;
  },

  updateMeta(patch: Partial<DbMeta>): DbMeta {
    data.meta = { ...data.meta, ...patch };
    touched();
    return data.meta;
  },

  /**
   * Run several mutations as one unit: a single change event, and a ChangeSet that
   * `revert` can undo. Nested batches join the outer one.
   */
  batch<R>(fn: () => R): { result: R; changes: ChangeSet } {
    const outer = tracking === null;
    if (outer) tracking = new Map();
    batchDepth += 1;
    let result: R;
    try {
      result = fn();
    } catch (err) {
      batchDepth -= 1;
      if (outer && tracking) {
        // roll back partial writes
        const partial: ChangeSet = { changes: [...tracking.values()] };
        tracking = null;
        dirty = false;
        db.revert(partial, { silent: true });
      }
      throw err;
    }
    batchDepth -= 1;
    const changes: ChangeSet = { changes: outer && tracking ? [...tracking.values()] : [] };
    if (outer) tracking = null;
    if (batchDepth === 0 && dirty) {
      dirty = false;
      emit();
    }
    return { result, changes };
  },

  /** Undo a batch: restores every touched row to its state before the batch. */
  revert(changeSet: ChangeSet, opts: { silent?: boolean } = {}): void {
    for (const change of [...changeSet.changes].reverse()) {
      if (change.table === 'settings') {
        data.settings = clone(change.before as Settings);
        continue;
      }
      if (change.table === 'meta') continue;
      const rows = data[change.table] as { id: ID }[];
      const idx = rows.findIndex((r) => r.id === change.id);
      if (change.before === null) {
        if (idx >= 0) rows.splice(idx, 1);
      } else if (idx >= 0) {
        rows[idx] = clone(change.before) as { id: ID };
      } else {
        rows.push(clone(change.before) as { id: ID });
      }
    }
    if (!opts.silent) emit();
  },

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /**
   * Demo: discard local changes and reseed for today. Written to storage at once (not after the usual 150 ms) with a
   * new generation, so a write from another, still stale tab cannot bring the old data back.
   */
  reset(): void {
    data = freshSeed();
    persistNow();
    emit();
  },

  /** Debug helper: deep copy of everything (never send to UI code). */
  dump(): DbData {
    return clone(data);
  },

  /**
   * Self tests: run `fn` on a private in-memory copy of the data. Nothing is written to the shared localStorage key
   * meanwhile (not even a demo reset), other tabs' writes are ignored, and afterwards this tab reloads the shared
   * data — so test rows can never reach another tab or a client walkthrough, whatever the timing.
   */
  async isolated<R>(fn: () => Promise<R>): Promise<R> {
    // changes made before the run still belong to the shared data
    if (isolation === 0 && persistTimer) persistNow();
    isolation += 1;
    try {
      return await fn();
    } finally {
      isolation -= 1;
      if (isolation === 0) {
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = null;
        data = loadOrSeed();
        version += 1;
        notifyListeners();
      }
    }
  },

  /** true while a self test runs on its private copy (db.isolated) */
  get isIsolated(): boolean {
    return isolation > 0;
  },
};

// Keep several open tabs in sync (e.g. internal view in one tab, client in another).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    // a self test runs on its private copy: the shared data is reloaded when it ends
    if (isolation > 0) return;
    try {
      const next = JSON.parse(e.newValue) as DbData;
      if (next?.meta?.seed_version === SEED_VERSION) {
        // a tab that has not seen the latest reset yet wrote its old copy: keep ours and write it back
        if (generationOf(next) < generationOf(data)) {
          persistNow();
          return;
        }
        data = withAllTables(next);
        version += 1;
        for (const cb of [...listeners]) cb();
      }
    } catch {
      // ignore
    }
  });
}
