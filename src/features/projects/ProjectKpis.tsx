// The 4 KPI cards heading the portfolio. Card 1 = scope + portfolio-wide progress; cards 2–4 are filters of the list
// below (pressed = active filter).
import { CalendarCheck, CalendarClock, CircleAlert, Clock, FolderKanban, ListChecks, ShieldAlert, ShieldCheck } from 'lucide-react';
import { KpiCard } from '@/components/common/kpi-card';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { slipTone, type PortfolioKpis, type ProjectFilter } from './projectsModel';

/** "A · B" that wraps at the separator only */
function Pair({ a, b }: { a: string; b: string }) {
  return (
    <>
      <span className="whitespace-nowrap">{a}</span>
      <span aria-hidden="true"> · </span>
      <span className="sr-only">, </span>
      <span className="whitespace-nowrap">{b}</span>
    </>
  );
}

function runningSub(k: PortfolioKpis): string {
  if (k.done > 0 && k.paused > 0) return t('projects.kpi.running.subBoth', { done: k.done, paused: k.paused });
  if (k.done > 0) return t('projects.kpi.running.subDone', { done: k.done });
  if (k.paused > 0) return t('projects.kpi.running.subPaused', { paused: k.paused });
  return t('projects.kpi.running.subAll');
}

export interface ProjectKpisProps {
  kpis: PortfolioKpis;
  /** active KPI filter */
  active: ProjectFilter | null;
  onFilter(filter: ProjectFilter): void;
}

export function ProjectKpis({ kpis: k, active, onFilter }: ProjectKpisProps) {
  const riskTone = k.blocked > 0 ? 'danger' : k.attention > 0 ? 'warning' : 'success';
  const overdueTotal = k.overdueClient + k.overdueInternal;
  const worst = k.worst;
  const worstTone = worst ? slipTone(worst) : 'warning';

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label={t('projects.kpi.running.label')}
        value={String(k.running)}
        sub={runningSub(k)}
        icon={FolderKanban}
        progress={k.runningTasks > 0 ? { value: k.runningDoneTasks, max: k.runningTasks, label: t('projects.kpi.running.progress') } : undefined}
      />
      <KpiCard
        label={<Pair a={t('enums.health.blocked')} b={t('enums.health.attention')} />}
        value={`${k.blocked} · ${k.attention}`}
        sub={k.blocked + k.attention > 0 ? t('projects.kpi.risk.sub', { total: k.live }) : t('projects.kpi.risk.subNone')}
        tone={riskTone}
        icon={riskTone === 'success' ? ShieldCheck : ShieldAlert}
        onClick={() => onFilter('at_risk')}
        active={active === 'at_risk'}
      />
      <KpiCard
        label={t('projects.kpi.slip.label')}
        value={String(k.slipping)}
        sub={
          worst ? (
            <span className={cn('inline-flex items-start gap-1 font-medium', worstTone === 'danger' ? 'text-danger' : 'text-warning')}>
              <Clock className="mt-[3px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="tabular">
                {t('projects.kpi.slip.sub', { days: worst.slip_days, account: worst.account.short_name || worst.account.name })}
              </span>
            </span>
          ) : (
            t('projects.kpi.slip.subNone')
          )
        }
        tone={worst ? worstTone : 'success'}
        icon={worst ? CalendarClock : CalendarCheck}
        onClick={() => onFilter('slipping')}
        active={active === 'slipping'}
      />
      <KpiCard
        label={t('projects.kpi.overdue.label')}
        value={String(overdueTotal)}
        sub={
          <Pair
            a={t('projects.kpi.overdue.client', { count: k.overdueClient })}
            b={t('projects.kpi.overdue.internal', { count: k.overdueInternal })}
          />
        }
        tone={overdueTotal > 0 ? 'warning' : 'success'}
        icon={overdueTotal > 0 ? CircleAlert : ListChecks}
        onClick={() => onFilter('overdue')}
        active={active === 'overdue'}
      />
    </div>
  );
}
