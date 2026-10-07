// <1280 (phones and iPad portrait/landscape): the portfolio as cards (DESIGN §4: below xl tables become cards —
// the entity line on top, then stacked label/value pairs). Same priorities as the table: name + health → next
// milestone → who we are waiting on → money → AM; the last update as a quiet footer.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AccountSummary } from '@/services/contract';
import { AccountLogo } from '@/components/common/account-logo';
import { DateText } from '@/components/common/date-text';
import { HealthBadge } from '@/components/common/health-badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { AmName, ContractValue, NextMilestoneInfo, ReceivableValue, TierStage, WaitingInline, lastTouched } from './PortfolioBits';
import { accountPath } from './PortfolioTable';

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-table">{children}</dd>
    </div>
  );
}

// From a 380px card width the health pill sits top-right of the name; narrower cards (2-up iPad, phones) put it at
// the start of the subline so the name keeps the full width. Class names stay literal for the Tailwind scanner.
function PortfolioCard({ account: a, showMoney }: { account: AccountSummary; showMoney: boolean }) {
  return (
    <li className="min-w-0">
      <Card interactive asChild className="flex h-full flex-col p-4 [container-type:inline-size] sm:p-5">
        <Link to={accountPath(a.id)}>
          <div className="flex items-start gap-3">
            <AccountLogo account={a} size="md" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words text-body font-semibold leading-6 text-ink">{a.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 [@container_(min-width:380px)]:mt-0.5">
                <HealthBadge health={a.health.value} size="sm" className="[@container_(min-width:380px)]:hidden" />
                <TierStage account={a} className="min-w-0" />
              </div>
            </div>
            <HealthBadge
              health={a.health.value}
              size="sm"
              className="mt-0.5 hidden [@container_(min-width:380px)]:inline-flex"
            />
          </div>

          <dl className="mt-4 grid flex-1 grid-cols-2 content-start gap-x-4 gap-y-3.5">
            <Field label={t('dashboard.portfolio.nextLabel')} className="col-span-2">
              <NextMilestoneInfo account={a} showProject />
            </Field>
            <Field label={t('dashboard.portfolio.columns.waiting')} className="col-span-2">
              <WaitingInline counts={a.counts} />
            </Field>
            {showMoney ? (
              <>
                <Field label={t('dashboard.portfolio.columns.contract')}>
                  <ContractValue value={a.contract_value} />
                </Field>
                <Field label={t('dashboard.portfolio.columns.receivable')}>
                  <ReceivableValue receivable={a.receivable} overdue={a.receivable_overdue} />
                </Field>
              </>
            ) : null}
          </dl>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-micro text-muted-foreground">
            <AmName user={a.am} />
            <span className="whitespace-nowrap">
              {t('dashboard.portfolio.updatedPrefix')} <DateText value={lastTouched(a)} relative />
            </span>
          </div>
        </Link>
      </Card>
    </li>
  );
}

export function PortfolioCards({ accounts, showMoney }: { accounts: AccountSummary[]; showMoney: boolean }) {
  return (
    <ul className="grid gap-3 sm:gap-4 md:grid-cols-2">
      {accounts.map((a) => (
        <PortfolioCard key={a.id} account={a} showMoney={showMoney} />
      ))}
    </ul>
  );
}
