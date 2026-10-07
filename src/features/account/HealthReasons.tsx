// Why an account has its health colour: one plain sentence per reason (most severe first, as the api sorts them).
import { Banknote, CircleAlert, Clock, OctagonX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HealthReason, TaskSide, WaitingOn } from '@/services/contract';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';

/** who the task waits on now (a client task the client already answered waits on New Era) */
export function waitsOnClient(r: { side: TaskSide; waiting_on: WaitingOn | null }): boolean {
  return (r.waiting_on ?? r.side) === 'client';
}

export function healthReasonText(r: HealthReason): string {
  switch (r.kind) {
    case 'overdue_blocking':
      return t(waitsOnClient(r) ? 'account.reason.overdueBlockingClient' : 'account.reason.overdueBlockingInternal', {
        task: r.task_title,
        days: r.overdue_days,
        milestone: r.milestone_name,
      });
    case 'due_soon_blocking':
      return r.days_left <= 0
        ? t('account.reason.dueTodayBlocking', { task: r.task_title, milestone: r.milestone_name })
        : t('account.reason.dueSoonBlocking', { task: r.task_title, days: r.days_left, milestone: r.milestone_name });
    case 'overdue_task':
      return t(waitsOnClient(r) ? 'account.reason.overdueTaskClient' : 'account.reason.overdueTaskInternal', {
        task: r.task_title,
        days: r.overdue_days,
      });
    case 'overdue_payment':
      return t('account.reason.overduePayment', { name: r.name, amount: formatMoneyCompact(r.amount), days: r.overdue_days });
  }
}

const LOOK: Record<HealthReason['kind'], { icon: LucideIcon; tone: string }> = {
  overdue_blocking: { icon: OctagonX, tone: 'text-danger' },
  due_soon_blocking: { icon: Clock, tone: 'text-warning' },
  overdue_task: { icon: CircleAlert, tone: 'text-warning' },
  overdue_payment: { icon: Banknote, tone: 'text-warning' },
};

function reasonKey(r: HealthReason, i: number): string {
  return r.kind === 'overdue_payment' ? `${r.kind}:${r.payment_id}` : `${r.kind}:${r.task_id}:${i}`;
}

export interface HealthReasonsProps {
  reasons: HealthReason[];
  /** show at most this many, then "+N lý do khác" */
  max?: number;
  className?: string;
}

export function HealthReasons({ reasons, max = 3, className }: HealthReasonsProps) {
  if (reasons.length === 0) {
    return <p className={cn('text-table text-muted-foreground', className)}>{t('account.health.noReasons')}</p>;
  }
  const shown = reasons.slice(0, max);
  const more = reasons.length - shown.length;
  return (
    <div className={className}>
      <ul className="space-y-2">
        {shown.map((r, i) => {
          const look = LOOK[r.kind];
          const Icon = look.icon;
          return (
            <li key={reasonKey(r, i)} className="flex items-start gap-2.5 text-table text-foreground">
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', look.tone)} strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 break-words">{healthReasonText(r)}</span>
            </li>
          );
        })}
      </ul>
      {more > 0 ? <p className="mt-2 pl-[26px] text-caption">{t('account.reason.more', { count: more })}</p> : null}
    </div>
  );
}
