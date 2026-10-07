// Small display pieces shared by the portfolio table (≥1280) and the portfolio cards (<1280).
import { CircleAlert } from 'lucide-react';
import type { AccountSummary, UserRef, WaitingCounts } from '@/services/contract';
import { ForecastLabel } from '@/components/common/forecast-label';
import { Money } from '@/components/common/money';
import { UserAvatar } from '@/components/common/user-avatar';
import { SMALL } from '@/components/common/cx';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { shortPersonName } from '../portfolioModel';
import { DotList } from './DotList';

/** "Chiến lược · Triển khai" (caption style); wraps between the parts */
export function TierStage({ account: a, className }: { account: AccountSummary; className?: string }) {
  return <DotList items={[t(`enums.tier.${a.tier}`), t(`enums.stage.${a.stage}`)]} className={cn('text-caption', className)} />;
}

/** latest activity on the account, else the last edit of the account itself */
export function lastTouched(a: AccountSummary): string {
  return a.last_activity_at ?? a.updated_at;
}

/** AM by the name colleagues use ("Thu Hà"); the full name in the tooltip. */
export function AmName({ user, avatar = true, className }: { user: UserRef; avatar?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)} title={user.full_name}>
      {avatar ? <UserAvatar user={user} size="xs" /> : null}
      <span className={avatar ? 'truncate' : 'whitespace-nowrap'}>{shortPersonName(user.full_name)}</span>
    </span>
  );
}

function OverdueBit({ count }: { count: number }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap font-medium text-danger', SMALL)}>
      <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t('dashboard.portfolio.waitingOverdue', { count })}
    </span>
  );
}

function waitingRows(counts: WaitingCounts) {
  return [
    { key: 'client', label: t('dashboard.portfolio.waitingClient'), count: counts.waiting_client, overdue: counts.overdue_client },
    { key: 'internal', label: t('dashboard.portfolio.waitingInternal'), count: counts.waiting_internal, overdue: counts.overdue_internal },
  ];
}

/** Table cell: "Khách 6" / "⚠ 1 quá hạn" (only when > 0) / "New Era 5", one fact per line. */
export function WaitingCompact({ counts }: { counts: WaitingCounts }) {
  return (
    <div
      className="flex flex-col gap-0.5"
      title={t('dashboard.portfolio.waitingTitle', { client: counts.waiting_client, internal: counts.waiting_internal })}
    >
      {waitingRows(counts).map((r) => (
        <div key={r.key} className="flex flex-col">
          <span className="inline-flex items-center gap-x-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="tabular font-semibold text-foreground">{r.count}</span>
          </span>
          {r.overdue > 0 ? <OverdueBit count={r.overdue} /> : null}
        </div>
      ))}
    </div>
  );
}

/** Card line: "Khách 3 · New Era 2", each part followed by its overdue count in danger when > 0. */
export function WaitingInline({ counts }: { counts: WaitingCounts }) {
  return (
    <DotList
      className="text-table"
      items={waitingRows(counts).map((r) => (
        <span key={r.key} className="inline-flex flex-wrap items-center gap-x-1.5">
          <span className="whitespace-nowrap">
            <span className="text-muted-foreground">{r.label}</span>{' '}
            <span className="tabular font-semibold text-foreground">{r.count}</span>
          </span>
          {r.overdue > 0 ? <OverdueBit count={r.overdue} /> : null}
        </span>
      ))}
    />
  );
}

/** Signed contract value; accounts without a contract yet (prospects) read "Chưa có" instead of a bare "0 ₫". */
export function ContractValue({ value }: { value: number }) {
  if (value <= 0) return <span className="text-muted-foreground">{t('dashboard.portfolio.noContract')}</span>;
  return <Money value={value} compact className="font-medium text-foreground" />;
}

/** Receivable amount; the overdue part on its own line in danger text (icon + words). */
export function ReceivableValue({
  receivable,
  overdue,
  align = 'start',
}: {
  receivable: number;
  overdue: number;
  align?: 'start' | 'end';
}) {
  if (receivable <= 0 && overdue <= 0) {
    return <span className="text-muted-foreground">{t('dashboard.portfolio.noReceivable')}</span>;
  }
  return (
    <span className={cn('inline-flex flex-col gap-0.5', align === 'end' ? 'items-end' : 'items-start')}>
      <Money value={receivable} compact className="font-medium text-foreground" />
      {overdue > 0 ? (
        // the amount never breaks (NBSP inside); "quá hạn" may wrap in a narrow table column
        <span className={cn('inline-flex items-start gap-1 font-medium text-danger', align === 'end' ? 'text-right' : 'text-left', SMALL)}>
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular">{t('dashboard.portfolio.receivableOverdue', { amount: formatMoneyCompact(overdue) })}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Milestone name (+ project) and the compact "08/10 → 14/10 · lùi 6 ngày". */
export function NextMilestoneInfo({ account, showProject = false }: { account: AccountSummary; showProject?: boolean }) {
  const m = account.next_milestone;
  if (!m) return <span className="text-muted-foreground">{t('dashboard.portfolio.noMilestone')}</span>;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="line-clamp-2 min-w-0 break-words font-medium text-foreground" title={`${m.name} · ${m.project_name}`}>
        {m.name}
        {showProject ? <span className="font-normal text-muted-foreground"> · {m.project_name}</span> : null}
      </span>
      <ForecastLabel milestone={m} compact />
    </div>
  );
}
