// Dashboard block "Danh mục khách hàng": title + result line, quick chips + AM menu (URL-synced), the view switch
// Chăm sóc · Tiến độ (SPEC-CARE §6.2) and the table / cards.
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import {
  applyCriteria,
  effectiveSort,
  effectiveStatus,
  effectiveView,
  sortPortfolio,
  type PortfolioAccount,
  type PortfolioCaps,
} from '../portfolioModel';
import type { PortfolioParamsApi } from '../usePortfolioParams';
import { PortfolioFilters, PortfolioViewSwitch, ResultLine } from './PortfolioFilters';
import { PortfolioList } from './PortfolioList';

export interface PortfolioSectionProps {
  accounts: PortfolioAccount[];
  params: PortfolioParamsApi;
  caps: PortfolioCaps;
  className?: string;
}

/** same filter and view on the full accounts page */
function accountsHref(params: PortfolioParamsApi, status: string | null): string {
  const search = new URLSearchParams();
  if (status) search.set('filter', status);
  if (params.amId) search.set('am', params.amId);
  if (params.view !== 'care') search.set('view', params.view);
  const qs = search.toString();
  return qs ? `/app/accounts?${qs}` : '/app/accounts';
}

export const PortfolioSection = forwardRef<HTMLElement, PortfolioSectionProps>(function PortfolioSection(
  { accounts, params, caps, className },
  ref,
) {
  const status = effectiveStatus(params.status, caps);
  const view = effectiveView(params.view, caps);
  const shown = sortPortfolio(applyCriteria(accounts, { status, amId: params.amId, query: '' }), effectiveSort(params.sort, caps));

  return (
    <section ref={ref} id="portfolio" aria-labelledby="portfolio-title" className={cn('min-w-0 scroll-mt-20 space-y-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="portfolio-title" className="text-heading font-semibold tracking-tightish text-ink">
            {t('dashboard.portfolio.title')}
          </h2>
          <ResultLine
            shown={shown.length}
            total={accounts.length}
            status={status}
            filtered={status !== null || params.amId !== null}
            onClear={params.clear}
          />
        </div>
        <Button asChild variant="ghost" size="sm" className="-mr-2 shrink-0 text-primary hover:text-primary">
          <Link to={accountsHref(params, status)}>
            {t('dashboard.portfolio.viewAll')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      {/* chips (scroll on phones, wrap from sm) and the view switch at the end of the row (its own row on phones) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PortfolioFilters
          accounts={accounts}
          status={status}
          amId={params.amId}
          caps={caps}
          onStatusChange={(s) => params.update({ status: s })}
          onAmChange={(id) => params.update({ amId: id })}
          className="sm:flex-1"
        />
        {caps.care ? <PortfolioViewSwitch view={view} onView={(v) => params.update({ view: v })} className="self-start" /> : null}
      </div>
      <PortfolioList accounts={shown} view={view} total={accounts.length} showMoney={caps.money} onClear={params.clear} />
    </section>
  );
});
