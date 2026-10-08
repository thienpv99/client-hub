// KPI strip of the map: value for the chosen metric, customers, ecosystems, the biggest ecosystem. One card with
// hairline-separated cells (the map is the focal block, so the figures stay compact: text-title, not text-kpi).
import type { LucideIcon } from 'lucide-react';
import { Building2, Crown, Network, Wallet } from 'lucide-react';
import type { ClientMapMetric } from '@/services/crmContract';
import { CountUp } from '@/components/common/count-up';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '@/i18n';
import { formatMoneyCompact, formatPercent } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import type { MapKpiData } from './mapModel';

// 2 × 2 below lg (dividers between the cells), one row from lg
const CELL = [
  'border-b border-border/60 lg:border-b-0',
  'border-b border-l border-border/60 lg:border-b-0',
  'lg:border-l lg:border-border/60',
  'border-l border-border/60',
];

interface CellProps {
  i: number;
  icon: LucideIcon;
  label: string;
  /** below xl, where a cell is ~170–180px wide (2 × 2 on phones, 4-up beside the open sidebar at 1024) */
  shortLabel?: string;
  value: string;
  sub: string;
}

function Cell({ i, icon: Icon, label, shortLabel, value, sub }: CellProps) {
  return (
    <div className={cn('min-w-0 px-4 py-3 md:px-5', CELL[i])}>
      <p className="flex items-center gap-1.5 text-caption font-medium" title={label}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {shortLabel ? (
          <>
            <span className="truncate xl:hidden">{shortLabel}</span>
            <span className="hidden truncate xl:inline">{label}</span>
          </>
        ) : (
          <span className="truncate">{label}</span>
        )}
      </p>
      {/* the context line sits under the figure in the 2 × 2 grid and in the 4-up row at 1024 (cells ~180px: side by side
          the figure itself was cut), beside it from xl, where the strip stays one line tall above the map */}
      <p className="mt-1 flex min-w-0 flex-col xl:flex-row xl:items-baseline xl:gap-x-2">
        {/* counts up once with the first map (DESIGN §8.5); a metric switch shows the new figure at once */}
        <span className="shrink-0 whitespace-nowrap text-title font-semibold tracking-tightish tabular text-ink">
          <CountUp value={value} />
        </span>
        <span className="min-w-0 truncate text-caption">{sub || ' '}</span>
      </p>
    </div>
  );
}

export function MapKpis({ kpis, metric, showLeads }: { kpis: MapKpiData; metric: ClientMapMetric; showLeads: boolean }) {
  return (
    <section aria-label={t('clientmap.kpi.label')} className="grid grid-cols-2 rounded-xl border border-border/70 bg-card shadow-card lg:grid-cols-4">
      <Cell
        i={0}
        icon={Wallet}
        label={t(`clientmap.kpi.value.${metric}`)}
        value={formatMoneyCompact(kpis.value)}
        sub={t('clientmap.kpi.valueSub', { count: kpis.companies })}
      />
      <Cell
        i={1}
        icon={Building2}
        label={t('clientmap.kpi.accounts')}
        value={String(kpis.accounts)}
        sub={showLeads ? t('clientmap.kpi.accountsSub', { count: kpis.leads }) : t('clientmap.kpi.accountsSubHidden')}
      />
      <Cell
        i={2}
        icon={Network}
        label={t('clientmap.kpi.ecosystems')}
        value={String(kpis.ecosystems)}
        sub={kpis.ecosystems > 0 ? t('clientmap.kpi.ecosystemsSub', { count: kpis.ecoMembers }) : t('clientmap.kpi.ecosystemsSubNone')}
      />
      <Cell
        i={3}
        icon={Crown}
        label={t('clientmap.kpi.topGroup')}
        shortLabel={t('clientmap.kpi.topGroupShort')}
        value={kpis.top ? formatMoneyCompact(kpis.top.value) : t('clientmap.kpi.topGroupNone')}
        sub={kpis.top ? t('clientmap.kpi.topGroupSub', { name: kpis.top.name, share: formatPercent(kpis.top.share) }) : ''}
      />
    </section>
  );
}

export function MapKpisSkeleton() {
  return (
    <div role="status" aria-busy="true" className="skeleton-reveal grid grid-cols-2 rounded-xl border border-border/70 bg-card shadow-card lg:grid-cols-4">
      <span className="sr-only">{t('components.loading')}</span>
      {CELL.map((c, i) => (
        <div key={i} className={cn('px-4 py-3 md:px-5', c)}>
          {/* same height as a loaded cell (18 + 4 + 28 [+ 18 below xl]), so the map below does not move */}
          <Skeleton className="my-[3px] h-3 w-24" />
          <Skeleton className="mt-1 h-7 w-32 max-w-full" />
          <Skeleton className="mt-1.5 h-3 w-20 xl:hidden" />
        </div>
      ))}
    </div>
  );
}
