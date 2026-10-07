// One group of the company-wide task list (an account or a person): a card whose header (logo / avatar, name,
// counts, overdue pill) collapses it, with a group checkbox for the tasks eligible for "Nhắc khách"; then TaskRows
// separated by hairlines (DESIGN §4 lists inside cards).
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, CircleAlert } from 'lucide-react';
import type { TaskView } from '@/services/contract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskRow } from '@/components/task/TaskRow';
import { isRemindEligible } from './companyFilters';

export interface TaskGroupCardProps {
  title: string;
  subtitle?: string;
  avatar: ReactNode;
  tasks: TaskView[];
  /** link to the account's Tasks tab (account groups) */
  href?: string;
  showAccount: boolean;
  selection: ReadonlySet<string>;
  onSelect: (ids: string[], selected: boolean) => void;
}

export function TaskGroupCard({ title, subtitle, avatar, tasks, href, showAccount, selection, onSelect }: TaskGroupCardProps) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const overdue = tasks.filter((x) => x.due.overdue).length;
  const eligible = tasks.filter(isRemindEligible).map((x) => x.id);
  const chosen = eligible.filter((id) => selection.has(id)).length;
  const groupState: boolean | 'indeterminate' = chosen === 0 ? false : chosen === eligible.length ? true : 'indeterminate';

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-card" aria-label={title}>
      <header className={cn('flex items-center gap-3 px-4 py-3 sm:px-5', open && 'border-b border-border/60')}>
        {eligible.length > 0 ? (
          <Checkbox
            checked={groupState}
            onCheckedChange={() => onSelect(eligible, groupState !== true)}
            aria-label={t('tasks.company.selectGroup', { group: title, count: eligible.length })}
          />
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="touch-tap flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
        >
          {avatar}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-heading font-semibold tracking-tightish text-ink">{title}</span>
            <span className="flex min-w-0 items-center gap-x-1.5 text-micro text-muted-foreground tabular">
              {subtitle ? (
                <>
                  <span className="truncate">{subtitle}</span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <span className="shrink-0">{t('tasks.filters.total', { count: tasks.length })}</span>
              {overdue > 0 ? (
                // phones: the count joins the subline so the name keeps the row's width
                <span className="inline-flex shrink-0 items-center gap-1 font-medium text-danger sm:hidden">
                  <span aria-hidden="true" className="text-muted-foreground">
                    ·
                  </span>
                  <CircleAlert className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
                  {t('tasks.company.overdueCount', { count: overdue })}
                </span>
              ) : null}
            </span>
          </span>
          {overdue > 0 ? (
            <span className="hidden h-6 shrink-0 items-center gap-1 rounded-full bg-danger-soft px-2 text-micro font-medium tabular text-danger sm:inline-flex">
              <CircleAlert className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
              {t('tasks.company.overdueCount', { count: overdue })}
            </span>
          ) : null}
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-caption transition-transform duration-150 ease-out-quart', !open && '-rotate-90')}
            aria-hidden="true"
          />
        </button>
        {href ? (
          <Link
            to={href}
            className="touch-tap-square -mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('tasks.company.openAccount', { account: title })}
            title={t('tasks.company.openAccount', { account: title })}
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      {open ? (
        <div id={bodyId} className="divide-y divide-border/60">
          {tasks.map((task) => {
            const can = isRemindEligible(task);
            return (
              <TaskRow
                key={task.id}
                task={task}
                showAccount={showAccount}
                hideAssignee={showAccount}
                selectable={can}
                reserveSelectSpace={eligible.length > 0}
                selected={selection.has(task.id)}
                onSelectedChange={(v) => onSelect([task.id], v)}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
