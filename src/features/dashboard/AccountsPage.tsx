// /app/accounts — the full portfolio (DESIGN §5 list page, SPEC-CARE §6.3): header → toolbar (search 280px, quick chips
// incl. Nợ triển khai · Quá hạn chăm sóc, AM menu) → result line + sort + view switch Chăm sóc · Tiến độ → table ≥1280 /
// cards below. Filters, search, sort and view are URL-synced. Director / AM get the care rows; members see the
// "Tiến độ" view only (no care, expansion or relationship data — SPEC-CARE §5).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
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
import { PortfolioFilters, PortfolioViewSwitch, ResultLine } from './components/PortfolioFilters';
import { PortfolioList, PortfolioSkeleton } from './components/PortfolioList';
import {
  applyCriteria,
  effectiveSort,
  effectiveStatus,
  effectiveView,
  isSortKey,
  matchesStatus,
  SORT_KEYS,
  sortLabel,
  sortPortfolio,
  withCare,
  type PortfolioAccount,
  type PortfolioCaps,
} from './portfolioModel';
import { usePortfolioParams } from './usePortfolioParams';

const SEARCH_DEBOUNCE_MS = 250;

/** one plain sentence on the portfolio's health; the count lives on the result line under the toolbar */
function describeHealth(accounts: PortfolioAccount[]): string {
  if (accounts.length === 0) return t('dashboard.accounts.descriptionEmpty');
  const blocked = accounts.filter((a) => a.health.value === 'blocked').length;
  const attention = accounts.filter((a) => a.health.value === 'attention').length;
  if (blocked > 0 && attention > 0) return t('dashboard.accounts.description', { blocked, attention });
  if (blocked > 0) return t('dashboard.accounts.descriptionBlocked', { blocked });
  if (attention > 0) return t('dashboard.accounts.descriptionAttention', { attention });
  return t('dashboard.accounts.descriptionCalm');
}

/** director / AM: delivery debt and overdue care first, then health ("1 khách hàng đang nợ triển khai, 2 quá hạn …") */
function describeCare(accounts: PortfolioAccount[]): string {
  if (accounts.length === 0) return t('carePortfolio.accounts.empty');
  const count = (pred: (a: PortfolioAccount) => boolean) => accounts.filter(pred).length;
  const debt = count((a) => (a.careRow?.requests.debt ?? 0) > 0);
  const careOverdue = count((a) => matchesStatus(a, 'care_overdue'));
  const blocked = count((a) => a.health.value === 'blocked');
  const attention = count((a) => a.health.value === 'attention');
  const parts = [
    debt > 0 ? t('carePortfolio.accounts.parts.debt', { count: debt }) : null,
    careOverdue > 0 ? t('carePortfolio.accounts.parts.careOverdue', { count: careOverdue }) : null,
    blocked > 0 ? t('carePortfolio.accounts.parts.blocked', { count: blocked }) : null,
    attention > 0 ? t('carePortfolio.accounts.parts.attention', { count: attention }) : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return t('carePortfolio.accounts.calm');
  return t('carePortfolio.accounts.sentence', { parts: parts.join(', ') });
}

export function AccountsPage() {
  const viewer = useViewer();
  const params = usePortfolioParams();
  const role = viewer?.role;
  const manager = role === 'director' || role === 'am';
  // commercial figures and care rows exist for director / AM only; internal members get neither
  const caps: PortfolioCaps = { money: manager, care: manager };
  const { data, loading, error, refetch } = useQuery<PortfolioAccount[]>(async () => {
    const [accounts, care] = await Promise.all([api.listAccounts(), manager ? api.getCarePortfolio() : Promise.resolve(null)]);
    return withCare(accounts, care);
  }, [viewer?.user.id, manager]);

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

  const status = effectiveStatus(params.status, caps);
  const view = effectiveView(params.view, caps);
  const sort = effectiveSort(params.sort, caps);

  function clearAll() {
    lastPushed.current = '';
    setQuery('');
    params.clear();
  }

  const createButton = manager ? (
    <Button asChild>
      <Link to="/app/accounts/new">
        <Plus aria-hidden="true" />
        {t('dashboard.accounts.create')}
      </Link>
    </Button>
  ) : null;

  const accounts = data ?? [];
  const shown = sortPortfolio(applyCriteria(accounts, { status, amId: params.amId, query }), sort);
  const filtered = status !== null || params.amId !== null || query.trim() !== '';

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title={t('dashboard.accounts.title')}
        description={data ? (caps.care ? describeCare(data) : describeHealth(data)) : undefined}
        actions={createButton}
        actionsInline
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
              caps={caps}
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

        {/* phones: the count, the sort and an icon-only view switch share one row (review QV-25: the first card no
            longer starts ~480px down); from sm the sort keeps its label and the switch its words */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:gap-x-4">
          {data ? (
            <ResultLine shown={shown.length} total={accounts.length} status={status} filtered={filtered} onClear={clearAll} />
          ) : (
            <Skeleton className="h-4 w-28" />
          )}
          <div className="flex min-w-0 items-center gap-2 sm:flex-wrap sm:gap-x-4 sm:gap-y-2">
            <label className="flex min-w-0 items-center gap-2">
              <span className="sr-only shrink-0 text-caption sm:not-sr-only">{t('dashboard.accounts.sortLabel')}</span>
              <NativeSelect
                size="sm"
                value={sort}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isSortKey(v)) params.update({ sort: v });
                }}
                wrapperClassName="w-[9.5rem] sm:w-60"
              >
                {SORT_KEYS.filter((k) => (caps.money || k !== 'receivable') && (caps.care || k !== 'care')).map((k) => (
                  <option key={k} value={k}>
                    {sortLabel(k)}
                  </option>
                ))}
              </NativeSelect>
            </label>
            {caps.care ? <PortfolioViewSwitch view={view} onView={(v) => params.update({ view: v })} compactOnPhone className="shrink-0" /> : null}
          </div>
        </div>

        {data ? (
          <PortfolioList
            accounts={shown}
            view={view}
            total={accounts.length}
            showMoney={caps.money}
            query={query}
            onClear={clearAll}
            emptyAction={createButton}
            stagger
          />
        ) : loading ? (
          <PortfolioSkeleton rows={6} showMoney={caps.money} view={view} />
        ) : (
          <Card>
            <ErrorState error={error} onRetry={refetch} />
          </Card>
        )}
      </div>
    </div>
  );
}
