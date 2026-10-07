// The 4 KPI tiles of SPEC §4.1 (DESIGN §4 KPI tile). Tiles 1, 2 and 4 filter the portfolio below (pressed = active).
import { CalendarClock, CircleAlert, CircleCheck, FileSignature, OctagonX, ShieldAlert, TriangleAlert, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DirectorDashboard } from '@/services/contract';
import { KpiCard } from '@/components/common/kpi-card';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import type { StatusFilter } from '../portfolioModel';
import { DotList } from './DotList';

/**
 * a status part of a context line: icon + words in the status colour. Short parts ("2 bị chặn") never break; `wrap`
 * is for a whole sentence, which must wrap inside a 2-up phone tile (~130px) with the icon on its first line.
 */
function StatusPart({
  icon: Icon,
  tone,
  wrap = false,
  children,
}: {
  icon: LucideIcon;
  tone: 'danger' | 'warning' | 'success';
  wrap?: boolean;
  children: string;
}) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-success';
  return (
    <span className={`inline-flex gap-1 font-medium ${wrap ? 'items-start' : 'items-center whitespace-nowrap'} ${color}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${wrap ? 'mt-0.5' : ''}`} strokeWidth={2.25} aria-hidden="true" />
      <span className="tabular">{children}</span>
    </span>
  );
}

export interface DashboardKpisProps {
  kpis: DirectorDashboard['kpis'];
  year: string;
  active: StatusFilter | null;
  onFilter(filter: StatusFilter): void;
}

export function DashboardKpis({ kpis, year, active, onFilter }: DashboardKpisProps) {
  const roomy = useMediaQuery('(min-width: 640px)');
  const risk = kpis.accounts_at_risk;
  const atRisk = risk.blocked + risk.attention;
  const onTrack = Math.max(0, risk.active_total - atRisk);
  const overdueTotal = kpis.overdue_tasks.client + kpis.overdue_tasks.internal;
  const riskTone = risk.blocked > 0 ? 'danger' : risk.attention > 0 ? 'warning' : 'success';

  const riskParts = [
    risk.blocked > 0 ? (
      <StatusPart key="b" icon={OctagonX} tone="danger">
        {t('dashboard.kpi.risk.blocked', { count: risk.blocked })}
      </StatusPart>
    ) : null,
    risk.attention > 0 ? (
      <StatusPart key="a" icon={TriangleAlert} tone="warning">
        {t('dashboard.kpi.risk.attention', { count: risk.attention })}
      </StatusPart>
    ) : null,
  ].filter((p) => p !== null);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label={t('dashboard.kpi.risk.label')}
        value={String(atRisk)}
        sub={
          risk.active_total === 0 ? (
            t('dashboard.kpi.risk.noActive')
          ) : riskParts.length > 0 ? (
            <DotList items={riskParts} />
          ) : (
            <StatusPart icon={CircleCheck} tone="success" wrap>
              {t('dashboard.kpi.risk.allClear')}
            </StatusPart>
          )
        }
        // phones: the 2-up tiles stay short so "Cần chú ý hôm nay" starts above the fold
        progress={
          risk.active_total > 0 && roomy
            ? {
                value: onTrack,
                max: risk.active_total,
                label: t('dashboard.kpi.risk.onTrack', { count: onTrack, total: risk.active_total }),
              }
            : undefined
        }
        tone={riskTone}
        icon={ShieldAlert}
        onClick={() => onFilter('at_risk')}
        active={active === 'at_risk'}
      />
      <KpiCard
        label={t('dashboard.kpi.overdue.label')}
        value={String(overdueTotal)}
        sub={
          overdueTotal > 0 ? (
            <DotList
              items={[
                t('dashboard.kpi.overdue.client', { count: kpis.overdue_tasks.client }),
                t('dashboard.kpi.overdue.internal', { count: kpis.overdue_tasks.internal }),
              ]}
            />
          ) : (
            t('dashboard.kpi.overdue.none')
          )
        }
        tone={overdueTotal > 0 ? 'warning' : 'success'}
        icon={CalendarClock}
        onClick={() => onFilter('overdue_tasks')}
        active={active === 'overdue_tasks'}
      />
      <KpiCard
        label={t('dashboard.kpi.contract.label', { year })}
        value={formatMoneyCompact(kpis.contract_value_ytd)}
        sub={
          kpis.contract_count_ytd > 0
            ? t('dashboard.kpi.contract.sub', { count: kpis.contract_count_ytd })
            : t('dashboard.kpi.contract.subNone')
        }
        icon={FileSignature}
      />
      <KpiCard
        label={t('dashboard.kpi.receivable.label')}
        value={formatMoneyCompact(kpis.receivable.total)}
        sub={
          kpis.receivable.overdue > 0 ? (
            <StatusPart icon={CircleAlert} tone="danger">
              {t('dashboard.kpi.receivable.overdue', { amount: formatMoneyCompact(kpis.receivable.overdue) })}
            </StatusPart>
          ) : (
            t('dashboard.kpi.receivable.noOverdue')
          )
        }
        icon={Wallet}
        onClick={() => onFilter('receivable')}
        active={active === 'receivable'}
      />
    </div>
  );
}
