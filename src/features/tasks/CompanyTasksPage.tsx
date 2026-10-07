// /app/tasks — every open task the viewer can see (SPEC §4.4), grouped by account or by person.
// DESIGN §5 list page: header → KPI row (the focal block: where work is stuck; each tile is a filter) → toolbar
// (search, "Của tôi" + side chips, group-by switcher) → grouped list. Bulk "Nhắc khách" for overdue tasks waiting
// on the client uses the floating action bar. Members land here on ?mine=1 ("Việc của tôi").
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellRing, Building2, CheckCheck, CircleAlert, Flag, ListTodo, Search, SearchX, Users, X } from 'lucide-react';
import type { TaskView, UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AccountLogo } from '@/components/common/account-logo';
import { ChipFilter } from '@/components/common/chip-filter';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { KpiCard } from '@/components/common/kpi-card';
import { sideLabel } from '@/components/common/labels';
import { PageHeader } from '@/components/common/page-header';
import { KpiSkeleton, ListSkeleton } from '@/components/common/skeletons';
import { AssigneeAvatar } from '@/components/task/TaskRow';
import { BulkRemindBar } from './company/BulkRemindBar';
import {
  clearCompanyFilters,
  countWhere,
  hasCompanyFilters,
  isRemindEligible,
  matchesCompany,
  readCompanyFilters,
  readGroupBy,
  writeCompanyParams,
  type CompanyFilters,
  type GroupBy,
} from './company/companyFilters';
import { TaskGroupCard } from './company/TaskGroupCard';
import { useDebouncedSearch } from './filters/TaskFilterBar';

interface TaskGroup {
  key: string;
  title: string;
  subtitle?: string;
  avatar: ReactNode;
  href?: string;
  tasks: TaskView[];
  overdue: number;
}

function groupTasks(tasks: TaskView[], by: GroupBy): TaskGroup[] {
  const map = new Map<string, TaskGroup>();
  for (const task of tasks) {
    let key: string;
    let make: () => TaskGroup;
    if (by === 'account') {
      key = task.account.id;
      make = () => ({
        key,
        title: task.account.name,
        avatar: <AccountLogo account={task.account} size="sm" />,
        href: `/app/accounts/${task.account.id}/tasks`,
        tasks: [],
        overdue: 0,
      });
    } else {
      const u: UserRef | null = task.assignee;
      key = u?.id ?? '__none__';
      make = () => ({
        key,
        title: u?.full_name ?? t('tasks.filters.unassigned'),
        subtitle: u ? personSubtitle(u, task) : undefined,
        avatar: <AssigneeAvatar user={u} size="sm" />,
        tasks: [],
        overdue: 0,
      });
    }
    const g = map.get(key) ?? make();
    g.tasks.push(task);
    if (task.due.overdue) g.overdue += 1;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === '__none__') return 1;
    if (b.key === '__none__') return -1;
    return b.overdue - a.overdue || a.title.localeCompare(b.title, 'vi');
  });
}

function personSubtitle(u: UserRef, task: TaskView): string {
  const org = u.org_type === 'internal' ? sideLabel('internal') : task.account.short_name;
  return u.title ? `${org} · ${u.title}` : org;
}

/**
 * "5 chờ khách · 2 chờ New Era": split values separated by a small dot (DESIGN §4 KPI context line). In a narrow
 * tile (KpiCard is a size container; 2-up phone tiles are < 200px) the parts stack without the dot, so a dot never
 * starts a line.
 */
function Split({ parts }: { parts: string[] }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 [@container_(max-width:200px)]:flex-col [@container_(max-width:200px)]:items-start">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-x-1.5">
          {i > 0 ? (
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-border-strong [@container_(max-width:200px)]:hidden" />
          ) : null}
          {p}
        </span>
      ))}
    </span>
  );
}

/** status part of a context line: icon + word in the status colour */
function OverdueNote({ count }: { count: number }) {
  if (count === 0) return <span>{t('tasks.company.kpi.noneOverdue')}</span>;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-danger">
      <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t('tasks.company.kpi.overdueCount', { count })}
    </span>
  );
}

export function CompanyTasksPage() {
  const viewer = useViewer();
  const me = viewer?.user.id ?? null;
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readCompanyFilters(params), [params]);
  const groupBy = readGroupBy(params);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());

  const { data, loading, error, refetch } = useQuery(() => api.listTasks({ openOnly: true }), []);
  const all = useMemo(() => data ?? [], [data]);

  const update = (patch: Partial<CompanyFilters> & { group?: GroupBy }) =>
    setParams((prev) => writeCompanyParams(prev, patch), { replace: true });
  const clearAll = () => setParams((prev) => clearCompanyFilters(prev), { replace: true });

  // search box → URL (debounced), URL → search box (back button, filters cleared)
  const [query, setQuery] = useDebouncedSearch(filters.q, (q) => update({ q }));

  const filtered = useMemo(() => all.filter((x) => matchesCompany(x, filters, me)), [all, filters, me]);
  const groups = useMemo(() => groupTasks(filtered, groupBy), [filtered, groupBy]);
  const eligible = useMemo(() => filtered.filter(isRemindEligible).map((x) => x.id), [filtered]);

  // keep the selection to tasks still listed and still eligible
  useEffect(() => {
    setSelection((prev) => {
      const keep = new Set([...prev].filter((id) => eligible.includes(id)));
      return keep.size === prev.size ? prev : keep;
    });
  }, [eligible]);

  // Escape clears the selection (unless a dialog / drawer / menu handles it)
  const hasSelection = selection.size > 0;
  useEffect(() => {
    if (!hasSelection) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      setSelection(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasSelection]);

  const select = (ids: string[], on: boolean) =>
    setSelection((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  // KPI tiles = faceted counts: every other active filter applies, the tile's own group does not
  const kpi = useMemo(() => {
    const exceptFlag = all.filter((x) => matchesCompany(x, filters, me, 'flag'));
    const exceptWait = all.filter((x) => matchesCompany(x, filters, me, 'wait'));
    const overdue = exceptFlag.filter((x) => x.due.overdue);
    const blocking = exceptFlag.filter((x) => x.is_blocking_milestone);
    const waitClient = exceptWait.filter((x) => x.waiting_on === 'client');
    const waitInternal = exceptWait.filter((x) => x.waiting_on === 'internal');
    return {
      overdue: overdue.length,
      overdueClient: overdue.filter((x) => x.waiting_on === 'client').length,
      overdueInternal: overdue.filter((x) => x.waiting_on === 'internal').length,
      blocking: blocking.length,
      heldMilestones: new Set(blocking.flatMap((x) => x.blocks_milestones.map((m) => m.id))).size,
      waitClient: waitClient.length,
      waitClientOverdue: waitClient.filter((x) => x.due.overdue).length,
      waitInternal: waitInternal.length,
      waitInternalOverdue: waitInternal.filter((x) => x.due.overdue).length,
    };
  }, [all, filters, me]);

  const count = (except: keyof CompanyFilters, pred: (x: TaskView) => boolean) => countWhere(all, filters, me, except, pred);
  const active = hasCompanyFilters(filters);
  const isMember = viewer?.role === 'member';
  const allEligibleSelected = eligible.length > 0 && eligible.every((id) => selection.has(id));
  const selectedIds = [...selection];

  const title = filters.mine ? t('tasks.company.mineTitle') : t('tasks.company.title');
  const description = filters.mine ? t('tasks.company.mineDescription') : t('tasks.company.description');

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="space-y-4">
        <ListSkeleton rows={4} />
        <ListSkeleton rows={3} />
      </div>
    );
  } else if (error && !data) {
    body = (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  } else if (filtered.length === 0) {
    body = (
      <Card>
        {all.length === 0 ? (
          <EmptyState icon={CheckCheck} title={t('tasks.company.emptyAll')} description={t('tasks.company.emptyAllHint')} />
        ) : filters.mine && !filters.side && !filters.wait && !filters.flag && !filters.q.trim() ? (
          <EmptyState
            icon={CheckCheck}
            title={t('tasks.company.emptyMine')}
            description={t('tasks.company.emptyMineHint')}
            action={
              isMember ? undefined : (
                <Button type="button" variant="secondary" onClick={() => update({ mine: false })}>
                  {t('tasks.company.showEveryone')}
                </Button>
              )
            }
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title={t('tasks.empty.filtered')}
            description={t('tasks.empty.filteredHint')}
            action={
              <Button type="button" variant="secondary" onClick={clearAll}>
                {t('tasks.filters.clear')}
              </Button>
            }
          />
        )}
      </Card>
    );
  } else {
    body = (
      <div className="space-y-4">
        {groups.map((g) => (
          <TaskGroupCard
            key={g.key}
            title={g.title}
            subtitle={g.subtitle}
            avatar={g.avatar}
            href={g.href}
            tasks={g.tasks}
            showAccount={groupBy === 'assignee'}
            selection={selection}
            onSelect={select}
          />
        ))}
      </div>
    );
  }

  const toggleFlag = (flag: CompanyFilters['flag']) => update({ flag: filters.flag === flag ? null : flag });
  const toggleWait = (wait: CompanyFilters['wait']) => update({ wait: filters.wait === wait ? null : wait });

  return (
    <div className={hasSelection ? 'space-y-6 pb-24' : 'space-y-6'}>
      <PageHeader title={title} description={description} />

      {/* focal block: where work is stuck — each tile filters the list below */}
      {loading ? (
        <KpiSkeleton className="grid-cols-2 gap-3 sm:gap-4" />
      ) : data ? (
        <section aria-label={t('tasks.company.kpi.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KpiCard
            label={t('tasks.company.kpi.overdue')}
            icon={CircleAlert}
            tone={kpi.overdue > 0 ? 'danger' : 'neutral'}
            value={kpi.overdue}
            sub={
              <Split
                parts={[
                  t('tasks.company.kpi.splitClient', { count: kpi.overdueClient }),
                  t('tasks.company.kpi.splitInternal', { count: kpi.overdueInternal }),
                ]}
              />
            }
            onClick={() => toggleFlag('overdue')}
            active={filters.flag === 'overdue'}
          />
          <KpiCard
            label={t('tasks.company.kpi.blocking')}
            icon={Flag}
            value={kpi.blocking}
            sub={kpi.heldMilestones > 0 ? t('tasks.company.kpi.heldMilestones', { count: kpi.heldMilestones }) : t('tasks.company.kpi.noneHeld')}
            onClick={() => toggleFlag('blocking')}
            active={filters.flag === 'blocking'}
          />
          <KpiCard
            label={t('tasks.company.kpi.waitClient')}
            icon={Building2}
            value={kpi.waitClient}
            sub={<OverdueNote count={kpi.waitClientOverdue} />}
            onClick={() => toggleWait('client')}
            active={filters.wait === 'client'}
          />
          <KpiCard
            label={t('tasks.company.kpi.waitInternal')}
            icon={ListTodo}
            value={kpi.waitInternal}
            sub={<OverdueNote count={kpi.waitInternalOverdue} />}
            onClick={() => toggleWait('internal')}
            active={filters.wait === 'internal'}
          />
        </section>
      ) : null}

      <div className="space-y-3">
        {/* toolbar: search · chips · group-by. One row from 1024 (776px column with the sidebar open: search 240,
            icon-only switcher); below that search + switcher on one row and the chips under it (scrolling on phones) */}
        <div className="flex flex-wrap items-center gap-2 xl:gap-3">
          <Input
            type="search"
            inputSize="sm"
            icon={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tasks.company.searchPlaceholder')}
            aria-label={t('tasks.company.searchLabel')}
            wrapperClassName="order-1 min-w-0 flex-1 lg:w-[240px] lg:flex-none xl:w-[280px]"
          />
          <ToggleGroup
            type="single"
            variant="segmented"
            value={groupBy}
            onValueChange={(v) => {
              if (v === 'account' || v === 'assignee') update({ group: v });
            }}
            aria-label={t('tasks.company.groupBy')}
            className="order-2 shrink-0 lg:order-3 lg:ml-auto"
          >
            <ToggleGroupItem value="account" aria-label={t('tasks.company.byAccount')} title={t('tasks.company.byAccount')}>
              <Building2 aria-hidden="true" />
              {/* labels where the row has room for them (phones and the 1024 one-row toolbar: icons + tooltip) */}
              <span className="hidden md:inline lg:hidden xl:inline">{t('tasks.company.byAccount')}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="assignee" aria-label={t('tasks.company.byAssignee')} title={t('tasks.company.byAssignee')}>
              <Users aria-hidden="true" />
              <span className="hidden md:inline lg:hidden xl:inline">{t('tasks.company.byAssignee')}</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="no-scrollbar order-3 -mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:w-full sm:overflow-visible sm:px-0 lg:order-2 lg:w-auto xl:gap-3">
            <ChipFilter
              ariaLabel={t('tasks.company.mineFilter')}
              value={filters.mine ? 'mine' : null}
              onChange={(v) => update({ mine: v === 'mine' })}
              className={CHIP_GROUP}
              options={[{ value: 'mine', label: t('tasks.company.mine'), count: count('mine', (x) => me !== null && x.assignee?.id === me) }]}
            />
            <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
            <ChipFilter
              ariaLabel={t('tasks.filters.side')}
              value={filters.side}
              onChange={(side) => update({ side })}
              className={CHIP_GROUP}
              options={[
                { value: 'client', label: sideLabel('client'), count: count('side', (x) => x.side === 'client') },
                { value: 'internal', label: sideLabel('internal'), count: count('side', (x) => x.side === 'internal') },
              ]}
            />
          </div>
        </div>

        {data ? (
          <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-caption tabular" aria-live="polite">
              {t('tasks.company.summary', { count: filtered.length, groups: groups.length })}
            </p>
            {active ? (
              <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={clearAll}>
                <X aria-hidden="true" />
                {t('tasks.filters.clear')}
              </Button>
            ) : null}
            {eligible.length > 0 ? (
              <Button
                type="button"
                variant="soft"
                size="sm"
                className="ml-auto"
                onClick={() => select(eligible, !allEligibleSelected)}
                title={t('tasks.company.remindHint')}
              >
                <BellRing aria-hidden="true" />
                {allEligibleSelected ? (
                  t('tasks.company.unselectAll')
                ) : (
                  <>
                    <span className="sm:hidden">{t('tasks.company.selectAllOverdueShort', { count: eligible.length })}</span>
                    <span className="hidden sm:inline">{t('tasks.company.selectAllOverdue', { count: eligible.length })}</span>
                  </>
                )}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {body}

      <BulkRemindBar taskIds={selectedIds} onClear={() => setSelection(new Set())} />
    </div>
  );
}

/** a chip group inside the shared sideways-scrolling row (phones) / wrapping row (≥640px) */
const CHIP_GROUP = 'max-w-none shrink-0 overflow-visible sm:max-w-full';
