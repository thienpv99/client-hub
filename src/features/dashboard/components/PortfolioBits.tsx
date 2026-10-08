// Small display pieces shared by the portfolio table (≥1280) and the portfolio cards (<1280).
import { CircleAlert, Clock, OctagonX } from 'lucide-react';
import type { AccountSummary, HealthReason, UserRef, WaitingCounts } from '@/services/contract';
import { healthReasonText, waitsOnClient } from '@/features/account/HealthReasons';
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
  if (overdue > 0 && overdue >= receivable) {
    // all of it is overdue: the amount once, in the danger colour, with one "quá hạn" line (it printed twice)
    return (
      <span className={cn('inline-flex flex-col gap-0.5', align === 'end' ? 'items-end' : 'items-start')}>
        <Money value={Math.max(receivable, overdue)} compact className="font-medium text-danger" />
        <span className={cn('inline-flex items-center gap-1 whitespace-nowrap font-medium text-danger', SMALL)}>
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('dashboard.portfolio.receivableAllOverdue')}
        </span>
      </span>
    );
  }
  return (
    <span className={cn('inline-flex flex-col gap-0.5', align === 'end' ? 'items-end' : 'items-start')}>
      <Money value={receivable} compact className="font-medium text-foreground" />
      {overdue > 0 ? (
        // one line: the amount never breaks (NBSP inside) and stays with "quá hạn"
        <span className={cn('inline-flex items-start gap-1 whitespace-nowrap font-medium text-danger', align === 'end' ? 'text-right' : 'text-left', SMALL)}>
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular">{t('dashboard.portfolio.receivableOverdue', { amount: formatMoneyCompact(overdue) })}</span>
        </span>
      ) : null}
    </span>
  );
}

type HoldingReason = Extract<HealthReason, { kind: 'overdue_blocking' | 'due_soon_blocking' }>;

/**
 * The milestone a late (or nearly due) task is holding, for an account that is not on track: a red "Đang bị chặn"
 * card must say what it is blocked on (Gió Ngàn: the next milestone Phát triển is on plan, while an overdue task
 * holds UAT). The api sorts the reasons most severe first.
 */
function holdingReason(a: AccountSummary): HoldingReason | null {
  if (a.health.value === 'on_track') return null;
  return (
    a.health.reasons.find((x): x is HoldingReason => x.kind === 'overdue_blocking' || x.kind === 'due_soon_blocking') ??
    null
  );
}

/** "do “Hoàn thiện tích hợp dữ liệu SCADA” chờ New Era, quá hạn 4 ngày" / "“Duyệt quy trình …” còn 2 ngày đến hạn" */
function holdingDetail(r: HoldingReason): string {
  if (r.kind === 'overdue_blocking') {
    return t(waitsOnClient(r) ? 'dashboard.portfolio.held.overdueClient' : 'dashboard.portfolio.held.overdueInternal', {
      task: r.task_title,
      days: r.overdue_days,
    });
  }
  return r.days_left <= 0
    ? t('dashboard.portfolio.held.dueToday', { task: r.task_title })
    : t('dashboard.portfolio.held.dueSoon', { task: r.task_title, days: r.days_left });
}

/** status colour + icon: overdue = danger, due soon = warning (always with the words beside it) */
function holdingLook(r: HoldingReason) {
  return r.kind === 'overdue_blocking' ? { Icon: OctagonX, tone: 'text-danger' } : { Icon: Clock, tone: 'text-warning' };
}

/** Another milestone than the next one is held: "⛔ Mốc UAT đang bị giữ" + the task line under it. */
function HeldMilestone({ reason: r, dense = false }: { reason: HoldingReason; dense?: boolean }) {
  const { Icon, tone } = holdingLook(r);
  const title = r.kind === 'overdue_blocking' ? 'dashboard.portfolio.held.title' : 'dashboard.portfolio.held.titleSoon';
  return (
    <span className="flex min-w-0 items-start gap-1.5" title={healthReasonText(r)}>
      <Icon className={cn('mt-[3px] h-3.5 w-3.5 shrink-0', tone)} strokeWidth={2.25} aria-hidden="true" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn('break-words font-medium', tone)}>{t(title, { milestone: r.milestone_name })}</span>
        <span className={cn(dense ? 'line-clamp-1' : 'line-clamp-2', 'break-words text-muted-foreground', SMALL)}>{holdingDetail(r)}</span>
      </span>
    </span>
  );
}

/** The next milestone itself is the held one: the task line under its dates. */
function HoldingCause({ reason: r, dense = false }: { reason: HoldingReason; dense?: boolean }) {
  const { Icon, tone } = holdingLook(r);
  return (
    <span className={cn('flex min-w-0 items-start gap-1.5 text-muted-foreground', SMALL)} title={healthReasonText(r)}>
      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', tone)} strokeWidth={2.25} aria-hidden="true" />
      <span className={cn(dense ? 'line-clamp-1' : 'line-clamp-2', 'min-w-0 break-words')}>{holdingDetail(r)}</span>
    </span>
  );
}

/**
 * Milestone name (+ project) and the compact "08/10 → 14/10 · lùi 6 ngày". An account that is not on track also says
 * which task holds which milestone: under the dates when it is the next milestone, else above it.
 */
/** dense (table rows): the task line holding a milestone takes one line (full text in the tooltip) */
export function NextMilestoneInfo({
  account,
  showProject = false,
  dense = false,
}: {
  account: AccountSummary;
  showProject?: boolean;
  dense?: boolean;
}) {
  const m = account.next_milestone;
  const reason = holdingReason(account);
  const heldIsNext = reason !== null && m !== null && reason.milestone_id === m.id;
  const next = m ? (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="line-clamp-2 min-w-0 break-words font-medium text-foreground" title={`${m.name} · ${m.project_name}`}>
        {m.name}
        {showProject ? <span className="font-normal text-muted-foreground"> · {m.project_name}</span> : null}
      </span>
      <ForecastLabel milestone={m} compact />
      {heldIsNext && reason ? <HoldingCause reason={reason} dense={dense} /> : null}
    </div>
  ) : reason ? null : (
    <span className="text-muted-foreground">{t('dashboard.portfolio.noMilestone')}</span>
  );
  if (!reason || heldIsNext) return next;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <HeldMilestone reason={reason} dense={dense} />
      {next}
    </div>
  );
}
