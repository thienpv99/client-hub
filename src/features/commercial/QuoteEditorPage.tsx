// /app/commercial/quotes/new?account=… and /app/commercial/quotes/:quoteId (director / AM).
// Loads the quote (or the account for a new one), the price list with the account's negotiated prices and the
// previous version for the live diff; editable drafts get the workspace, everything else the read-only view.
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';
import type { AccountRef } from '@/services/contract';
import { isFullSettings } from '@/services/contract';
import { AccountLogo } from '@/components/common/account-logo';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { CardSkeleton, ListSkeleton } from '@/components/common/skeletons';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { api } from '@/services/api';
import { buildCatalog } from './editor/draft';
import { QuoteReadOnly } from './editor/QuoteReadOnly';
import { QuoteWorkspace } from './editor/QuoteWorkspace';

function useCatalog(accountId: string | null, enabled: boolean) {
  return useQuery(
    async () => {
      const [items, prices] = await Promise.all([api.listPriceItems({ includeInactive: true }), api.listAccountPrices(accountId as string)]);
      return { items, prices };
    },
    [accountId],
    { enabled: enabled && !!accountId },
  );
}

/** header + main column (info, lines) + side summary — the real layout's sizes */
function EditorSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-7 w-80 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5 xl:col-start-2 xl:row-start-1">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-8 w-48" />
          <Skeleton className="mt-2 h-3 w-40" />
          <Skeleton className="mt-6 h-1.5 w-full rounded-full" />
          <Skeleton className="mt-6 h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-6 xl:col-start-1 xl:row-start-1">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={6} />
        </div>
      </div>
    </div>
  );
}

function ExistingQuote({ quoteId }: { quoteId: string }) {
  const quoteQ = useQuery(() => api.getQuote(quoteId), [quoteId]);
  const quote = quoteQ.data;
  const accountId = quote?.account.id ?? null;
  const editable = !!quote?.can.edit;
  const catalogQ = useCatalog(accountId, editable);
  const parentId = quote?.parent_id ?? null;
  const parentQ = useQuery(() => api.getQuote(parentId as string), [parentId], { enabled: editable && !!parentId });
  const projectsQ = useQuery(() => api.listProjects(accountId as string), [accountId], { enabled: editable && !!accountId });
  const activitiesQ = useQuery(() => api.listActivities({ accountId: accountId as string, limit: 300 }), [accountId], {
    enabled: !!accountId,
  });

  const catalog = useMemo(
    () => (catalogQ.data && quote ? buildCatalog(catalogQ.data.items, catalogQ.data.prices, quote.lines) : null),
    [catalogQ.data, quote],
  );
  const projects = useMemo(() => (projectsQ.data ?? []).map((p) => ({ id: p.id, name: p.name })), [projectsQ.data]);

  if (quoteQ.loading) return <EditorSkeleton />;
  if (!quote) {
    return (
      <div className="space-y-6">
        <PageHeader compact title={t('commercial.editor.notFoundTitle')} />
        <Card>
          <ErrorState error={quoteQ.error} onRetry={quoteQ.refetch} />
        </Card>
      </div>
    );
  }
  const parentVersion = quote.parent_id ? (quote.versions.find((v) => v.id === quote.parent_id)?.version ?? null) : null;
  const activities = activitiesQ.data ?? [];

  if (!editable) return <QuoteReadOnly quote={quote} activities={activities} parentVersion={parentVersion} />;
  if (catalogQ.error && !catalogQ.data) {
    return (
      <Card>
        <ErrorState error={catalogQ.error} onRetry={catalogQ.refetch} />
      </Card>
    );
  }
  if (!catalog || (parentId && !parentQ.data && !parentQ.error)) return <EditorSkeleton />;
  return (
    <QuoteWorkspace
      quote={quote}
      account={quote.account}
      catalog={catalog}
      thresholdPct={quote.threshold_pct}
      projects={projects}
      parentLines={parentQ.data?.lines ?? null}
      parentVersion={parentVersion}
      activities={activities}
    />
  );
}

function AccountPicker() {
  const accountsQ = useQuery(() => api.listAccounts(), []);
  return (
    <div className="space-y-6">
      <PageHeader title={t('commercial.editor.newTitle')} description={t('commercial.editor.pickAccount')} />
      {accountsQ.loading ? (
        <ListSkeleton rows={5} />
      ) : !accountsQ.data ? (
        <Card>
          <ErrorState error={accountsQ.error} onRetry={accountsQ.refetch} />
        </Card>
      ) : accountsQ.data.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title={t('commercial.editor.noAccounts')} />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accountsQ.data.map((a) => (
            <li key={a.id} className="min-w-0">
              <Card interactive asChild>
                <Link to={`/app/commercial/quotes/new?account=${encodeURIComponent(a.id)}`} className="flex min-h-tap items-center gap-3 p-4">
                  <AccountLogo account={a} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{a.name}</span>
                    <span className="block truncate text-caption">
                      {t(`enums.stage.${a.stage}`)} · {a.am.full_name}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-caption" aria-hidden="true" />
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewQuote({ accountId }: { accountId: string }) {
  const accountQ = useQuery(() => api.getAccount(accountId), [accountId]);
  const catalogQ = useCatalog(accountId, true);
  const settingsQ = useQuery(() => api.getSettings(), []);
  const account = accountQ.data;
  const catalog = useMemo(() => (catalogQ.data ? buildCatalog(catalogQ.data.items, catalogQ.data.prices) : null), [catalogQ.data]);
  const ref: AccountRef | null = account
    ? { id: account.id, name: account.name, short_name: account.short_name, logo_url: account.logo_url, brand_color: account.brand_color }
    : null;
  const projects = useMemo(() => (account?.projects ?? []).map((p) => ({ id: p.id, name: p.name })), [account]);

  const error = accountQ.error ?? catalogQ.error;
  if (error && (!account || !catalog)) {
    return (
      <div className="space-y-6">
        <PageHeader compact title={t('commercial.editor.newTitle')} />
        <Card>
          <ErrorState error={error} onRetry={() => (accountQ.error ? accountQ.refetch() : catalogQ.refetch())} />
        </Card>
      </div>
    );
  }
  if (!ref || !catalog || !settingsQ.data) return <EditorSkeleton />;
  const threshold = isFullSettings(settingsQ.data) ? settingsQ.data.discount_approval_threshold_pct : 10;
  return (
    <QuoteWorkspace
      quote={null}
      account={ref}
      catalog={catalog}
      thresholdPct={threshold}
      projects={projects}
      parentLines={null}
      parentVersion={null}
      activities={[]}
    />
  );
}

export function QuoteEditorPage() {
  const { quoteId } = useParams();
  const [params] = useSearchParams();
  const accountId = params.get('account');
  if (quoteId) return <ExistingQuote key={quoteId} quoteId={quoteId} />;
  if (!accountId) return <AccountPicker />;
  return <NewQuote key={accountId} accountId={accountId} />;
}
