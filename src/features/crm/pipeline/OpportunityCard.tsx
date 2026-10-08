// One pipeline card (DESIGN §5 Kanban): account, deal, value · probability, next step, owner + expected close,
// days in stage. The whole card opens the opportunity page; HTML5 drag (mouse) or the "Chuyển giai đoạn…" menu
// moves it. While dragged, the browser's drag image shows the card lifted (shadow-pop, rotate 1°).
import { useEffect, useRef } from 'react';
import type { DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CircleAlert, Clock } from 'lucide-react';
import type { OpportunityStage } from '@/domain/crmTypes';
import type { OpportunityView } from '@/services/crmContract';
import { t } from '@/i18n';
import { formatDate, formatDateShort, formatMoneyCompact, formatPercent, formatRelativeDays } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { SMALL } from '@/components/common/cx';
import { AccountLogo } from '@/components/common/account-logo';
import { UserAvatar } from '@/components/common/user-avatar';
import { crmPaths } from '@/components/crm/crmLabels';
import type { OpenStage } from '@/components/crm/crmLabels';
import { daysFrom } from '../crmModel';
import { StageMenu } from './StageMenu';

export const DRAG_MIME = 'application/x-clienthub-opportunity';

export interface OpportunityCardProps {
  opp: OpportunityView;
  stage: OpportunityStage;
  today: string;
  moving?: boolean;
  dragging?: boolean;
  /** moved with the keyboard menu: take the focus when (re-)mounted in its new column */
  focusRequest?: boolean;
  draggable?: boolean;
  onMove: (to: OpenStage) => void;
  onWin: () => void;
  onLose: () => void;
  onDragStart?: (o: OpportunityView) => void;
  onDragEnd?: () => void;
}

/** a date this close also says "hôm nay" / "ngày mai" / "còn 3 ngày" */
const SOON_DAYS = 3;

/** "15/11" this year, "03/02/2027" for another year (a card never hides which year a date is in) */
export function cardDate(date: string, today: string): string {
  return date.slice(0, 4) === today.slice(0, 4) ? formatDateShort(date) : formatDate(date);
}

/**
 * "Chốt dự kiến 15/11 · còn 2 ngày" or, when the date has passed, "Quá ngày chốt 3 ngày · 03/10" (danger, with icon).
 * `compact`: 12px, "Chốt 15/11" / "Trễ chốt 3 ngày" (card footers).
 */
export function CloseDateLine({ opp, today, compact = false, className }: { opp: OpportunityView; today: string; compact?: boolean; className?: string }) {
  const days = daysFrom(today, opp.expected_close_date);
  const date = cardDate(opp.expected_close_date, today);
  const size = compact ? 'text-micro' : SMALL;
  if (opp.close_overdue && days < 0) {
    return (
      <p className={cn('flex items-center gap-1 font-medium tabular text-danger', size, className)} title={formatDate(opp.expected_close_date)}>
        <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {compact ? t('crm.card.closeLate', { days: -days }) : t('crm.card.closeOverdue', { days: -days, date })}
      </p>
    );
  }
  const shown = days >= 0 && days <= SOON_DAYS ? t('crm.card.dateSoon', { date, relative: formatRelativeDays(days) }) : date;
  return (
    <p className={cn('flex items-center gap-1 tabular text-muted-foreground', size, className)} title={formatDate(opp.expected_close_date)}>
      <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {t(compact ? 'crm.card.closeShort' : 'crm.card.close', { date: shown })}
    </p>
  );
}

/** next step text + date; an overdue date is highlighted with an icon */
export function NextStepLine({ opp, today, clamp = true, className }: { opp: OpportunityView; today: string; clamp?: boolean; className?: string }) {
  if (!opp.next_step && !opp.next_step_date) {
    return <p className={cn('text-muted-foreground', SMALL, className)}>{t('crm.card.noNextStep')}</p>;
  }
  const overdueDays = opp.next_step_date ? -daysFrom(today, opp.next_step_date) : 0;
  const overdue = opp.next_step_overdue && overdueDays > 0;
  const nextDate = opp.next_step_date ? cardDate(opp.next_step_date, today) : '';
  const soon = !overdue && overdueDays <= 0 && -overdueDays <= SOON_DAYS;
  return (
    <p className={cn('flex items-start gap-1.5', SMALL, overdue ? 'text-danger' : 'text-muted-foreground', className)}>
      {overdue ? (
        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className={cn('min-w-0', clamp && 'line-clamp-2')}>
        {opp.next_step ? <span className="text-foreground">{opp.next_step}</span> : null}
        {opp.next_step_date ? (
          <span className={cn('tabular', overdue && 'font-medium')}>
            {opp.next_step ? ' · ' : ''}
            {overdue
              ? t('crm.card.nextOverdue', { date: nextDate, days: overdueDays })
              : soon
                ? t('crm.card.dateSoon', { date: nextDate, relative: formatRelativeDays(-overdueDays) })
                : nextDate}
          </span>
        ) : null}
      </span>
    </p>
  );
}

export function OpportunityCard({
  opp,
  stage,
  today,
  moving = false,
  dragging = false,
  focusRequest = false,
  draggable = true,
  onMove,
  onWin,
  onLose,
  onDragStart,
  onDragEnd,
}: OpportunityCardProps) {
  const menuRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!focusRequest) return;
    const id = window.setTimeout(() => menuRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [focusRequest, stage]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_MIME, opp.id);
    e.dataTransfer.setData('text/plain', opp.name);
    // the drag image is painted right after this handler: lift it, then let the source fade to a placeholder
    const el = e.currentTarget;
    el.dataset.ghost = '';
    window.requestAnimationFrame(() => {
      delete el.dataset.ghost;
    });
    onDragStart?.(opp);
  };

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      aria-busy={moving || undefined}
      className={cn(
        'group relative space-y-2 rounded-lg border border-border/70 bg-card p-3 shadow-xs',
        // the hover lift of every clickable card (Card interactive, DESIGN §8.3); keyboard focus keeps the blue edge
        'transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out-quart',
        'hover:-translate-y-px hover:border-border hover:shadow-card-hover active:translate-y-0 focus-within:border-primary-border',
        'data-[ghost]:rotate-1 data-[ghost]:shadow-pop data-[ghost]:transition-none',
        draggable && 'cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
        moving && 'opacity-80',
      )}
    >
      <div className="flex items-center gap-2">
        <AccountLogo account={opp.account} size="xs" />
        <span className="min-w-0 flex-1 truncate text-micro font-medium text-muted-foreground">{opp.account.short_name || opp.account.name}</span>
        <StageMenu name={opp.name} current={stage} onMove={onMove} onWin={onWin} onLose={onLose} triggerRef={menuRef} className="-my-1.5 -mr-1.5" />
      </div>

      <Link
        to={crmPaths.opportunity(opp.id)}
        draggable={false}
        className={cn(
          'block line-clamp-2 text-table font-medium leading-5 text-ink',
          "after:absolute after:inset-0 after:rounded-lg after:content-['']",
          'focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary',
        )}
      >
        {opp.name}
      </Link>

      <p className="flex flex-wrap items-baseline gap-x-1.5 tabular">
        <span className="text-body font-semibold text-ink">{formatMoneyCompact(opp.value)}</span>
        <span className="text-micro text-muted-foreground">{t('crm.card.probability', { pct: formatPercent(opp.probability) })}</span>
      </p>

      <NextStepLine opp={opp} today={today} />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
        <span title={opp.owner.full_name} className="shrink-0">
          <UserAvatar user={opp.owner} size="xs" />
        </span>
        <span className="sr-only">{t('crm.card.owner', { name: opp.owner.full_name })}</span>
        <CloseDateLine opp={opp} today={today} compact />
        <span
          className="ml-auto inline-flex items-center gap-1 text-micro tabular text-muted-foreground"
          title={t('crm.card.daysInStageLong', { days: opp.days_in_stage })}
        >
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t('crm.card.daysInStage', { days: opp.days_in_stage })}
          <span className="sr-only">{t('crm.card.daysInStageSr')}</span>
        </span>
      </div>
    </div>
  );
}
