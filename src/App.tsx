// Routes (ARCHITECTURE §12). Owner G1.
import { BrowserRouter, HashRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { PortalProjectProvider } from '@/hooks/usePortalProject';
import { InternalLayout } from '@/layouts/InternalLayout';
import { ClientLayout } from '@/layouts/ClientLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { SelfTestPage } from '@/features/dev/SelfTestPage';
import { NotFoundPage } from '@/features/shell/NotFoundPage';
import { InternalHome, RequireClient, RequireInternal, RequireRole, RootRedirect } from '@/features/shell/RouteGuards';
import { SessionEffects } from '@/features/shell/SessionEffects';
import { MEMBER_HOME } from '@/features/shell/routing';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AccountsPage } from '@/features/dashboard/AccountsPage';
import { NewAccountPage } from '@/features/wizard/NewAccountPage';
import { AccountDetailPage } from '@/features/account/AccountDetailPage';
import { CompanyTasksPage } from '@/features/tasks/CompanyTasksPage';
import { CommercialPage } from '@/features/commercial/CommercialPage';
import { QuoteEditorPage } from '@/features/commercial/QuoteEditorPage';
import { PortalCommercialPage } from '@/features/commercial/PortalCommercialPage';
import { PortalQuotePage } from '@/features/commercial/PortalQuotePage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { DigestPreviewPage } from '@/features/notifications/DigestPreviewPage';
import { PortalSettingsPage } from '@/features/notifications/PortalSettingsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { PortalHomePage } from '@/features/portal/PortalHomePage';
import { PortalTasksPage } from '@/features/portal/PortalTasksPage';
import { PortalProgressPage } from '@/features/portal/PortalProgressPage';
import { PortalDocumentsPage } from '@/features/portal/PortalDocumentsPage';
import { CrmPage } from '@/features/crm/CrmPage';
import { OpportunityPage } from '@/features/crm/OpportunityPage';
import { TargetsPage } from '@/features/targets/TargetsPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { ClientMapPage } from '@/features/clientmap/ClientMapPage';
import { isFeatureOn } from '@/config/features';

/** read once: the flags are build-time switches (config/features.ts) */
const SALES_ON = isFeatureOn('sales');
const TARGETS_ON = isFeatureOn('targets');

// The single-file demo (tools/build-standalone.html) opens from file:// where only hash URLs work.
// Pages injected through an iframe srcdoc (some file previewers) live at about:srcdoc, where URLs and pushState
// throw — keep the routing in memory there.
function canUseHistory(): boolean {
  try {
    if (window.location.protocol === 'about:') return false;
    window.history.replaceState(window.history.state, '');
    return true;
  } catch {
    return false;
  }
}
const Router = !canUseHistory()
  ? MemoryRouter
  : (window as { __CH_STANDALONE__?: boolean }).__CH_STANDALONE__
    ? HashRouter
    : BrowserRouter;

export function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TooltipProvider delayDuration={250}>
        <SessionEffects />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RootRedirect />} />

          <Route
            path="/app"
            element={
              <RequireInternal>
                <InternalLayout />
              </RequireInternal>
            }
          >
            <Route
              index
              element={
                <InternalHome>
                  <DashboardPage />
                </InternalHome>
              }
            />
            <Route path="accounts" element={<AccountsPage />} />
            <Route
              path="accounts/new"
              element={
                <RequireRole roles={['director', 'am']} fallback="/app/accounts">
                  <NewAccountPage />
                </RequireRole>
              }
            />
            <Route path="accounts/:accountId/:tab?" element={<AccountDetailPage />} />
            <Route path="tasks" element={<CompanyTasksPage />} />
            <Route path="projects/:tab?" element={<ProjectsPage />} />
            <Route
              path="map"
              element={
                <RequireRole roles={['director', 'am']} fallback={MEMBER_HOME}>
                  <ClientMapPage />
                </RequireRole>
              }
            />
            {/* SPEC-CARE §1: sales and prospecting are hidden for now — every /app/crm* and /app/targets* link (old
                bookmarks, notifications) lands on the overview; the pages come back when their flag is switched on */}
            {SALES_ON ? (
              <>
                <Route
                  path="crm/opportunities/:opportunityId"
                  element={
                    <RequireRole roles={['director', 'am']} fallback={MEMBER_HOME}>
                      <OpportunityPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="crm/:tab?"
                  element={
                    <RequireRole roles={['director', 'am']} fallback={MEMBER_HOME}>
                      <CrmPage />
                    </RequireRole>
                  }
                />
              </>
            ) : (
              <Route path="crm/*" element={<Navigate to="/app" replace />} />
            )}
            {TARGETS_ON ? (
              <>
                <Route
                  path="targets/leads/:leadId"
                  element={
                    <RequireRole roles={['director', 'am']} fallback={MEMBER_HOME}>
                      <TargetsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="targets/:tab?"
                  element={
                    <RequireRole roles={['director', 'am']} fallback={MEMBER_HOME}>
                      <TargetsPage />
                    </RequireRole>
                  }
                />
              </>
            ) : (
              <Route path="targets/*" element={<Navigate to="/app" replace />} />
            )}
            <Route
              path="commercial/quotes/new"
              element={
                <RequireRole roles={['director', 'am']} fallback={MEMBER_HOME}>
                  <QuoteEditorPage />
                </RequireRole>
              }
            />
            <Route
              path="commercial/quotes/:quoteId"
              element={
                <RequireRole roles={['director', 'am']} fallback={MEMBER_HOME}>
                  <QuoteEditorPage />
                </RequireRole>
              }
            />
            <Route
              path="commercial/:tab?"
              element={
                <RequireRole roles={['director', 'am']} fallback={MEMBER_HOME}>
                  <CommercialPage />
                </RequireRole>
              }
            />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="digest" element={<DigestPreviewPage />} />
            <Route
              path="settings/:tab?"
              element={
                <RequireRole roles={['director', 'am']} fallback={MEMBER_HOME}>
                  <SettingsPage />
                </RequireRole>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route
            path="/portal"
            element={
              <RequireClient>
                <PortalProjectProvider>
                  <ClientLayout />
                </PortalProjectProvider>
              </RequireClient>
            }
          >
            <Route index element={<PortalHomePage />} />
            <Route path="tasks" element={<PortalTasksPage />} />
            <Route path="tasks/:taskId" element={<PortalTasksPage />} />
            <Route path="progress" element={<PortalProgressPage />} />
            <Route
              path="commercial"
              element={
                <RequireRole roles={['client_owner']} fallback="/portal">
                  <PortalCommercialPage />
                </RequireRole>
              }
            />
            <Route
              path="commercial/quotes/:quoteId"
              element={
                <RequireRole roles={['client_owner']} fallback="/portal">
                  <PortalQuotePage />
                </RequireRole>
              }
            />
            <Route path="documents" element={<PortalDocumentsPage />} />
            <Route path="settings" element={<PortalSettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="/dev/selftest" element={<SelfTestPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </TooltipProvider>
    </Router>
  );
}
