// ≥1280, view "Chăm sóc" (SPEC-CARE §6.2–6.3): the portfolio by care — what each client has deployed, departments
// covered and the room to grow, the request flags, the next care action (date + owner, with a "Ghi lần chăm sóc"
// button) and the decision maker's relationship strength. Health sits under the name so 5 columns fit ~950px at 1280.
import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AccountLogo } from '@/components/common/account-logo';
import { HealthBadge } from '@/components/common/health-badge';
import { CareTouchButton } from '@/components/care/CareTouchButton';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RiseProps } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { accountHref } from '../careModel';
import { shortPersonName, type PortfolioAccount } from '../portfolioModel';
import { CareNext, CoverageLine, DecisionMakerInfo, DeployedCount, RequestSummary } from './CareBits';
import { DotList } from './DotList';

/**
 * clicks on links / buttons inside the row, a text selection, or anything rendered in a portal (the care-touch dialog
 * is a React child of the row: its clicks bubble here although they happen outside the row) do not navigate
 */
function shouldIgnoreRowClick(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target as HTMLElement | null;
  if (!target || !e.currentTarget.contains(target)) return true;
  if (target.closest('a,button,[role="button"],input,select,textarea')) return true;
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  return Boolean(selection && selection.toString().length > 0);
}

const NO_RISE = (): RiseProps => ({});

export function PortfolioCareTable({
  accounts,
  rise = NO_RISE,
}: {
  accounts: PortfolioAccount[];
  /** stagger recipe (useStagger) of the page's focal list; rows rise one after another on its first paint */
  rise?: (index: number) => RiseProps;
}) {
  const navigate = useNavigate();
  const head = 'px-2';
  const cell = 'h-auto px-2 py-3 align-top';

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableCaption className="sr-only">{t('carePortfolio.portfolio.tableCaption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className={head}>{t('carePortfolio.portfolio.columns.account')}</TableHead>
            <TableHead className={head}>{t('carePortfolio.portfolio.columns.deployed')}</TableHead>
            <TableHead className={head}>{t('carePortfolio.portfolio.columns.departments')}</TableHead>
            <TableHead className={head}>{t('carePortfolio.portfolio.columns.requests')}</TableHead>
            <TableHead className={head}>{t('carePortfolio.portfolio.columns.care')}</TableHead>
            <TableHead className={head}>{t('carePortfolio.portfolio.columns.decisionMaker')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((a, i) => {
            const r = rise(i);
            const row = a.careRow;
            return (
              <TableRow
                key={a.id}
                className={cn('group cursor-pointer', r.className)}
                style={r.style}
                onClick={(e) => {
                  if (!shouldIgnoreRowClick(e)) navigate(accountHref(a.id));
                }}
              >
                <TableCell className={cell}>
                  <div className="flex min-w-[11.5rem] items-start gap-3 min-[1400px]:min-w-[15rem]">
                    <AccountLogo account={a} size="sm" />
                    <div className="min-w-0">
                      <Link
                        to={accountHref(a.id)}
                        className="line-clamp-2 font-semibold text-ink underline-offset-4 hover:text-primary hover:underline"
                      >
                        {a.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <HealthBadge health={a.health.value} size="sm" variant="dot" />
                      </div>
                      <DotList
                        className="mt-1 text-caption"
                        items={[t(`enums.tier.${a.tier}`), t('carePortfolio.portfolio.am', { name: shortPersonName(a.am.full_name) })]}
                      />
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cell}>{row ? <DeployedCount row={row} /> : null}</TableCell>
                <TableCell className={cell}>{row ? <CoverageLine row={row} showLabel={false} /> : null}</TableCell>
                {/* 1280: at least 8.5rem so a pill wraps once at most ("2 chưa xử lý / quá 7 ngày"), never into three lines */}
                <TableCell className={cn(cell, 'min-w-[8.5rem] max-w-[9.5rem]')}>{row ? <RequestSummary row={row} /> : null}</TableCell>
                <TableCell className={cn(cell, 'min-w-[13rem] max-w-[17rem]')}>
                  {row ? (
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <CareNext row={row} dense />
                      </div>
                      {/* row action: on hover / focus for mouse users, always on touch screens (DESIGN §7.5 table) */}
                      <CareTouchButton
                        accountId={a.id}
                        variant="ghost"
                        iconOnly
                        label={t('care.kit.logTouchFor', { account: a.name })}
                        className="-mr-1 -mt-1 shrink-0 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
                      />
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className={cn(cell, 'max-w-[11rem]')}>{row ? <DecisionMakerInfo row={row} /> : null}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
