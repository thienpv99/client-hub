// "Chăm sóc" (SPEC-CARE §6.4): when New Era last touched the account, the cadence it should keep, the next care action
// (due date + who), and "Ghi lần chăm sóc" (CRM LogInteractionDialog preset to this account). The director / the
// account's AM edit the plan (CarePlanDialog).
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarClock } from 'lucide-react';
import type { Tier } from '@/domain/types';
import type { CareInfo } from '@/services/careContract';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { t } from '@/i18n';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { CareStatusBadge } from '@/components/care/badges';
import { CareTouchButton } from '@/components/care/CareTouchButton';
import { SectionCard } from '@/components/common/section-card';
import { UserAvatar } from '@/components/common/user-avatar';
import { CareDue } from '../../care/careParts';
import { CarePlanDialog } from './CarePlanDialog';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-caption">{label}</dt>
      <dd className="min-w-0 text-table text-foreground">{children}</dd>
    </div>
  );
}

export interface CareCardProps {
  account: { id: string; name: string; tier: Tier };
  care: CareInfo;
  /** director / the account's AM: edit the plan */
  canEdit: boolean;
  className?: string;
}

export function CareCard({ account, care, canEdit, className }: CareCardProps) {
  const [editing, setEditing] = useState(false);
  const plan = care.plan;
  const behind = care.days_since !== null && care.days_since > plan.cadence_days;
  return (
    <SectionCard
      className={cn('overflow-hidden', className)}
      title={t('careAccount.overview.care.title')}
      actions={<CareStatusBadge status={care.status} short={false} size="md" />}
      footer={
        <>
          <CareTouchButton accountId={account.id} className="flex-1 sm:flex-none" />
          {canEdit ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} className="flex-1 sm:flex-none">
              <CalendarClock aria-hidden="true" />
              {t('careAccount.overview.care.editPlan')}
            </Button>
          ) : null}
        </>
      }
    >
      {behind ? (
        <p className="mb-3 text-pretty text-[13px] font-medium leading-[18px] text-danger">
          {t('careAccount.overview.care.overdueLine', { days: care.days_since ?? 0, cadence: plan.cadence_days })}
        </p>
      ) : care.next_action_overdue && plan.next_action_due ? (
        // overdue only because the planned care action is past its date: say that first, so "Quá hạn chăm sóc" never
        // reads as a contradiction of a recent last touch
        <p className="mb-3 text-pretty text-[13px] font-medium leading-[18px] text-danger">
          {t('careAccount.overview.care.actionOverdueLine', { days: Math.max(1, diffDays(todayISO(), plan.next_action_due)) })}
        </p>
      ) : care.status === 'due_soon' && care.days_since !== null ? (
        <p className="mb-3 text-pretty text-[13px] font-medium leading-[18px] text-warning">
          {t('careAccount.overview.care.dueSoonLine', { days: Math.max(0, plan.cadence_days - care.days_since) })}
        </p>
      ) : null}
      <dl className="divide-y divide-border/60">
        <Row label={t('careAccount.overview.care.lastTouch')}>
          {care.last_touch_at ? (
            <span className="tabular" title={formatDate(care.last_touch_at)}>
              {/* older touches read as a plain date already: never "01/10/2026 · 01/10/2026" */}
              {formatRelativeTime(care.last_touch_at) === formatDate(care.last_touch_at)
                ? formatDate(care.last_touch_at)
                : t('careAccount.overview.care.lastTouchValue', { relative: formatRelativeTime(care.last_touch_at), date: formatDate(care.last_touch_at) })}
            </span>
          ) : (
            <span className="text-muted-foreground">{t('careAccount.overview.care.never')}</span>
          )}
        </Row>
        <Row label={t('careAccount.overview.care.cadence')}>
          {t('careAccount.overview.care.cadenceValue', { days: plan.cadence_days })}
          {plan.cadence_is_default ? <span className="text-muted-foreground"> · {t('careAccount.overview.care.cadenceDefault')}</span> : null}
        </Row>
        <Row label={t('careAccount.overview.care.nextAction')}>
          {plan.next_action ? (
            <>
              <span className="block break-words">{plan.next_action}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-muted-foreground">
                {plan.next_action_due ? <CareDue date={plan.next_action_due} /> : null}
                {plan.next_action_owner ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <UserAvatar user={plan.next_action_owner} size="xs" />
                    <span className="truncate">{plan.next_action_owner.full_name}</span>
                  </span>
                ) : null}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">{t('careAccount.overview.care.noNextAction')}</span>
          )}
        </Row>
      </dl>
      {canEdit ? <CarePlanDialog account={account} plan={plan} open={editing} onOpenChange={setEditing} /> : null}
    </SectionCard>
  );
}
