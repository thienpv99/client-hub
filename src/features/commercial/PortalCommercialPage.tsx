// /portal/commercial (client_owner): quotes waiting for a decision first (the focal block: big total + one primary
// action), then contracts with the payment schedule as calm divided rows; the quotes already received sit in a side
// column from lg (below it, after the contracts) — no dense tables (SPEC §5.4, §7).
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, ChevronRight, CircleCheck, FileSignature, FileText } from 'lucide-react';
import type { ContractView, QuoteSummary } from '@/services/contract';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Money } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton } from '@/components/common/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { capitalize, t } from '@/i18n';
import { formatDate, formatRelativeDays } from '@/lib/format';
import { api } from '@/services/api';
import { fmtPct } from './lib';
import { PortalPaymentRow } from './components/PortalPaymentRow';
import { QuoteStatusBadge } from './components/status';

function portalQuoteHref(id: string): string {
  return `/portal/commercial/quotes/${id}`;
}

function SectionTitle({ id, children, aside }: { id: string; children: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-heading font-semibold tracking-tightish text-ink">
        {children}
      </h2>
      {aside ? <span className="text-caption">{aside}</span> : null}
    </div>
  );
}

function PendingQuoteCard({ quote, salutation }: { quote: QuoteSummary; salutation: string }) {
  const days = diffDays(quote.valid_until, todayISO());
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <QuoteStatusBadge status={quote.status} audience="client" />
            <Badge variant={days <= 3 ? 'warning' : 'default'}>
              <CalendarClock aria-hidden="true" />
              {t('commercial.portal.validChip', { rel: formatRelativeDays(days), date: formatDate(quote.valid_until) })}
            </Badge>
          </div>
          <h3 className="break-words text-title font-semibold tracking-tightish text-ink">{quote.title}</h3>
          <p className="text-caption tabular">{t('commercial.quote.codeVersion', { code: quote.code, version: quote.version })}</p>
        </div>
        <div className="shrink-0 md:text-right">
          <p className="text-caption">{t('commercial.portal.totalVat')}</p>
          <Money value={quote.grand_total} className="mt-0.5 block text-kpi font-semibold tracking-display text-ink" />
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-border/60 pt-4 md:flex-row md:items-center md:justify-between">
        <p className="text-table text-muted-foreground">{capitalize(t('commercial.portal.pendingHint', { salutation }))}</p>
        <Button asChild size="touch" className="w-full shrink-0 md:w-auto">
          <Link to={portalQuoteHref(quote.id)}>
            {t('commercial.portal.review')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

function ContractBlock({ contract }: { contract: ContractView }) {
  const paid = contract.payments.filter((p) => p.status === 'paid').length;
  const pct = contract.value > 0 ? Math.min(100, (contract.collected / contract.value) * 100) : 0;
  return (
    <Card className="overflow-hidden">
      <div className="p-4 sm:p-5">
        <h3 className="break-words text-heading font-semibold tracking-tightish text-ink">{contract.title}</h3>
        <p className="mt-0.5 text-caption tabular">
          {contract.code}
          {contract.signed_date ? ` · ${t('commercial.contract.signedOn', { date: formatDate(contract.signed_date) })}` : ''}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-caption">{t('commercial.contract.value')}</dt>
            <dd className="mt-0.5 text-title font-semibold tracking-tightish text-ink">
              <Money value={contract.value} />
            </dd>
          </div>
          <div>
            <dt className="text-caption">{t('commercial.portal.paidSoFar')}</dt>
            <dd className="mt-0.5 text-title font-semibold tracking-tightish text-foreground">
              <Money value={contract.collected} />
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={pct} className="flex-1" aria-label={t('commercial.portal.paidPct', { pct: fmtPct(pct) })} />
          <span className="shrink-0 text-micro font-medium tabular text-muted-foreground">
            {t('commercial.portal.paidCount', { paid, total: contract.payments.length })}
          </span>
        </div>
      </div>
      <div className="border-t border-border/60">
        <h4 className="px-4 pb-1 pt-3.5 text-micro font-medium text-muted-foreground sm:px-5">{t('commercial.portal.schedule')}</h4>
        {contract.payments.length === 0 ? (
          <p className="px-4 pb-4 text-table text-muted-foreground sm:px-5">{t('commercial.contract.noPayments')}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {contract.payments.map((p) => (
              <PortalPaymentRow key={p.id} payment={p} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** "Báo giá đã nhận": full-width rows below lg, a narrow side card from lg (amount + status under the title) */
function HistoryCard({ quotes }: { quotes: QuoteSummary[] }) {
  return (
    <SectionCard title={t('commercial.portal.historyTitle')} flush>
      <ul className="divide-y divide-border/60 border-t border-border/60">
        {quotes.map((q) => (
          <li key={q.id}>
            <Link
              to={portalQuoteHref(q.id)}
              className="group flex min-h-tap items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-subtle sm:px-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{q.title}</span>
                <span className="block text-caption tabular">{t('commercial.quote.codeVersion', { code: q.code, version: q.version })}</span>
                <span className="mt-1.5 hidden flex-wrap items-center gap-x-3 gap-y-1 lg:flex">
                  <Money value={q.grand_total} className="text-table font-semibold text-ink" />
                  <QuoteStatusBadge status={q.status} audience="client" size="sm" />
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3 lg:hidden">
                <Money value={q.grand_total} className="text-table font-semibold text-ink" />
                <QuoteStatusBadge status={q.status} audience="client" size="sm" />
              </span>
              <ChevronRight
                className="hidden h-4 w-4 shrink-0 text-caption transition-transform group-hover:translate-x-0.5 sm:block"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function PortalCommercialPage() {
  const viewer = useViewer();
  const salutation = viewer?.user.salutation ?? t('commercial.portal.salutationFallback');
  const quotesQ = useQuery(() => api.listQuotes(), []);
  const contractsQ = useQuery(() => api.listContracts(), []);
  const quotes = quotesQ.data ?? [];
  // a sent version is decidable only while it is the newest one of its code the client can see
  const newest = new Map<string, number>();
  for (const q of quotes) newest.set(q.code, Math.max(newest.get(q.code) ?? 0, q.version));
  const pending = quotes.filter((q) => q.status === 'sent' && newest.get(q.code) === q.version);
  const others = quotes.filter((q) => !pending.includes(q));
  const hasHistory = others.length > 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader title={t('commercial.portal.title')} description={t('commercial.portal.description')} />

      <div className={hasHistory ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6' : undefined}>
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="portal-quotes-pending" className="space-y-3">
            <SectionTitle
              id="portal-quotes-pending"
              aside={pending.length > 1 ? t('commercial.portal.pendingCount', { count: pending.length }) : undefined}
            >
              {capitalize(t('commercial.portal.pendingTitle', { salutation }))}
            </SectionTitle>
            {quotesQ.loading ? (
              <CardSkeleton lines={3} />
            ) : !quotesQ.data ? (
              <Card>
                <ErrorState error={quotesQ.error} onRetry={quotesQ.refetch} />
              </Card>
            ) : pending.length === 0 ? (
              <Card className="flex items-center gap-3.5 p-4 sm:p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft">
                  <CircleCheck className="h-5 w-5 text-success" aria-hidden="true" />
                </span>
                <p className="text-body text-foreground">{capitalize(t('commercial.portal.pendingEmpty', { salutation }))}</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {pending.map((q) => (
                  <PendingQuoteCard key={q.id} quote={q} salutation={salutation} />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="portal-contracts" className="space-y-3">
            <SectionTitle id="portal-contracts">{t('commercial.portal.contractsTitle')}</SectionTitle>
            {contractsQ.loading ? (
              <CardSkeleton lines={5} />
            ) : !contractsQ.data ? (
              <Card>
                <ErrorState error={contractsQ.error} onRetry={contractsQ.refetch} />
              </Card>
            ) : contractsQ.data.length === 0 ? (
              <Card>
                <EmptyState compact icon={FileSignature} title={t('commercial.portal.noContracts')} />
              </Card>
            ) : (
              <div className="space-y-4">
                {contractsQ.data.map((c) => (
                  <ContractBlock key={c.id} contract={c} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* lg: aligned with the first section's card, under the section titles' line */}
        {hasHistory ? (
          <div className="min-w-0 lg:pt-9">
            <HistoryCard quotes={others} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
