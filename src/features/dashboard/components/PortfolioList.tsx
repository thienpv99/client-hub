// Table on desktop (≥1280), cards below (iPad portrait/landscape and phones), with natural-sentence empty states.
// Two views (SPEC-CARE §6.2–6.3): "Chăm sóc" (deployments, requests, next care action, decision maker — director / AM)
// and "Tiến độ" (next milestone, waiting, money — everyone; members only have this one).
import { Building2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState, SearchEmptyState } from '@/components/common/empty-state';
import { TableSkeleton } from '@/components/common/skeletons';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBreakpoint } from '@/hooks/useMedia';
import { useStagger } from '@/hooks/useMotion';
import { t } from '@/i18n';
import type { PortfolioAccount, PortfolioView } from '../portfolioModel';
import { PortfolioCards } from './PortfolioCards';
import { PortfolioCareCards } from './PortfolioCareCards';
import { PortfolioCareTable } from './PortfolioCareTable';
import { PortfolioTable } from './PortfolioTable';

/** Loading state shaped like what will replace it: the table from 1280, the card grid below. */
export function PortfolioSkeleton({ rows = 6, showMoney = true, view = 'progress' }: { rows?: number; showMoney?: boolean; view?: PortfolioView }) {
  const breakpoint = useBreakpoint();
  if (breakpoint === 'desktop') return <TableSkeleton rows={rows} cols={view === 'care' ? 6 : showMoney ? 8 : 6} />;
  return (
    // skeleton-reveal: the card frames wait 120 ms with their blocks and fade in as one (DESIGN §8.2)
    <div role="status" aria-busy="true" aria-live="polite" className="skeleton-reveal">
      <span className="sr-only">{t('common.a11y.loading')}</span>
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2" aria-hidden="true">
        {Array.from({ length: Math.min(rows, 4) }, (_, i) => (
          <div key={i} className="flex flex-col rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
            {/* name, then status pill + tier · stage (the narrow-card header of PortfolioCards) */}
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="mt-3.5 space-y-2">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-4 w-3/5" />
            </div>
            {showMoney ? (
              <div className="mt-3.5 grid grid-cols-2 gap-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-8 w-2/3" />
              </div>
            ) : null}
            <div className="mt-4 flex justify-between border-t border-border/60 pt-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface PortfolioListProps {
  accounts: PortfolioAccount[];
  /** 'care' needs the care rows (director / AM) */
  view?: PortfolioView;
  /** number of accounts before filtering (0 → "Chưa có khách hàng nào") */
  total: number;
  showMoney: boolean;
  query?: string;
  onClear(): void;
  /** extra action for the "no accounts at all" state (e.g. "Tạo account") */
  emptyAction?: ReactNode;
  /** rows / cards rise one after another on the first paint — only where the list is the page's focal block */
  stagger?: boolean;
}

export function PortfolioList({ accounts, view = 'progress', total, showMoney, query, onClear, emptyAction, stagger = false }: PortfolioListProps) {
  const breakpoint = useBreakpoint();
  // held here, not in the table / cards: a filter that empties the list and brings it back never replays it
  const rise = useStagger(stagger);

  if (accounts.length === 0) {
    const q = query?.trim() ?? '';
    let body: ReactNode;
    if (total === 0) {
      body = (
        <EmptyState
          icon={Building2}
          title={t('dashboard.portfolio.empty.none')}
          description={t('dashboard.portfolio.empty.noneDescription')}
          action={emptyAction}
        />
      );
    } else {
      body = <SearchEmptyState entity="account" query={q} icon={Building2} onClear={onClear} />;
    }
    return <Card>{body}</Card>;
  }

  if (view === 'care') {
    return breakpoint === 'desktop' ? <PortfolioCareTable accounts={accounts} rise={rise} /> : <PortfolioCareCards accounts={accounts} rise={rise} />;
  }
  return breakpoint === 'desktop' ? (
    <PortfolioTable accounts={accounts} showMoney={showMoney} rise={rise} />
  ) : (
    <PortfolioCards accounts={accounts} showMoney={showMoney} rise={rise} />
  );
}
