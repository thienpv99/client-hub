// Horizontal timeline (iPad / desktop), Gantt-light: one row per milestone on a shared date axis.
// Each row draws its phase (previous milestone → this one: done light blue, current blue, upcoming grey), then
// planned ○ — dashed — ◆ forecast, ✓ for done milestones; a dashed month grid and a "Hôm nay" line run across the
// rows. The sticky names column prints the dates ("22/10 → 28/10"), so the chart reads without tooltips (touch).
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { CircleCheck } from 'lucide-react';
import type { MilestoneView, ProjectView } from '@/services/contract';
import { forecastSentence } from '@/components/common/forecast-label';
import { MICRO_MUTED } from '@/components/common/cx';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { MilestoneDates, MilestoneStatusIcon } from './MilestoneBits';
import { buildScale, delayOf, delayTone, effectiveDate, isDone, type DelayTone } from './roadmapUtils';
import { useRoadmap } from './roadmapContext';

const ROW = 52; // px — keep in step with h-[52px]
const GAP = 26; // px, minimum distance between the planned ○ and the forecast ◆

const DIAMOND: Record<DelayTone, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  neutral: 'bg-foreground/70',
};
const DASH: Record<DelayTone, string> = {
  danger: 'border-danger/60',
  warning: 'border-warning/60',
  neutral: 'border-caption/60',
};

/** phase bar: done = light blue, current = blue, upcoming = grey hairline (chart ramp, DESIGN §2) */
type Phase = 'done' | 'current' | 'upcoming';
const PHASE: Record<Phase, string> = {
  done: 'bg-chart-4',
  current: 'bg-chart-3',
  upcoming: 'bg-muted ring-1 ring-inset ring-border',
};

function at(pos: number): CSSProperties {
  return { left: `${pos}%` };
}

function PhaseBar({ from, to, phase }: { from: number; to: number; phase: Phase }) {
  const left = Math.min(from, to);
  const width = Math.abs(to - from);
  if (width <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn('absolute top-1/2 h-2 -translate-y-1/2 rounded-full', PHASE[phase])}
      style={{ left: `${left}%`, width: `${width}%` }}
    />
  );
}

function TimelineRow({
  m,
  prevDate,
  pos,
  current,
}: {
  m: MilestoneView;
  prevDate: string;
  pos: (d: string) => number;
  current: boolean;
}) {
  const done = isDone(m);
  const sentence = forecastSentence(m, true);
  const pPos = pos(m.planned_date);
  const prevPos = pos(prevDate);

  if (done) {
    const dPos = pos(effectiveDate(m));
    return (
      <>
        <PhaseBar from={prevPos} to={dPos} phase="done" />
        <span
          aria-hidden="true"
          title={sentence}
          className="absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card"
          style={at(dPos)}
        >
          <CircleCheck className="h-5 w-5 text-success" />
        </span>
      </>
    );
  }

  const phase: Phase = current ? 'current' : 'upcoming';
  const delay = delayOf(m);
  const fPos = pos(m.forecast_date);
  const tone = delayTone(m);
  // a short delay on a long project would put ◆ on top of ○: keep them at least GAP px apart
  const later = fPos >= pPos;
  const fLeft = later ? `max(${fPos}%, calc(${pPos}% + ${GAP}px))` : `min(${fPos}%, calc(${pPos}% - ${GAP}px))`;
  const lineStyle: CSSProperties = later
    ? { left: `${pPos}%`, width: `max(${fPos - pPos}%, ${GAP}px)` }
    : { left: fLeft, width: `max(${pPos - fPos}%, ${GAP}px)` };

  // the shift is drawn (○ — dashed — ◆) and spelled out in the names column ("22/10 → 28/10"); the "+6 ngày" chip
  // lives in the headline and the list below, so the chart does not repeat it on every cascaded row
  return (
    <>
      <PhaseBar from={prevPos} to={pPos} phase={phase} />
      {delay !== 0 ? (
        <>
          <span
            aria-hidden="true"
            className={cn('absolute top-1/2 -translate-y-1/2 border-t-2 border-dashed', DASH[tone])}
            style={lineStyle}
          />
          <span
            aria-hidden="true"
            title={t('roadmap.timeline.markerPlanned', { date: formatDateShort(m.planned_date) })}
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-caption bg-card"
            style={at(pPos)}
          />
          <span
            aria-hidden="true"
            title={sentence}
            className={cn('absolute top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ring-2 ring-card', DIAMOND[tone])}
            style={{ left: fLeft }}
          />
        </>
      ) : (
        <span
          aria-hidden="true"
          title={sentence}
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70 ring-2 ring-card"
          style={at(pPos)}
        />
      )}
    </>
  );
}

export interface MilestoneTimelineProps {
  project: ProjectView;
  className?: string;
}

export function MilestoneTimeline({ project, className }: MilestoneTimelineProps) {
  const { today, currentId } = useRoadmap();
  const scale = useMemo(() => buildScale(project, today), [project, today]);
  const milestones = useMemo(() => [...project.milestones].sort((a, b) => a.order_no - b.order_no), [project.milestones]);
  const height = milestones.length * ROW;
  const todayLeft = scale.todayPos;

  return (
    // isolate: the z-indexes below (names 20 > forecast ◆ 10 > today line 5) stay local, under the sticky app headers
    <div className={cn('scrollbar-thin isolate -mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5', className)}>
      <div className="flex min-w-[560px]">
        {/* names + dates (sticky when the chart scrolls sideways) */}
        <div className="sticky left-0 z-20 w-44 shrink-0 bg-card pr-4 lg:w-52">
          <div className={cn('flex h-8 items-start font-medium', MICRO_MUTED)}>{t('roadmap.timeline.milestoneCol')}</div>
          <ol aria-label={t('roadmap.timeline.title')}>
            {milestones.map((m) => {
              const current = m.id === currentId;
              return (
                <li key={m.id} className="flex h-[52px] items-center gap-2.5 border-b border-border/60 last:border-b-0">
                  <MilestoneStatusIcon milestone={m} className="h-4 w-4" />
                  <div className="min-w-0 flex-1" aria-hidden="true">
                    <p
                      className={cn(
                        'truncate text-table',
                        current ? 'font-semibold text-ink' : isDone(m) ? 'text-muted-foreground' : 'font-medium text-foreground',
                      )}
                      title={m.name}
                    >
                      {m.name}
                    </p>
                    <MilestoneDates milestone={m} className="text-micro" />
                  </div>
                  <span className="sr-only">
                    {m.name}: {forecastSentence(m, true)}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="h-8" />
        </div>

        {/* track */}
        <div className="relative min-w-0 flex-1" aria-hidden="true">
          <div className="relative h-8">
            {scale.ticks.map((tick) => (
              <span
                key={tick.date}
                className={cn('absolute top-0 whitespace-nowrap tabular', MICRO_MUTED, tick.pos > 92 ? '-translate-x-full pr-1.5' : 'pl-1.5')}
                style={at(tick.pos)}
              >
                {tick.label}
              </span>
            ))}
          </div>
          <div className="relative" style={{ height }}>
            {scale.ticks.map((tick) => (
              <span key={tick.date} className="absolute -top-8 bottom-0 border-l border-dashed border-border" style={at(tick.pos)} />
            ))}
            {milestones.map((m, i) => (
              <div
                key={m.id}
                className={cn('absolute inset-x-0', i < milestones.length - 1 && 'border-b border-border/60')}
                style={{ top: i * ROW, height: ROW }}
              >
                <TimelineRow
                  m={m}
                  prevDate={i === 0 ? project.start_date : effectiveDate(milestones[i - 1] as MilestoneView)}
                  pos={scale.pos}
                  current={m.id === currentId}
                />
              </div>
            ))}
            {todayLeft !== null ? (
              <span className="absolute -bottom-2 top-0 z-[5] w-0.5 -translate-x-1/2 rounded-full bg-primary/60" style={at(todayLeft)} />
            ) : null}
          </div>
          <div className="relative h-8">
            {todayLeft !== null ? (
              <span
                className="absolute top-2 z-10 inline-flex h-5 items-center whitespace-nowrap rounded-full bg-primary-soft px-2 text-micro font-medium tabular text-primary ring-1 ring-inset ring-primary-border"
                style={{
                  left: `${todayLeft}%`,
                  transform: `translateX(${todayLeft > 88 ? '-100%' : todayLeft < 12 ? '0' : '-50%'})`,
                }}
              >
                {t('roadmap.timeline.todayDate', { date: formatDateShort(today) })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Key of the markers, for the card footer. */
export function TimelineLegend() {
  const item = 'inline-flex items-center gap-2 whitespace-nowrap';
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-5 gap-y-2', MICRO_MUTED)} aria-label={t('roadmap.timeline.legend')}>
      <li className={item}>
        <span aria-hidden="true" className="h-2 w-6 rounded-full bg-chart-3" />
        {t('roadmap.timeline.legendPhase')}
      </li>
      <li className={item}>
        <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-caption bg-card" />
        {t('roadmap.timeline.legendPlanned')}
      </li>
      <li className={item}>
        <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-danger" />
        {t('roadmap.timeline.legendForecast')}
      </li>
      <li className={item}>
        <span aria-hidden="true" className="h-3 w-3 rounded-full bg-foreground/70" />
        {t('roadmap.timeline.legendOnPlan')}
      </li>
      <li className={item}>
        <CircleCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        {t('roadmap.timeline.legendDone')}
      </li>
      <li className={item}>
        <span aria-hidden="true" className="h-3.5 w-0.5 rounded-full bg-primary/60" />
        {t('roadmap.timeline.legendToday')}
      </li>
    </ul>
  );
}
