// /portal/tasks and /portal/tasks/:taskId (email deep link → opens the task drawer straight away).
// Segmented tabs: Cần xử lý (mine) · Đã giao (client_owner) · Chờ New Era · Đã xong (newest first) · Cả công ty
// (client_owner: every open task waiting on the company side = the "Đang chờ phía anh N" figure), each with a count.
import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Building2, CheckCheck, Hourglass, ListChecks, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TaskView, Viewer } from '@/services/contract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { useMediaQuery } from '@/hooks/useMedia';
import { useStagger } from '@/hooks/useMotion';
import type { RiseProps } from '@/hooks/useMotion';
import { usePortalProject, usePortalShell } from '@/hooks/usePortalProject';
import { useQuery } from '@/hooks/useQuery';
import { TASK_PARAM, useTaskDrawer } from '@/hooks/useTaskDrawer';
import { useViewer } from '@/hooks/useViewer';
import type { Salute } from './portalText';
import { saluteOf, TASKS_TAB_PARAM } from './portalText';
import { CompanyTaskList } from './CompanyTaskList';
import { DoneTaskList } from './DoneTaskList';
import { TaskCardList } from './TaskCards';
import { TasksAside } from './TasksAside';

type TabKey = 'mine' | 'delegated' | 'waiting' | 'done' | 'company';
const TAB_PARAM = TASKS_TAB_PARAM;
const ALL_TABS: TabKey[] = ['mine', 'delegated', 'waiting', 'done', 'company'];
/** tabs only the decision maker has */
const OWNER_TABS: ReadonlySet<TabKey> = new Set<TabKey>(['delegated', 'company']);

interface TaskLists {
  mine: TaskView[];
  delegated: TaskView[];
  waiting: TaskView[];
  done: TaskView[];
  company: TaskView[];
}

function byCompletedDesc(a: TaskView, b: TaskView): number {
  return (b.completed_at ?? '').localeCompare(a.completed_at ?? '') || a.title.localeCompare(b.title, 'vi');
}

async function loadLists(viewer: Viewer, projectId: string | null): Promise<TaskLists> {
  const owner = viewer.role === 'client_owner';
  const me = viewer.user.id;
  const scope = { accountId: viewer.account_id ?? undefined, projectId: projectId ?? undefined };
  const [mine, delegated, waiting, clientTasks, company] = await Promise.all([
    api.listTasks({ ...scope, mine: true }),
    owner ? api.listTasks({ ...scope, delegatedByMe: true, openOnly: false }) : Promise.resolve<TaskView[]>([]),
    api.listTasks({ ...scope, side: 'client', waitingOn: 'internal' }),
    api.listTasks({ ...scope, side: 'client', openOnly: false }),
    // what "Đang chờ phía anh N" counts (views.countsFor): open, waiting on the client, not held by an earlier task
    owner ? api.listTasks({ ...scope, side: 'client', waitingOn: 'client' }) : Promise.resolve<TaskView[]>([]),
  ]);
  // the decision maker follows every task of the company; a member follows their own (as on the home page)
  const mineOrOwner = (x: TaskView) => owner || x.assignee?.id === me || x.delegated_by?.id === me;
  return {
    mine,
    // still open first (by due date), then the ones colleagues already finished
    delegated: [
      ...delegated.filter((x) => x.status !== 'done'),
      ...delegated.filter((x) => x.status === 'done').sort(byCompletedDesc),
    ],
    waiting: waiting.filter(mineOrOwner),
    done: clientTasks.filter((x) => x.status === 'done' && mineOrOwner(x)).sort(byCompletedDesc),
    company: company.filter((x) => !x.blocked),
  };
}

function countOf(lists: TaskLists, tab: TabKey): number {
  // "Đã giao" counts what is still open; finished delegations stay listed below for reference
  return tab === 'delegated' ? lists.delegated.filter((x) => x.status !== 'done').length : lists[tab].length;
}

const EMPTY_ICONS: Record<TabKey, LucideIcon> = {
  mine: CheckCheck,
  delegated: UserPlus,
  waiting: Hourglass,
  done: ListChecks,
  company: Building2,
};

function TabEmpty({ tab, salute }: { tab: TabKey; salute: Salute }) {
  const p = { you: salute.you, You: salute.You };
  return (
    <Card>
      <EmptyState icon={EMPTY_ICONS[tab]} title={t(`portal.tasks.empty.${tab}`, p)} description={t(`portal.tasks.empty.${tab}Hint`, p)} />
    </Card>
  );
}

/**
 * Same frame as the loaded page: the tab strip (phones: underline strip; from sm: segmented control), then task cards
 * (type tile from sm, title, chips, inset, full-width action on phones). Fades in as one after 120 ms.
 */
function CardsSkeleton({ tabs }: { tabs: number }) {
  return (
    // same rhythm as the loaded page (tabs → cards 16px, 20px from md) and the strip's real size, so nothing jumps
    <div role="status" aria-busy="true" className="skeleton-reveal space-y-4 md:space-y-5">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="-mx-4 flex h-11 items-center gap-6 overflow-hidden px-4 shadow-[inset_0_-1px_0_0_rgb(var(--border))] sm:hidden">
        {Array.from({ length: Math.min(tabs, 4) }, (_, i) => (
          <Skeleton key={i} className="h-4 w-16 shrink-0" />
        ))}
      </div>
      <Skeleton className={cn('hidden h-[52px] max-w-full rounded-lg sm:block md:h-10', tabs > 3 ? 'sm:w-[600px]' : 'sm:w-[340px]')} />
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="hidden h-9 w-9 shrink-0 rounded-lg sm:block" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className={cn('h-5', i % 2 ? 'w-2/3' : 'w-5/6')} />
                <Skeleton className="h-7 w-36 rounded-md" />
              </div>
            </div>
            <Skeleton className="mt-4 h-16 w-full rounded-lg" />
            <Skeleton className="mt-4 h-11 w-full rounded-lg sm:w-36 md:h-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortalTasksPage() {
  const viewer = useViewer();
  const { taskId: routeTaskId } = useParams<{ taskId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { taskId: drawerTaskId } = useTaskDrawer();
  const { projectId, projects } = usePortalProject();
  const { account, loading: shellLoading } = usePortalShell();
  const owner = viewer?.role === 'client_owner';
  const salute = saluteOf(viewer);
  const wide = useMediaQuery('(min-width: 1024px)');
  // phones: page tabs as the underline strip (one row that scrolls, DESIGN §3/§4); from sm the segmented control
  const smUp = useMediaQuery('(min-width: 640px)');

  // Email deep link /portal/tasks/:taskId → /portal/tasks?task=:taskId: the drawer opens on top of the list (full
  // screen on phones) and closing it leaves the reader on /portal/tasks.
  useEffect(() => {
    if (!routeTaskId) return;
    const next = new URLSearchParams(location.search);
    next.set(TASK_PARAM, routeTaskId);
    navigate({ pathname: '/portal/tasks', search: `?${next.toString()}` }, { replace: true, state: { deepLinkTask: routeTaskId } });
  }, [routeTaskId, location.search, navigate]);

  const query = useQuery<TaskLists | null>(
    () => (viewer ? loadLists(viewer, projectId) : Promise.resolve(null)),
    [viewer?.user.id, viewer?.account_id, viewer?.role, projectId],
    { enabled: !!viewer && !routeTaskId, keepPreviousData: true },
  );
  const lists = query.data ?? null;
  // the open tab's cards fade up one after the other when the lists first arrive — not on a tab switch or a refetch
  const rise = useStagger(!!lists);

  const tabs = useMemo(() => ALL_TABS.filter((x) => owner || !OWNER_TABS.has(x)), [owner]);
  const requested = params.get(TAB_PARAM) as TabKey | null;
  const active: TabKey = requested && tabs.includes(requested) ? requested : 'mine';

  const setTab = (tab: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'mine') next.delete(TAB_PARAM);
        else next.set(TAB_PARAM, tab);
        return next;
      },
      { replace: true },
    );
  };

  // A deep-linked task that is not in "Cần xử lý" (already submitted, delegated or done): show the tab that holds it,
  // once, so closing the drawer lands next to the task.
  const deepLinkTask = (location.state as { deepLinkTask?: string } | null)?.deepLinkTask ?? null;
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || !deepLinkTask || !lists || requested) return;
    deepLinkHandled.current = true;
    const holder = tabs.find((tab) => lists[tab].some((x) => x.id === deepLinkTask));
    if (holder && holder !== 'mine') setTab(holder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkTask, lists, requested, tabs]);

  const showProject = !projectId && projects.length > 1;
  const company = account?.short_name || account?.name || '';

  const header = (
    <PageHeader
      title={t('portal.tasks.title')}
      description={
        !account && shellLoading ? (
          // the sentence names the company, which arrives with the shell: hold its room (2 lines of 24px on phones,
          // 1 from sm) so the tabs and the focal cards below do not move down when it lands (DESIGN §8.9)
          <div aria-hidden="true" className="flex h-12 flex-col justify-center gap-2.5 sm:h-6">
            <Skeleton className="h-3.5 w-full sm:w-[420px]" />
            <Skeleton className="h-3.5 w-1/3 sm:hidden" />
          </div>
        ) : company ? (
          t('portal.tasks.description', { company })
        ) : (
          t('portal.tasks.descriptionNoCompany')
        )
      }
    />
  );

  // lg (iPad landscape / desktop): the list keeps the home's 2/3 reading width, the counts + contact sit beside it
  const layout = (content: ReactNode) => (
    <div className="space-y-6 md:space-y-8">
      {header}
      <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="min-w-0 lg:col-span-2">{content}</div>
        {wide ? <TasksAside projectId={projectId} salute={salute} /> : null}
      </div>
    </div>
  );

  if (routeTaskId) return layout(<CardsSkeleton tabs={tabs.length} />);

  return layout(
    !lists ? (
      query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (
        <CardsSkeleton tabs={tabs.length} />
      )
    ) : (
      <Tabs value={active} onValueChange={setTab} aria-busy={query.refreshing || undefined}>
        {/* phones: the underline strip, edge to edge, one row that scrolls with a faded edge and keeps the active tab
            in view (it used to be a 3-row grid of segments above the list); from sm: the segmented control */}
        <TabsList
          variant={smUp ? 'segmented' : 'underline'}
          aria-label={t('portal.tasks.tabsLabel')}
          className={smUp ? undefined : '-mx-4 w-auto max-w-none px-4'}
        >
          {tabs.map((tab) => {
            const count = countOf(lists, tab);
            return (
              <TabsTrigger
                key={tab}
                value={tab}
                // no "0" pills: an empty tab says so itself, and a zero only adds noise to the switch
                count={count > 0 ? count : null}
                countLabel={t('portal.tasks.tabCount', { count })}
              >
                <span className="truncate">{t(`portal.tasks.tabs.${tab}`)}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="mine" className="mt-4 md:mt-5">
          {lists.mine.length ? (
            <TaskCardList tasks={lists.mine} showProject={showProject} rise={rise} />
          ) : (
            <TabEmpty tab="mine" salute={salute} />
          )}
        </TabsContent>
        {owner ? (
          <TabsContent value="delegated" className="mt-4 md:mt-5">
            {lists.delegated.length ? (
              <DelegatedTab tasks={lists.delegated} showProject={showProject} highlightId={drawerTaskId} rise={rise} />
            ) : (
              <TabEmpty tab="delegated" salute={salute} />
            )}
          </TabsContent>
        ) : null}
        <TabsContent value="waiting" className="mt-4 md:mt-5">
          {lists.waiting.length ? (
            <TaskCardList tasks={lists.waiting} variant="waiting" showProject={showProject} rise={rise} />
          ) : (
            <TabEmpty tab="waiting" salute={salute} />
          )}
        </TabsContent>
        <TabsContent value="done" className="mt-4 md:mt-5">
          {lists.done.length ? (
            <DoneTaskList tasks={lists.done} showProject={showProject} highlightId={drawerTaskId} />
          ) : (
            <TabEmpty tab="done" salute={salute} />
          )}
        </TabsContent>
        {owner && viewer ? (
          <TabsContent value="company" className="mt-4 md:mt-5">
            {lists.company.length ? (
              <CompanyTaskList
                tasks={lists.company}
                meId={viewer.user.id}
                company={company}
                salute={salute}
                showProject={showProject}
                highlightId={drawerTaskId}
              />
            ) : (
              <TabEmpty tab="company" salute={salute} />
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    ),
  );
}

function DelegatedTab({
  tasks,
  showProject,
  highlightId,
  rise,
}: {
  tasks: TaskView[];
  showProject: boolean;
  highlightId: string | null;
  rise: (index: number) => RiseProps;
}) {
  const open = tasks.filter((x) => x.status !== 'done');
  const finished = tasks.filter((x) => x.status === 'done');
  return (
    <div className="space-y-6">
      {open.length ? <TaskCardList tasks={open} variant="delegated" showProject={showProject} rise={rise} /> : null}
      {finished.length ? (
        <section className="space-y-3">
          <h2 className="text-table font-medium text-muted-foreground">{t('portal.tasks.delegatedDone')}</h2>
          <DoneTaskList
            tasks={finished}
            showProject={showProject}
            highlightId={highlightId}
            leading="assignee"
            ariaLabel={t('portal.tasks.delegatedDone')}
          />
        </section>
      ) : null}
    </div>
  );
}
