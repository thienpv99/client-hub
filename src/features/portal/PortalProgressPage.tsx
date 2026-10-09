// /portal/progress (SPEC 5.4 + SPEC-CARE §6.7): one card per project (summary + milestone timeline; respects the
// project selector) — the focal block — then "Yêu cầu của anh/chị" (status in client words, promised date, New
// Era's note; "Gửi yêu cầu mới"), "Giải pháp đang dùng" and the approvals history.
// lg (iPad landscape / desktop): left 2/3 = projects, then the solutions; right 1/3 = requests, then approvals.
// Below lg: projects → requests → solutions → approvals. Each layout renders its blocks in its own reading order
// (WCAG 2.4.3, no CSS `order`); the request sheet and its URL state live above both, so a rotation keeps them.
import { useState } from 'react';
import { Flag, Plus } from 'lucide-react';
import type { ActivityView, ProjectView } from '@/services/contract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardSkeleton } from '@/components/common/skeletons';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { useMediaQuery } from '@/hooks/useMedia';
import { useStagger } from '@/hooks/useMotion';
import { usePortalProject, usePortalShell } from '@/hooks/usePortalProject';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { ApprovalHistory } from './ApprovalHistory';
import { ProjectTimelineCard } from './MilestoneTimeline';
import { saluteOf } from './portalText';
import { RequestDetailSheet } from './RequestDetailSheet';
import { RequestFormDialog } from './RequestFormDialog';
import { RequestsSection, useClientRequests } from './RequestsSection';
import { SolutionsSection } from './SolutionsSection';

export function PortalProgressPage() {
  const viewer = useViewer();
  const accountId = viewer?.account_id ?? null;
  const { projectId, projects: projectOptions } = usePortalProject();
  const { account } = usePortalShell();
  const company = account?.short_name || account?.name || '';
  const salute = saluteOf(viewer);
  const today = todayISO();
  const readOnly = !!viewer?.read_only;
  const twoColumns = useMediaQuery('(min-width: 1024px)');
  const [formOpen, setFormOpen] = useState(false);
  const requests = useClientRequests();

  const projects = useQuery<ProjectView[]>(() => api.listProjects(accountId ?? ''), [accountId], {
    enabled: !!accountId,
  });
  const approvals = useQuery<ActivityView[]>(() => api.listActivities({ accountId: accountId ?? undefined, approvalsOnly: true }), [accountId], {
    enabled: !!accountId,
  });

  const shownProjects = (projects.data ?? []).filter((p) => !projectId || p.id === projectId);
  // the milestone timelines unfold on the page's first load only (not when the project selector changes)
  const rise = useStagger(!!projects.data);
  const projectName = projectId ? (projectOptions.find((p) => p.id === projectId)?.name ?? null) : null;
  const showProject = !projectId && projectOptions.length > 1;

  const timelines = projects.data ? (
    shownProjects.length > 0 ? (
      shownProjects.map((p) => <ProjectTimelineCard key={p.id} project={p} rise={rise} />)
    ) : (
      <Card>
        <EmptyState icon={Flag} title={t('portal.progress.noProjects')} description={t('portal.progress.noProjectsHint')} />
      </Card>
    )
  ) : projects.error ? (
    <ErrorState error={projects.error} onRetry={projects.refetch} />
  ) : (
    <CardSkeleton lines={7} />
  );

  const requestsBlock = (
    <RequestsSection
      state={requests}
      projectId={projectId}
      projectName={projectName}
      showProject={showProject}
      salute={salute}
      today={today}
      readOnly={readOnly}
      onNew={() => setFormOpen(true)}
    />
  );
  const solutionsBlock = <SolutionsSection projectId={projectId} projectName={projectName} company={company} today={today} />;
  const approvalsBlock = approvals.data ? (
    <ApprovalHistory items={approvals.data} company={company} />
  ) : approvals.error ? (
    <ErrorState error={approvals.error} onRetry={approvals.refetch} compact />
  ) : (
    <CardSkeleton lines={4} />
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title={t('portal.progress.title')}
        description={company ? t('portal.progress.descriptionCare', { company }) : t('portal.progress.description')}
        actionsInline
        actions={
          <Button
            type="button"
            onClick={() => setFormOpen(true)}
            disabled={readOnly}
            title={readOnly ? t('carePortal.requests.readOnly') : undefined}
          >
            <Plus aria-hidden="true" />
            {t('carePortal.requests.newButton')}
          </Button>
        }
      />
      {twoColumns ? (
        <div className="grid grid-cols-3 items-start gap-6">
          <div className="col-span-2 flex min-w-0 flex-col gap-6">
            {timelines}
            {solutionsBlock}
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            {requestsBlock}
            {approvalsBlock}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 md:gap-6">
          {timelines}
          {requestsBlock}
          {solutionsBlock}
          {approvalsBlock}
        </div>
      )}
      <RequestFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <RequestDetailSheet
        request={requests.sheetRequest}
        open={!!requests.selected}
        onOpenChange={(next) => {
          if (!next) requests.closeRequest();
        }}
        salute={salute}
        today={today}
      />
    </div>
  );
}
