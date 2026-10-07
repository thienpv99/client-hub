// Client home (SPEC §5.1, DESIGN §5 "Client home"): greeting → status hero → "Việc cần anh xử lý" (the focal block)
// first; progress, New Era work, updates and the AM summary in a right column from lg (iPad landscape / desktop),
// below the tasks on phones and iPad portrait.
import { todayISO } from '@/domain/clock';
import { t } from '@/i18n';
import { formatDate, formatWeekday } from '@/lib/format';
import { api } from '@/services/api';
import type { PortalHome } from '@/services/contract';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/skeletons';
import { StatusBand } from '@/components/common/status-band';
import { useMediaQuery } from '@/hooks/useMedia';
import { usePortalProject } from '@/hooks/usePortalProject';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { HomeProgressCard } from './HomeProgressCard';
import { DelegatedCard, MyTasksSection, NewEraCard, SummaryCard, UpdatesCard, WaitingCard } from './HomeSections';
import { bandMilestone } from './homeModel';
import type { Salute } from './portalText';
import { projectSearch, saluteOf } from './portalText';

function greeting(home: PortalHome, salute: Salute): { title: string; sub: string | null } {
  const total = home.my_tasks.length;
  const week = home.week_count;
  const params = { address: salute.address, you: salute.you };
  if (week > 0) return { title: t('portal.home.greetingWeek', { ...params, count: week }), sub: null };
  if (total > 0) return { title: t('portal.home.greetingLater', { ...params, count: total }), sub: t('portal.home.greetingLaterSub') };
  return { title: t('portal.home.greetingNone', params), sub: null };
}

export function PortalHomePage() {
  const viewer = useViewer();
  const { projectId, projects } = usePortalProject();
  // phones: no date line above the greeting — the phone shows the date, and the 26px go to the focal block
  const showDate = useMediaQuery('(min-width: 640px)');
  const query = useQuery<PortalHome>(
    () => api.getPortalHome(projectId ? { projectId } : undefined),
    [projectId, viewer?.user.id, viewer?.account_id],
    { enabled: !!viewer, keepPreviousData: true },
  );
  const home = query.data;

  if (!home) {
    if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;
    return <PageSkeleton />;
  }

  const salute = saluteOf(viewer);
  // the home gathers every project; each task then carries its project tag (SPEC §5)
  const showProject = !projectId && Math.max(projects.length, home.projects.length) > 1;
  const owner = home.viewer.role === 'client_owner';
  const search = projectSearch(projectId);
  const today = todayISO();
  const { title, sub } = greeting(home, salute);

  return (
    <div className="space-y-6 md:space-y-8" aria-busy={query.refreshing || undefined}>
      <div className="space-y-4 md:space-y-5">
        <PageHeader
          eyebrow={
            showDate ? <span className="tabular">{t('portal.home.dateLine', { weekday: formatWeekday(today), date: formatDate(today) })}</span> : null
          }
          title={title}
          description={sub}
        />
        <StatusBand line={home.status_line} salutation={home.viewer.salutation} milestone={bandMilestone(home.status_line, home.progress)} />
      </div>

      {/* phones / iPad portrait: one column, ordered by `order-*`; lg: 2/3 + 1/3 columns (SPEC 5.1) */}
      <div className="flex flex-col gap-5 md:gap-6 lg:grid lg:grid-cols-3 lg:items-start">
        <div className="contents lg:col-span-2 lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <MyTasksSection
            className="order-1"
            tasks={home.my_tasks}
            showProject={showProject}
            salute={salute}
            onTrack={home.health.value === 'on_track'}
            search={search}
          />
          {owner && home.delegated_tasks.length > 0 ? (
            <DelegatedCard className="order-3" tasks={home.delegated_tasks} showProject={showProject} salute={salute} />
          ) : null}
          {home.waiting_new_era.length > 0 ? (
            <WaitingCard className="order-4" tasks={home.waiting_new_era} showProject={showProject} salute={salute} />
          ) : null}
        </div>
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
          <HomeProgressCard className="order-2" progress={home.progress} />
          <NewEraCard className="order-5" tasks={home.new_era_working} counts={home.counts} salute={salute} showProject={showProject} />
          <UpdatesCard className="order-6" items={home.updates} />
          <SummaryCard className="order-7" summary={home.account.exec_summary} am={home.am} salute={salute} />
        </div>
      </div>
    </div>
  );
}
