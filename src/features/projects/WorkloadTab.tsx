// "Tải việc" tab: people × weeks heat map (open tasks due each week; overdue counted in the first week) with
// open / overdue / blocked totals and the accounts each person works on. One-line summary + legend on top; table
// from 1280px, cards below. A row (or card) opens the company task list filtered on that person.
import { Link, useNavigate } from 'react-router-dom';
import { CircleAlert, Lock, Users } from 'lucide-react';
import type { AccountRef } from '@/services/contract';
import type { WorkloadView } from '@/services/crmContract';
import { api } from '@/services/api';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { TableSkeleton } from '@/components/common/skeletons';
import { UserAvatar } from '@/components/common/user-avatar';
import { MICRO_MUTED, SMALL } from '@/components/common/cx';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMediaQuery } from '@/hooks/useMedia';
import { useStagger } from '@/hooks/useMotion';
import type { RiseProps } from '@/hooks/useMotion';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { CARD_INTERACTIVE } from './PortfolioCards';
import { shouldIgnoreRowClick } from './PortfolioTable';
import { assigneeTasksHref } from './projectsModel';
import { cellLabel, HEAT_CLASSES, HEAT_LEVELS, heatLevel, sortPeople, workloadTotals, type WorkloadPerson } from './workloadModel';

const WEEKS = 6;

/** stagger: the people rise in on first appearance (the page's entry tab only) */
export function WorkloadTab({ stagger = false }: { stagger?: boolean }) {
  const viewer = useViewer();
  const wide = useMediaQuery('(min-width: 1280px)');
  const { data, loading, error, refetch } = useQuery(() => api.getWorkload({ weeks: WEEKS }), [viewer?.user.id]);
  const rise = useStagger(stagger && data !== undefined);

  if (!data) {
    if (loading) {
      return (
        <div className="space-y-4">
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-[18px] w-80 max-w-full" />
            <Skeleton className="h-3 w-96 max-w-full" />
          </div>
          <TableSkeleton rows={5} cols={8} />
        </div>
      );
    }
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  const people = sortPeople(data.people);
  if (people.length === 0) {
    return (
      <Card>
        <EmptyState icon={Users} title={t('projects.workload.empty.title')} description={t('projects.workload.empty.description')} />
      </Card>
    );
  }

  const totals = workloadTotals(people);
  const head = (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <h2 className="text-heading font-semibold tracking-tightish text-ink">
          {t(totals.overdue > 0 ? 'projects.workload.summary' : 'projects.workload.summaryNoOverdue', totals)}
        </h2>
        <p className="mt-0.5 text-caption">{t('projects.workload.explain')}</p>
      </div>
      <HeatLegend />
    </div>
  );

  if (wide) {
    return (
      <Card className="overflow-hidden">
        <div className="px-5 pb-4 pt-5">{head}</div>
        <WorkloadTable data={data} people={people} rise={rise} />
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {head}
      <WorkloadCards data={data} people={people} rise={rise} />
    </div>
  );
}

function HeatLegend() {
  return (
    <div className={cn('flex shrink-0 items-center gap-1.5', MICRO_MUTED)} aria-hidden="true">
      <span className="mr-1">{t('projects.workload.legendLess')}</span>
      {HEAT_LEVELS.map((l) => (
        <span key={l} className={cn('h-3.5 w-5 rounded', HEAT_CLASSES[l])} />
      ))}
      <span className="ml-1">{t('projects.workload.legendMore')}</span>
    </div>
  );
}

function HeatCell({ person, count, week, index, className }: { person: WorkloadPerson; count: number; week: string; index: number; className?: string }) {
  const level = heatLevel(count);
  const label = cellLabel(person.user.full_name, count, week, index, person.overdue);
  return (
    <span
      className={cn('flex h-9 items-center justify-center rounded-md text-table font-medium tabular', HEAT_CLASSES[level], className)}
      title={label}
    >
      <span aria-hidden="true">{count > 0 ? count : '–'}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function OverdueValue({ count }: { count: number }) {
  if (count <= 0) return <span className="tabular text-muted-foreground">0</span>;
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular text-danger">
      <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      {count}
      <span className="sr-only">{t('projects.workload.overdueSr')}</span>
    </span>
  );
}

function BlockedValue({ count }: { count: number }) {
  if (count <= 0) return <span className="tabular text-muted-foreground">0</span>;
  return (
    <span className="inline-flex items-center gap-1 font-medium tabular text-foreground">
      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      {count}
    </span>
  );
}

function AccountChips({ accounts, max = 3 }: { accounts: AccountRef[]; max?: number }) {
  if (accounts.length === 0) return <span className={MICRO_MUTED}>{t('projects.workload.noAccounts')}</span>;
  const shown = accounts.slice(0, max);
  const rest = accounts.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((a) => (
        <span key={a.id} className={cn('inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-muted pl-0.5 pr-2 text-muted-foreground', SMALL)}>
          <AccountLogo account={a} size="xs" className="rounded-full" />
          <span className="truncate">{a.short_name || a.name}</span>
        </span>
      ))}
      {rest > 0 ? (
        <span
          className={cn('inline-flex h-6 items-center rounded-full bg-muted px-2 tabular text-muted-foreground', SMALL)}
          title={accounts.slice(max).map((a) => a.name).join(', ')}
        >
          {t('projects.workload.moreAccounts', { count: rest })}
        </span>
      ) : null}
    </span>
  );
}

function WorkloadTable({ data, people, rise }: { data: WorkloadView; people: WorkloadPerson[]; rise: (index: number) => RiseProps }) {
  const navigate = useNavigate();
  return (
    <Table>
      <TableCaption className="sr-only">{t('projects.workload.tableCaption')}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-5">{t('projects.workload.columns.person')}</TableHead>
          {data.weeks.map((w, i) => (
            <TableHead key={w} className="h-auto w-16 px-1 py-2 text-center">
              <span className={cn('block', i === 0 ? 'text-foreground' : '')}>
                {i === 0 ? t('projects.workload.weekOfNow') : t('projects.workload.weekOf')}
              </span>
              <span className="block font-normal tabular">{formatDateShort(w)}</span>
            </TableHead>
          ))}
          <TableHead numeric>{t('projects.workload.columns.open')}</TableHead>
          <TableHead numeric>{t('projects.workload.columns.overdue')}</TableHead>
          <TableHead numeric>{t('projects.workload.columns.blocked')}</TableHead>
          <TableHead className="pr-5">{t('projects.workload.columns.accounts')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person, i) => (
          <TableRow
            key={person.user.id}
            className={cn('cursor-pointer', rise(i).className)}
            style={rise(i).style}
            onClick={(e) => {
              if (!shouldIgnoreRowClick(e)) navigate(assigneeTasksHref(person.user.id));
            }}
          >
            <TableCell className="pl-5">
              <div className="flex min-w-[12rem] items-center gap-3">
                <UserAvatar user={person.user} size="sm" />
                <div className="min-w-0">
                  <Link
                    to={assigneeTasksHref(person.user.id)}
                    className="font-semibold text-ink underline-offset-4 hover:text-primary hover:underline"
                  >
                    {person.user.full_name}
                  </Link>
                  {person.user.title ? <p className="truncate text-caption">{person.user.title}</p> : null}
                </div>
              </div>
            </TableCell>
            {data.weeks.map((w, i) => (
              <TableCell key={w} className="px-1">
                <HeatCell person={person} count={person.per_week[i] ?? 0} week={w} index={i} />
              </TableCell>
            ))}
            <TableCell className="text-right font-semibold tabular">{person.open}</TableCell>
            <TableCell className="text-right">
              <OverdueValue count={person.overdue} />
            </TableCell>
            <TableCell className="text-right">
              <BlockedValue count={person.blocked} />
            </TableCell>
            <TableCell className="pr-5">
              <div className="min-w-[10rem] max-w-[18rem]">
                <AccountChips accounts={person.accounts} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function WorkloadCards({ data, people, rise }: { data: WorkloadView; people: WorkloadPerson[]; rise: (index: number) => RiseProps }) {
  return (
    <ul className="grid gap-3 sm:gap-4 md:grid-cols-2">
      {people.map((person, i) => (
        <li key={person.user.id} className={cn('min-w-0', rise(i).className)} style={rise(i).style}>
          <Link
            to={assigneeTasksHref(person.user.id)}
            className={cn(
              CARD_INTERACTIVE,
              'flex h-full flex-col gap-4 p-4 text-table focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:p-5',
            )}
          >
            <div className="flex items-center gap-3">
              <UserAvatar user={person.user} size="md" />
              <div className="min-w-0">
                <p className="break-words text-body font-semibold text-ink">{person.user.full_name}</p>
                {person.user.title ? <p className="truncate text-caption">{person.user.title}</p> : null}
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-3">
              <div>
                <dt className={MICRO_MUTED}>{t('projects.workload.columns.open')}</dt>
                <dd className="mt-0.5 text-heading font-semibold tabular text-ink">{person.open}</dd>
              </div>
              <div>
                <dt className={MICRO_MUTED}>{t('projects.workload.columns.overdue')}</dt>
                <dd className="mt-0.5 text-heading">
                  <OverdueValue count={person.overdue} />
                </dd>
              </div>
              <div>
                <dt className={MICRO_MUTED}>{t('projects.workload.columns.blocked')}</dt>
                <dd className="mt-0.5 text-heading">
                  <BlockedValue count={person.blocked} />
                </dd>
              </div>
            </dl>

            <div>
              <p className={MICRO_MUTED}>{t('projects.workload.perWeek')}</p>
              <div className="mt-1.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, data.weeks.length)}, minmax(0, 1fr))` }}>
                {data.weeks.map((w, i) => (
                  <div key={w} className="min-w-0 text-center">
                    <span
                      className={cn('block truncate text-micro tabular', i === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                      aria-hidden="true"
                    >
                      {formatDateShort(w)}
                    </span>
                    <HeatCell person={person} count={person.per_week[i] ?? 0} week={w} index={i} className="mt-1" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto">
              <AccountChips accounts={person.accounts} max={4} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
