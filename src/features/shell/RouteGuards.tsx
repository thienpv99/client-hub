// Route guards (owner G1). Data-level RBAC lives in the service layer; these only route people to the right side.
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@/services/contract';
import { useViewer } from '@/hooks/useViewer';
import { getViewAsExitTarget, homePathFor, loginPathWithNext, MEMBER_HOME } from './routing';

/** /app/**: must be logged in as New Era staff (a "Xem như khách hàng" session counts as client). */
export function RequireInternal({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const location = useLocation();
  if (!viewer) return <Navigate to={loginPathWithNext(location)} replace />;
  if (viewer.org_type !== 'internal') return <Navigate to="/portal" replace />;
  return <>{children}</>;
}

/** /portal/**: must be a client user, or staff in "Xem như khách hàng" mode. */
export function RequireClient({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const location = useLocation();
  if (!viewer) return <Navigate to={loginPathWithNext(location)} replace />;
  if (viewer.org_type !== 'client') return <Navigate to={getViewAsExitTarget() ?? homePathFor(viewer)} replace />;
  return <>{children}</>;
}

/** Inside a guarded side: only the listed roles; others go to `fallback` (default: their home). */
export function RequireRole({ roles, fallback, children }: { roles: Role[]; fallback?: string; children: ReactNode }) {
  const viewer = useViewer();
  if (!viewer) return null;
  if (!roles.includes(viewer.role)) return <Navigate to={fallback ?? homePathFor(viewer)} replace />;
  return <>{children}</>;
}

/** '/' → role home */
export function RootRedirect() {
  const viewer = useViewer();
  return <Navigate to={homePathFor(viewer)} replace />;
}

/** /app index: members land on their own tasks, director/AM see the dashboard. */
export function InternalHome({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  if (viewer?.role === 'member') return <Navigate to={MEMBER_HOME} replace />;
  return <>{children}</>;
}
