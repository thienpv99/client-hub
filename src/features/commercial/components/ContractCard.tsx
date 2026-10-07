// Internal contract card: value, signed date, collected / outstanding with a progress bar, then the installment
// schedule edge to edge (table from xl, divided rows below — no box inside the box). Managers get the payment
// actions and the auto-task switch.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Flag } from 'lucide-react';
import type { ContractView, FileView, PaymentView } from '@/services/contract';
import { AccountLogo } from '@/components/common/account-logo';
import { FilePreviewDialog } from '@/components/common/file-preview-dialog';
import { Money } from '@/components/common/money';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { useBreakpoint } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { formatDate, formatRelativeDays } from '@/lib/format';
import { fmtPct } from '../lib';
import { PaymentActionButtons, PaymentAutoTask } from './PaymentActions';
import { ContractStatusBadge, PaymentStatusBadge } from './status';

/** "còn 9 ngày" / "hôm nay" — only for installments still open */
export function dueRelative(p: PaymentView): string | null {
  if (p.status === 'paid') return null;
  return formatRelativeDays(diffDays(p.due_date, todayISO()));
}

function DueText({ p }: { p: PaymentView }) {
  const rel = p.status === 'overdue' ? null : dueRelative(p);
  return (
    <span className="flex flex-col">
      <span className="tabular text-foreground">{formatDate(p.due_date)}</span>
      {rel ? <span className="text-caption">{rel}</span> : null}
      {p.status === 'paid' && p.paid_at ? (
        <span className="text-caption">{t('commercial.payment.paidOn', { date: formatDate(p.paid_at) })}</span>
      ) : null}
    </span>
  );
}

function StatusText({ p }: { p: PaymentView }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <PaymentStatusBadge status={p.status} overdueDays={p.overdue_days} size="sm" />
      {p.invoice_no ? <span className="text-caption tabular">{t('commercial.payment.invoiceNo', { no: p.invoice_no })}</span> : null}
      {p.client_reported_at && p.status !== 'paid' ? (
        <span className="text-caption">{t('commercial.payment.reportedOn', { date: formatDate(p.client_reported_at) })}</span>
      ) : null}
    </span>
  );
}

function MilestoneLine({ p }: { p: PaymentView }) {
  if (!p.milestone) return <span className="text-caption">{t('commercial.payment.noMilestone')}</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-caption">
      <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{p.milestone.name}</span>
    </span>
  );
}

function InstallmentTable({ payments, manage }: { payments: PaymentView[]; manage: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('commercial.payment.col.name')}</TableHead>
          <TableHead className="text-right">{t('commercial.payment.col.amount')}</TableHead>
          <TableHead>{t('commercial.payment.col.due')}</TableHead>
          <TableHead>{t('commercial.payment.col.status')}</TableHead>
          <TableHead>{t('commercial.payment.col.autoTask')}</TableHead>
          {manage ? (
            <TableHead className="text-right">
              <span className="sr-only">{t('commercial.payment.col.actions')}</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id} className="hover:bg-transparent">
            <TableCell className="min-w-[200px] max-w-[280px]">
              <p className="font-medium text-foreground">{p.name}</p>
              <MilestoneLine p={p} />
            </TableCell>
            <TableCell className="text-right">
              <p className="font-semibold text-ink">
                <Money value={p.amount} />
              </p>
              <p className="text-caption tabular">{fmtPct(p.percent)}</p>
            </TableCell>
            <TableCell>
              <DueText p={p} />
            </TableCell>
            <TableCell>
              <StatusText p={p} />
            </TableCell>
            <TableCell>
              {p.status === 'paid' && !p.task_id ? <span className="text-caption">—</span> : <PaymentAutoTask payment={p} manage={manage} />}
            </TableCell>
            {manage ? (
              <TableCell>
                {/* wraps under 2 buttons wide, so the table fits the 951px column at 1280 */}
                <PaymentActionButtons payment={p} className="flex-wrap justify-end" />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function InstallmentRows({ payments, manage }: { payments: PaymentView[]; manage: boolean }) {
  return (
    <ul className="divide-y divide-border/60">
      {payments.map((p) => (
        <li key={p.id} className="space-y-3 px-4 py-3.5 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{p.name}</p>
              <MilestoneLine p={p} />
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold text-ink">
                <Money value={p.amount} />
              </p>
              <p className="text-caption tabular">{fmtPct(p.percent)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 text-table">
            <DueText p={p} />
            <StatusText p={p} />
          </div>
          {p.status !== 'paid' || p.task_id || manage ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PaymentAutoTask payment={p} manage={manage} showLabel />
              {manage ? <PaymentActionButtons payment={p} /> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ContractCard({
  contract,
  showAccount = false,
  manage,
  className,
}: {
  contract: ContractView;
  showAccount?: boolean;
  manage: boolean;
  className?: string;
}) {
  const breakpoint = useBreakpoint();
  const [preview, setPreview] = useState<FileView | null>(null);
  const paidCount = contract.payments.filter((p) => p.status === 'paid').length;
  const collectedPct = contract.value > 0 ? Math.min(100, (contract.collected / contract.value) * 100) : 0;

  return (
    <Card className={cn('min-w-0 overflow-hidden', className)}>
      <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:pt-5">
        <div className="min-w-0">
          {showAccount ? (
            <Link
              to={`/app/accounts/${contract.account.id}/commercial`}
              className="touch-tap -ml-1 mb-1 inline-flex min-h-tap items-center gap-2 rounded-lg px-1 text-table font-medium text-muted-foreground transition-colors hover:text-foreground md:min-h-0"
            >
              <AccountLogo account={contract.account} size="xs" />
              {contract.account.name}
            </Link>
          ) : null}
          <h3 className="break-words text-heading font-semibold tracking-tightish text-ink">{contract.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption">
            <span className="tabular">{contract.code}</span>
            <span aria-hidden="true">·</span>
            <span>
              {contract.signed_date ? t('commercial.contract.signedOn', { date: formatDate(contract.signed_date) }) : t('commercial.contract.notSigned')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular">
              {t('commercial.contract.period', { start: formatDate(contract.start_date), end: formatDate(contract.end_date) })}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ContractStatusBadge status={contract.status} />
          {contract.file ? (
            <Button variant="ghost" size="sm" onClick={() => setPreview(contract.file)}>
              <FileText aria-hidden="true" />
              {t('commercial.contract.viewFile')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:items-end sm:gap-x-10">
          <div className="col-span-2">
            <dt className="text-caption">{t('commercial.contract.value')}</dt>
            <dd className="mt-0.5 text-title font-semibold tracking-tightish text-ink">
              <Money value={contract.value} />
            </dd>
          </div>
          <div>
            <dt className="text-caption">{t('commercial.contract.collected')}</dt>
            <dd className="mt-0.5 text-body font-medium text-foreground">
              <Money value={contract.collected} />
            </dd>
          </div>
          <div>
            <dt className="text-caption">{t('commercial.contract.outstanding')}</dt>
            <dd className="mt-0.5 text-body font-medium text-foreground">
              <Money value={contract.outstanding} />
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={collectedPct} className="flex-1" aria-label={t('commercial.contract.collectedPct', { pct: fmtPct(collectedPct) })} />
          <span className="shrink-0 text-micro font-medium tabular text-muted-foreground">
            {t('commercial.contract.paidCount', { paid: paidCount, total: contract.payments.length })}
          </span>
        </div>
      </div>

      <div className="border-t border-border/60">
        <h4 className="sr-only">{t('commercial.contract.schedule')}</h4>
        {contract.payments.length === 0 ? (
          <p className="px-4 py-4 text-table text-muted-foreground sm:px-5">{t('commercial.contract.noPayments')}</p>
        ) : breakpoint === 'desktop' ? (
          <InstallmentTable payments={contract.payments} manage={manage} />
        ) : (
          <InstallmentRows payments={contract.payments} manage={manage} />
        )}
      </div>
      <FilePreviewDialog file={preview} onOpenChange={(o) => !o && setPreview(null)} />
    </Card>
  );
}
