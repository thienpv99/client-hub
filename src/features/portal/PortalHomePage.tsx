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
import { bandMilestone, colleaguesWaiting } from './homeModel';
import type { Salute } from './portalText';
import { projectSearch, saluteOf, tasksTabLink } from './portalText';

/**
 * The greeting's number is always the "Việc cần anh xử lý" pill right under it (one "how many" on the first screen):
 * all due this week → "tuần này có N việc" (SPEC §5.1); only some → the total, the week figure in the subline;
 * none this week → the total "trong thời gian tới".
 */
function greeting(home: Pick<PortalHome, 'my_tasks' | 'week_count'>, salute: Salute): { title: string; sub: string | null } {
  const total = home.my_tasks.length;
  const week = Math.min(home.week_count, total);
  const params = { address: salute.address, you: salute.you };
  if (total === 0) return { title: t('portal.home.greetingNone', params), sub: null };
  if (week === total) return { title: t('portal.home.greetingWeek', { ...params, count: total }), sub: null };
  if (week > 0) {
    return { title: t('portal.home.greetingTotal', { ...params, count: total }), sub: t('portal.home.greetingWeekSub', { count: week }) };
  }
  return { title: t('portal.home.greetingLater', { ...params, count: total }), sub: t('portal.home.greetingLaterSub') };
}

export function PortalHomePage() {
  const viewer = useViewer();
  const { projectId, projects } = usePortalProject();
  // phones: no date line above the greeting — the phone shows the date, and the 26px go to the focal block
  const showDate = useMediaQuery('(min-width: 640px)');
  // lg: 2/3 + 1/3 columns; below: one column. Each layout renders its blocks in its own reading order, so the
  // keyboard / screen-reader order is the visual order (WCAG 2.4.3) — no CSS `order`.
  const twoColumns = useMediaQuery('(min-width: 1024px)');
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

  const myTasks = (
    <MyTasksSection
      tasks={home.my_tasks}
      showProject={showProject}
      salute={salute}
      onTrack={home.health.value === 'on_track'}
      search={search}
    />
  );
  const delegated =
    owner && home.delegated_tasks.length > 0 ? <DelegatedCard tasks={home.delegated_tasks} showProject={showProject} salute={salute} /> : null;
  const waiting =
    home.waiting_new_era.length > 0 ? <WaitingCard tasks={home.waiting_new_era} showProject={showProject} salute={salute} /> : null;
  const progress = <HomeProgressCard progress={home.progress} />;
  const newEra = (
    <NewEraCard
      tasks={home.new_era_working}
      counts={home.counts}
      salute={salute}
      showProject={showProject}
      // the decision maker can open every task "Đang chờ phía anh" counts, colleagues' ones included; a member
      // (no list of colleagues' tasks) is told how many of them are colleagues'
      waitingTo={owner ? tasksTabLink(projectId, 'company') : null}
      colleagues={owner ? null : colleaguesWaiting(home)}
    />
  );
  const updates = <UpdatesCard items={home.updates} />;
  const summary = <SummaryCard summary={home.account.exec_summary} am={home.am} salute={salute} />;

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

      {twoColumns ? (
        // lg (SPEC 5.1): left 2/3 = what the client must do or follow, right 1/3 = progress, New Era, updates
        <div className="grid grid-cols-3 items-start gap-6">
          <div className="col-span-2 flex min-w-0 flex-col gap-6">
            {myTasks}
            {delegated}
            {waiting}
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            {progress}
            {newEra}
            {updates}
            {summary}
          </div>
        </div>
      ) : (
        // phones / iPad portrait: the tasks first, then where the project stands, then the rest
        <div className="flex flex-col gap-5 md:gap-6">
          {myTasks}
          {progress}
          {delegated}
          {waiting}
          {newEra}
          {updates}
          {summary}
        </div>
      )}
    </div>
  );
}
