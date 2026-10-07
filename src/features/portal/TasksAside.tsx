// Side column of /portal/tasks from lg (iPad landscape / desktop): how many tasks wait on each side (SPEC §1.4) and
// the New Era contact. It keeps the task cards at a readable width (same 2/3 column as the home) instead of
// stretching them across the whole canvas. Not rendered below lg — the home already shows both on phones.
import type { PortalHome } from '@/services/contract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton } from '@/components/common/skeletons';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { AmContact } from './HomeSections';
import { colleaguesWaiting } from './homeModel';
import type { Salute } from './portalText';
import { tasksTabLink } from './portalText';
import { ClientWaitingLine } from './TaskRows';

export function TasksAside({ projectId, salute }: { projectId: string | null; salute: Salute }) {
  const viewer = useViewer();
  const query = useQuery<PortalHome>(
    () => api.getPortalHome(projectId ? { projectId } : undefined),
    [projectId, viewer?.user.id, viewer?.account_id],
    { enabled: !!viewer, keepPreviousData: true },
  );
  const home = query.data;
  if (!home) {
    return query.error ? <ErrorState error={query.error} onRetry={query.refetch} compact /> : <CardSkeleton lines={2} />;
  }
  // the decision maker can open every task the company-side figure counts (tab "Cả công ty")
  const owner = home.viewer.role === 'client_owner';
  return (
    <SectionCard
      title={t('portal.tasks.aside.title')}
      description={t('portal.tasks.aside.description')}
      footer={<AmContact am={home.am} salute={salute} />}
    >
      <ClientWaitingLine
        counts={home.counts}
        you={salute.you}
        clientTo={owner ? tasksTabLink(projectId, 'company') : null}
        colleagues={owner ? null : colleaguesWaiting(home)}
      />
    </SectionCard>
  );
}
