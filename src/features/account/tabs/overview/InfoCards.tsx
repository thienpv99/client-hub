// Side column of the account overview: the client's decision makers and the commercial summary.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CircleAlert, Mail, Phone } from 'lucide-react';
import type { AccountDetail, CommercialSummary } from '@/services/contract';
import { t } from '@/i18n';
import { formatDate, formatMoney, formatMoneyCompact, formatPercent } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/common/empty-state';
import { enumLabel } from '@/components/common/labels';
import { Money } from '@/components/common/money';
import { SectionCard } from '@/components/common/section-card';
import { accountTabPath } from '../../accountTabs';
import { ContactAvatar, telHref } from '../../contactParts';
import { TabLink } from './TabLink';

export function DecisionMakersCard({ account, className }: { account: AccountDetail; className?: string }) {
  const people = account.contacts.filter((c) => c.decision_role === 'decision_maker' || c.decision_role === 'approver');
  return (
    <SectionCard
      className={cn('overflow-hidden', className)}
      title={t('account.overview.people.title')}
      flush
      footer={
        <TabLink accountId={account.id} tab="contacts">
          {t('account.overview.people.all', { count: account.contacts.length })}
        </TabLink>
      }
    >
      {people.length === 0 ? (
        <EmptyState compact title={t('account.overview.people.empty')} description={t('account.overview.people.emptyHint')} />
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {people.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3 pl-4 pr-2 sm:pl-5 sm:pr-3">
              <ContactAvatar contact={c} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-table font-semibold text-ink" title={c.full_name}>
                  {c.full_name}
                </p>
                <p className="break-words text-caption">
                  {[c.title, enumLabel('decisionRole', c.decision_role)].filter(Boolean).join(t('common.separator'))}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                {c.phone ? (
                  <Button asChild variant="ghost" size="icon-sm">
                    <a
                      href={telHref(c.phone)}
                      aria-label={t('account.contacts.call', { name: c.full_name, phone: c.phone })}
                      title={c.phone}
                    >
                      <Phone aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
                {c.email ? (
                  <Button asChild variant="ghost" size="icon-sm">
                    <a
                      href={`mailto:${c.email}`}
                      aria-label={t('account.contacts.mail', { name: c.full_name, email: c.email })}
                      title={c.email}
                    >
                      <Mail aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function Stat({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption">{label}</dt>
      <dd className="mt-0.5 text-heading font-semibold tracking-tightish tabular text-ink">{children}</dd>
    </div>
  );
}

/**
 * One line under the figures: open quote / next installment. Title left, amount right on the first line; the
 * caption below uses the full width (the side column is narrow). The whole row is the link.
 */
function LinkRow({ to, title, amount, children }: { to: string; title: ReactNode; amount: number; children: ReactNode }) {
  return (
    <li className="group relative px-4 py-3 transition-colors duration-150 hover:bg-subtle sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <Link
          to={to}
          className="min-w-0 break-words rounded text-table font-medium text-foreground after:absolute after:inset-0 after:content-['']"
        >
          {title}
        </Link>
        <span className="flex shrink-0 items-center gap-1">
          <Money value={amount} compact className="text-table font-semibold text-ink" />
          <ChevronRight
            className="h-4 w-4 text-caption transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
      <p className="mt-0.5 break-words text-caption">{children}</p>
    </li>
  );
}

export function CommercialCard({ account, summary, className }: { account: AccountDetail; summary: CommercialSummary; className?: string }) {
  const hasContract = summary.contract_value > 0;
  const pct = hasContract ? Math.min(100, (summary.collected / summary.contract_value) * 100) : 0;
  const quote = summary.open_quote;
  const payment = summary.next_payment;
  return (
    <SectionCard
      className={cn('overflow-hidden', className)}
      title={t('account.overview.commercial.title')}
      actions={
        <TabLink accountId={account.id} tab="commercial">
          {t('account.overview.commercial.open')}
        </TabLink>
      }
      flush
    >
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {hasContract ? (
          <>
            <p className="text-caption">{t('account.overview.commercial.collected')}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
              <Money value={summary.collected} compact className="text-title font-semibold tracking-tightish text-ink" />
              <span className="text-caption tabular" title={formatMoney(summary.contract_value)}>
                {t('account.overview.commercial.ofContract', { value: formatMoneyCompact(summary.contract_value) })}
              </span>
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Progress
                value={pct}
                className="min-w-0 flex-1"
                aria-label={t('account.overview.commercial.collectedPct', { pct: formatPercent(pct) })}
              />
              <span className="shrink-0 text-micro font-medium tabular text-muted-foreground" aria-hidden="true">
                {formatPercent(pct)}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
              <Stat label={t('account.overview.commercial.receivable')}>
                <Money value={summary.receivable} compact />
              </Stat>
              <Stat label={t('account.overview.commercial.overdue')}>
                {summary.receivable_overdue > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-danger">
                    <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <Money value={summary.receivable_overdue} compact />
                  </span>
                ) : (
                  <span className="text-table font-normal text-muted-foreground">{t('account.overview.commercial.noOverdue')}</span>
                )}
              </Stat>
            </dl>
          </>
        ) : (
          <p className="text-table text-muted-foreground">{t('account.overview.commercial.noContract')}</p>
        )}
      </div>

      {quote || payment ? (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {quote ? (
            <LinkRow
              to={`/app/commercial/quotes/${encodeURIComponent(quote.id)}`}
              title={t('account.overview.commercial.quoteName', { title: quote.title, version: quote.version })}
              amount={quote.grand_total}
            >
              {t('account.overview.commercial.openQuoteLine', { status: enumLabel('quoteStatus', quote.status) })}
            </LinkRow>
          ) : null}
          {payment ? (
            <LinkRow to={accountTabPath(account.id, 'commercial')} title={payment.name} amount={payment.amount}>
              {payment.status === 'overdue' ? (
                <span className="inline-flex items-start gap-1 font-medium text-danger">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t('account.overview.commercial.paymentOverdueLine', { days: payment.overdue_days })}
                </span>
              ) : (
                <span className="tabular">
                  {t('account.overview.commercial.nextPaymentLine', { date: formatDate(payment.due_date) })}
                </span>
              )}
            </LinkRow>
          ) : null}
        </ul>
      ) : null}
    </SectionCard>
  );
}
