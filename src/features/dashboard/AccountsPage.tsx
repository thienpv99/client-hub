// /app/accounts — the full portfolio (DESIGN §5 list page): header → toolbar (search 280px, quick chips, AM menu)
// → result line + sort → table ≥1280 / cards below. Filters, search and sort are URL-synced.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import type { AccountSummary } from '@/services/contract';
import { api } from '@/services/api';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { effectiveStatus, PortfolioFilters, ResultLine } from './components/PortfolioFilters';
import { PortfolioList, PortfolioSkeleton } from './components/PortfolioList';
import { applyCriteria, isSortKey, SORT_KEYS, sortPortfolio } from './portfolioModel';
import { useDocumentTitle } from './useDocumentTitle';
import { usePortfolioParams } from './usePortfolioParams';

const SEARCH_DEBOUNCE_MS = 250;

/** one plain sentence on the portfolio's health; the count lives on the result line under the toolbar */
function describe(accounts: AccountSummary[]): string {
  if (accounts.length === 0) return t('dashboard.accounts.descriptionEmpty');
  const blocked = accounts.filter((a) => a.health.value === 'blocked').length;
  const attention = accounts.filter((a) => a.health.value === 'attention').length;
  if (blocked > 0 && attention > 0) return t('dashboard.accounts.description', { blocked, attention });
  if (blocked > 0) return t('dashboard.accounts.descriptionBlocked', { blocked });
  if (attention > 0) return t('dashboard.accounts.descriptionAttention', { attention });
  return t('dashboard.accounts.descriptionCalm');
}

export function AccountsPage() {
  useDocumentTitle(t('dashboard.accounts.title'));
  const viewer = useViewer();
  const params = usePortfolioParams();
  const { data, loading, error, refetch } = useQuery(() => api.listAccounts(), [viewer?.user.id]);

  // the box filters instantly; the URL (?q=) follows after a short pause so typing never fights the router
  const [query, setQuery] = useState(params.query);
  const lastPushed = useRef(params.query);
  // the router's updater sees the search params of the render it came from: always push with the latest one,
  // so a chip clicked during the pause is not overwritten
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

  const role = viewer?.role;
  const canCreate = role === 'director' || role === 'am';
  // commercial figures exist for director / AM only; internal members get zeros, so the money columns are dropped
  const showMoney = role === 'director' || role === 'am';
  const status = effectiveStatus(params.status, showMoney);

  function clearAll() {
    lastPushed.current = '';
    setQuery('');
    params.clear();
  }

  const createButton = canCreate ? (
    <Button asChild>
      <Link to="/app/accounts/new">
        <Plus aria-hidden="true" />
        {t('dashboard.accounts.create')}
      </Link>
    </Button>
  ) : null;

  const accounts = data ?? [];
  const shown = sortPortfolio(applyCriteria(accounts, { status, amId: params.amId, query }), params.sort);
  const filtered = status !== null || params.amId !== null || query.trim() !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.accounts.title')}
        description={data ? describe(data) : undefined}
        actions={createButton}
      >
        {data ? null : <Skeleton className="-mt-2 h-5 w-64 max-w-full" />}
      </PageHeader>

      <div className="space-y-4">
        {/* toolbar: search + quick chips + AM menu. Below lg the chips get their own row under a full-width search;
            from lg everything is one wrapping row of equal-height items (the filters' wrapper dissolves), so at 1024
            the AM menu wraps under the search instead of pushing the row out of line. */}
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <Input
            type="search"
            icon={<Search />}
            inputSize="sm"
            wrapperClassName="w-full lg:w-[280px] lg:shrink-0"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault();
                setQuery('');
              }
            }}
            placeholder={t('dashboard.accounts.searchPlaceholder')}
            aria-label={t('dashboard.accounts.searchLabel')}
            autoComplete="off"
            enterKeyHint="search"
          />
          {data ? (
            <PortfolioFilters
              accounts={accounts}
              status={status}
              amId={params.amId}
              query={query}
              showMoney={showMoney}
              onStatusChange={(s) => params.update({ status: s })}
              onAmChange={(id) => params.update({ amId: id })}
              className="lg:contents"
            />
          ) : loading ? (
            <div className="flex gap-2" aria-hidden="true">
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {data ? (
            <ResultLine shown={shown.length} total={accounts.length} status={status} filtered={filtered} onClear={clearAll} />
          ) : (
            <Skeleton className="h-4 w-28" />
          )}
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-caption">{t('dashboard.accounts.sortLabel')}</span>
            <NativeSelect
              size="sm"
              value={params.sort}
              onChange={(e) => {
                const v = e.target.value;
                if (isSortKey(v)) params.update({ sort: v });
              }}
              wrapperClassName="w-44"
            >
              {SORT_KEYS.filter((k) => showMoney || k !== 'receivable').map((k) => (
                <option key={k} value={k}>
                  {t(`dashboard.accounts.sort.${k}`)}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>

        {data ? (
          <PortfolioList
            accounts={shown}
            total={accounts.length}
            showMoney={showMoney}
            query={query}
            onClear={clearAll}
            emptyAction={createButton}
          />
        ) : loading ? (
          <PortfolioSkeleton rows={6} showMoney={showMoney} />
        ) : (
          <Card>
            <ErrorState error={error} onRetry={refetch} />
          </Card>
        )}
      </div>
    </div>
  );
}
