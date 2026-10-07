// "Mốc sắp tới" (DESIGN §5, right column): the next milestone of each account, soonest forecast first.
// Each row opens the account's roadmap. Late milestones carry "lùi N ngày" in danger (icon + words).
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Flag } from 'lucide-react';
import type { AccountSummary } from '@/services/contract';
import { diffDays } from '@/domain/dates';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { formatDate, formatDateShort, formatRelativeDays } from '@/lib/format';

const MAX_ROWS = 5;

type Upcoming = { account: AccountSummary; milestone: NonNullable<AccountSummary['next_milestone']> };

export function upcomingMilestones(accounts: AccountSummary[], max = MAX_ROWS): Upcoming[] {
  const list: Upcoming[] = [];
  for (const account of accounts) {
    const m = account.next_milestone;
    if (m && m.status !== 'done') list.push({ account, milestone: m });
  }
  return list
    .sort(
      (a, b) =>
        a.milestone.forecast_date.localeCompare(b.milestone.forecast_date) || a.account.name.localeCompare(b.account.name, 'vi'),
    )
    .slice(0, max);
}

function Row({ account: a, milestone: m, today }: Upcoming & { today: string }) {
  const late = m.delay_days > 0;
  const days = diffDays(m.forecast_date, today);
  return (
    <li>
      <Link
        to={`/app/accounts/${a.id}/roadmap`}
        aria-label={`${t('dashboard.upcoming.rowLabel', { milestone: m.name, account: a.name, date: formatDate(m.forecast_date) })}, ${
          late ? t('dashboard.upcoming.late', { days: m.delay_days }) : formatRelativeDays(days)
        }`}
        className="flex min-h-tap items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-subtle focus-visible:bg-subtle sm:px-5"
      >
        <AccountLogo account={a} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-table font-medium text-foreground" title={`${m.name} · ${m.project_name}`}>
            {m.name}
          </span>
          <span className="block truncate text-caption">{a.short_name || a.name}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span className="text-table font-medium tabular text-foreground" title={formatDate(m.forecast_date)}>
            {formatDateShort(m.forecast_date)}
          </span>
          {late ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-micro font-medium text-danger">
              <Clock className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
              {t('dashboard.upcoming.late', { days: m.delay_days })}
            </span>
          ) : (
            <span className="whitespace-nowrap text-micro text-muted-foreground">{formatRelativeDays(days)}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function UpcomingMilestones({ accounts, today, className }: { accounts: AccountSummary[]; today: string; className?: string }) {
  const rows = upcomingMilestones(accounts);
  return (
    <SectionCard
      className={className}
      flush
      title={t('dashboard.upcoming.title')}
      actions={
        rows.length > 0 ? (
          <Button asChild variant="ghost" size="sm" className="-mr-2 text-primary hover:text-primary">
            <Link to="/app/projects/timeline">
              {t('dashboard.upcoming.viewAll')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          compact
          icon={Flag}
          title={t('dashboard.upcoming.empty')}
          description={t('dashboard.upcoming.emptyDescription')}
        />
      ) : (
        <ul className="mt-1 divide-y divide-border/60 border-t border-border/60 pb-1">
          {rows.map((r) => (
            <Row key={r.account.id} {...r} today={today} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
