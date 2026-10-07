// Dashboard block "Danh mục khách hàng": title + result line, quick chips + AM menu (URL-synced), table/cards.
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { AccountSummary } from '@/services/contract';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { applyCriteria, sortPortfolio } from '../portfolioModel';
import type { PortfolioParamsApi } from '../usePortfolioParams';
import { effectiveStatus, PortfolioFilters, ResultLine } from './PortfolioFilters';
import { PortfolioList } from './PortfolioList';

export interface PortfolioSectionProps {
  accounts: AccountSummary[];
  params: PortfolioParamsApi;
  showMoney: boolean;
  className?: string;
}

/** same filter on the full accounts page */
function accountsHref(params: PortfolioParamsApi, status: string | null): string {
  const search = new URLSearchParams();
  if (status) search.set('filter', status);
  if (params.amId) search.set('am', params.amId);
  const qs = search.toString();
  return qs ? `/app/accounts?${qs}` : '/app/accounts';
}

export const PortfolioSection = forwardRef<HTMLElement, PortfolioSectionProps>(function PortfolioSection(
  { accounts, params, showMoney, className },
  ref,
) {
  const status = effectiveStatus(params.status, showMoney);
  const shown = sortPortfolio(applyCriteria(accounts, { status, amId: params.amId, query: '' }), params.sort);

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
      <PortfolioFilters
        accounts={accounts}
        status={status}
        amId={params.amId}
        showMoney={showMoney}
        onStatusChange={(s) => params.update({ status: s })}
        onAmChange={(id) => params.update({ amId: id })}
      />
      <PortfolioList accounts={shown} total={accounts.length} showMoney={showMoney} onClear={params.clear} />
    </section>
  );
});
