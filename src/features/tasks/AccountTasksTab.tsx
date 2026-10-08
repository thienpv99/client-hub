// Account detail → tab "Việc" (SPEC §4.2): Kanban / Danh sách / Timeline (URL ?view=), filters with counts,
// "Tạo việc" for the account's managers. Data: every task of the account the api returns for this viewer.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarRange, Kanban, List, ListChecks, Plus } from 'lucide-react';
import type { AccountDetail, ProjectView } from '@/services/contract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState, SearchEmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { CardSkeleton, ListSkeleton } from '@/components/common/skeletons';
import { TaskFilterBar } from './filters/TaskFilterBar';
import {
  clearFilters,
  matchesFilters,
  NONE,
  readFilters,
  readView,
  writeFilters,
  type AccountTaskFilters,
  type TaskViewMode,
} from './filters/accountFilters';
import { KanbanBoard } from './kanban/KanbanBoard';
import { useTaskMoves } from './kanban/useTaskMoves';
import { TaskListView } from './list/TaskListView';
import { TimelineView } from './timeline/TimelineView';
import { TaskFormDialog } from './TaskFormDialog';

export interface AccountTasksTabProps {
  account: AccountDetail;
}

const VIEW_ICONS = { kanban: Kanban, list: List, timeline: CalendarRange } as const;

export function AccountTasksTab({ account }: AccountTasksTabProps) {
  const viewer = useViewer();
  const [params, setParams] = useSearchParams();
  const view = readView(params);
  const filters = useMemo(() => readFilters(params), [params]);
  const [formOpen, setFormOpen] = useState(false);

  const { data, loading, error, refetch } = useQuery(() => api.listTasks({ accountId: account.id, openOnly: false }), [account.id]);
  const moves = useTaskMoves(data);

  // managers of this account create tasks (the service enforces it; this only hides a button that would fail)
  const canManage =
    !!viewer &&
    viewer.org_type === 'internal' &&
    !viewer.read_only &&
    (viewer.role === 'director' || (viewer.role === 'am' && account.am.id === viewer.user.id));

  const all = data ?? [];
  const filtered = useMemo(() => all.filter((x) => matchesFilters(x, filters)), [all, filters]);

  const update = (patch: Partial<AccountTaskFilters> & { view?: TaskViewMode }) =>
    setParams((prev) => writeFilters(prev, patch), { replace: true });
  const clear = () => setParams((prev) => clearFilters(prev), { replace: true });

  // timeline scope: the projects / milestones the filters keep
  const scopedProjects: ProjectView[] = useMemo(() => {
    const list = filters.project ? account.projects.filter((p) => p.id === filters.project) : account.projects;
    if (!filters.milestone) return list;
    if (filters.milestone === NONE) return list.map((p) => ({ ...p, milestones: [] }));
    return list
      .filter((p) => p.milestones.some((m) => m.id === filters.milestone))
      .map((p) => ({ ...p, milestones: p.milestones.filter((m) => m.id === filters.milestone) }));
  }, [account.projects, filters.project, filters.milestone]);
  const taskLevelFilter = filters.q !== null || filters.side !== null || filters.assignee !== null || filters.flag !== null;

  const create = canManage ? (
    <Button type="button" onClick={() => setFormOpen(true)}>
      <Plus aria-hidden="true" />
      {t('tasks.create')}
    </Button>
  ) : null;

  let body: ReactNode;
  if (loading) {
    body = <ViewSkeleton view={view} />;
  } else if (error && !data) {
    body = <ErrorState error={error} onRetry={refetch} />;
  } else if (all.length === 0) {
    // the toolbar above already holds "Tạo việc" (one primary per region)
    body = (
      <Card>
        <EmptyState icon={ListChecks} title={t('tasks.empty.none')} description={canManage ? t('tasks.empty.noneHint') : undefined} />
      </Card>
    );
  } else if (filtered.length === 0) {
    body = (
      <Card>
        <SearchEmptyState entity="task" query={filters.q} onClear={clear} />
      </Card>
    );
  } else if (view === 'kanban') {
    body = <KanbanBoard tasks={filtered} moves={moves} />;
  } else if (view === 'list') {
    body = <TaskListView tasks={filtered} account={account} />;
  } else {
    body = (
      <TimelineView
        tasks={filtered}
        projects={scopedProjects}
        showEmptyMilestones={!taskLevelFilter}
        multiProject={account.projects.length > 1}
      />
    );
  }

  // Below 1280 only the active view is named (the others: icon + tooltip), so the toolbar stays one row. On phones
  // next to "Tạo việc" the switcher is icons only: "Dòng thời gian" and "Tạo việc" do not fit one 343px row, and the
  // primary action keeps its words.
  const viewLabel = create ? 'hidden xl:inline sm:[[data-state=on]>&]:inline' : 'hidden xl:inline [[data-state=on]>&]:inline';
  const actions = (
    <>
      <ToggleGroup
        type="single"
        variant="segmented"
        value={view}
        onValueChange={(v) => {
          if (v === 'kanban' || v === 'list' || v === 'timeline') update({ view: v });
        }}
        aria-label={t('tasks.views.label')}
      >
        {(['kanban', 'list', 'timeline'] as const).map((v) => {
          const Icon = VIEW_ICONS[v];
          return (
            <ToggleGroupItem key={v} value={v} aria-label={t(`tasks.views.${v}`)} title={t(`tasks.views.${v}`)}>
              <Icon aria-hidden="true" />
              <span className={viewLabel}>{t(`tasks.views.${v}`)}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      {create ? <div className="ml-auto sm:ml-0">{create}</div> : null}
    </>
  );

  return (
    <div className="space-y-4">
      {data && all.length > 0 ? (
        <TaskFilterBar
          account={account}
          tasks={all}
          filters={filters}
          shown={filtered.length}
          onChange={(patch) => update(patch)}
          onClear={clear}
          actions={actions}
        />
      ) : (
        <div className="flex w-full items-center gap-2 sm:justify-end">{actions}</div>
      )}

      {body}

      {canManage ? (
        <TaskFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          accountId={account.id}
          defaultProjectId={filters.project ?? undefined}
          defaultMilestoneId={filters.milestone && filters.milestone !== NONE ? filters.milestone : undefined}
        />
      ) : null}
    </div>
  );
}

function ViewSkeleton({ view }: { view: TaskViewMode }) {
  if (view === 'list') return <ListSkeleton rows={6} />;
  if (view === 'timeline') return <CardSkeleton lines={7} />;
  // same frame as the board: bg-subtle columns, header row, white cards
  return (
    <div role="status" aria-busy="true" className="skeleton-reveal flex gap-3 overflow-hidden xl:grid xl:grid-cols-4 xl:gap-4">
      <span className="sr-only">{t('common.loading')}</span>
      {[3, 2, 2, 3].map((n, i) => (
        <div
          key={i}
          className="w-[82vw] max-w-[300px] shrink-0 space-y-2 rounded-xl bg-subtle p-2 ring-1 ring-inset ring-border/60 md:w-[300px] xl:w-auto xl:max-w-none"
        >
          <div className="flex min-h-9 items-center gap-2 px-1.5 pb-2 pt-1">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          {Array.from({ length: n }, (_, j) => (
            <div key={j} className="space-y-2.5 rounded-lg border border-border/70 bg-card p-3 shadow-xs">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-2/3" />
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-6 w-24 rounded-md" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
