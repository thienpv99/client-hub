// Dự báo: weighted value by expected close month (next 6 months) next to the value already won in those months —
// one plain sentence on top (also the accessible summary) and a hidden data table — then the pipeline by stage as a
// quiet funnel, and the deals that weigh most. DESIGN §4 charts: dashed horizontal grid, chart-1 actual, chart-3 planned.
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import type { CrmDashboard } from '@/services/crmContract';
import { useArrivalMotion } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { formatMoney, formatMoneyCompact, formatPercent } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { AccountLogo } from '@/components/common/account-logo';
import { SectionCard } from '@/components/common/section-card';
import { crmPaths, stageLabel } from '@/components/crm/crmLabels';

interface Row {
  month: string;
  n: number;
  year: string;
  label: string;
  weighted: number;
  won: number;
}

const COLOR = {
  planned: 'rgb(var(--chart-3))',
  actual: 'rgb(var(--chart-1))',
  grid: 'rgb(var(--border))',
  axis: 'rgb(var(--caption))',
  cursor: 'rgb(var(--muted))',
};

/** the bars' first-draw rise (same length as the KPI count-up) */
const BAR_MS = 700;

function Swatch({ kind }: { kind: 'planned' | 'actual' | 'total' }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-sm', kind === 'actual' ? 'bg-chart-1' : kind === 'planned' ? 'bg-chart-3' : 'bg-chart-4')}
    />
  );
}

function Legend({ items }: { items: { kind: 'planned' | 'actual' | 'total'; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-muted-foreground" aria-hidden="true">
      {items.map((i) => (
        <span key={i.kind} className="inline-flex items-center gap-1.5">
          <Swatch kind={i.kind} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function ForecastTooltip({ active, payload }: { active?: boolean; payload?: { payload?: Row }[] }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="min-w-[13rem] rounded-xl border border-border/70 bg-card px-3 py-2.5 text-table shadow-pop">
      <p className="font-semibold text-ink">{t('crm.forecast.monthYear', { n: row.n, year: row.year })}</p>
      <dl className="mt-1.5 space-y-1">
        <div className="flex items-center gap-2">
          <Swatch kind="planned" />
          <dt className="flex-1 text-muted-foreground">{t('crm.forecast.weighted')}</dt>
          <dd className="font-medium tabular text-foreground">{formatMoney(row.weighted)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Swatch kind="actual" />
          <dt className="flex-1 text-muted-foreground">{t('crm.forecast.won')}</dt>
          <dd className="font-medium tabular text-foreground">{formatMoney(row.won)}</dd>
        </div>
      </dl>
    </div>
  );
}

function ForecastChart({ forecast }: { forecast: CrmDashboard['forecast'] }) {
  // the bars rise once when the PAGE arrives (Recharts' own JS animation; off under reduced motion) — never again when a
  // tab switch back to Dự báo remounts the chart (DESIGN.md §8.3)
  const animate = useArrivalMotion();
  // one array per data set: Recharts replays its animation whenever the data array changes identity
  const rows: Row[] = useMemo(
    () =>
      forecast.map((f) => {
        const n = Number(f.month.slice(5, 7));
        return { month: f.month, n, year: f.month.slice(0, 4), label: t('common.monthShort', { n }), weighted: f.weighted, won: f.won };
      }),
    [forecast],
  );
  const totalWeighted = rows.reduce((s, r) => s + r.weighted, 0);
  const totalWon = rows.reduce((s, r) => s + r.won, 0);
  const peak = rows.reduce<Row | null>((best, r) => (r.weighted > (best?.weighted ?? 0) ? r : best), null);
  const empty = rows.every((r) => r.weighted === 0 && r.won === 0);
  const summary = empty
    ? t('crm.forecast.empty')
    : peak
      ? t('crm.forecast.summary', {
          weighted: formatMoneyCompact(totalWeighted),
          won: formatMoneyCompact(totalWon),
          month: t('crm.forecast.monthYearInline', { n: peak.n, year: peak.year }),
          peak: formatMoneyCompact(peak.weighted),
        })
      : t('crm.forecast.summaryNoPeak', { won: formatMoneyCompact(totalWon) });

  return (
    <SectionCard
      title={t('crm.forecast.title')}
      description={summary}
      actions={
        empty ? null : (
          <Legend
            items={[
              { kind: 'planned', label: t('crm.forecast.weighted') },
              { kind: 'actual', label: t('crm.forecast.won') },
            ]}
          />
        )
      }
      headerClassName="items-center"
    >
      {empty ? null : (
        <figure>
          <div className="relative h-56 sm:h-72" aria-hidden="true">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 0, bottom: 0, left: -4 }} barCategoryGap="24%" barGap={4}>
                  <CartesianGrid vertical={false} stroke={COLOR.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} height={24} tick={{ fill: COLOR.axis, fontSize: 12 }} />
                  <YAxis
                    tickFormatter={(v: number) => formatMoneyCompact(v)}
                    tickLine={false}
                    axisLine={false}
                    width={68}
                    tick={{ fill: COLOR.axis, fontSize: 12 }}
                  />
                  <Tooltip cursor={{ fill: COLOR.cursor }} content={<ForecastTooltip />} isAnimationActive={false} wrapperStyle={{ outline: 'none' }} />
                  <Bar dataKey="weighted" name={t('crm.forecast.weighted')} fill={COLOR.planned} radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={animate} animationDuration={BAR_MS} animationEasing="ease-out" />
                  <Bar dataKey="won" name={t('crm.forecast.won')} fill={COLOR.actual} radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={animate} animationDuration={BAR_MS} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* sr-only on a <table> itself does not clip (tables grow to their content): wrap it in a block */}
          <figcaption className="sr-only">
            <table>
              <caption>{t('crm.forecast.tableCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('crm.forecast.month')}</th>
                  <th scope="col">{t('crm.forecast.weighted')}</th>
                  <th scope="col">{t('crm.forecast.won')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month}>
                    <th scope="row">{t('crm.forecast.monthYear', { n: r.n, year: r.year })}</th>
                    <td>{formatMoney(r.weighted)}</td>
                    <td>{formatMoney(r.won)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figcaption>
        </figure>
      )}
    </SectionCard>
  );
}

/** pipeline by stage: weighted value (darker) inside the total value (light) of each stage, on one scale */
function StageFunnel({ pipeline }: { pipeline: CrmDashboard['pipeline'] }) {
  const arrival = useArrivalMotion();
  const total = pipeline.reduce(
    (s, r) => ({ count: s.count + r.count, value: s.value + r.value, weighted: s.weighted + r.weighted }),
    { count: 0, value: 0, weighted: 0 },
  );
  const max = Math.max(1, ...pipeline.map((r) => r.value));
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <SectionCard
      title={t('crm.forecast.byStage')}
      description={t('crm.forecast.byStageHint')}
      actions={
        <Legend
          items={[
            { kind: 'planned', label: t('crm.forecast.weightedShort') },
            { kind: 'total', label: t('crm.forecast.valueShort') },
          ]}
        />
      }
      headerClassName="items-center"
      divided
      footer={
        <p className="flex w-full items-baseline justify-between gap-3 tabular">
          <span className="font-medium text-foreground">{t('crm.forecast.totalLine', { count: total.count })}</span>
          <span>
            <span className="font-semibold text-ink">{formatMoneyCompact(total.weighted)}</span>
            <span className="text-muted-foreground">{t('crm.forecast.ofValue', { value: formatMoneyCompact(total.value) })}</span>
          </span>
        </p>
      }
    >
      {pipeline.map((r) => (
        <div key={r.stage} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="min-w-0 text-table">
              <span className="font-medium text-foreground">{stageLabel(r.stage)}</span>
              <span className="ml-2 text-micro tabular text-muted-foreground">{t('crm.forecast.countLine', { count: r.count })}</span>
            </p>
            <p className="shrink-0 text-table tabular">
              <span className="font-semibold text-ink">{formatMoneyCompact(r.weighted)}</span>
              <span className="text-muted-foreground">{t('crm.forecast.ofValue', { value: formatMoneyCompact(r.value) })}</span>
            </p>
          </div>
          {/* full-width fills moved by transform (DESIGN §8.5): they grow from empty on page arrival, ease to new values */}
          <div className="relative h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span
              className={cn('absolute inset-0 rounded-full bg-chart-4 transition-transform duration-500 ease-out-quart', arrival && 'animate-progress-grow')}
              style={{ transform: `translateX(-${100 - pct(r.value)}%)` }}
            />
            <span
              className={cn('absolute inset-0 rounded-full bg-chart-3 transition-transform duration-500 ease-out-quart', arrival && 'animate-progress-grow')}
              style={{ transform: `translateX(-${100 - pct(r.weighted)}%)` }}
            />
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

/** sorted by weighted value (the service's order), so the weighted value is the main number */
function TopDeals({ items }: { items: CrmDashboard['top_opportunities'] }) {
  if (items.length === 0) return null;
  return (
    <SectionCard title={t('crm.forecast.top')} description={t('crm.forecast.topHint')} divided>
      {items.slice(0, 5).map((o) => (
        // the whole row is the link (≥ 44px touch target), like the pipeline cards
        <div key={o.id} className="relative flex min-h-tap min-w-0 items-center gap-3 transition-colors hover:bg-subtle focus-within:bg-subtle">
          <AccountLogo account={o.account} size="sm" />
          <div className="min-w-0 flex-1">
            <Link
              to={crmPaths.opportunity(o.id)}
              className="line-clamp-2 text-table font-medium text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
            >
              {o.name}
            </Link>
            {/* "giá trị × %" lives in the caption, so the name keeps the row's width in the 1/3 side column */}
            <p className="line-clamp-2 text-caption">
              {t('crm.forecast.topMeta', {
                account: o.account.short_name || o.account.name,
                stage: stageLabel(o.stage),
                value: formatMoneyCompact(o.value),
                pct: formatPercent(o.probability),
              })}
            </p>
          </div>
          <span className="shrink-0 whitespace-nowrap text-right text-table font-semibold tabular text-ink">
            {formatMoneyCompact(o.weighted_value)}
          </span>
        </div>
      ))}
    </SectionCard>
  );
}

export function ForecastTab({ dashboard }: { dashboard: CrmDashboard }) {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-3">
      <div className="min-w-0 space-y-6 xl:col-span-2">
        <ForecastChart forecast={dashboard.forecast} />
        <StageFunnel pipeline={dashboard.pipeline} />
      </div>
      <div className="min-w-0">
        <TopDeals items={dashboard.top_opportunities} />
      </div>
    </div>
  );
}
