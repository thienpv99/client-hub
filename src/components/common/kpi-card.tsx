import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ListFilter } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { t } from '@/i18n';
import { cx } from './cx';

export type KpiTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

/**
 * Colour of the 16px label icon. Blue is for action / selection only (DESIGN §1.6), so 'primary' stays quiet like
 * 'neutral'; status tones colour the icon only (the label is the word).
 */
const ICON_TONE: Record<KpiTone, string> = {
  neutral: 'text-muted-foreground',
  primary: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export interface KpiTrend {
  /** already formatted ("+12%", "−3", "+250 tr ₫") */
  value: string;
  direction: 'up' | 'down' | 'flat';
  /** is this direction good news? default: up = good, down = bad, flat = neutral */
  good?: boolean;
  /** what the trend compares with ("so với tháng trước"); screen readers and tooltip */
  label?: string;
}

export interface KpiProgress {
  value: number;
  max: number;
  /** caption under the bar ("Đã thu 4/6 đợt"); the percentage is shown on the right */
  label?: ReactNode;
}

export interface KpiCardProps {
  /** caption above the number */
  label: ReactNode;
  /** already formatted ("1,25 tỷ ₫", "3/6") */
  value: ReactNode;
  /** one short context line under the number (may contain coloured parts with icons) */
  sub?: ReactNode;
  /** colour of the label icon (status tones only when the KPI is a status) */
  tone?: KpiTone;
  icon?: LucideIcon;
  /** clickable card (e.g. applies a filter) */
  onClick?: () => void;
  /** pressed state for a clickable card (active filter) */
  active?: boolean;
  /** small chip next to the value: "↗ +12%" in success / danger / neutral */
  trend?: KpiTrend;
  /** thin progress bar in the footer */
  progress?: KpiProgress;
  /** tiny area chart in the footer (oldest → newest) */
  spark?: number[];
  /** custom footer under the context line */
  footer?: ReactNode;
  className?: string;
}

function trendTone(trend: KpiTrend): 'good' | 'bad' | 'neutral' {
  if (trend.direction === 'flat') return 'neutral';
  const good = trend.good ?? trend.direction === 'up';
  return good ? 'good' : 'bad';
}

const TREND_ICON: Record<KpiTrend['direction'], LucideIcon> = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight };
const TREND_STYLE = {
  good: 'bg-success-soft text-success',
  bad: 'bg-danger-soft text-danger',
  neutral: 'bg-muted text-muted-foreground',
} as const;

export function KpiTrendChip({ trend, className }: { trend: KpiTrend; className?: string }) {
  const Icon = TREND_ICON[trend.direction];
  const word = t(trend.direction === 'up' ? 'components.kpi.trendUp' : trend.direction === 'down' ? 'components.kpi.trendDown' : 'components.kpi.trendFlat');
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full pl-1 pr-2 text-micro font-medium tabular',
        TREND_STYLE[trendTone(trend)],
        className,
      )}
      title={trend.label}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">{word} </span>
      {trend.value}
      {trend.label ? <span className="sr-only"> {trend.label}</span> : null}
    </span>
  );
}

function KpiProgressBar({ progress }: { progress: KpiProgress }) {
  const max = progress.max > 0 ? progress.max : 1;
  const pct = Math.max(0, Math.min(100, Math.round((progress.value / max) * 100)));
  return (
    <div className="mt-4">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.max}
        aria-valuenow={progress.value}
        aria-valuetext={t('components.kpi.progressPct', { pct })}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out-quart" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-micro text-muted-foreground">
        <span className="min-w-0 truncate">{progress.label ?? t('components.kpi.progress', { value: progress.value, max: progress.max })}</span>
        <span className="shrink-0 font-medium tabular text-foreground" aria-hidden="true">
          {t('components.kpi.progressPct', { pct })}
        </span>
      </div>
    </div>
  );
}

const SPARK_STROKE = 'rgb(var(--chart-1))';

function KpiSpark({ data }: { data: number[] }) {
  const rows = data.map((v, i) => ({ i, v }));
  return (
    // decorative: the number above carries the information
    <div className="relative mt-3 h-8" aria-hidden="true">
      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 2, right: 1, bottom: 2, left: 1 }}>
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Area
              type="monotone"
              dataKey="v"
              stroke={SPARK_STROKE}
              strokeWidth={1.75}
              fill={SPARK_STROKE}
              fillOpacity={0.08}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  tone = 'neutral',
  icon: Icon,
  onClick,
  active,
  trend,
  progress,
  spark,
  footer,
  className,
}: KpiCardProps) {
  const clickable = Boolean(onClick);
  const body = (
    <>
      {/* narrow cards (2-up phones, 4-up iPad): reserve two label lines so the numbers of a row line up */}
      <div className={cx('flex min-w-0 items-start gap-2 [@container_(max-width:200px)]:min-h-9', clickable && 'pr-3')}>
        {Icon ? <Icon className={cx('mt-px h-4 w-4 shrink-0', ICON_TONE[tone])} aria-hidden="true" /> : null}
        <span className="min-w-0 flex-1 text-caption font-medium">{label}</span>
      </div>
      {clickable ? (
        // filter cue in the corner (takes no width from the label): blue when this KPI filters the list below
        <span
          className={cx(
            'absolute right-2.5 top-2.5 inline-flex transition-opacity duration-150',
            active ? 'text-primary opacity-100' : 'text-caption opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
          aria-hidden="true"
        >
          <ListFilter className="h-4 w-4" />
        </span>
      ) : null}
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {/* The number scales with the card (container query units): 30px (text-kpi) on roomy cards down to 24px on
            narrow ones, so "9,22 tỷ ₫" never breaks inside a 2-up phone grid or a 4-up iPad row. Size classes a caller
            put on spans inside `value` give way to it. */}
        <span className="min-w-0 break-words text-[clamp(1.5rem,13cqi,1.875rem)] font-semibold leading-[1.2] tabular tracking-display text-ink [&_span]:text-[length:inherit] [&_span]:leading-[inherit]">
          {value}
        </span>
        {trend ? <KpiTrendChip trend={trend} /> : null}
      </div>
      {sub ? <div className="mt-1 text-caption">{sub}</div> : null}
      {progress ? <KpiProgressBar progress={progress} /> : null}
      {spark && spark.length > 1 ? <KpiSpark data={spark} /> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
      {clickable && active ? <span className="sr-only">{t('components.kpi.filtering')}</span> : null}
    </>
  );
  // container-type: the value size follows the card width (grid cells always give the card its width)
  const base = 'flex min-w-0 flex-col rounded-xl border bg-card p-4 text-left shadow-card [container-type:inline-size] sm:p-5';

  if (!onClick) return <div className={cx(base, 'border-border/70', className)}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active === undefined ? undefined : active}
      className={cx(
        base,
        'group relative w-full transition duration-200 ease-out-quart hover:-translate-y-px hover:shadow-card-hover active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        active ? 'border-primary ring-1 ring-primary' : 'border-border/70 hover:border-border-strong',
        className,
      )}
    >
      {body}
    </button>
  );
}
