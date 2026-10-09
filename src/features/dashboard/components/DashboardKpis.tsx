// The 4 KPI tiles of the care overview (SPEC-CARE §6.2, DESIGN §4 KPI tile) — the four questions a director asks:
// which clients need attention (health), where we owe delivery, which requests wait too long, which clients are
// overdue for a touch. Every tile filters the portfolio below (pressed = active).
import { CircleCheck, ClipboardX, Clock, HeartHandshake, Inbox, OctagonX, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DirectorDashboard } from '@/services/contract';
import { KpiCard } from '@/components/common/kpi-card';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import type { CareKpiNumbers } from '../careModel';
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

/**
 * a tile label in a 2-up phone tile: pretty avoids a lone last word ("… rủi / ro") without balance's even split,
 * which broke "Khách / hàng rủi ro" (KpiCard labels are pretty too)
 */
function Label({ text }: { text: string }) {
  return <span className="block text-pretty">{text}</span>;
}

export interface DashboardKpisProps {
  kpis: DirectorDashboard['kpis'];
  care: CareKpiNumbers;
  active: StatusFilter | null;
  onFilter(filter: StatusFilter): void;
}

export function DashboardKpis({ kpis, care, active, onFilter }: DashboardKpisProps) {
  const roomy = useMediaQuery('(min-width: 640px)');
  const risk = kpis.accounts_at_risk;
  const atRisk = risk.blocked + risk.attention;
  const onTrack = Math.max(0, risk.active_total - atRisk);
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

  const careTone = care.careOverdue > 0 ? 'danger' : care.careDueSoon > 0 ? 'warning' : 'success';

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <KpiCard
        label={<Label text={t('carePortfolio.kpi.risk.label')} />}
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
        label={<Label text={t('carePortfolio.kpi.debt.label')} />}
        value={String(care.debt)}
        sub={
          care.debt > 0 ? (
            <StatusPart icon={TriangleAlert} tone="danger" wrap>
              {t('carePortfolio.kpi.debt.accounts', { count: care.debtAccounts })}
            </StatusPart>
          ) : (
            <StatusPart icon={CircleCheck} tone="success" wrap>
              {t('carePortfolio.kpi.debt.none')}
            </StatusPart>
          )
        }
        tone={care.debt > 0 ? 'danger' : 'success'}
        icon={ClipboardX}
        onClick={() => onFilter('debt')}
        active={active === 'debt'}
      />
      <KpiCard
        label={<Label text={t('carePortfolio.kpi.untriaged.label')} />}
        value={String(care.untriaged)}
        sub={
          care.untriaged > 0 ? (
            <StatusPart icon={Clock} tone="warning" wrap>
              {t('carePortfolio.kpi.untriaged.accounts', { count: care.untriagedAccounts })}
            </StatusPart>
          ) : care.open > 0 ? (
            t('carePortfolio.kpi.untriaged.open', { count: care.open })
          ) : (
            t('carePortfolio.kpi.untriaged.none')
          )
        }
        tone={care.untriaged > 0 ? 'warning' : 'success'}
        icon={Inbox}
        onClick={() => onFilter('untriaged')}
        active={active === 'untriaged'}
      />
      <KpiCard
        label={<Label text={t('carePortfolio.kpi.care.label')} />}
        value={String(care.careOverdue)}
        sub={
          care.total === 0 ? (
            t('carePortfolio.kpi.care.none')
          ) : care.careDueSoon > 0 ? (
            <StatusPart icon={Clock} tone="warning" wrap>
              {t('carePortfolio.kpi.care.dueSoon', { count: care.careDueSoon })}
            </StatusPart>
          ) : care.careOverdue === 0 ? (
            <StatusPart icon={CircleCheck} tone="success" wrap>
              {t('carePortfolio.kpi.care.allOk')}
            </StatusPart>
          ) : roomy ? undefined : (
            // the progress caption carries the same words from 640px
            t('carePortfolio.kpi.care.onTrack', { count: care.careOk, total: care.total })
          )
        }
        progress={
          care.total > 0 && roomy
            ? { value: care.careOk, max: care.total, label: t('carePortfolio.kpi.care.onTrack', { count: care.careOk, total: care.total }) }
            : undefined
        }
        tone={careTone}
        icon={HeartHandshake}
        onClick={() => onFilter('care_overdue')}
        active={active === 'care_overdue'}
      />
    </div>
  );
}
