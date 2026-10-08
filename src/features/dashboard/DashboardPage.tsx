// /app — Director / AM overview (SPEC §4.1, DESIGN §5 "Executive dashboard"). Greeting → KPI row → "Cần chú ý hôm
// nay" (the focal block) with the cashflow chart + "Mốc sắp tới" beside it on xl → full-width portfolio.
// Members never get here (the shell redirects them to their own tasks).
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import type { DirectorDashboard, Viewer } from '@/services/contract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { givenName } from '@/domain/naming';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { CardSkeleton, KpiSkeleton, ListSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { formatDate, formatWeekday } from '@/lib/format';
import { AttentionPanel } from './components/AttentionPanel';
import { CashflowCard } from './components/CashflowChart';
import { DashboardKpis } from './components/DashboardKpis';
import { PortfolioSkeleton } from './components/PortfolioList';
import { PortfolioSection } from './components/PortfolioSection';
import { effectiveStatus } from './components/PortfolioFilters';
import { UpcomingMilestones } from './components/UpcomingMilestones';
import { ValueMapTeaser } from './components/ValueMapTeaser';
import type { StatusFilter } from './portfolioModel';
import { usePortfolioParams } from './usePortfolioParams';

/** scroll the portfolio into view when its top is below the fold (KPI filters act on it) */
function revealPortfolio(el: HTMLElement | null) {
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  if (top > window.innerHeight * 0.6 || top < 0) {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
}

/** "anh Nam" when a salutation is stored, else the given name ("Nam") */
function greetingName(viewer: Viewer | null): string {
  if (!viewer) return '';
  const given = givenName(viewer.user.full_name) || viewer.user.full_name;
  return viewer.user.salutation ? `${viewer.user.salutation} ${given}` : given;
}

/*
 * Layout: attention first everywhere (the focal block). Below lg the right stack is one column (cashflow →
 * milestones); on lg (iPad landscape / 1024 with the sidebar open) the two cards sit side by side under attention at
 * the same ~350px width they get in the xl side column; from xl attention takes the left 2/3 (stretched to the
 * height of the right stack) and the value map runs full width underneath.
 */
const GRID = 'flex min-w-0 flex-col gap-6 xl:grid xl:grid-cols-3';
const LEFT = 'flex min-w-0 flex-col xl:col-span-2';
const RIGHT = 'grid min-w-0 gap-6 lg:grid-cols-2 xl:flex xl:flex-col';
const WIDE = 'xl:col-span-3';

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <KpiSkeleton count={4} className="grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4" />
      <div className={GRID}>
        <div className={LEFT}>
          <ListSkeleton rows={5} />
        </div>
        <div className={RIGHT}>
          <CardSkeleton lines={6} />
          <CardSkeleton lines={4} />
        </div>
      </div>
      <PortfolioSkeleton rows={6} />
    </div>
  );
}

function DashboardBody({ data, today }: { data: DirectorDashboard; today: string }) {
  const params = usePortfolioParams();
  const portfolioRef = useRef<HTMLElement>(null);
  const showMoney = true; // director & AM (the only roles that reach this page) see the commercial figures
  const active = effectiveStatus(params.status, showMoney);

  function onKpiFilter(filter: StatusFilter) {
    const next = active === filter ? null : filter;
    params.update({ status: next });
    if (next) requestAnimationFrame(() => revealPortfolio(portfolioRef.current));
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 md:gap-8">
      <DashboardKpis kpis={data.kpis} year={today.slice(0, 4)} active={active} onFilter={onKpiFilter} />
      <div className={GRID}>
        <div className={LEFT}>
          <AttentionPanel items={data.attention} className="xl:flex-1" />
        </div>
        <div className={RIGHT}>
          <CashflowCard cashflow={data.cashflow} today={today} />
          <UpcomingMilestones accounts={data.accounts} today={today} />
        </div>
        <ValueMapTeaser className={WIDE} />
      </div>
      <PortfolioSection ref={portfolioRef} accounts={data.accounts} params={params} showMoney={showMoney} />
    </div>
  );
}

export function DashboardPage() {
  const viewer = useViewer();
  const { data, loading, error, refetch } = useQuery(() => api.getDirectorDashboard(), [viewer?.user.id]);
  const today = todayISO();
  const name = greetingName(viewer);
  const isDirector = viewer?.role === 'director';
  const roomy = useMediaQuery('(min-width: 640px)');

  let summary: string | null = null;
  if (data) {
    const params = { count: data.attention.length, total: data.accounts.length };
    if (data.attention.length > 0) summary = t(isDirector ? 'dashboard.summary.director' : 'dashboard.summary.am', params);
    else summary = t(isDirector ? 'dashboard.summary.calmDirector' : 'dashboard.summary.calmAm', params);
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        eyebrow={t('dashboard.dateLine', { weekday: formatWeekday(today), date: formatDate(today) })}
        title={name ? t('dashboard.greeting', { name }) : t('dashboard.title')}
        description={summary ?? undefined}
        actions={
          // phones: the header stays short so "Cần chú ý hôm nay" starts above the fold
          roomy ? (
            <Button asChild variant="secondary">
              <Link to="/app/digest">
                <Newspaper aria-hidden="true" />
                {t('dashboard.digest')}
              </Link>
            </Button>
          ) : undefined
        }
      >
        {summary === null && loading ? <Skeleton className="-mt-2 h-5 w-72 max-w-full" /> : null}
      </PageHeader>
      {data ? (
        <DashboardBody data={data} today={today} />
      ) : loading ? (
        <DashboardSkeleton />
      ) : (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      )}
    </div>
  );
}
