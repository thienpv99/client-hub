// <1280, view "Chăm sóc": the portfolio as cards (DESIGN §4: below xl tables become cards). Same priorities as the
// care table: name + health → what is deployed and the departments covered → request flags → next care action →
// decision maker; the AM and the last care touch as a quiet footer.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AccountLogo } from '@/components/common/account-logo';
import { HealthBadge } from '@/components/common/health-badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import type { RiseProps } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { accountHref } from '../careModel';
import type { PortfolioAccount } from '../portfolioModel';
import { CareNext, CoverageLine, DecisionMakerInfo, DeployedCount, LastTouch, RequestSummary } from './CareBits';
import { AmName, TierStage } from './PortfolioBits';

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-table">{children}</dd>
    </div>
  );
}

function CareCard({ account: a, rise }: { account: PortfolioAccount; rise: RiseProps }) {
  const row = a.careRow;
  return (
    <li className={cn('min-w-0', rise.className)} style={rise.style}>
      <Card interactive asChild className="flex h-full flex-col p-4 [container-type:inline-size] sm:p-5">
        <Link to={accountHref(a.id)}>
          <div className="flex items-start gap-3">
            <AccountLogo account={a} size="md" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words text-body font-semibold leading-6 text-ink">{a.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 [@container_(min-width:380px)]:mt-0.5">
                <HealthBadge health={a.health.value} size="sm" className="[@container_(min-width:380px)]:hidden" />
                <TierStage account={a} className="min-w-0" />
              </div>
            </div>
            <HealthBadge health={a.health.value} size="sm" className="mt-0.5 hidden [@container_(min-width:380px)]:inline-flex" />
          </div>

          {row ? (
            <dl className="mt-4 grid flex-1 grid-cols-2 content-start gap-x-4 gap-y-3.5">
              <Field label={t('carePortfolio.portfolio.columns.deployed')}>
                <DeployedCount row={row} />
              </Field>
              <Field label={t('carePortfolio.portfolio.columns.departments')}>
                <CoverageLine row={row} showLabel={false} />
              </Field>
              <Field label={t('carePortfolio.portfolio.columns.requests')} className="col-span-2">
                <RequestSummary row={row} />
              </Field>
              <Field label={t('carePortfolio.portfolio.columns.care')} className="col-span-2">
                <CareNext row={row} />
              </Field>
              <Field label={t('carePortfolio.portfolio.columns.decisionMaker')} className="col-span-2">
                <DecisionMakerInfo row={row} inline />
              </Field>
            </dl>
          ) : (
            <div className="flex-1" />
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-micro text-muted-foreground">
            <AmName user={a.am} />
            {row ? <LastTouch row={row} /> : null}
          </div>
        </Link>
      </Card>
    </li>
  );
}

const NO_RISE = (): RiseProps => ({});

export function PortfolioCareCards({
  accounts,
  rise = NO_RISE,
}: {
  accounts: PortfolioAccount[];
  rise?: (index: number) => RiseProps;
}) {
  return (
    <ul className="grid gap-3 sm:gap-4 md:grid-cols-2">
      {accounts.map((a, i) => (
        <CareCard key={a.id} account={a} rise={rise(i)} />
      ))}
    </ul>
  );
}
