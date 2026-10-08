// Cross-project light Gantt (≥768px): one-line summary + zoom (Tháng / Quý) in the card header, month scale, today
// line, one row per project with a soft bar start → planned end (filled part = progress), a dashed ghost to the
// forecast end when the project slips, and milestone markers (planned ◇, forecast ◆, done ✓) with a tooltip
// "Kế hoạch → Dự báo · lý do" (tap opens it on touch screens). Scrolls sideways inside its card only; the project
// column stays pinned.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import type { MilestoneView } from '@/services/contract';
import type { ProjectPortfolioRow } from '@/services/crmContract';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { AccountLogo } from '@/components/common/account-logo';
import { forecastSentence } from '@/components/common/forecast-label';
import { HealthBadge } from '@/components/common/health-badge';
import { MICRO_MUTED } from '@/components/common/cx';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SCROLL_FADE_END_CLASS, useScrollFade } from '@/components/ui/use-scroll-fade';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMediaQuery } from '@/hooks/useMedia';
import { useArrivalMotion } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { plannedEndDate, roadmapHref, slipTone } from './projectsModel';
import { buildGanttRange, milestoneDate, monthStarts, sortForGantt, type GanttRange } from './timelineModel';

type Zoom = 'month' | 'quarter';
const DAY_W: Record<Zoom, number> = { month: 5, quarter: 2 };
/** px: room for a two-line project name + the account line (2 × 18 + 16) */
const ROW_H = 60;
const ZOOM_KEY = 'clienthub.projects.ganttZoom';

type XFn = (d: ISODate) => number;

function readZoom(): Zoom {
  try {
    return window.localStorage.getItem(ZOOM_KEY) === 'quarter' ? 'quarter' : 'month';
  } catch {
    return 'month';
  }
}

function saveZoom(z: Zoom): void {
  try {
    window.localStorage.setItem(ZOOM_KEY, z);
  } catch {
    // private mode / blocked storage: the choice just is not remembered
  }
}

function monthLabel(d: ISODate, withYear: boolean, short: boolean): string {
  const month = Number(d.slice(5, 7));
  const year = d.slice(0, 4);
  if (short) return withYear ? t('projects.timeline.monthShortYear', { month, year }) : t('projects.timeline.monthShort', { month });
  return withYear ? t('projects.timeline.monthYear', { month, year }) : t('projects.timeline.month', { month });
}

const SLIP_PILL = {
  danger: 'bg-danger-soft text-danger ring-danger/15',
  warning: 'bg-warning-soft text-warning ring-warning/20',
} as const;
const SLIP_GHOST = {
  danger: 'border-danger/60 bg-danger-soft',
  warning: 'border-warning/60 bg-warning-soft',
} as const;

export function GanttChart({ rows, summary }: { rows: ProjectPortfolioRow[]; summary: string }) {
  const today = todayISO();
  const lg = useMediaQuery('(min-width: 1024px)');
  const xl = useMediaQuery('(min-width: 1280px)');
  const labelW = xl ? 304 : lg ? 264 : 232;
  const [zoom, setZoom] = useState<Zoom>(readZoom);
  const dayW = DAY_W[zoom];
  const half = dayW / 2;
  const range = useMemo(() => buildGanttRange(rows, today), [rows, today]);
  const sorted = useMemo(() => sortForGantt(rows), [rows]);
  const months = useMemo(() => monthStarts(range), [range]);
  const chartW = range.days * dayW;
  const x: XFn = (d) => Math.max(0, Math.min(range.days, diffDays(d, range.start))) * dayW;
  const todayX = x(today) + half;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useScrollFade(scrollRef);

  // open with today about a quarter into the visible chart (again when the scale or the zoom changes), snapped back to
  // the month line at or before that point so the first month label is never half under the pinned project column
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const visible = el.clientWidth - labelW;
    const target = Math.max(0, todayX - visible * 0.25);
    el.scrollLeft = months.reduce((snap, m) => {
      const mx = x(m);
      return mx <= target && mx > snap ? mx : snap;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.days, labelW, dayW]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border/60 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-heading font-semibold tracking-tightish text-ink">{summary}</h2>
          <p className="mt-0.5 text-caption">{t('projects.timeline.hint')}</p>
        </div>
        <ToggleGroup
          type="single"
          variant="segmented"
          value={zoom}
          onValueChange={(v) => {
            if (v !== 'month' && v !== 'quarter') return;
            setZoom(v);
            saveZoom(v);
          }}
          aria-label={t('projects.timeline.zoom.label')}
        >
          <ToggleGroupItem value="month">{t('projects.timeline.zoom.month')}</ToggleGroupItem>
          <ToggleGroupItem value="quarter">{t('projects.timeline.zoom.quarter')}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* end-edge fade while later months are cut off (the pinned project column covers the start edge); the hairline
          above lives on the header so the fade never fades it */}
      <div
        ref={scrollRef}
        className={cn('scrollbar-thin overflow-x-auto', SCROLL_FADE_END_CLASS)}
        role="region"
        aria-label={t('projects.timeline.label')}
        tabIndex={0}
      >
        <div className="relative" style={{ width: labelW + chartW }}>
          {/* month grid + today line, behind bars and markers; the pinned column covers it when scrolled */}
          <div className="pointer-events-none absolute inset-y-0" style={{ left: labelW, width: chartW }} aria-hidden="true">
            {months.map((m) => (
              <span key={m} className="absolute inset-y-0 border-l border-dashed border-border" style={{ left: x(m) }} />
            ))}
            <span className="absolute inset-y-0 w-0.5 rounded-full bg-primary/60" style={{ left: todayX - 1 }} />
          </div>

          {/* scale */}
          <div className="relative flex border-b border-border/60 bg-subtle">
            <div
              className={cn('sticky left-0 z-20 flex shrink-0 items-end bg-subtle px-4 pb-1.5 font-medium sm:px-5', MICRO_MUTED)}
              style={{ width: labelW }}
            >
              {t('projects.timeline.projectColumn')}
            </div>
            <div className="relative h-12 shrink-0" style={{ width: chartW }} aria-hidden="true">
              {months.map((m, i) => (
                <span key={m} className={cn('absolute bottom-1.5 whitespace-nowrap pl-2 tabular', MICRO_MUTED)} style={{ left: x(m) }}>
                  {monthLabel(m, i === 0 || m.slice(5, 7) === '01', zoom === 'quarter')}
                </span>
              ))}
              <span
                className="absolute top-1 z-10 inline-flex h-5 -translate-x-1/2 items-center whitespace-nowrap rounded-full bg-primary-soft px-2 text-micro font-medium text-primary ring-1 ring-inset ring-primary-border"
                style={{ left: todayX }}
              >
                {t('projects.timeline.today')}
              </span>
            </div>
          </div>

          <ul aria-label={t('projects.timeline.rowsLabel')}>
            {sorted.map((p) => (
              <GanttRow key={p.id} project={p} labelW={labelW} chartW={chartW} x={x} range={range} dayW={dayW} />
            ))}
          </ul>
        </div>
      </div>
      <Legend />
    </Card>
  );
}

interface GanttRowProps {
  project: ProjectPortfolioRow;
  labelW: number;
  chartW: number;
  x: XFn;
  range: GanttRange;
  dayW: number;
}

function GanttRow({ project: p, labelW, chartW, x, range, dayW }: GanttRowProps) {
  // progress fills grow only when the page arrives, not on a switch back to the Dòng thời gian tab (DESIGN §8.5)
  const arrival = useArrivalMotion();
  const clippedLeft = p.start_date < range.start;
  // "kết thúc" = the final milestone's planned date, as on Danh mục (EndDates); the contract end date is secondary
  const plannedEnd = plannedEndDate(p);
  const startX = x(p.start_date);
  const endX = x(plannedEnd) + dayW;
  const forecastEndX = x(p.forecast_end_date) + dayW;
  const live = p.status !== 'done';
  // the final milestone forecast runs past its plan → dashed ghost up to it
  const overrun = live && diffDays(p.forecast_end_date, plannedEnd) > 0;
  const slipping = live && p.slip_days > 0;
  const tone = slipTone(p);
  const pct = Math.max(0, Math.min(100, Math.round(p.progress_pct)));
  const tailX = overrun ? forecastEndX : endX;
  const summary = slipping
    ? t('projects.timeline.rowSummaryLate', {
        start: formatDate(p.start_date),
        end: formatDate(plannedEnd),
        forecast: formatDate(p.forecast_end_date),
        days: p.slip_days,
        pct,
      })
    : t('projects.timeline.rowSummary', { start: formatDate(p.start_date), end: formatDate(plannedEnd), pct });
  const endTitle = t('projects.end.title', { planned: formatDate(plannedEnd), forecast: formatDate(p.forecast_end_date), end: formatDate(p.end_date) });

  return (
    <li className="flex border-b border-border/60 last:border-b-0">
      <Link
        to={roadmapHref(p)}
        title={`${p.name} · ${endTitle}`}
        // the left shadow (card colour) covers markers that straddle the pinned edge while the chart scrolls
        className="group sticky left-0 z-20 flex shrink-0 items-center gap-3 bg-card px-4 shadow-[-6px_0_0_0_rgb(var(--card))] transition-colors duration-150 hover:bg-subtle sm:px-5"
        style={{ width: labelW, height: ROW_H }}
      >
        <AccountLogo account={p.account} size="sm" />
        {/* the name may take two lines (legible on iPad, where there is no tooltip); the account line stays one */}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words text-table font-medium leading-[18px] text-ink group-hover:text-primary">{p.name}</span>
          <span className="block truncate text-micro leading-4 text-muted-foreground">
            {p.account.short_name || p.account.name} · {p.code}
          </span>
        </span>
        <HealthBadge health={p.health} size="sm" showLabel={false} />
      </Link>
      <div className="relative shrink-0" style={{ width: chartW, height: ROW_H }}>
        <span className="sr-only">{summary}</span>
        {/* project span; the darker part is the progress */}
        <span
          aria-hidden="true"
          className={cn('absolute top-1/2 h-2 -translate-y-1/2 overflow-hidden bg-chart-4', clippedLeft ? 'rounded-r-full' : 'rounded-full')}
          style={{ left: startX, width: Math.max(dayW, endX - startX) }}
        >
          {/* full-width fill moved by transform (DESIGN §8.5): it grows from empty when the page arrives */}
          <span
            className={cn('block h-full w-full rounded-r-full bg-chart-2 transition-transform duration-500 ease-out-quart', arrival && 'animate-progress-grow')}
            style={{ transform: `translateX(-${100 - pct}%)` }}
          />
        </span>
        {overrun ? (
          <span
            aria-hidden="true"
            className={cn('absolute top-1/2 h-2 -translate-y-1/2 rounded-r-full border border-l-0 border-dashed', SLIP_GHOST[tone])}
            style={{ left: endX, width: Math.max(0, forecastEndX - endX) }}
          />
        ) : null}
        {slipping ? (
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-1/2 inline-flex h-5 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full px-1.5 text-micro font-medium tabular ring-1 ring-inset',
              SLIP_PILL[tone],
            )}
            style={{ left: tailX + 16 }}
          >
            <Clock className="h-3 w-3" strokeWidth={2.25} />
            {t('projects.slip.value', { days: p.slip_days })}
          </span>
        ) : null}
        {p.milestones.map((m) => (
          <MilestoneMarker key={m.id} milestone={m} projectName={p.name} x={x} half={dayW / 2} />
        ))}
      </div>
    </li>
  );
}

/**
 * One focusable marker per milestone spanning planned ◇ → forecast ◆ (or the ✓ of a done one). Hover / focus shows
 * the tooltip; a tap (touch screens, iPad) opens it too.
 */
function MilestoneMarker({ milestone: m, projectName, x, half }: { milestone: MilestoneView; projectName: string; x: XFn; half: number }) {
  const [open, setOpen] = useState(false);
  const sentence = forecastSentence(m);
  const label = t('projects.timeline.markerLabel', { name: m.name, project: projectName, sentence });
  const done = m.status === 'done' || m.forecast_source === 'done';

  const plannedX = x(m.planned_date) + half;
  const atX = x(milestoneDate(m)) + half;
  const shift = done ? 0 : diffDays(m.forecast_date, m.planned_date);
  const lo = done ? atX : Math.min(plannedX, atX);
  const hi = done ? atX : Math.max(plannedX, atX);
  const PAD = 10;
  const left = lo - PAD;
  const width = hi - lo + PAD * 2;

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            // keep it open on click / tap (the trigger closes on click by default)
            e.preventDefault();
            setOpen(true);
          }}
          className="touch-tap-square absolute top-1/2 z-10 h-7 -translate-y-1/2 rounded-md transition-colors duration-150 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ left, width }}
        >
          {done ? (
            <span
              className="absolute top-1/2 inline-flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-success text-primary-foreground ring-2 ring-card"
              style={{ left: atX - left }}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden="true" />
            </span>
          ) : shift === 0 ? (
            <Diamond filled late={false} at={atX - left} />
          ) : (
            <>
              <span
                className={cn('absolute top-1/2 -translate-y-1/2 border-t-2 border-dashed', shift > 0 ? 'border-danger/60' : 'border-foreground/40')}
                style={{ left: lo - left, width: hi - lo }}
              />
              <Diamond filled={false} late={false} at={plannedX - left} />
              <Diamond filled late={shift > 0} at={atX - left} />
            </>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[18rem]">
        <span className="block font-semibold">{m.name}</span>
        <span className="block font-normal">{sentence}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function Diamond({ filled, late, at }: { filled: boolean; late: boolean; at: number }) {
  return (
    <span
      className={cn(
        'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ring-2 ring-card',
        filled ? (late ? 'bg-danger' : 'bg-foreground/70') : 'border-2 border-foreground/70 bg-card',
      )}
      style={{ left: at }}
    />
  );
}

function Legend() {
  const item = 'inline-flex items-center gap-2 whitespace-nowrap';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 px-4 py-3 sm:px-5', MICRO_MUTED)}>
      <span className={item}>
        <span className="relative inline-block h-2 w-8 overflow-hidden rounded-full bg-chart-4" aria-hidden="true">
          <span className="block h-full w-1/2 rounded-r-full bg-chart-2" />
        </span>
        {t('projects.timeline.legend.span')}
      </span>
      <span className={item}>
        <span className="relative inline-block h-3 w-3" aria-hidden="true">
          <Diamond filled={false} late={false} at={6} />
        </span>
        {t('projects.timeline.legend.planned')}
      </span>
      <span className={item}>
        <span className="relative inline-block h-3 w-3" aria-hidden="true">
          <Diamond filled late={false} at={6} />
        </span>
        {t('projects.timeline.legend.forecast')}
      </span>
      <span className={item}>
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-primary-foreground" aria-hidden="true">
          <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
        </span>
        {t('projects.timeline.legend.done')}
      </span>
      <span className={item}>
        <span className="inline-block h-2 w-8 rounded-r-full border border-l-0 border-dashed border-danger/60 bg-danger-soft" aria-hidden="true" />
        {t('projects.timeline.legend.slip')}
      </span>
      <span className={item}>
        <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary/60" aria-hidden="true" />
        {t('projects.timeline.legend.today')}
      </span>
    </div>
  );
}
