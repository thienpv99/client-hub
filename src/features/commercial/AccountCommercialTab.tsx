// Account detail → "Thương mại" tab: money summary (KPI row, the focal block), quotes with their versions,
// contracts with the payment schedule, and the account's negotiated prices. Director / AM only; anyone else gets a
// calm "no access" note.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, FilePlus2, FileSignature, FileText, Lock, Wallet } from 'lucide-react';
import type { AccountDetail, QuoteSummary } from '@/services/contract';
import { DateText } from '@/components/common/date-text';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { KpiCard } from '@/components/common/kpi-card';
import { Money } from '@/components/common/money';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton, KpiSkeleton, ListSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { api } from '@/services/api';
import { canManageCommercial, canReadInternalCommercial, errorCode } from './lib';
import { AccountPricesCard } from './components/AccountPricesCard';
import { ContractCard } from './components/ContractCard';
import { quoteHref } from './components/QuoteCard';
import { ApprovalState, DiscountValue, QuoteStatusBadge, quoteStatusLabel } from './components/status';

export interface AccountCommercialTabProps {
  account: AccountDetail;
}

function NoAccess() {
  return (
    <Card>
      <EmptyState icon={Lock} title={t('commercial.account.noAccessTitle')} description={t('commercial.account.noAccessHint')} />
    </Card>
  );
}

/** quotes grouped by code: latest version first, older versions as links */
function groupQuotes(quotes: QuoteSummary[]): { latest: QuoteSummary; older: QuoteSummary[] }[] {
  const groups = new Map<string, QuoteSummary[]>();
  for (const q of quotes) {
    const list = groups.get(q.code);
    if (list) list.push(q);
    else groups.set(q.code, [q]);
  }
  return [...groups.values()].map((list) => {
    const sorted = [...list].sort((a, b) => b.version - a.version);
    return { latest: sorted[0] as QuoteSummary, older: sorted.slice(1) };
  });
}

function QuoteRow({ latest, older }: { latest: QuoteSummary; older: QuoteSummary[] }) {
  return (
    <div className="flex flex-col gap-3 transition-colors hover:bg-subtle md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="min-w-0">
        <Link
          to={quoteHref(latest.id)}
          className="touch-tap inline-flex min-h-tap items-center break-words rounded font-semibold text-ink hover:text-primary md:min-h-0"
        >
          {latest.title}
        </Link>
        <p className="flex flex-wrap items-center gap-x-1.5 text-caption">
          <span className="tabular">{t('commercial.quote.codeVersion', { code: latest.code, version: latest.version })}</span>
          <span aria-hidden="true">·</span>
          <span>
            {t('commercial.quote.updated')} <DateText value={latest.updated_at} relative />
          </span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <QuoteStatusBadge status={latest.status} size="sm" />
          {/* drafts only: for the other states the status pill already says where approval stands */}
          {latest.status === 'draft' ? (
            <ApprovalState status={latest.status} needsApproval={latest.needs_approval} approved={latest.approved} size="sm" quiet />
          ) : null}
        </div>
        {older.length > 0 ? (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-caption">
            <span>{t('commercial.account.olderVersions')}</span>
            {older.map((o) => (
              <Link
                key={o.id}
                to={quoteHref(o.id)}
                className="touch-tap inline-flex min-h-tap items-center rounded tabular text-primary hover:underline md:min-h-0"
              >
                {t('commercial.account.olderVersionLink', { version: o.version, status: quoteStatusLabel(o.status) })}
              </Link>
            ))}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-row items-baseline justify-between gap-4 md:flex-col md:items-end md:gap-1">
        <Money value={latest.grand_total} className="text-heading font-semibold tracking-tightish text-ink" />
        <span className="inline-flex items-center gap-1.5 text-caption">
          {t('commercial.quote.discountShort')}
          <DiscountValue pct={latest.effective_discount_pct} over={latest.needs_approval} />
        </span>
      </div>
    </div>
  );
}

function QuotesSection({ accountId, manage }: { accountId: string; manage: boolean }) {
  const query = useQuery(() => api.listQuotes({ accountId }), [accountId]);
  const groups = useMemo(() => groupQuotes(query.data ?? []), [query.data]);
  const newHref = `/app/commercial/quotes/new?account=${encodeURIComponent(accountId)}`;
  const actions = manage ? (
    <Button size="sm" variant="secondary" asChild>
      <Link to={newHref}>
        <FilePlus2 aria-hidden="true" />
        {t('commercial.page.createQuote')}
      </Link>
    </Button>
  ) : null;

  if (query.loading) return <ListSkeleton rows={2} />;
  if (!query.data) {
    return (
      <SectionCard title={t('commercial.account.quotesTitle')} actions={actions}>
        <ErrorState error={query.error} onRetry={query.refetch} compact />
      </SectionCard>
    );
  }
  if (groups.length === 0) {
    return (
      <SectionCard title={t('commercial.account.quotesTitle')} actions={actions}>
        <EmptyState compact icon={FileText} title={t('commercial.account.noQuotes')} description={manage ? t('commercial.account.noQuotesHint') : undefined} />
      </SectionCard>
    );
  }
  return (
    <SectionCard
      title={t('commercial.account.quotesTitle')}
      description={t('commercial.account.quotesCount', { count: groups.length })}
      actions={actions}
      divided
    >
      {groups.map(({ latest, older }) => (
        <QuoteRow key={latest.code} latest={latest} older={older} />
      ))}
    </SectionCard>
  );
}

function ContractsSection({ accountId, manage }: { accountId: string; manage: boolean }) {
  const query = useQuery(() => api.listContracts({ accountId }), [accountId]);
  return (
    <section aria-labelledby="account-contracts" className="space-y-3">
      <h2 id="account-contracts" className="text-heading font-semibold tracking-tightish text-ink">
        {t('commercial.account.contractsTitle')}
      </h2>
      {query.loading ? (
        <CardSkeleton lines={5} />
      ) : !query.data ? (
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} compact />
        </Card>
      ) : query.data.length === 0 ? (
        <Card>
          <EmptyState compact icon={FileSignature} title={t('commercial.account.noContracts')} />
        </Card>
      ) : (
        <div className="space-y-4">
          {query.data.map((c) => (
            <ContractCard key={c.id} contract={c} manage={manage} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Money row (the focal block). The account header above already shows the contract value, so the row starts with
 * what was collected out of it (progress), then what is owed and what is late.
 */
function Summary({ account }: { account: AccountDetail }) {
  const c = account.commercial;
  if (!c) return <KpiSkeleton count={3} className="grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3" />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
      <KpiCard
        className="col-span-2 xl:col-span-1"
        label={t('commercial.account.kpi.collected')}
        value={formatMoneyCompact(c.collected)}
        icon={CircleCheck}
        sub={c.contract_value > 0 ? undefined : t('commercial.account.kpi.noContract')}
        progress={
          c.contract_value > 0
            ? { value: c.collected, max: c.contract_value, label: t('commercial.account.kpi.collectedOfValue', { value: formatMoneyCompact(c.contract_value) }) }
            : undefined
        }
      />
      <KpiCard
        label={t('commercial.account.kpi.receivable')}
        value={formatMoneyCompact(c.receivable)}
        icon={Wallet}
        sub={c.next_payment ? t('commercial.account.kpi.nextPayment', { name: c.next_payment.name }) : t('commercial.account.kpi.noNextPayment')}
      />
      <KpiCard
        label={t('commercial.account.kpi.overdue')}
        value={formatMoneyCompact(c.receivable_overdue)}
        icon={c.receivable_overdue > 0 ? CircleAlert : CircleCheck}
        tone={c.receivable_overdue > 0 ? 'danger' : 'success'}
        sub={c.receivable_overdue > 0 ? t('commercial.account.kpi.overdueSub') : t('commercial.account.kpi.overdueNone')}
      />
    </div>
  );
}

function Content({ account, manage }: { account: AccountDetail; manage: boolean }) {
  // a probe call: members, clients or a revoked AM get 'forbidden' → calm note instead of a wall of errors
  const probe = useQuery(() => api.listQuotes({ accountId: account.id, latestOnly: true }), [account.id]);
  const code = errorCode(probe.error);
  if (!probe.data && (code === 'forbidden' || code === 'not_found')) return <NoAccess />;
  return (
    <div className="space-y-6 md:space-y-8">
      <Summary account={account} />
      <QuotesSection accountId={account.id} manage={manage} />
      <ContractsSection accountId={account.id} manage={manage} />
      <AccountPricesCard accountId={account.id} manage={manage} />
    </div>
  );
}

export function AccountCommercialTab({ account }: AccountCommercialTabProps) {
  const viewer = useViewer();
  if (!canReadInternalCommercial(viewer)) return <NoAccess />;
  const manage = canManageCommercial(viewer) && (viewer?.role === 'director' || account.am.id === viewer?.user.id);
  return <Content account={account} manage={manage} />;
}
