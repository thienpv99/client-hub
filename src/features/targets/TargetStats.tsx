// Three KPI tiles on top of the lead list: open targets, grade A, to contact today / overdue. The last two are
// filters of the list below (ring when active, a second click clears). An AM sees her own targets (the unassigned
// pool is named in the first tile).
import { CalendarClock, CircleAlert, Star, Target } from 'lucide-react';
import { todayISO } from '@/domain/clock';
import { api } from '@/services/api';
import { useMediaQuery } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { KpiCard } from '@/components/common/kpi-card';
import { KpiSkeleton } from '@/components/common/skeletons';
import { t } from '@/i18n';
import { needsContact } from './leads/leadModel';
import type { LeadParams } from './leads/useLeadParams';

export interface TargetStatsProps {
  isDirector: boolean;
  meId: string;
  /** the lead list's URL filters (the tiles read and set grade / due) */
  params: LeadParams;
}

export function TargetStats({ isDirector, meId, params }: TargetStatsProps) {
  const roomy = useMediaQuery('(min-width: 640px)');
  const { data } = useQuery(() => api.listLeads({ openOnly: true }), [meId], { keepPreviousData: true });
  if (!data) return <KpiSkeleton count={3} className="grid-cols-3 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-3" />;

  const today = todayISO();
  const unassigned = data.filter((l) => l.owner === null).length;
  const scope = isDirector ? data : data.filter((l) => l.owner?.id === meId);
  const gradeA = scope.filter((l) => l.fit.grade === 'A').length;
  const due = scope.filter((l) => needsContact(l, today));
  const overdue = due.filter((l) => l.follow_up_overdue || (l.next_follow_up_date !== null && l.next_follow_up_date < today)).length;
  // phones: 3 narrow tiles → short labels, no icons, only an urgent context line
  const tile = 'p-3 sm:p-5';

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4" role="group" aria-label={t('targets.stats.label')}>
      <KpiCard
        className={tile}
        label={roomy ? (isDirector ? t('targets.stats.open') : t('targets.stats.openMine')) : t('targets.stats.openShort')}
        icon={roomy ? Target : undefined}
        value={scope.length}
        sub={roomy ? (unassigned > 0 ? t('targets.stats.unassigned', { count: unassigned }) : t('targets.stats.unassignedNone')) : undefined}
      />
      <KpiCard
        className={tile}
        label={t('targets.stats.gradeA')}
        icon={roomy ? Star : undefined}
        value={gradeA}
        sub={roomy ? t('targets.stats.gradeASub') : undefined}
        active={params.grade === 'A'}
        onClick={() => params.update({ grade: params.grade === 'A' ? null : 'A' })}
      />
      <KpiCard
        className={tile}
        label={roomy ? t('targets.stats.due') : t('targets.stats.dueShort')}
        icon={roomy ? CalendarClock : undefined}
        tone={overdue > 0 ? 'danger' : 'neutral'}
        value={due.length}
        sub={
          overdue > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-danger">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t(roomy ? 'targets.stats.dueOverdue' : 'targets.stats.dueOverdueShort', { count: overdue })}
            </span>
          ) : roomy ? (
            t('targets.stats.dueNone')
          ) : undefined
        }
        active={params.due}
        onClick={() => params.update(params.due ? { due: false } : { due: true, sort: 'followup' })}
      />
    </div>
  );
}
