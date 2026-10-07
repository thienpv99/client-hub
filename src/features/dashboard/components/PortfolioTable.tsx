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
}

export function PortfolioTable({ accounts, showMoney }: PortfolioTableProps) {
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
            <TableHead className={cn(head, 'text-right')}>{t('dashboard.portfolio.columns.updated')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((a) => (
            <TableRow
              key={a.id}
              className="cursor-pointer"
              onClick={(e) => {
                if (!shouldIgnoreRowClick(e)) navigate(accountPath(a.id));
              }}
            >
              <TableCell className={cell}>
                <div className="flex min-w-[11rem] items-center gap-3">
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
                <NextMilestoneInfo account={a} />
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
              </TableCell>
              <TableCell className={cn(cell, 'whitespace-nowrap text-right text-muted-foreground', SMALL)}>
                <DateText value={lastTouched(a)} relative />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
