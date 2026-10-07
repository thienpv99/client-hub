// "Danh sách": a sortable table from 1280px, TaskRow cards below (internal tables become cards on iPad and phones).
// Optional grouping by milestone (project order, then "Chưa gắn mốc").
import { Fragment, useMemo, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, BellRing, EyeOff, Flag, Lock } from 'lucide-react';
import type { AccountDetail, MilestoneView, TaskView } from '@/services/contract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { blockerText } from '@/components/common/blocked-note';
import { SMALL } from '@/components/common/cx';
import { DueLabel } from '@/components/common/due-label';
import { ForecastLabel } from '@/components/common/forecast-label';
import { sideLabel } from '@/components/common/labels';
import { AssigneeAvatar, TaskRow, TaskTypeTile } from '@/components/task/TaskRow';
import { compareStatus, StatusPill } from '../shared/taskStatus';

type SortKey = 'due' | 'status' | 'side';
type SortDir = 'asc' | 'desc';

/** open work first: done tasks always sink to the end of the due / side orders (the status order puts them last) */
function compareBy(key: SortKey, dir: SortDir): (a: TaskView, b: TaskView) => number {
  const sign = dir === 'asc' ? 1 : -1;
  const doneLast = (a: TaskView, b: TaskView) => Number(a.status === 'done') - Number(b.status === 'done');
  const due = (a: TaskView, b: TaskView) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title, 'vi');
  if (key === 'status') return (a, b) => sign * compareStatus(a.status, b.status) || due(a, b);
  if (key === 'side') return (a, b) => sign * (a.side === b.side ? 0 : a.side === 'client' ? -1 : 1) || doneLast(a, b) || due(a, b);
  return (a, b) => doneLast(a, b) || sign * due(a, b);
}

interface Group {
  id: string;
  title: string;
  project: string | null;
  milestone: MilestoneView | null;
  tasks: TaskView[];
}

function groupByMilestone(tasks: TaskView[], account: AccountDetail): Group[] {
  const multiProject = account.projects.length > 1;
  const groups: Group[] = [];
  for (const p of account.projects) {
    const inProject = tasks.filter((x) => x.project_id === p.id);
    for (const m of p.milestones) {
      const list = inProject.filter((x) => x.milestone_id === m.id);
      if (list.length) groups.push({ id: m.id, title: m.name, project: multiProject ? p.name : null, milestone: m, tasks: list });
    }
    const loose = inProject.filter((x) => x.milestone_id === null || !p.milestones.some((m) => m.id === x.milestone_id));
    if (loose.length) {
      groups.push({ id: `${p.id}:none`, title: t('tasks.filters.noMilestone'), project: multiProject ? p.name : null, milestone: null, tasks: loose });
    }
  }
  // tasks of projects the account view does not list (defensive)
  const known = new Set(groups.flatMap((g) => g.tasks.map((x) => x.id)));
  const rest = tasks.filter((x) => !known.has(x.id));
  if (rest.length) groups.push({ id: 'other', title: t('tasks.filters.noMilestone'), project: null, milestone: null, tasks: rest });
  return groups;
}

export interface TaskListViewProps {
  tasks: TaskView[];
  account: AccountDetail;
}

export function TaskListView({ tasks, account }: TaskListViewProps) {
  const { open } = useTaskDrawer();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'due', dir: 'asc' });
  const [grouped, setGrouped] = useState(false);

  const sorted = useMemo(() => [...tasks].sort(compareBy(sort.key, sort.dir)), [tasks, sort]);

  const groups: Group[] = useMemo(
    () =>
      grouped
        ? groupByMilestone(sorted, account)
        : [{ id: 'all', title: '', project: null, milestone: null, tasks: sorted }],
    [grouped, sorted, account],
  );

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const sortHeader = (key: SortKey, label: string, className?: string): ReactNode => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <TableHead className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-1 hover:text-foreground"
        >
          {label}
          <Icon className={cn('h-3.5 w-3.5', active ? 'text-foreground' : 'text-caption')} aria-hidden="true" />
        </button>
      </TableHead>
    );
  };

  const rowKey = (task: TaskView) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      open(task.id);
    }
  };

  return (
    <div className="space-y-3">
      {/* list options in one row (phones too): sort (cards only — the table sorts by its headers) · group by milestone */}
      <div className="flex items-center justify-between gap-3">
        <NativeSelect
          size="sm"
          wrapperClassName="min-w-0 flex-1 sm:w-60 sm:flex-none xl:hidden"
          aria-label={t('tasks.list.sortLabel')}
          value={`${sort.key}:${sort.dir}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(':') as [SortKey, SortDir];
            setSort({ key, dir });
          }}
        >
          <option value="due:asc">{t('tasks.list.sort.dueAsc')}</option>
          <option value="due:desc">{t('tasks.list.sort.dueDesc')}</option>
          <option value="status:asc">{t('tasks.list.sort.status')}</option>
          <option value="side:asc">{t('tasks.list.sort.side')}</option>
        </NativeSelect>
        <Label className="ml-auto flex min-h-tap shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap font-medium text-muted-foreground md:min-h-9">
          <Switch checked={grouped} onCheckedChange={setGrouped} />
          {t('tasks.list.groupByMilestone')}
        </Label>
      </div>

      {/* ≥1280: table */}
      <Card className="hidden overflow-hidden xl:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('tasks.list.columns.task')}</TableHead>
              {sortHeader('side', t('tasks.list.columns.side'))}
              <TableHead>{t('tasks.list.columns.assignee')}</TableHead>
              {sortHeader('status', t('tasks.list.columns.status'))}
              {sortHeader('due', t('tasks.list.columns.due'))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <Fragment key={g.id}>
                {grouped ? (
                  <TableRow className="bg-subtle/70 hover:bg-subtle/70">
                    <TableCell colSpan={5} className="h-11 py-2">
                      <GroupHeading group={g} />
                    </TableCell>
                  </TableRow>
                ) : null}
                {g.tasks.map((task) => {
                  const done = task.status === 'done';
                  const blocker = task.blocked ? task.blocked_by[0] : undefined;
                  return (
                    <TableRow
                      key={task.id}
                      tabIndex={0}
                      onClick={() => open(task.id)}
                      onKeyDown={rowKey(task)}
                      className="cursor-pointer focus-visible:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                      <TableCell className="max-w-0 py-3">
                        <div className="flex items-center gap-3">
                          <TaskTypeTile task={task} />
                          <div className="min-w-0">
                            <p className={cn('flex items-start gap-1.5 font-medium leading-5', done ? 'text-muted-foreground' : 'text-ink')}>
                              {task.blocked ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label={t('tasks.row.blocked')} role="img" /> : null}
                              <span className="line-clamp-1" title={task.title}>
                                {task.title}
                              </span>
                            </p>
                            <p className={cn('mt-0.5 flex min-w-0 items-center gap-x-3 text-muted-foreground', SMALL)}>
                              {task.milestone ? (
                                <span className="inline-flex shrink-0 items-center gap-1">
                                  <Flag className="h-3.5 w-3.5 text-caption" aria-hidden="true" />
                                  {task.milestone.name}
                                </span>
                              ) : null}
                              {blocker ? <span className="truncate">{blockerText(blocker)}</span> : null}
                              {task.reminder_count > 0 ? (
                                <span className="inline-flex shrink-0 items-center gap-1 tabular">
                                  <BellRing className="h-3.5 w-3.5 text-caption" aria-hidden="true" />
                                  {t('tasks.row.reminded', { count: task.reminder_count })}
                                </span>
                              ) : null}
                              {task.side === 'internal' && !task.client_visible ? (
                                <span className="inline-flex shrink-0 items-center gap-1">
                                  <EyeOff className="h-3.5 w-3.5 text-caption" aria-hidden="true" />
                                  {t('tasks.row.hiddenFromClient')}
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="w-[120px] text-muted-foreground">{sideLabel(task.side)}</TableCell>
                      <TableCell className="w-52">
                        <span className="flex min-w-0 items-center gap-2">
                          <AssigneeAvatar user={task.assignee} size="sm" />
                          <span className={cn('truncate', task.assignee ? 'text-foreground' : 'text-muted-foreground')}>
                            {task.assignee?.full_name ?? t('tasks.row.unassigned')}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="w-40">
                        <StatusPill status={task.status} size="sm" />
                      </TableCell>
                      <TableCell className="w-[168px]">
                        <DueLabel due={task.due} done={done} completedAt={task.completed_at} compact />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* <1280: rows */}
      <div className="space-y-4 xl:hidden">
        {groups.map((g) => (
          <section key={g.id} aria-label={grouped ? g.title : undefined}>
            {grouped ? (
              <div className="mb-2 px-1">
                <GroupHeading group={g} />
              </div>
            ) : null}
            <Card className="divide-y divide-border/60 overflow-hidden">
              {g.tasks.map((task) => (
                <TaskRow key={task.id} task={task} hideMilestone={grouped} />
              ))}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}

function GroupHeading({ group }: { group: Group }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h3 className="inline-flex items-center gap-1.5 text-table font-semibold text-ink">
        <Flag className="h-4 w-4 text-caption" aria-hidden="true" />
        {group.title}
        {group.project ? <span className="font-normal text-muted-foreground">· {group.project}</span> : null}
      </h3>
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
        <span aria-hidden="true">{group.tasks.length}</span>
        <span className="sr-only">{t('tasks.filters.total', { count: group.tasks.length })}</span>
      </span>
      {group.milestone ? <ForecastLabel milestone={group.milestone} compact className="sm:ml-auto" /> : null}
    </div>
  );
}
