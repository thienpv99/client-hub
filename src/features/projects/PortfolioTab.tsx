// "Danh mục" tab: KPI filters → toolbar (search, health chips, AM, status — URL-synced) → every project with health,
// progress, next milestone, waiting counts, people and end dates. Table from 1280px, cards below.
import { useEffect, useRef, useState } from 'react';
import { FolderKanban, SearchX } from 'lucide-react';
import type { ProjectPortfolioRow } from '@/services/crmContract';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { KpiSkeleton, TableSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { PortfolioToolbar, ResultLine } from './PortfolioFilters';
import { PortfolioCards } from './PortfolioCards';
import { PortfolioTable } from './PortfolioTable';
import { ProjectKpis } from './ProjectKpis';
import { applyCriteria, portfolioKpis, shortPersonName, sortBySeverity, type ProjectFilter } from './projectsModel';
import type { ProjectParamsApi } from './useProjectParams';

const SEARCH_DEBOUNCE_MS = 250;

/** bring the list into view when a KPI filter is applied and the list starts low on the screen (phones) */
function revealList(el: HTMLElement | null) {
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  if (top > window.innerHeight * 0.6 || top < 0) {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
}

export interface PortfolioTabProps {
  rows: ProjectPortfolioRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry(): void;
  params: ProjectParamsApi;
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8">
      <KpiSkeleton count={4} className="grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4" />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Skeleton className="h-11 w-full rounded-lg sm:h-8 sm:w-[280px]" />
          <Skeleton className="h-11 w-32 rounded-full sm:h-8" />
          <Skeleton className="h-11 w-28 rounded-full sm:h-8" />
          <Skeleton className="h-11 w-32 rounded-full sm:h-8" />
        </div>
        <TableSkeleton rows={6} cols={7} />
      </div>
    </div>
  );
}

export function PortfolioTab({ rows, loading, error, onRetry, params }: PortfolioTabProps) {
  const wide = useMediaQuery('(min-width: 1280px)');
  const listRef = useRef<HTMLDivElement>(null);

  // the box filters instantly; the URL (?q=) follows after a short pause so typing never fights the router
  const [query, setQuery] = useState(params.query);
  const lastPushed = useRef(params.query);
  const updateRef = useRef(params.update);
  updateRef.current = params.update;
  useEffect(() => {
    if (params.query !== lastPushed.current) {
      lastPushed.current = params.query;
      setQuery(params.query);
    }
  }, [params.query]);
  useEffect(() => {
    if (query === lastPushed.current) return;
    const timer = window.setTimeout(() => {
      lastPushed.current = query.trim() ? query : '';
      updateRef.current({ query });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  function clearAll() {
    lastPushed.current = '';
    setQuery('');
    params.clear();
  }

  function onKpiFilter(filter: ProjectFilter) {
    const next = params.filter === filter ? null : filter;
    params.update({ filter: next });
    if (next) requestAnimationFrame(() => revealList(listRef.current));
  }

  if (!rows) {
    if (loading) return <PortfolioSkeleton />;
    return (
      <Card>
        <ErrorState error={error} onRetry={onRetry} />
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon={FolderKanban} title={t('projects.portfolio.empty.none')} description={t('projects.portfolio.empty.noneDescription')} />
      </Card>
    );
  }

  const kpis = portfolioKpis(rows);
  const criteria = { filter: params.filter, amId: params.amId, status: params.status, query };
  const shown = sortBySeverity(applyCriteria(rows, criteria));
  const am = rows.find((p) => p.am.id === params.amId)?.am ?? null;
  const q = query.trim();

  return (
    <div className="space-y-6 md:space-y-8">
      <ProjectKpis kpis={kpis} active={params.filter} onFilter={onKpiFilter} />

      <div ref={listRef} className="scroll-mt-20 space-y-3">
        <PortfolioToolbar
          rows={rows}
          query={query}
          onQueryChange={setQuery}
          filter={params.filter}
          onFilterChange={(f) => params.update({ filter: f })}
          amId={params.amId}
          onAmChange={(id) => params.update({ amId: id })}
          status={params.status}
          onStatusChange={(s) => params.update({ status: s })}
        />
        <ResultLine
          shown={shown.length}
          total={rows.length}
          filter={params.filter}
          status={params.status}
          amName={am ? shortPersonName(am.full_name) : null}
          query={query}
          onClear={clearAll}
        />
        {shown.length === 0 ? (
          <Card>
            <EmptyState
              icon={SearchX}
              title={q ? t('projects.portfolio.empty.search', { query: q }) : t('projects.portfolio.empty.filtered')}
              description={t('projects.portfolio.empty.filteredDescription')}
              action={
                <Button variant="secondary" onClick={clearAll}>
                  {t('projects.filters.clear')}
                </Button>
              }
            />
          </Card>
        ) : wide ? (
          <PortfolioTable rows={shown} />
        ) : (
          <PortfolioCards rows={shown} />
        )}
      </div>
    </div>
  );
}
