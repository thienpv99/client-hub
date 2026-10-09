// "Theo ngày hẹn" (SPEC-CARE §6.5): the open requests on a date axis, grouped by client, with a "Hôm nay" line.
// From 768px a light chart — pinned request column, week grid, a soft bar from the day the request came in to the
// date promised to the client, the promised date as a pill (red with the overdue tail when it has passed), and one
// "Chưa hẹn ngày" row per request without a date. Phones: an agenda per client with a "Hôm nay" divider.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { CalendarClock, CalendarRange, CalendarX } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import { dateOf } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import type { ChangeRequestView } from '@/services/careContract';
import { CrFlags, CrStatusChip } from '@/components/care/badges';
import { AccountLogo } from '@/components/common/account-logo';
import { MICRO_MUTED, SMALL } from '@/components/common/cx';
import { EmptyState } from '@/components/common/empty-state';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { SCROLL_FADE_END_CLASS, useScrollFade } from '@/components/ui/use-scroll-fade';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { formatDate, formatDateShort } from '@/lib/format';
import { CR_STATUS_ICONS, OwnerMark } from './RequestCard';
import { daysToPromise, timelineGroups, timelineRange, weekStarts, type TimelineGroup } from './requestsModel';

const DAY_W = 14;
const ROW_H = 52;
const GROUP_H = 48;

export interface RequestTimelineProps {
  rows: ChangeRequestView[];
  today: ISODate;
  onOpen(cr: ChangeRequestView): void;
}

/** "14 yêu cầu đã hẹn ngày với khách, 2 yêu cầu đã quá hẹn." */
function summaryOf(groups: TimelineGroup[], today: ISODate): { title: string; sub: string } {
  const dated = groups.flatMap((g) => g.dated);
  const undated = groups.reduce((n, g) => n + g.undated.length, 0);
  const late = dated.filter((cr) => (daysToPromise(cr, today) ?? 0) < 0).length;
  const title =
    dated.length === 0
      ? t('carePm.timeline.summaryNone')
      : late > 0
        ? t('carePm.timeline.summaryLate', { dated: dated.length, late })
        : t('carePm.timeline.summaryCalm', { dated: dated.length });
  return { title, sub: undated > 0 ? t('carePm.timeline.undatedCount', { count: undated }) : t('carePm.timeline.undatedNone') };
}

export function RequestTimeline({ rows, today, onOpen }: RequestTimelineProps) {
  const chart = useMediaQuery('(min-width: 768px)');
  const groups = useMemo(() => timelineGroups(rows), [rows]);

  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState icon={CalendarRange} title={t('carePm.timeline.empty.title')} description={t('carePm.timeline.empty.description')} />
      </Card>
    );
  }
  const summary = summaryOf(groups, today);
  return chart ? (
    <TimelineChart groups={groups} today={today} onOpen={onOpen} summary={summary} />
  ) : (
    <div className="space-y-4">
      <div>
        <h2 className="text-heading font-semibold tracking-tightish text-ink">{summary.title}</h2>
        <p className="mt-0.5 text-caption">{summary.sub}</p>
      </div>
      <TimelineAgenda groups={groups} today={today} onOpen={onOpen} />
    </div>
  );
}

// ───────────────────────────── chart (≥ 768px) ─────────────────────────────

type XFn = (d: ISODate) => number;

function TimelineChart({
  groups,
  today,
  onOpen,
  summary,
}: {
  groups: TimelineGroup[];
  today: ISODate;
  onOpen(cr: ChangeRequestView): void;
  summary: { title: string; sub: string };
}) {
  const xl = useMediaQuery('(min-width: 1280px)');
  const labelW = xl ? 320 : 272;
  const range = useMemo(() => timelineRange(groups, today), [groups, today]);
  const weeks = useMemo(() => weekStarts(range), [range]);
  const chartW = range.days * DAY_W;
  const x: XFn = (d) => Math.max(0, Math.min(range.days, diffDays(d, range.start))) * DAY_W;
  const half = DAY_W / 2;
  const todayX = x(today) + half;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useScrollFade(scrollRef);

  // open with today about a quarter into the visible chart, snapped back to the week line before it
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = Math.max(0, todayX - (el.clientWidth - labelW) * 0.25);
    el.scrollLeft = weeks.reduce((snap, w) => {
      const wx = x(w);
      return wx <= target && wx > snap ? wx : snap;
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.days, labelW]);

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
        <h2 className="text-heading font-semibold tracking-tightish text-ink">{summary.title}</h2>
        <p className="mt-0.5 text-caption">
          {summary.sub} {t('carePm.timeline.hint')}
        </p>
      </div>
      <div
        ref={scrollRef}
        className={cn('scrollbar-thin overflow-x-auto', SCROLL_FADE_END_CLASS)}
        role="region"
        aria-label={t('carePm.timeline.label')}
        tabIndex={0}
      >
        <div className="relative" style={{ width: labelW + chartW }}>
          {/* week grid + today line behind the rows; the pinned column covers it while scrolled */}
          <div className="pointer-events-none absolute inset-y-0" style={{ left: labelW, width: chartW }} aria-hidden="true">
            {weeks.map((w) => (
              <span key={w} className="absolute inset-y-0 border-l border-dashed border-border" style={{ left: x(w) }} />
            ))}
            <span className="absolute inset-y-0 z-[1] w-0.5 rounded-full bg-primary/60" style={{ left: todayX - 1 }} />
          </div>

          {/* scale */}
          <div className="relative flex border-b border-border/60 bg-subtle">
            <div className={cn('sticky left-0 z-20 flex shrink-0 items-end bg-subtle px-4 pb-1.5 font-medium sm:px-5', MICRO_MUTED)} style={{ width: labelW }}>
              {t('carePm.timeline.requestColumn')}
            </div>
            <div className="relative h-12 shrink-0" style={{ width: chartW }} aria-hidden="true">
              {weeks.map((w) => (
                <span key={w} className={cn('absolute bottom-1.5 whitespace-nowrap pl-2 tabular', MICRO_MUTED)} style={{ left: x(w) }}>
                  {formatDateShort(w)}
                </span>
              ))}
              <span
                className="absolute top-1 z-10 inline-flex h-5 -translate-x-1/2 items-center whitespace-nowrap rounded-full bg-primary-soft px-2 text-micro font-medium text-primary ring-1 ring-inset ring-primary-border"
                style={{ left: todayX }}
              >
                {t('carePm.timeline.today')}
              </span>
            </div>
          </div>

          {groups.map((g) => (
            <section key={g.account.id} aria-label={g.account.name}>
              <GroupRow group={g} labelW={labelW} chartW={chartW} />
              <ul>
                {g.dated.map((cr) => (
                  <DatedRow key={cr.id} request={cr} labelW={labelW} chartW={chartW} x={x} half={half} today={today} todayX={todayX} onOpen={() => onOpen(cr)} />
                ))}
                {g.undated.map((cr) => (
                  <UndatedRow key={cr.id} request={cr} labelW={labelW} chartW={chartW} onOpen={() => onOpen(cr)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <TimelineLegend />
    </Card>
  );
}

function GroupRow({ group: g, labelW, chartW }: { group: TimelineGroup; labelW: number; chartW: number }) {
  const total = g.dated.length + g.undated.length;
  return (
    <div className="flex border-b border-border/60 bg-subtle/70">
      <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2.5 bg-subtle px-4 sm:px-5" style={{ width: labelW, height: GROUP_H }}>
        <AccountLogo account={g.account} size="xs" />
        <h3 className="min-w-0 truncate text-table font-semibold text-ink">{g.account.name}</h3>
        <span className={cn('shrink-0 tabular', MICRO_MUTED)}>{t('carePm.timeline.groupCount', { count: total })}</span>
      </div>
      <div className="relative shrink-0" style={{ width: chartW, height: GROUP_H }}>
        {g.debt > 0 ? (
          <span className="sticky inline-flex h-full items-center pl-3" style={{ left: labelW }}>
            <span className="inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full bg-danger-soft px-1.5 text-micro font-medium text-danger">
              <CalendarX className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
              {t('carePm.timeline.groupDebt', { count: g.debt })}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** pinned label of a request row: code · title (one line) and the status; the whole row opens the sheet */
function RowLabel({ request: cr, labelW, onOpen }: { request: ChangeRequestView; labelW: number; onOpen(): void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={cr.title}
      className="group sticky left-0 z-20 flex shrink-0 flex-col justify-center gap-0.5 bg-card px-4 text-left shadow-[-6px_0_0_0_rgb(var(--card))] transition-colors duration-150 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
      style={{ width: labelW, height: ROW_H }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn('shrink-0 font-medium tabular text-muted-foreground', SMALL)}>{cr.code}</span>
        <span className="min-w-0 truncate text-table font-medium text-ink group-hover:text-primary">{cr.title}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn('truncate', MICRO_MUTED)}>{t(`care.crStatus.${cr.status}`)}</span>
        <OwnerMark request={cr} className="ml-auto" />
      </span>
    </button>
  );
}

function DatedRow({
  request: cr,
  labelW,
  chartW,
  x,
  half,
  today,
  todayX,
  onOpen,
}: {
  request: ChangeRequestView;
  labelW: number;
  chartW: number;
  x: XFn;
  half: number;
  today: ISODate;
  todayX: number;
  onOpen(): void;
}) {
  const promised = cr.promised_date as ISODate;
  const left = diffDays(promised, today);
  const late = left < 0;
  const startX = x(dateOf(cr.received_at)) + half;
  const atX = x(promised) + half;
  const Icon = late ? CalendarX : CR_STATUS_ICONS[cr.status];
  const sentence = late
    ? t('carePm.timeline.rowLate', { date: formatDate(promised), days: -left, received: formatDate(cr.received_at) })
    : t('carePm.timeline.rowSummary', { date: formatDate(promised), received: formatDate(cr.received_at) });
  return (
    <li className="flex border-b border-border/60 last:border-b-0">
      <RowLabel request={cr} labelW={labelW} onOpen={onOpen} />
      <div className="relative shrink-0" style={{ width: chartW, height: ROW_H }}>
        <span className="sr-only">{sentence}</span>
        {/* the whole lane opens the request too (pointer only; the label is the keyboard target) */}
        <span aria-hidden="true" className="absolute inset-0 cursor-pointer" onClick={onOpen} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-chart-4"
          style={{ left: Math.min(startX, atX), width: Math.max(2, Math.abs(atX - startX)) }}
        />
        {late ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-r-full border border-l-0 border-dashed border-danger/60 bg-danger-soft"
            style={{ left: atX, width: Math.max(0, todayX - atX) }}
          />
        ) : null}
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 z-[2] inline-flex h-6 -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2 text-micro font-medium tabular ring-1 ring-inset',
            late || cr.flags.debt ? 'bg-danger-soft text-danger ring-danger/20' : 'bg-card text-foreground shadow-xs ring-border-strong',
          )}
          style={{ left: atX }}
        >
          <Icon className="h-3 w-3" strokeWidth={2.25} />
          {formatDateShort(promised)}
        </span>
        {cr.flags.debt && !late ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 z-[2] -translate-y-1/2 whitespace-nowrap pl-12 text-micro font-medium text-danger"
            style={{ left: atX }}
          >
            {t(`care.debtReasonShort.${cr.flags.debt_reason ?? 'no_plan'}`)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function UndatedRow({ request: cr, labelW, chartW, onOpen }: { request: ChangeRequestView; labelW: number; chartW: number; onOpen(): void }) {
  return (
    <li className="flex border-b border-border/60 last:border-b-0">
      <RowLabel request={cr} labelW={labelW} onOpen={onOpen} />
      <div className="relative flex shrink-0 items-center" style={{ width: chartW, height: ROW_H }}>
        <span aria-hidden="true" className="absolute inset-0 cursor-pointer" onClick={onOpen} />
        {/* stays in view while the chart scrolls */}
        <span className="pointer-events-none sticky z-[2] flex items-center gap-2 pl-3" style={{ left: labelW }}>
          <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-border-strong bg-card px-2 font-medium text-muted-foreground', SMALL)}>
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            {t('carePm.timeline.undated')}
          </span>
          <CrFlags flags={cr.flags} />
        </span>
      </div>
    </li>
  );
}

function TimelineLegend() {
  const item = 'inline-flex items-center gap-2 whitespace-nowrap';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 px-4 py-3 sm:px-5', MICRO_MUTED)}>
      <span className={item}>
        <span className="inline-block h-1.5 w-8 rounded-full bg-chart-4" aria-hidden="true" />
        {t('carePm.timeline.legend.span')}
      </span>
      <span className={item}>
        <span className="inline-flex h-4 items-center rounded-full bg-card px-1.5 text-[11px] tabular text-foreground ring-1 ring-inset ring-border-strong" aria-hidden="true">
          14/10
        </span>
        {t('carePm.timeline.legend.promised')}
      </span>
      <span className={item}>
        <span className="inline-block h-1.5 w-8 rounded-r-full border border-l-0 border-dashed border-danger/60 bg-danger-soft" aria-hidden="true" />
        {t('carePm.timeline.legend.late')}
      </span>
      <span className={item}>
        <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary/60" aria-hidden="true" />
        {t('carePm.timeline.legend.today')}
      </span>
    </div>
  );
}

// ───────────────────────────── agenda (phones) ─────────────────────────────

function AgendaRow({ request: cr, today, onOpen }: { request: ChangeRequestView; today: ISODate; onOpen(): void }) {
  const left = daysToPromise(cr, today);
  const late = left !== null && left < 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-tap w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <span
          className={cn(
            'flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5 tabular ring-1 ring-inset',
            cr.promised_date ? (late ? 'bg-danger-soft text-danger ring-danger/20' : 'bg-subtle text-ink ring-border/60') : 'border border-dashed border-border-strong text-muted-foreground ring-transparent',
          )}
        >
          {cr.promised_date ? (
            <>
              <span className="text-table font-semibold leading-5">{formatDateShort(cr.promised_date).slice(0, 5)}</span>
              <span className="text-[11px] leading-4">{t(`carePm.weekdayShort.${new Date(`${cr.promised_date}T00:00:00Z`).getUTCDay()}`)}</span>
            </>
          ) : (
            <CalendarClock className="my-1.5 h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="block text-table font-medium leading-5 text-ink">
            <span className={cn('mr-1.5 tabular text-muted-foreground', SMALL)}>{cr.code}</span>
            {cr.title}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <CrStatusChip status={cr.status} />
            <CrFlags flags={cr.flags} />
          </span>
          {late ? <span className={cn('block font-medium text-danger', SMALL)}>{t('carePm.date.lateLong', { days: -(left as number) })}</span> : null}
        </span>
      </button>
    </li>
  );
}

function TimelineAgenda({ groups, today, onOpen }: { groups: TimelineGroup[]; today: ISODate; onOpen(cr: ChangeRequestView): void }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const past = g.dated.filter((cr) => (cr.promised_date as ISODate) < today);
        const coming = g.dated.filter((cr) => (cr.promised_date as ISODate) >= today);
        return (
          <section key={g.account.id} aria-label={g.account.name} className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
            <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
              <AccountLogo account={g.account} size="sm" />
              <h3 className="min-w-0 flex-1 truncate text-table font-semibold text-ink">{g.account.name}</h3>
              <span className={cn('shrink-0 tabular', MICRO_MUTED)}>{t('carePm.timeline.groupCount', { count: g.dated.length + g.undated.length })}</span>
            </header>
            <ul className="divide-y divide-border/60">
              {past.map((cr) => (
                <AgendaRow key={cr.id} request={cr} today={today} onOpen={() => onOpen(cr)} />
              ))}
              {past.length > 0 || coming.length > 0 ? (
                <li className="flex items-center gap-2 px-4 py-1.5">
                  <span className="sr-only">{t('carePm.timeline.todayLine', { date: formatDate(today) })}</span>
                  <span className="h-0.5 flex-1 rounded-full bg-primary/60" aria-hidden="true" />
                  <span className="text-micro font-medium text-primary" aria-hidden="true">
                    {t('carePm.timeline.today')} · {formatDateShort(today)}
                  </span>
                  <span className="h-0.5 w-6 rounded-full bg-primary/60" aria-hidden="true" />
                </li>
              ) : null}
              {coming.map((cr) => (
                <AgendaRow key={cr.id} request={cr} today={today} onOpen={() => onOpen(cr)} />
              ))}
              {g.undated.length > 0 ? (
                <li className={cn('bg-subtle px-4 py-2 font-medium', MICRO_MUTED)}>{t('carePm.timeline.undatedHeading', { count: g.undated.length })}</li>
              ) : null}
              {g.undated.map((cr) => (
                <AgendaRow key={cr.id} request={cr} today={today} onOpen={() => onOpen(cr)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
