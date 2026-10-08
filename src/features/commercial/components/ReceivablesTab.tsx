// "Phải thu" tab: KPI row (total · overdue = filter · due in 30 days) + money owed per account with the next due
// installment — a table from xl, cards below (DESIGN §4).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, ChevronRight, CircleAlert, CircleCheck, Wallet } from 'lucide-react';
import type { ReceivablesView } from '@/services/contract';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { KpiCard } from '@/components/common/kpi-card';
import { Money } from '@/components/common/money';
import { KpiSkeleton, TableSkeleton } from '@/components/common/skeletons';
import { UserAvatar } from '@/components/common/user-avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { useBreakpoint } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDate, formatMoneyCompact } from '@/lib/format';
import { api } from '@/services/api';
import { dueRelative } from './ContractCard';
import { PaymentStatusBadge } from './status';

type Row = ReceivablesView['by_account'][number];

function maxOverdueDays(row: Row): number {
  return row.payments.reduce((m, p) => Math.max(m, p.overdue_days), 0);
}

function OverdueValue({ row, align = 'start' }: { row: Row; align?: 'start' | 'end' }) {
  if (row.overdue <= 0) return <span className="text-caption">{t('commercial.receivables.noOverdue')}</span>;
  // the next-due pill already says "Quá hạn N ngày" when the next installment is the overdue one
  const days = maxOverdueDays(row);
  const repeat = row.next_due?.status === 'overdue' && row.next_due.overdue_days === days;
  return (
    <span className={cn('flex flex-col', align === 'end' ? 'items-end' : 'items-start')}>
      <span className="inline-flex items-center gap-1.5 font-medium text-danger">
        <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <Money value={row.overdue} />
      </span>
      {repeat ? null : <span className="text-caption">{t('commercial.receivables.overdueFor', { days })}</span>}
    </span>
  );
}

function NextDue({ row }: { row: Row }) {
  const p = row.next_due;
  if (!p) return <span className="text-caption">—</span>;
  const rel = p.status === 'overdue' ? null : dueRelative(p);
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-foreground">{p.name}</span>
      <span className="text-caption tabular">
        {formatDate(p.due_date)}
        {rel ? ` · ${rel}` : ''}
      </span>
    </span>
  );
}

function accountHref(row: Row): string {
  return `/app/accounts/${row.account.id}/commercial`;
}

function RowsTable({ rows }: { rows: Row[] }) {
  const navigate = useNavigate();
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('commercial.receivables.col.account')}</TableHead>
            {/* both money columns right-aligned, so the amounts line up digit under digit */}
            <TableHead numeric>{t('commercial.receivables.col.total')}</TableHead>
            <TableHead numeric>{t('commercial.receivables.col.overdue')}</TableHead>
            <TableHead>{t('commercial.receivables.col.nextDue')}</TableHead>
            <TableHead>{t('commercial.receivables.col.status')}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t('commercial.receivables.open')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.account.id} className="group cursor-pointer" onClick={() => navigate(accountHref(row))}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <AccountLogo account={row.account} size="sm" />
                  <div className="min-w-0">
                    <Link
                      to={accountHref(row)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={t('commercial.receivables.openAccount', { name: row.account.name })}
                      className="block max-w-[240px] truncate font-semibold text-ink hover:text-primary"
                    >
                      {row.account.name}
                    </Link>
                    <span className="flex items-center gap-1.5 text-caption">
                      <UserAvatar user={row.am} size="xs" />
                      <span className="truncate">{row.am.full_name}</span>
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right font-semibold text-ink">
                <Money value={row.total} />
              </TableCell>
              <TableCell className="text-right">
                <OverdueValue row={row} align="end" />
              </TableCell>
              <TableCell className="max-w-[260px]">
                <NextDue row={row} />
              </TableCell>
              <TableCell>
                {row.next_due ? <PaymentStatusBadge status={row.next_due.status} overdueDays={row.next_due.overdue_days} size="sm" /> : null}
              </TableCell>
              <TableCell className="text-right">
                <ChevronRight
                  className="ml-auto h-4 w-4 text-caption opacity-60 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function RowCards({ rows }: { rows: Row[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {rows.map((row) => (
        <li key={row.account.id} className="min-w-0">
          <Card interactive asChild>
            <Link to={accountHref(row)} className="flex h-full flex-col p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <AccountLogo account={row.account} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{row.account.name}</p>
                  <p className="truncate text-caption">{t('commercial.receivables.amLine', { name: row.am.full_name })}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-caption" aria-hidden="true" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-table">
                <div>
                  <p className="text-caption">{t('commercial.receivables.col.total')}</p>
                  <Money value={row.total} className="text-title font-semibold tracking-tightish text-ink" />
                </div>
                <div>
                  <p className="text-caption">{t('commercial.receivables.col.overdue')}</p>
                  <OverdueValue row={row} />
                </div>
              </div>
              {row.next_due ? (
                <div className="mt-auto pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-t border-border/60 pt-3 text-table">
                    <div className="min-w-0">
                      <p className="text-caption">{t('commercial.receivables.col.nextDue')}</p>
                      <NextDue row={row} />
                    </div>
                    <PaymentStatusBadge status={row.next_due.status} overdueDays={row.next_due.overdue_days} size="sm" />
                  </div>
                </div>
              ) : null}
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function ReceivablesTab() {
  const breakpoint = useBreakpoint();
  const [overdueOnly, setOverdueOnly] = useState(false);
  const query = useQuery(() => api.getReceivables(), []);
  const data = query.data;

  if (query.loading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <KpiSkeleton count={3} className="grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3" itemClassName={(i) => (i === 0 ? 'col-span-2 xl:col-span-1' : undefined)} />
        <TableSkeleton rows={4} cols={5} />
      </div>
    );
  }
  if (!data) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Card>
    );
  }

  const today = todayISO();
  const all = data.by_account.flatMap((r) => r.payments);
  const overdueCount = all.filter((p) => p.status === 'overdue').length;
  const soon = all.filter((p) => p.status === 'invoiced' && diffDays(p.due_date, today) <= 30);
  const soonTotal = soon.reduce((s, p) => s + p.amount, 0);
  const rows = overdueOnly ? data.by_account.filter((r) => r.overdue > 0) : data.by_account;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <KpiCard
          className="col-span-2 xl:col-span-1"
          label={t('commercial.receivables.kpi.total')}
          value={formatMoneyCompact(data.total)}
          icon={Wallet}
          sub={t('commercial.receivables.kpi.totalSub', { accounts: data.by_account.length, payments: all.length })}
        />
        <KpiCard
          label={t('commercial.receivables.kpi.overdue')}
          value={formatMoneyCompact(data.overdue)}
          icon={data.overdue > 0 ? CircleAlert : CircleCheck}
          tone={data.overdue > 0 ? 'danger' : 'success'}
          sub={data.overdue > 0 ? t('commercial.receivables.kpi.overdueSub', { count: overdueCount }) : t('commercial.receivables.kpi.overdueNone')}
          onClick={data.overdue > 0 ? () => setOverdueOnly((v) => !v) : undefined}
          active={data.overdue > 0 ? overdueOnly : undefined}
        />
        <KpiCard
          label={t('commercial.receivables.kpi.soon')}
          value={formatMoneyCompact(soonTotal)}
          icon={CalendarClock}
          sub={t('commercial.receivables.kpi.soonSub', { count: soon.length })}
        />
      </div>

      <section aria-labelledby="receivables-by-account" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="receivables-by-account" className="text-heading font-semibold tracking-tightish text-ink">
            {t('commercial.receivables.byAccount')}
          </h2>
          <p className="text-caption" aria-live="polite">
            {overdueOnly
              ? t('commercial.receivables.resultOverdue', { count: rows.length })
              : t('commercial.receivables.result', { count: rows.length })}
          </p>
        </div>
        {rows.length === 0 ? (
          <Card>
            <EmptyState icon={CircleCheck} title={t('commercial.receivables.empty')} description={t('commercial.receivables.emptyHint')} />
          </Card>
        ) : breakpoint === 'desktop' ? (
          <RowsTable rows={rows} />
        ) : (
          <RowCards rows={rows} />
        )}
      </section>
    </div>
  );
}
