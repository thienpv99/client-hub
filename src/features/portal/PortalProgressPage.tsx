// /portal/progress (SPEC 5.4): one card per project (summary + milestone timeline; respects the project selector),
// approvals history beside it from lg (below on phones and iPad portrait).
import { Flag } from 'lucide-react';
import type { ActivityView, ProjectView } from '@/services/contract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { Card } from '@/components/ui/card';
import { CardSkeleton } from '@/components/common/skeletons';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { useStagger } from '@/hooks/useMotion';
import { usePortalProject, usePortalShell } from '@/hooks/usePortalProject';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { ApprovalHistory } from './ApprovalHistory';
import { ProjectTimelineCard } from './MilestoneTimeline';

export function PortalProgressPage() {
  const viewer = useViewer();
  const accountId = viewer?.account_id ?? null;
  const { projectId } = usePortalProject();
  const { account } = usePortalShell();
  const company = account?.short_name || account?.name || '';

  const projects = useQuery<ProjectView[]>(() => api.listProjects(accountId ?? ''), [accountId], {
    enabled: !!accountId,
  });
  const approvals = useQuery<ActivityView[]>(() => api.listActivities({ accountId: accountId ?? undefined, approvalsOnly: true }), [accountId], {
    enabled: !!accountId,
  });

  const shownProjects = (projects.data ?? []).filter((p) => !projectId || p.id === projectId);
  // the milestone timelines unfold on the page's first load only (not when the project selector changes)
  const rise = useStagger(!!projects.data);

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title={t('portal.progress.title')} description={t('portal.progress.description')} />
      <div className="grid gap-5 md:gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-5 md:space-y-6 lg:col-span-2">
          {projects.data ? (
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
          )}
        </div>
        <div className="min-w-0">
          {approvals.data ? (
            <ApprovalHistory items={approvals.data} company={company} />
          ) : approvals.error ? (
            <ErrorState error={approvals.error} onRetry={approvals.refetch} compact />
          ) : (
            <CardSkeleton lines={4} />
          )}
        </div>
      </div>
    </div>
  );
}
