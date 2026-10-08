// ≥1280: the portfolio as a table (DESIGN §4 Table). The account name is a real link (keyboard); the whole row is
// clickable for mouse users. Tier and stage sit under the name so 8 columns fit the ~970px content width at 1280.
import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AccountSummary } from '@/services/contract';
import { AccountLogo } from '@/components/common/account-logo';
import { DateText } from '@/components/common/date-text';
import { HealthBadge } from '@/components/common/health-badge';
import { SMALL } from '@/components/common/cx';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RiseProps } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { AmName, ContractValue, NextMilestoneInfo, ReceivableValue, TierStage, WaitingCompact, lastTouched } from './PortfolioBits';

export function accountPath(id: string): string {
  return `/app/accounts/${id}`;
}

/** clicks on links/buttons inside the row, or a text selection, do not navigate the row */
function shouldIgnoreRowClick(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target as HTMLElement | null;
  if (target?.closest('a,button,[role="button"],input,select,textarea')) return true;
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  return Boolean(selection && selection.toString().length > 0);
}

export interface PortfolioTableProps {
  accounts: AccountSummary[];
  showMoney: boolean;
  /** stagger recipe (useStagger) of the page's focal list; rows rise one after another on its first paint */
  rise?: (index: number) => RiseProps;
}

const NO_RISE = (): RiseProps => ({});

export function PortfolioTable({ accounts, showMoney, rise = NO_RISE }: PortfolioTableProps) {
  const navigate = useNavigate();
  // 8 columns in ~950px at 1280 (sidebar open): tight side padding, name and milestone cells wrap
  const head = 'px-2';
  const cell = 'h-auto px-2 py-3';

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableCaption className="sr-only">{t('dashboard.portfolio.tableCaption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className={head}>{t('dashboard.portfolio.columns.account')}</TableHead>
            <TableHead className={head}>{t('dashboard.portfolio.columns.health')}</TableHead>
            <TableHead className={head}>{t('dashboard.portfolio.columns.next')}</TableHead>
            <TableHead className={head}>{t('dashboard.portfolio.columns.waiting')}</TableHead>
            {showMoney ? (
              <>
                <TableHead className={cn(head, 'text-right')}>{t('dashboard.portfolio.columns.contract')}</TableHead>
                <TableHead className={cn(head, 'text-right')}>{t('dashboard.portfolio.columns.receivable')}</TableHead>
              </>
            ) : null}
            <TableHead className={head}>{t('dashboard.portfolio.columns.am')}</TableHead>
            {/* below 1400 the relative time sits under the AM name: its column gave the account name its room back */}
            <TableHead className={cn(head, 'hidden text-right min-[1400px]:table-cell')}>{t('dashboard.portfolio.columns.updated')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((a, i) => {
            const r = rise(i);
            return (
              <TableRow
                key={a.id}
                className={cn('cursor-pointer', r.className)}
                style={r.style}
                onClick={(e) => {
                  if (!shouldIgnoreRowClick(e)) navigate(accountPath(a.id));
                }}
              >
                <TableCell className={cell}>
                  {/* the widest column: at 1280 most names and "tier · stage" stay on one line each (≥1400: always) */}
                  <div className="flex min-w-[13.5rem] items-center gap-3 min-[1400px]:min-w-[15rem]">
                    <AccountLogo account={a} size="sm" />
                    <div className="min-w-0">
                      <Link
                        to={accountPath(a.id)}
                        className="line-clamp-2 font-semibold text-ink underline-offset-4 hover:text-primary hover:underline"
                      >
                        {a.name}
                      </Link>
                      <TierStage account={a} className="mt-0.5" />
                    </div>
                  </div>
                </TableCell>
                <TableCell className={cell}>
                  <HealthBadge health={a.health.value} size="sm" variant="dot" />
                </TableCell>
                <TableCell className={cn(cell, 'min-w-[10rem]')}>
                  <NextMilestoneInfo account={a} dense />
                </TableCell>
                <TableCell className={cell}>
                  <WaitingCompact counts={a.counts} />
                </TableCell>
                {showMoney ? (
                  <>
                    <TableCell className={cn(cell, 'text-right')}>
                      <ContractValue value={a.contract_value} />
                    </TableCell>
                    <TableCell className={cn(cell, 'text-right')}>
                      <ReceivableValue receivable={a.receivable} overdue={a.receivable_overdue} align="end" />
                    </TableCell>
                  </>
                ) : null}
                <TableCell className={cn(cell, 'text-muted-foreground')}>
                  <AmName user={a.am} avatar={false} />
                  <span className={cn('block whitespace-nowrap min-[1400px]:hidden', SMALL)}>
                    <DateText value={lastTouched(a)} relative />
                  </span>
                </TableCell>
                <TableCell className={cn(cell, 'hidden whitespace-nowrap text-right text-muted-foreground min-[1400px]:table-cell', SMALL)}>
                  <DateText value={lastTouched(a)} relative />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
