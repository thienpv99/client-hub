// Role-aware paths shared by the router, the login page and the menus.
import type { Viewer } from '@/services/contract';

export const LOGIN_PATH = '/login';
export const MEMBER_HOME = '/app/tasks?mine=1';

/** Where a viewer lands: client → /portal, member → own tasks, director/AM → /app. */
export function homePathFor(viewer: Viewer | null): string {
  if (!viewer) return LOGIN_PATH;
  if (viewer.org_type === 'client') return '/portal';
  return viewer.role === 'member' ? MEMBER_HOME : '/app';
}

/** `?next=` target if it is an in-app path that fits the viewer's side, else null. */
export function safeNextPath(next: string | null, viewer: Viewer): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`) || next.startsWith(`${LOGIN_PATH}/`)) return null;
  const isClient = viewer.org_type === 'client';
  if (isClient && (next === '/app' || next.startsWith('/app/') || next.startsWith('/app?'))) return null;
  if (!isClient && (next === '/portal' || next.startsWith('/portal/') || next.startsWith('/portal?'))) return null;
  return next;
}

// Leaving "Xem như khách hàng": the portal guard sends the (now internal) viewer here instead of /app,
// so the exit lands on the account it came from whatever order the router and the api settle in.
let viewAsExitTarget: string | null = null;

export function setViewAsExitTarget(path: string | null): void {
  viewAsExitTarget = path;
}

export function getViewAsExitTarget(): string | null {
  return viewAsExitTarget;
}

export function loginPathWithNext(location: { pathname: string; search: string }): string {
  const next = `${location.pathname}${location.search}`;
  if (!next || next === '/') return LOGIN_PATH;
  return `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
