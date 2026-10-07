// The dashboard's only chart (SPEC §4.1): monthly actual collections vs the collection plan for the current year.
// Plan = light wide bar, actual = narrower primary bar drawn over it (bullet style, one axis) so it stays readable in
// the 1/3 column. The summary above (collected so far vs plan) carries the message; the same numbers are in a
// visually hidden table for screen readers.
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DirectorDashboard } from '@/services/contract';
import { SectionCard } from '@/components/common/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { formatMoney, formatMoneyCompact, formatPercent } from '@/lib/format';

type CashflowRow = DirectorDashboard['cashflow'][number];

interface ChartRow extends CashflowRow {
  n: number;
  label: string;
  current: boolean;
}

const COLOR = {
  actual: 'rgb(var(--chart-1))',
  planned: 'rgb(var(--chart-3) / 0.55)',
  grid: 'rgb(var(--border))',
  axis: 'rgb(var(--caption))',
  strong: 'rgb(var(--foreground))',
  cursor: 'rgb(var(--muted))',
};

function Swatch({ kind }: { kind: 'actual' | 'planned' }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
      style={{ background: kind === 'actual' ? COLOR.actual : COLOR.planned }}
    />
  );
}

interface TooltipPayload {
  payload?: ChartRow;
}

function CashflowTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="min-w-[13rem] rounded-xl border border-border/70 bg-card px-3 py-2.5 text-table shadow-pop">
      <p className="font-semibold text-ink">{t('dashboard.cashflow.month', { n: row.n })}</p>
      <dl className="mt-1.5 space-y-1">
        <div className="flex items-center gap-2">
          <Swatch kind="actual" />
          <dt className="flex-1 text-muted-foreground">{t('dashboard.cashflow.actual')}</dt>
          <dd className="tabular font-medium text-foreground">{formatMoney(row.actual)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Swatch kind="planned" />
          <dt className="flex-1 text-muted-foreground">{t('dashboard.cashflow.planned')}</dt>
          <dd className="tabular text-foreground">{formatMoney(row.planned)}</dd>
        </div>
      </dl>
    </div>
  );
}

interface TickProps {
  x?: number;
  y?: number;
  payload?: { value?: string; index?: number };
  rows: ChartRow[];
}

/** month ticks ("T1" … "T12"); the current month in the body colour, semibold */
function MonthTick({ x = 0, y = 0, payload, rows }: TickProps) {
  const row = rows.find((r) => r.label === payload?.value);
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fontSize={12}
      fill={row?.current ? COLOR.strong : COLOR.axis}
      fontWeight={row?.current ? 600 : 400}
      className="tabular"
    >
      {payload?.value}
    </text>
  );
}

/**
 * Plan bar / actual bar widths: the actual bar stays well under the plan bar so a fully collected month still shows
 * its plan on both sides. The card is ~350px wide on phones, on lg (beside "Mốc sắp tới") and in the xl side column
 * (12 bands of ~21px: plan 14 / actual 6); only on iPad portrait does it run full width (bands of ~44px).
 */
const BAR_SIZES = {
  narrow: { plan: 14, actual: 6 },
  wide: { plan: 22, actual: 10 },
} as const;
const WIDE_CARD = '(min-width: 768px) and (max-width: 1023.98px)';

export function CashflowCard({
  cashflow,
  today,
  className,
}: {
  cashflow: DirectorDashboard['cashflow'];
  /** ISO date of today (Vietnam time) */
  today: string;
  className?: string;
}) {
  const bars = useMediaQuery(WIDE_CARD) ? BAR_SIZES.wide : BAR_SIZES.narrow;
  const thisMonth = today.slice(0, 7);
  const year = cashflow[0]?.month.slice(0, 4) ?? today.slice(0, 4);
  const rows: ChartRow[] = cashflow.map((c) => {
    const n = Number(c.month.slice(5, 7));
    return { ...c, n, label: t('common.monthShort', { n }), current: c.month === thisMonth };
  });
  const toDate = rows.filter((r) => r.month <= thisMonth);
  const actualToDate = toDate.reduce((s, r) => s + r.actual, 0);
  const plannedToDate = toDate.reduce((s, r) => s + r.planned, 0);
  const rate = plannedToDate > 0 ? Math.round((actualToDate / plannedToDate) * 100) : null;
  const empty = rows.every((r) => r.actual === 0 && r.planned === 0);

  return (
    <SectionCard
      className={cn('flex flex-col', className)}
      contentClassName="flex flex-1 flex-col"
      title={t('dashboard.cashflow.title', { year })}
      actions={
        <Button asChild variant="ghost" size="sm" className="-mr-2 text-primary hover:text-primary">
          <Link to="/app/commercial/receivables">
            {t('dashboard.cashflow.receivables')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {empty ? (
        <p className="py-8 text-center text-table text-muted-foreground">{t('dashboard.cashflow.empty', { year })}</p>
      ) : (
        <figure className="flex flex-1 flex-col">
          {/* the one-line summary that the chart illustrates */}
          <figcaption className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-title font-semibold tracking-tightish tabular text-ink">{formatMoneyCompact(actualToDate)}</span>
            <span className="text-caption tabular">
              {t('dashboard.cashflow.ofPlan', { planned: formatMoneyCompact(plannedToDate) })}
            </span>
            {rate !== null ? (
              <Badge className="tabular">{t('dashboard.cashflow.rate', { pct: formatPercent(rate) })}</Badge>
            ) : null}
          </figcaption>
          <div className="relative mt-4 h-52 xl:h-44" aria-hidden="true">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -8 }} barCategoryGap="16%">
                  <CartesianGrid vertical={false} stroke={COLOR.grid} strokeDasharray="3 3" />
                  <XAxis
                    xAxisId="plan"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    height={22}
                    tick={<MonthTick rows={rows} />}
                  />
                  <XAxis xAxisId="actual" dataKey="label" hide />
                  <YAxis
                    tickFormatter={(v: number) => formatMoneyCompact(v)}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickCount={4}
                    tick={{ fill: COLOR.axis, fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: COLOR.cursor }}
                    content={<CashflowTooltip />}
                    isAnimationActive={false}
                    wrapperStyle={{ outline: 'none' }}
                  />
                  <Bar
                    xAxisId="plan"
                    dataKey="planned"
                    name={t('dashboard.cashflow.planned')}
                    fill={COLOR.planned}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={bars.plan}
                    isAnimationActive={false}
                  />
                  <Bar
                    xAxisId="actual"
                    dataKey="actual"
                    name={t('dashboard.cashflow.actual')}
                    fill={COLOR.actual}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={bars.actual}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-muted-foreground" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <Swatch kind="actual" />
              {t('dashboard.cashflow.actual')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Swatch kind="planned" />
              {t('dashboard.cashflow.planned')}
            </span>
          </div>
          {/* the wrapper clips: a <table> ignores `width: 1px` and would widen the page on phones */}
          <div className="sr-only">
            <table>
              <caption>{t('dashboard.cashflow.tableCaption', { year })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('dashboard.cashflow.tableMonth')}</th>
                  <th scope="col">{t('dashboard.cashflow.actual')}</th>
                  <th scope="col">{t('dashboard.cashflow.planned')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month}>
                    <th scope="row">{t('dashboard.cashflow.month', { n: r.n })}</th>
                    <td>{formatMoney(r.actual)}</td>
                    <td>{formatMoney(r.planned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      )}
    </SectionCard>
  );
}
