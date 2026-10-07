// One quote as a card (quote list below xl). The whole card links to the quote (hover lift, DESIGN §7.5).
import { Link } from 'react-router-dom';
import type { QuoteSummary } from '@/services/contract';
import { AccountLogo } from '@/components/common/account-logo';
import { DateText } from '@/components/common/date-text';
import { Money } from '@/components/common/money';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { ApprovalState, DiscountValue, QuoteStatusBadge } from './status';

export function quoteHref(id: string): string {
  return `/app/commercial/quotes/${id}`;
}

export function QuoteCard({ quote, className }: { quote: QuoteSummary; className?: string }) {
  return (
    <Card interactive asChild className={className}>
      <Link to={quoteHref(quote.id)} className="flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <AccountLogo account={quote.account} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-table font-medium text-foreground">{quote.account.name}</p>
              <p className="text-caption tabular">{t('commercial.quote.codeVersion', { code: quote.code, version: quote.version })}</p>
            </div>
          </div>
          <QuoteStatusBadge status={quote.status} size="sm" className="mt-0.5" />
        </div>
        <p className="mt-3 line-clamp-2 text-heading font-semibold tracking-tightish text-ink">{quote.title}</p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2 pt-4">
          <div>
            <p className="text-caption">{t('commercial.quote.total')}</p>
            <Money value={quote.grand_total} className="text-title font-semibold tracking-tightish text-ink" />
          </div>
          <div className="flex flex-col items-end gap-1 text-table">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              {t('commercial.quote.discountShort')}
              <DiscountValue pct={quote.effective_discount_pct} over={quote.needs_approval} />
            </span>
            {quote.status === 'draft' ? (
              <ApprovalState status={quote.status} needsApproval={quote.needs_approval} approved={quote.approved} size="sm" quiet />
            ) : (
              <span className="text-caption">
                {t('commercial.quote.updated')} <DateText value={quote.updated_at} relative />
              </span>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}
