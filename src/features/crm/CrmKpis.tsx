// The 4 KPI tiles of the Bán hàng page: open pipeline, weighted value, win rate (180 days), won this year.
// Phones (2-up): one short context line each. From `sm` the weighted tile shows its share of the open value as a bar.
import { Handshake, Scale, Target, Trophy } from 'lucide-react';
import type { CrmDashboard } from '@/services/crmContract';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { formatMoneyCompact, formatPercent } from '@/lib/format';
import { KpiCard } from '@/components/common/kpi-card';

export function CrmKpis({ data, year }: { data: CrmDashboard; year: string }) {
  const roomy = useMediaQuery('(min-width: 640px)');
  const openCount = data.pipeline.reduce((s, p) => s + p.count, 0);
  const hasOpen = data.open_value > 0;
  const share = hasOpen ? (data.weighted_value / data.open_value) * 100 : 0;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label={t('crm.kpi.open.label')}
        icon={Handshake}
        value={formatMoneyCompact(data.open_value)}
        sub={openCount > 0 ? t('crm.kpi.open.sub', { count: openCount }) : t('crm.kpi.open.subNone')}
      />
      <KpiCard
        label={t('crm.kpi.weighted.label')}
        icon={Scale}
        value={formatMoneyCompact(data.weighted_value)}
        sub={!hasOpen ? t('crm.kpi.weighted.subNone') : roomy ? undefined : t('crm.kpi.weighted.sub', { pct: formatPercent(share) })}
        progress={hasOpen && roomy ? { value: data.weighted_value, max: data.open_value, label: t('crm.kpi.weighted.progress') } : undefined}
      />
      <KpiCard
        label={t('crm.kpi.winRate.label')}
        icon={Target}
        value={formatPercent(data.win_rate)}
        sub={data.avg_cycle_days > 0 ? t('crm.kpi.winRate.sub', { days: Math.round(data.avg_cycle_days) }) : t('crm.kpi.winRate.subNone')}
      />
      <KpiCard
        label={t('crm.kpi.won.label', { year })}
        icon={Trophy}
        value={formatMoneyCompact(data.won_value_ytd)}
        sub={data.won_count_ytd > 0 ? t('crm.kpi.won.sub', { count: data.won_count_ytd }) : t('crm.kpi.won.subNone')}
      />
    </div>
  );
}
