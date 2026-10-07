// One installment on the client portal: a calm divided row (name + due date + milestone, amount on the right, status
// pill) and, while the payment task is open, "Báo đã chuyển khoản" (opens the task drawer) — full width on phones.
import { Flag, Landmark } from 'lucide-react';
import type { PaymentView } from '@/services/contract';
import { Money } from '@/components/common/money';
import { Button } from '@/components/ui/button';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { fmtPct } from '../lib';
import { dueRelative } from './ContractCard';
import { PaymentStatusBadge } from './status';

export function PortalPaymentRow({ payment }: { payment: PaymentView }) {
  const { open } = useTaskDrawer();
  const rel = payment.status === 'overdue' || payment.status === 'paid' ? null : dueRelative(payment);
  const canReport = !!payment.task_id && (payment.status === 'invoiced' || payment.status === 'overdue') && !payment.client_reported_at;
  const reported = payment.client_reported_at && payment.status !== 'paid';
  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium text-foreground">{payment.name}</p>
          <p className="text-caption tabular">
            {payment.status === 'paid' && payment.paid_at
              ? t('commercial.portal.paidOn', { date: formatDate(payment.paid_at) })
              : t('commercial.portal.dueOn', { date: formatDate(payment.due_date) })}
            {rel ? ` · ${rel}` : ''}
          </p>
          {payment.milestone ? (
            <p className="inline-flex items-center gap-1.5 text-caption">
              <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('commercial.portal.milestone', { name: payment.milestone.name })}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold text-ink">
            <Money value={payment.amount} />
          </p>
          <p className="text-caption tabular">{fmtPct(payment.percent)}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <PaymentStatusBadge status={payment.status} overdueDays={payment.overdue_days} audience="client" size="sm" />
        {payment.invoice_no ? <span className="text-caption tabular">{t('commercial.payment.invoiceNo', { no: payment.invoice_no })}</span> : null}
        {reported ? <span className="text-caption">{t('commercial.portal.reported', { date: formatDate(payment.client_reported_at ?? '') })}</span> : null}
        {canReport ? (
          <Button size="touch" className="w-full sm:ml-auto sm:w-auto" onClick={() => open(payment.task_id as string)}>
            <Landmark aria-hidden="true" />
            {t('enums.taskAction.payment')}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
