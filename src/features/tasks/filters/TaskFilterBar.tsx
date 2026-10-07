// Toolbar of the account Tasks tab (DESIGN §5 list pages / §6): search + "Bộ lọc" popover (project, milestone,
// assignee) on the left, the caller's actions (view switcher, "Tạo việc") on the right; below it the quick chips
// (side · overdue / blocking / blocked) with faceted counts and the result count.
import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { AccountDetail, TaskView, UserRef } from '@/services/contract';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOptGroup } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChipFilter } from '@/components/common/chip-filter';
import { sideLabel } from '@/components/common/labels';
import {
  activeFilterCount,
  facetCounts,
  flagValues,
  NONE,
  POPOVER_GROUPS,
  type AccountTaskFilters,
  type FlagFilter,
} from './accountFilters';

export interface TaskFilterBarProps {
  account: AccountDetail;
  tasks: TaskView[];
  filters: AccountTaskFilters;
  shown: number;
  onChange: (patch: Partial<AccountTaskFilters>) => void;
  onClear: () => void;
  /** right side of the toolbar (view switcher, primary "Tạo việc" last) */
  actions?: ReactNode;
}

function withCount(label: string, count: number | undefined): string {
  return t('tasks.filters.optionCount', { label, count: count ?? 0 });
}

/** "Bộ lọc" button: a popover holding the less-used filters, the number of active ones on the button. */
export function FilterPopover({ active, onClear, children }: { active: number; onClear: () => void; children: ReactNode }) {
  const label = active > 0 ? t('tasks.filters.moreActive', { count: active }) : t('tasks.filters.more');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" size="sm" aria-label={label} className="min-w-11 shrink-0 px-3">
          <SlidersHorizontal aria-hidden="true" />
          <span className="hidden sm:inline">{t('tasks.filters.more')}</span>
          {active > 0 ? (
            <span
              aria-hidden="true"
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-soft px-1.5 text-micro font-semibold tabular text-primary"
            >
              {active}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-4">
        <p className="text-table font-semibold text-ink">{t('tasks.filters.moreTitle')}</p>
        <div className="grid gap-3">{children}</div>
        {active > 0 ? (
          <div className="border-t border-border/60 pt-3">
            <Button type="button" variant="link" size="sm" onClick={onClear}>
              {t('tasks.filters.clearMore')}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** search box bound to the URL with a short debounce (typing never pushes a history entry per key) */
export function useDebouncedSearch(value: string, commit: (q: string) => void): [string, (q: string) => void] {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return undefined;
    const id = window.setTimeout(() => commit(text), 250);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return [text, setText];
}

export function TaskFilterBar({ account, tasks, filters, shown, onChange, onClear, actions }: TaskFilterBarProps) {
  const id = useId();
  const active = activeFilterCount(filters);
  const popoverActive = POPOVER_GROUPS.filter((g) => filters[g] !== null).length;
  const [query, setQuery] = useDebouncedSearch(filters.q ?? '', (q) => onChange({ q: q.trim() ? q : null }));

  const sideCounts = useMemo(() => facetCounts(tasks, filters, 'side', (x) => [x.side]), [tasks, filters]);
  const flagCounts = useMemo(() => facetCounts(tasks, filters, 'flag', flagValues), [tasks, filters]);
  const projectCounts = useMemo(() => facetCounts(tasks, filters, 'project', (x) => [x.project_id]), [tasks, filters]);
  const milestoneCounts = useMemo(
    () => facetCounts(tasks, filters, 'milestone', (x) => [x.milestone_id ?? NONE]),
    [tasks, filters],
  );
  const assigneeCounts = useMemo(
    () => facetCounts(tasks, filters, 'assignee', (x) => [x.assignee?.id ?? NONE]),
    [tasks, filters],
  );

  const assignees = useMemo(() => {
    const byId = new Map<string, UserRef>();
    for (const task of tasks) if (task.assignee) byId.set(task.assignee.id, task.assignee);
    const list = [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
    return {
      internal: list.filter((u) => u.org_type === 'internal'),
      client: list.filter((u) => u.org_type === 'client'),
      hasUnassigned: tasks.some((x) => x.assignee === null),
    };
  }, [tasks]);

  const projects = account.projects;
  const milestoneProjects = filters.project ? projects.filter((p) => p.id === filters.project) : projects;
  const hasNoMilestone = tasks.some((x) => x.milestone_id === null);

  const flagOptions: { value: FlagFilter; label: string; count: number }[] = [
    { value: 'overdue', label: t('tasks.filters.overdue'), count: flagCounts.get('overdue') ?? 0 },
    { value: 'blocking', label: t('tasks.filters.blocking'), count: flagCounts.get('blocking') ?? 0 },
    { value: 'blocked', label: t('tasks.filters.blocked'), count: flagCounts.get('blocked') ?? 0 },
  ];

  const countText = active > 0 ? t('tasks.filters.showing', { shown, total: tasks.length }) : t('tasks.filters.total', { count: tasks.length });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          inputSize="sm"
          icon={<Search />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('tasks.filters.searchPlaceholder')}
          aria-label={t('tasks.filters.search')}
          wrapperClassName="min-w-0 flex-1 sm:w-[240px] sm:flex-none xl:w-[280px]"
        />
        <FilterPopover active={popoverActive} onClear={() => onChange({ project: null, milestone: null, assignee: null })}>
          {projects.length > 1 ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-project`}>{t('tasks.filters.project')}</Label>
              <NativeSelect
                id={`${id}-project`}
                size="sm"
                value={filters.project ?? ''}
                onChange={(e) => onChange({ project: e.target.value || null, milestone: null })}
              >
                <option value="">{t('tasks.filters.allProjects')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {withCount(p.name, projectCounts.get(p.id))}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-milestone`}>{t('tasks.filters.milestone')}</Label>
            <NativeSelect
              id={`${id}-milestone`}
              size="sm"
              value={filters.milestone ?? ''}
              onChange={(e) => onChange({ milestone: e.target.value || null })}
            >
              <option value="">{t('tasks.filters.allMilestones')}</option>
              {milestoneProjects.map((p) =>
                milestoneProjects.length > 1 ? (
                  <NativeSelectOptGroup key={p.id} label={p.name}>
                    {p.milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {withCount(m.name, milestoneCounts.get(m.id))}
                      </option>
                    ))}
                  </NativeSelectOptGroup>
                ) : (
                  p.milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {withCount(m.name, milestoneCounts.get(m.id))}
                    </option>
                  ))
                ),
              )}
              {hasNoMilestone ? <option value={NONE}>{withCount(t('tasks.filters.noMilestone'), milestoneCounts.get(NONE))}</option> : null}
            </NativeSelect>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-assignee`}>{t('tasks.filters.assignee')}</Label>
            <NativeSelect
              id={`${id}-assignee`}
              size="sm"
              value={filters.assignee ?? ''}
              onChange={(e) => onChange({ assignee: e.target.value || null })}
            >
              <option value="">{t('tasks.filters.allAssignees')}</option>
              {assignees.internal.length > 0 ? (
                <NativeSelectOptGroup label={sideLabel('internal')}>
                  {assignees.internal.map((u) => (
                    <option key={u.id} value={u.id}>
                      {withCount(u.full_name, assigneeCounts.get(u.id))}
                    </option>
                  ))}
                </NativeSelectOptGroup>
              ) : null}
              {assignees.client.length > 0 ? (
                <NativeSelectOptGroup label={account.short_name}>
                  {assignees.client.map((u) => (
                    <option key={u.id} value={u.id}>
                      {withCount(u.full_name, assigneeCounts.get(u.id))}
                    </option>
                  ))}
                </NativeSelectOptGroup>
              ) : null}
              {assignees.hasUnassigned ? <option value={NONE}>{withCount(t('tasks.filters.unassigned'), assigneeCounts.get(NONE))}</option> : null}
            </NativeSelect>
          </div>
        </FilterPopover>
        {actions ? <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">{actions}</div> : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* phones: one row of chips scrolling sideways inside its own box; wraps from 640px */}
        <div className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:flex-wrap sm:gap-x-3 sm:gap-y-2 sm:overflow-visible sm:px-0">
          <ChipFilter
            ariaLabel={t('tasks.filters.side')}
            value={filters.side}
            onChange={(side) => onChange({ side })}
            className="max-w-none shrink-0 overflow-visible sm:max-w-full"
            options={[
              { value: 'client', label: sideLabel('client'), count: sideCounts.get('client') ?? 0 },
              { value: 'internal', label: sideLabel('internal'), count: sideCounts.get('internal') ?? 0 },
            ]}
          />
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
          <ChipFilter
            ariaLabel={t('tasks.filters.flags')}
            value={filters.flag}
            onChange={(flag) => onChange({ flag })}
            options={flagOptions}
            className="max-w-none shrink-0 overflow-visible sm:max-w-full"
          />
        </div>

        {/* phones: the bare total would take a row of its own — the count shows once a filter narrows the list */}
        <div className={active > 0 ? 'ml-auto flex min-h-8 items-center gap-1' : 'ml-auto hidden min-h-8 items-center gap-1 sm:flex'}>
          <p className="text-caption tabular" aria-live="polite">
            {countText}
          </p>
          {active > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <X aria-hidden="true" />
              {t('tasks.filters.clear')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
