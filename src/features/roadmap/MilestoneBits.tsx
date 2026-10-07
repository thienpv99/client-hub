// Small building blocks shared by the horizontal timeline, the list and the mobile vertical timeline.
import { ArrowRight, CalendarClock, Circle, CircleCheck, CircleDot, CircleHelp, EyeOff, MoreHorizontal, PencilLine, Plus } from 'lucide-react';
import type { MilestoneView } from '@/services/contract';
import { dateOf } from '@/domain/clock';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SMALL } from '@/components/common/cx';
import { delayOf, delayTone, isDone, type DelayTone } from './roadmapUtils';
import { useRoadmap, type MilestoneAction } from './roadmapContext';

/** soft status pill per delay tone (status colour + icon + word, DESIGN §1.5) */
export const DELAY_PILL: Record<DelayTone, string> = {
  danger: 'bg-danger-soft text-danger ring-danger/15',
  warning: 'bg-warning-soft text-warning ring-warning/20',
  neutral: 'bg-muted text-muted-foreground ring-border',
};

/** text colour of a forecast date per delay tone */
export const DELAY_TEXT: Record<DelayTone, string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  neutral: 'text-foreground',
};

/** "09/10 → 15/10" (forecast in the delay tone) · "12/11" on plan · "Xong 25/08" — one short line for tight columns. */
export function MilestoneDates({ milestone: m, className }: { milestone: MilestoneView; className?: string }) {
  if (isDone(m)) {
    const d = m.completed_at ? dateOf(m.completed_at) : m.forecast_date;
    return <span className={cn('tabular text-muted-foreground', className)}>{t('roadmap.timeline.doneOn', { date: formatDateShort(d) })}</span>;
  }
  if (delayOf(m) === 0) return <span className={cn('tabular text-muted-foreground', className)}>{formatDateShort(m.planned_date)}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap tabular text-muted-foreground', className)}>
      {formatDateShort(m.planned_date)}
      <ArrowRight className="h-3 w-3 shrink-0 text-caption" aria-hidden="true" />
      <span className={cn('font-medium', DELAY_TEXT[delayTone(m)])}>{formatDateShort(m.forecast_date)}</span>
    </span>
  );
}

/** ✓ done (success) · ◉ current · ○ upcoming. */
export function MilestoneStatusIcon({ milestone, className }: { milestone: MilestoneView; className?: string }) {
  const { currentId } = useRoadmap();
  if (isDone(milestone)) return <CircleCheck className={cn('h-5 w-5 shrink-0 text-success', className)} aria-hidden="true" />;
  if (milestone.id === currentId) return <CircleDot className={cn('h-5 w-5 shrink-0 text-primary', className)} aria-hidden="true" />;
  return <Circle className={cn('h-5 w-5 shrink-0 text-caption', className)} aria-hidden="true" />;
}

/** "Đang thực hiện" / "Sắp tới" / "Đã hoàn thành" (the current milestone reads as in progress). */
export function milestoneStatusText(milestone: MilestoneView, currentId: string | null): string {
  if (isDone(milestone)) return t('enums.milestoneStatus.done');
  if (milestone.status === 'in_progress' || milestone.id === currentId) return t('enums.milestoneStatus.in_progress');
  return t('enums.milestoneStatus.upcoming');
}

/**
 * Status line under a milestone name: "Đang thực hiện" for the current one only (the icon / the dates already say done
 * or upcoming); the state is always read to screen readers.
 */
export function MilestoneStatusLine({ milestone, className }: { milestone: MilestoneView; className?: string }) {
  const { currentId } = useRoadmap();
  const text = milestoneStatusText(milestone, currentId);
  const inProgress = !isDone(milestone) && (milestone.status === 'in_progress' || milestone.id === currentId);
  if (!inProgress) return <span className="sr-only">{text}</span>;
  return <span className={cn('font-medium text-primary', SMALL, className)}>{text}</span>;
}

/** "Điều chỉnh tay" (manual forecast) and "Ẩn với khách" tags. */
export function MilestoneTags({ milestone }: { milestone: MilestoneView }) {
  const { isVisible } = useRoadmap();
  const manual = milestone.forecast_source === 'manual' && !isDone(milestone);
  const hidden = !isVisible(milestone);
  if (!manual && !hidden) return null;
  return (
    <>
      {manual ? (
        <Badge variant="outline" size="sm">
          <PencilLine aria-hidden="true" />
          {t('roadmap.tags.manual')}
        </Badge>
      ) : null}
      {hidden ? (
        <Badge variant="default" size="sm">
          <EyeOff aria-hidden="true" />
          {t('roadmap.tags.hidden')}
        </Badge>
      ) : null}
    </>
  );
}

/** "3 đang mở · 5 đã xong" */
export function taskCountsText(milestone: MilestoneView): string {
  const open = milestone.open_task_count;
  const done = milestone.done_task_count;
  if (open + done === 0) return t('roadmap.counts.none');
  if (done === 0) return t('roadmap.counts.openOnly', { open });
  if (open === 0) return t('roadmap.counts.doneOnly', { done });
  return t('roadmap.counts.both', { open, done });
}

/**
 * "Hoàn thành mốc" quick button on the current milestone + the "…" menu (managers). `visibilityInMenu`: "Khách thấy
 * được" as a check item of the menu (the rows show only the exception, the "Ẩn với khách" tag).
 */
export function MilestoneActions({
  milestone,
  quickComplete = true,
  visibilityInMenu = false,
}: {
  milestone: MilestoneView;
  quickComplete?: boolean;
  visibilityInMenu?: boolean;
}) {
  const { canManage, canAddTask, currentId, onAction, isVisible, toggleVisible } = useRoadmap();
  if (!canManage) return null;
  const done = isDone(milestone);
  // let the menu close (and hand focus back) before a dialog takes over
  const select = (action: MilestoneAction) => () => window.setTimeout(() => onAction(action, milestone), 0);
  return (
    <div className="flex shrink-0 items-center gap-1">
      {quickComplete && !done && milestone.id === currentId ? (
        <Button variant="secondary" size="sm" onClick={() => onAction('complete', milestone)}>
          <CircleCheck aria-hidden="true" />
          {t('roadmap.actions.completeShort')}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('roadmap.actions.more', { name: milestone.name })}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          <DropdownMenuItem onSelect={select('edit')}>
            <PencilLine aria-hidden="true" />
            {t('roadmap.actions.edit')}
          </DropdownMenuItem>
          {!done ? (
            <DropdownMenuItem onSelect={select('override')}>
              <CalendarClock aria-hidden="true" />
              {t('roadmap.actions.override')}
            </DropdownMenuItem>
          ) : null}
          {canAddTask ? (
            <DropdownMenuItem onSelect={select('addTask')}>
              <Plus aria-hidden="true" />
              {t('roadmap.actions.addTask')}
            </DropdownMenuItem>
          ) : null}
          {visibilityInMenu ? (
            <DropdownMenuCheckboxItem
              checked={isVisible(milestone)}
              onCheckedChange={(next) => toggleVisible(milestone, next === true)}
            >
              {t('roadmap.visible.label')}
            </DropdownMenuCheckboxItem>
          ) : null}
          {!done ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={select('complete')}>
                <CircleCheck aria-hidden="true" />
                {t('roadmap.actions.complete')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** (?) next to the timeline title: how the forecast is computed. `withLabel`: icon + text (phones, in the card footer). */
export function ForecastHelp({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {withLabel ? (
          <Button variant="ghost" size="sm" className="-ml-2">
            <CircleHelp aria-hidden="true" />
            {t('roadmap.help.title')}
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label={t('roadmap.help.aria')}>
            <CircleHelp aria-hidden="true" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-2">
        <p className="text-table font-semibold text-ink">{t('roadmap.help.title')}</p>
        <p className="text-table text-foreground">{t('roadmap.help.rule')}</p>
        <p className="text-caption">{t('roadmap.help.extra')}</p>
      </PopoverContent>
    </Popover>
  );
}
