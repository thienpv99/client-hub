// Client home (SPEC §5.1, DESIGN §5 "Client home"): greeting → status hero → "Việc cần anh xử lý" (the focal block)
// first; progress, requests to New Era, New Era work, updates and the AM summary in a right column from lg (iPad
// landscape / desktop), below the tasks on phones and iPad portrait.
import { todayISO } from '@/domain/clock';
import { t } from '@/i18n';
import { formatDate, formatWeekday } from '@/lib/format';
import { api } from '@/services/api';
import type { PortalHome } from '@/services/contract';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { StatusBand } from '@/components/common/status-band';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/useMedia';
import { usePortalProject } from '@/hooks/usePortalProject';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { HomeProgressCard } from './HomeProgressCard';
import { HomeRequestsCard } from './HomeRequestsCard';
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

/**
 * Same frame as the loaded home, phones first (DESIGN §8.9: nothing jumps when the data arrives): header group (date
 * line from sm, 16/20px to the status band) → the focal task cards (no type tile on phones, full-width primary) → on
 * lg the right column. The whole placeholder fades in as one after 120 ms (skeleton-reveal).
 */
function PortalHomeSkeleton({ twoColumns }: { twoColumns: boolean }) {
  const taskCards = (
    <div className="space-y-3">
      <Skeleton className="h-5 w-48 max-w-full" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="hidden h-9 w-9 shrink-0 rounded-lg sm:block" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={i % 2 ? 'h-5 w-2/3' : 'h-5 w-5/6'} />
              <Skeleton className="h-6 w-36 rounded-md" />
            </div>
          </div>
          <Skeleton className="mt-4 h-16 w-full rounded-lg" />
          <Skeleton className="mt-4 h-11 w-full rounded-lg sm:w-36 md:h-10" />
        </div>
      ))}
    </div>
  );
  const sideCards = (
    <div className="flex min-w-0 flex-col gap-6">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
          <Skeleton className="h-[18px] w-2/5" />
          <div className="mt-5 space-y-3">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div role="status" aria-busy="true" className="skeleton-reveal space-y-6 md:space-y-8">
      <div className="space-y-4 md:space-y-5">
        <div className="space-y-2.5">
          <Skeleton className="hidden h-3 w-40 sm:block" />
          <Skeleton className="h-7 w-80 max-w-full md:h-8" />
          {/* phones: the greeting takes two lines */}
          <Skeleton className="h-7 w-40 sm:hidden" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        {/* the status band: icon, label, a two-line sentence, the milestone chip under it */}
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3.5">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full sm:hidden" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <Skeleton className="mt-4 h-8 w-56 max-w-full rounded-lg sm:ml-[54px]" />
        </div>
      </div>
      {twoColumns ? (
        <div className="grid grid-cols-3 items-start gap-6">
          <div className="col-span-2 min-w-0">{taskCards}</div>
          {sideCards}
        </div>
      ) : (
        taskCards
      )}
      {/* last: as a first child it would take the space-y gap and push the frame 24px down */}
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
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
    return <PortalHomeSkeleton twoColumns={twoColumns} />;
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
  // SPEC-CARE §6.7: what New Era is still handling of the company's requests (+ "Gửi yêu cầu mới")
  const requests = <HomeRequestsCard projectId={projectId} salute={salute} today={today} readOnly={!!viewer?.read_only} />;
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
            {requests}
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
          {requests}
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
