// Session + viewer + permission helpers for the service layer.
// The viewer is who the data is filtered for. In "Xem như khách hàng" mode an internal user
// becomes a READ-ONLY client_owner of that account, so every read goes through client filtering.

import type { ID, Role, User } from '@/domain/types';
import { ApiError, type UserRef, type Viewer } from './contract';
import { db } from './db';

export interface SessionState {
  user_id: ID;
  remember: boolean;
  view_as_account_id: ID | null;
}

const SESSION_KEY = 'clienthub.session.v1';
const viewerListeners = new Set<() => void>();
let session: SessionState | null = readSession();

// Each tab keeps its own session in sessionStorage (so two tabs can be logged in as different roles).
// "Ghi nhớ thiết bị" additionally stores it in localStorage, which seeds NEW tabs / browser restarts.
function readSession(): SessionState | null {
  for (const store of [safeStorage('session'), safeStorage('local')]) {
    try {
      const raw = store?.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw) as SessionState;
    } catch {
      // ignore
    }
  }
  return null;
}

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function writeSession(next: SessionState | null): void {
  const raw = next ? JSON.stringify(next) : null;
  try {
    const tab = safeStorage('session');
    if (raw) tab?.setItem(SESSION_KEY, raw);
    else tab?.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  try {
    const device = safeStorage('local');
    // remembered sessions survive browser restarts; logging out forgets the device
    if (raw && next?.remember) device?.setItem(SESSION_KEY, raw);
    else device?.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function getSession(): SessionState | null {
  return session;
}

export function setSession(next: SessionState | null): void {
  session = next;
  writeSession(next);
  for (const cb of [...viewerListeners]) cb();
}

export function onViewerChange(cb: () => void): () => void {
  viewerListeners.add(cb);
  return () => viewerListeners.delete(cb);
}

export function toUserRef(u: User): UserRef {
  return {
    id: u.id,
    full_name: u.full_name,
    title: u.title,
    salutation: u.salutation,
    org_type: u.org_type,
    role: u.role,
    avatar_url: u.avatar_url,
    email: u.email,
    phone: u.phone,
  };
}

/** The client_owner a "Xem như khách hàng" session impersonates (first active decision maker). */
export function primaryOwnerOf(accountId: ID): User | undefined {
  const owners = db
    .rows('users')
    .filter((u) => u.account_id === accountId && u.role === 'client_owner' && u.status !== 'disabled');
  return owners.find((u) => u.status === 'active') ?? owners[0];
}

let cachedViewer: { key: string; viewer: Viewer | null } | null = null;

export function getViewer(): Viewer | null {
  const key = `${db.version}|${JSON.stringify(session)}`;
  if (cachedViewer?.key === key) return cachedViewer.viewer;
  cachedViewer = { key, viewer: buildViewer() };
  return cachedViewer.viewer;
}

function buildViewer(): Viewer | null {
  if (!session) return null;
  const real = db.find('users', session.user_id);
  if (!real || real.status === 'disabled') return null;

  const viewAs = session.view_as_account_id ? db.find('accounts', session.view_as_account_id) : undefined;
  // view-as is for the director and the account's AM only (a stale session of anyone else falls back to their own view)
  if (viewAs && real.org_type === 'internal' && (real.role === 'director' || (real.role === 'am' && viewAs.am_id === real.id))) {
    const accountId = viewAs.id;
    const account = viewAs;
    const owner = primaryOwnerOf(accountId);
    const virtual: User = owner ?? {
      id: `viewas_${accountId}`,
      full_name: account.name,
      email: `owner@${account.email_domain}`,
      phone: null,
      org_type: 'client',
      account_id: accountId,
      role: 'client_owner',
      can_view_cost: false,
      title: null,
      salutation: null,
      avatar_url: null,
      notification_pref: 'all',
      onboarded_at: '2000-01-01T00:00:00.000+07:00',
      invited_at: null,
      invited_by: null,
      last_login_at: null,
      status: 'active',
      deleted_at: null,
    };
    return {
      user: {
        ...toUserRef(virtual),
        account_id: accountId,
        notification_pref: virtual.notification_pref,
        // never show onboarding while impersonating
        onboarded_at: virtual.onboarded_at ?? '2000-01-01T00:00:00.000+07:00',
      },
      role: 'client_owner',
      org_type: 'client',
      account_id: accountId,
      can_view_cost: false,
      read_only: true,
      impersonating: { by: toUserRef(real), account_id: accountId },
      remember_device: session.remember,
    };
  }

  return {
    user: {
      ...toUserRef(real),
      account_id: real.account_id,
      notification_pref: real.notification_pref,
      onboarded_at: real.onboarded_at,
    },
    role: real.role,
    org_type: real.org_type,
    account_id: real.account_id,
    can_view_cost: real.role === 'director' || (real.role === 'am' && real.can_view_cost),
    read_only: false,
    impersonating: null,
    remember_device: session.remember,
  };
}

export function requireViewer(): Viewer {
  const v = getViewer();
  if (!v) throw new ApiError('unauthenticated', 'errors.unauthenticated');
  return v;
}

export const isInternal = (v: Viewer): boolean => v.org_type === 'internal';
export const isClient = (v: Viewer): boolean => v.org_type === 'client';
export const isDirector = (v: Viewer): boolean => v.role === 'director';
/** cost price / margin visibility (director, or AM granted by director) */
export const canSeeCost = (v: Viewer): boolean => v.org_type === 'internal' && v.can_view_cost;

/** Accounts this viewer may read. */
export function accessibleAccountIds(v: Viewer): Set<ID> {
  if (v.org_type === 'client') return new Set(v.account_id ? [v.account_id] : []);
  const accounts = db.rows('accounts');
  if (v.role === 'director') return new Set(accounts.map((a) => a.id));
  if (v.role === 'am') return new Set(accounts.filter((a) => a.am_id === v.user.id).map((a) => a.id));
  // member: accounts where they are assigned at least one task
  const projectIds = new Set(db.rows('tasks').filter((t) => t.assignee_id === v.user.id).map((t) => t.project_id));
  return new Set(db.rows('projects').filter((p) => projectIds.has(p.id)).map((p) => p.account_id));
}

/**
 * Error for a row of an account the viewer cannot read. Clients get 'not_found' — the same answer as for an
 * unknown id — so other companies' ids cannot be probed; internal users get 'forbidden'.
 */
export function noAccess(v: Viewer): ApiError {
  return v.org_type === 'client' ? new ApiError('not_found', 'errors.not_found') : new ApiError('forbidden', 'errors.forbidden');
}

export function assertAccount(v: Viewer, accountId: ID): void {
  if (!accessibleAccountIds(v).has(accountId)) throw noAccess(v);
}

/** Every mutation must call this first (blocks "Xem như khách hàng" mode). */
export function assertWritable(v: Viewer): void {
  if (v.read_only) throw new ApiError('read_only', 'errors.read_only');
}

export function assertRole(v: Viewer, roles: Role[]): void {
  if (!roles.includes(v.role)) throw new ApiError('forbidden', 'errors.forbidden');
}

export function assertInternal(v: Viewer): void {
  if (v.org_type !== 'internal') throw new ApiError('forbidden', 'errors.forbidden');
}

/** director, or the AM in charge of the account */
export function isManagerOf(v: Viewer, accountId: ID): boolean {
  if (v.org_type !== 'internal' || v.read_only) return false;
  if (v.role === 'director') return true;
  return v.role === 'am' && db.find('accounts', accountId)?.am_id === v.user.id;
}

export function assertManagerOf(v: Viewer, accountId: ID): void {
  if (!isManagerOf(v, accountId)) throw new ApiError('forbidden', 'errors.forbidden');
}

/** account id of a project / task / milestone (helpers for permission checks) */
export function accountOfProject(projectId: ID): ID {
  return db.get('projects', projectId).account_id;
}

export function accountOfTask(taskId: ID): ID {
  return accountOfProject(db.get('tasks', taskId).project_id);
}

export function accountOfMilestone(milestoneId: ID): ID {
  return accountOfProject(db.get('milestones', milestoneId).project_id);
}
