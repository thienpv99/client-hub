import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Clock } from 'lucide-react';
import type { MilestoneView } from '@/services/contract';
import { dateOf } from '@/domain/clock';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { cx, SMALL } from './cx';

type StepState = 'done' | 'current' | 'upcoming';

function StepDate({ m, state }: { m: MilestoneView; state: StepState }) {
  if (state === 'done') {
    const d = m.completed_at ? dateOf(m.completed_at) : m.forecast_date;
    return <span>{t('components.stepper.done', { date: formatDateShort(d) })}</span>;
  }
  const planned = formatDateShort(m.planned_date);
  if (m.forecast_date === m.planned_date) return <span>{planned}</span>;
  const later = m.forecast_date > m.planned_date;
  return (
    <span
      className="inline-flex flex-wrap items-center justify-center gap-x-0.5"
      title={t('components.stepper.forecastTitle', { planned, forecast: formatDateShort(m.forecast_date) })}
    >
      <span className="sr-only">{t('components.forecast.plannedSr')} </span>
      <span>{planned}</span>
      <ArrowRight className="h-3 w-3 shrink-0 text-caption" aria-hidden="true" />
      <span className={cx('inline-flex items-center gap-0.5 font-semibold', later ? 'text-danger' : 'text-foreground')}>
        <span className="sr-only">{t('components.forecast.forecastSr')} </span>
        {later ? <Clock className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
        {formatDateShort(m.forecast_date)}
      </span>
    </span>
  );
}

export interface StageStepperProps {
  milestones: MilestoneView[];
  /** small circles and names only (cards, table rows) */
  compact?: boolean;
  className?: string;
}

/**
 * Horizontal milestone steps: done = soft check, current = solid blue with a halo, upcoming = outlined number.
 * The connector is filled up to the current step. Scrolls sideways (current step centred) when it does not fit.
 */
export function StageStepper({ milestones, compact = false, className }: StageStepperProps) {
  const steps = useMemo(() => [...milestones].sort((a, b) => a.order_no - b.order_no), [milestones]);
  const currentIndex = steps.findIndex((m) => m.status !== 'done');
  const scrollerRef = useRef<HTMLOListElement | null>(null);
  const currentRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const centre = () => {
      const current = currentRef.current;
      if (!current || scroller.clientWidth === 0 || scroller.scrollWidth <= scroller.clientWidth) return;
      // centre the current step without scrolling the page vertically (scrollIntoView would)
      scroller.scrollLeft = Math.max(0, current.offsetLeft - (scroller.clientWidth - current.offsetWidth) / 2);
    };
    centre();
    // also when it becomes visible (hidden tab) or the layout width changes
    if (typeof ResizeObserver === 'undefined') return undefined;
    let lastWidth = scroller.clientWidth;
    const ro = new ResizeObserver(() => {
      if (scroller.clientWidth !== lastWidth) {
        lastWidth = scroller.clientWidth;
        centre();
      }
    });
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [currentIndex, steps.length, compact]);

  // overflow cue: the side(s) with more steps fade out (the scrollbar itself is hidden)
  const [edges, setEdges] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const update = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      const left = max > 1 && scroller.scrollLeft > 1;
      const right = max > 1 && scroller.scrollLeft < max - 1;
      setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [steps.length, compact]);

  if (steps.length === 0) {
    return <p className={cx('text-table text-muted-foreground', className)}>{t('components.stepper.empty')}</p>;
  }

  // step numbers ≥ 12px (readable on phones); the connector runs through the circle's middle
  const circle = compact ? 'h-6 w-6 text-[12px]' : 'h-7 w-7 text-[12px]';
  const lineTop = compact ? 'top-[11px]' : 'top-[13px]';
  const overflowing = edges.left || edges.right;
  const fade = overflowing
    ? `linear-gradient(to right, ${edges.left ? 'transparent 0, #000 32px' : '#000 0'}, ${edges.right ? '#000 calc(100% - 32px), transparent 100%' : '#000 100%'})`
    : undefined;

  // tabIndex: keyboard users can scroll a stepper that does not fit (its steps are not focusable)
  return (
    <ol
      ref={scrollerRef}
      aria-label={t('components.stepper.label')}
      tabIndex={overflowing ? 0 : undefined}
      style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
      className={cx('no-scrollbar relative flex w-full overflow-x-auto pb-1 pt-1', className)}
    >
      {steps.map((m, i) => {
        const state: StepState = m.status === 'done' || (currentIndex !== -1 && i < currentIndex) || currentIndex === -1
          ? 'done'
          : i === currentIndex
            ? 'current'
            : 'upcoming';
        const stateText = t(
          state === 'done' ? 'components.stepper.stateDone' : state === 'current' ? 'components.stepper.stateCurrent' : 'components.stepper.stateUpcoming',
        );
        return (
          <li
            key={m.id}
            ref={state === 'current' ? currentRef : undefined}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cx('relative flex flex-1 flex-col items-center px-1 text-center', compact ? 'min-w-[84px]' : 'min-w-[112px]')}
          >
            {/* left half of the connector: filled when this step is reached */}
            {i > 0 ? (
              <span
                aria-hidden="true"
                className={cx('absolute left-0 right-1/2 h-[2px] rounded-full', lineTop, state === 'upcoming' ? 'bg-border' : 'bg-primary/50')}
              />
            ) : null}
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cx('absolute left-1/2 right-0 h-[2px] rounded-full', lineTop, state === 'done' ? 'bg-primary/50' : 'bg-border')}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cx(
                'relative z-10 flex shrink-0 items-center justify-center rounded-full font-semibold tabular',
                circle,
                state === 'done' && 'bg-primary-soft text-primary ring-1 ring-inset ring-primary-border',
                state === 'current' && 'bg-primary text-primary-foreground shadow-btn ring-4 ring-primary-soft',
                state === 'upcoming' && 'bg-card text-muted-foreground ring-1 ring-inset ring-border-strong',
              )}
            >
              {state === 'done' ? <Check className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cx(
                'mt-2.5 line-clamp-2 max-w-full break-words',
                compact ? SMALL : 'text-table',
                state === 'current' ? 'font-semibold text-ink' : state === 'done' ? 'text-muted-foreground' : 'font-medium text-foreground',
              )}
            >
              {m.name}
              <span className="sr-only"> ({stateText})</span>
            </span>
            {compact ? null : (
              <span className="mt-0.5 text-micro tabular text-muted-foreground">
                <StepDate m={m} state={state} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
