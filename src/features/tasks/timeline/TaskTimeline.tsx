// Light Gantt grouped by milestone (≥768px): week scale, today line, milestone markers (planned solid, forecast
// ghost + "+6 ngày"), task bars created → due (a dot when there is no span), overdue tail in red with icon + text,
// done muted. Scrolls sideways inside its card only; the task column stays pinned.
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Check, CircleAlert, Clock, Flag, Lock } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import type { MilestoneView, TaskView } from '@/services/contract';
import { dateOf, todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { formatDateShort } from '@/lib/format';
import { useMediaQuery } from '@/hooks/useMedia';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { Card } from '@/components/ui/card';
import { SMALL } from '@/components/common/cx';
import { dueLabelText } from '@/components/common/due-label';
import { forecastSentence } from '@/components/common/forecast-label';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { AssigneeAvatar } from '@/components/task/TaskRow';
import { taskSpan, weekStarts, type TimelineGroup, type TimelineRange } from './timelineModel';

const DAY_W = 18;
const ROW_H = 'h-11';

export interface TaskTimelineProps {
  groups: TimelineGroup[];
  range: TimelineRange;
  multiProject: boolean;
}

export function TaskTimeline({ groups, range, multiProject }: TaskTimelineProps) {
  const today = todayISO();
  const wide = useMediaQuery('(min-width: 1024px)');
  const labelW = wide ? 288 : 224;
  const chartW = range.days * DAY_W;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const x = (d: ISODate): number => diffDays(d, range.start) * DAY_W;
  const todayX = x(today) + DAY_W / 2;

  // open with today about a quarter into the visible chart
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const visible = el.clientWidth - labelW;
    el.scrollLeft = Math.max(0, todayX - visible * 0.25);
    // only when the scale changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.days, labelW]);

  const grid: CSSProperties = {
    width: chartW,
    backgroundImage: `repeating-linear-gradient(to right, rgb(var(--border)) 0 1px, transparent 1px ${7 * DAY_W}px)`,
  };
  const weeks = useMemo(() => weekStarts(range), [range]);

  const todayLine = <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary/70" style={{ left: todayX - 1 }} aria-hidden="true" />;

  return (
    // `isolate`: the pinned column's z-index stays inside the card (never above the page's sticky header)
    <Card className="isolate overflow-hidden">
      <div ref={scrollRef} className="scrollbar-thin overflow-x-auto" role="region" aria-label={t('tasks.timeline.label')} tabIndex={0}>
        <div className="relative" style={{ width: labelW + chartW }}>
          {/* scale */}
          <div className="flex border-b border-border/70">
            <div className="sticky left-0 z-20 flex shrink-0 items-end bg-card px-4 pb-2 text-micro font-medium text-muted-foreground sm:px-5" style={{ width: labelW }}>
              {t('tasks.timeline.taskColumn')}
            </div>
            <div className="relative h-12 shrink-0" style={grid}>
              {weeks.map((w) => (
                <span key={w} className="absolute bottom-2 whitespace-nowrap pl-1.5 text-micro tabular text-muted-foreground" style={{ left: x(w) }}>
                  {formatDateShort(w)}
                </span>
              ))}
              <span
                className={cn('absolute top-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground', SMALL)}
                style={{ left: todayX }}
              >
                {t('tasks.timeline.today')}
              </span>
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.id} role="group" aria-label={groupTitle(g, multiProject)}>
              <div className="flex border-b border-border/60 bg-subtle">
                <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2 bg-subtle px-4 py-2 sm:px-5" style={{ width: labelW }}>
                  <Flag className="h-4 w-4 shrink-0 text-caption" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-table font-semibold text-ink">{groupTitle(g, false)}</span>
                    {multiProject ? <span className="block truncate text-micro text-muted-foreground">{g.project.name}</span> : null}
                  </span>
                </div>
                <div className={cn('relative shrink-0', multiProject ? 'h-14' : 'h-11')} style={grid}>
                  {todayLine}
                  {g.milestone ? <MilestoneMarkers milestone={g.milestone} x={x} range={range} /> : null}
                </div>
              </div>

              {g.tasks.map((task) => (
                <TaskBarRow key={task.id} task={task} labelW={labelW} grid={grid} x={x} range={range} today={today} todayLine={todayLine} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function groupTitle(g: TimelineGroup, withProject: boolean): string {
  const name = g.milestone ? g.milestone.name : t('tasks.filters.noMilestone');
  return withProject ? `${name} · ${g.project.name}` : name;
}

function inRange(d: ISODate, range: TimelineRange): boolean {
  return d >= range.start && d <= range.end;
}

function MilestoneMarkers({ milestone: m, x, range }: { milestone: MilestoneView; x: (d: ISODate) => number; range: TimelineRange }) {
  const sentence = forecastSentence(m);
  const half = DAY_W / 2;
  if (m.status === 'done') {
    const d = m.completed_at ? dateOf(m.completed_at) : m.forecast_date;
    if (!inRange(d, range)) return null;
    return (
      <span
        role="img"
        aria-label={`${m.name}: ${sentence}`}
        title={sentence}
        className="absolute top-1/2 inline-flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-success text-primary-foreground"
        style={{ left: x(d) + half }}
      >
        <Check className="h-3 w-3" aria-hidden="true" />
      </span>
    );
  }
  const shift = diffDays(m.forecast_date, m.planned_date);
  const plannedX = x(m.planned_date) + half;
  const forecastX = x(m.forecast_date) + half;
  return (
    <span role="img" aria-label={`${m.name}: ${sentence}`} title={sentence}>
      {shift > 0 ? (
        <span
          className="absolute top-1/2 border-t-2 border-dashed border-danger/50"
          style={{ left: plannedX, width: Math.max(0, forecastX - plannedX) }}
          aria-hidden="true"
        />
      ) : null}
      {inRange(m.planned_date, range) ? (
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-foreground/80"
          style={{ left: plannedX }}
          aria-hidden="true"
        />
      ) : null}
      {shift !== 0 && inRange(m.forecast_date, range) ? (
        <>
          <span
            className={cn(
              'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 bg-card',
              shift > 0 ? 'border-danger' : 'border-foreground/60',
            )}
            style={{ left: forecastX }}
            aria-hidden="true"
          />
          {shift > 0 ? (
            <span
              className={cn('absolute top-1/2 inline-flex -translate-y-1/2 items-center gap-1 whitespace-nowrap font-medium text-danger tabular', SMALL)}
              style={{ left: forecastX + 12 }}
              aria-hidden="true"
            >
              <Clock className="h-3.5 w-3.5" />
              {t('tasks.timeline.shift', { days: shift })}
            </span>
          ) : null}
        </>
      ) : null}
    </span>
  );
}

interface TaskBarRowProps {
  task: TaskView;
  labelW: number;
  grid: CSSProperties;
  x: (d: ISODate) => number;
  range: TimelineRange;
  today: ISODate;
  todayLine: ReactNode;
}

function TaskBarRow({ task, labelW, grid, x, range, today, todayLine }: TaskBarRowProps) {
  const { open } = useTaskDrawer();
  const span = taskSpan(task, today);
  const done = task.status === 'done';
  const overdue = !done && task.due.overdue;
  const due = dueLabelText(task.due, { done, completedAt: task.completed_at, compact: true });

  const clippedLeft = span.start < range.start;
  const startX = x(clippedLeft ? range.start : span.start);
  const endX = x(span.end) + DAY_W;
  const tailEndX = span.overdueUntil ? x(span.overdueUntil) + DAY_W : endX;
  const label = t('tasks.timeline.barLabel', {
    task: task.title,
    from: formatDateShort(span.start),
    to: formatDateShort(span.end),
    due: due.text,
  });

  const barTone = done
    ? 'border-border/70 bg-muted text-caption'
    : task.blocked
      ? 'border-dashed border-caption/60 bg-muted text-muted-foreground'
      : 'border-primary-border bg-primary-soft text-primary';

  return (
    <div className="group/row flex border-b border-border/60 last:border-b-0">
      <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2 bg-card px-4 transition-colors duration-150 group-hover/row:bg-subtle sm:px-5" style={{ width: labelW }}>
        <TaskTypeIcon type={task.type} labelled className={done ? 'text-caption' : 'text-muted-foreground'} />
        <button
          type="button"
          onClick={() => open(task.id)}
          className={cn(
            'min-w-0 flex-1 truncate rounded text-left text-table hover:text-primary',
            done ? 'text-muted-foreground' : 'text-foreground',
          )}
          title={task.title}
        >
          {task.title}
        </button>
        <AssigneeAvatar user={task.assignee} size="xs" />
      </div>
      <div className={cn('relative shrink-0 transition-colors duration-150 group-hover/row:bg-subtle/60', ROW_H)} style={grid}>
        {todayLine}
        {span.dot && !clippedLeft ? (
          <button
            type="button"
            onClick={() => open(task.id)}
            aria-label={label}
            title={label}
            className={cn(
              'absolute top-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border',
              overdue ? 'border-danger bg-danger-soft' : barTone,
            )}
            style={{ left: x(span.end) + DAY_W / 2 }}
          />
        ) : (
          <button
            type="button"
            onClick={() => open(task.id)}
            aria-label={label}
            title={label}
            className={cn(
              'absolute top-1/2 z-10 flex h-6 -translate-y-1/2 items-center gap-1 overflow-hidden border px-1.5',
              clippedLeft ? 'rounded-r-md border-l-0' : 'rounded-md',
              barTone,
            )}
            style={{ left: startX, width: Math.max(DAY_W, endX - startX) }}
          >
            {task.blocked && !done ? <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
            {done ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
          </button>
        )}
        {overdue ? (
          <>
            <span
              className="absolute top-1/2 h-6 -translate-y-1/2 rounded-r-md border border-l-0 border-danger/40 bg-danger-soft"
              style={{ left: endX, width: Math.max(0, tailEndX - endX) }}
              aria-hidden="true"
            />
            <span
              className={cn('absolute top-1/2 inline-flex -translate-y-1/2 items-center gap-1 whitespace-nowrap font-medium text-danger tabular', SMALL)}
              style={{ left: tailEndX + 6 }}
              aria-hidden="true"
            >
              <CircleAlert className="h-3.5 w-3.5" />
              {due.text}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
