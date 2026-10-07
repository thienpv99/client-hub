// "Đánh dấu hoàn thành" — irreversible, so a ConfirmDialog that says what follows (linked installments become
// "Đến hạn xuất hóa đơn", the client sees the milestone done, open tasks stay open).
import { useMemo } from 'react';
import { Receipt, TriangleAlert } from 'lucide-react';
import type { MilestoneView } from '@/services/contract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { ConfirmDialog } from '@/components/common/confirm-dialog';

export interface CompleteMilestoneDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  milestone: MilestoneView;
  accountId: string;
}

export function CompleteMilestoneDialog({ open, onOpenChange, milestone: m, accountId }: CompleteMilestoneDialogProps) {
  const { run } = useAction();
  const payments = useQuery(() => api.listPayments({ accountId }), [accountId, m.id], { enabled: open });
  const linked = useMemo(
    () => (payments.data ?? []).filter((p) => p.milestone?.id === m.id && p.status === 'not_due'),
    [payments.data, m.id],
  );
  const paymentsKnown = payments.data !== undefined;

  async function confirm(): Promise<boolean> {
    const count = linked.length;
    const r = await run(() => api.completeMilestone(m.id), {
      success: count > 0 ? 'roadmap.complete.doneWithPayments' : 'roadmap.complete.done',
      successParams: { name: m.name, count },
    });
    return r !== undefined;
  }

  const description = (
    <>
      <span className="block">
        {t('roadmap.complete.body', { date: formatDate(todayISO()) })}
        {m.client_visible ? ` ${t('roadmap.complete.clientSees')}` : ''}
      </span>
      {m.open_task_count > 0 ? (
        <span className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-warning ring-1 ring-inset ring-warning/20">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('roadmap.complete.openTasks', { count: m.open_task_count })}</span>
        </span>
      ) : null}
      <span className="mt-3 flex items-start gap-2 rounded-lg bg-subtle p-3 text-foreground ring-1 ring-inset ring-border/60">
        <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-caption" aria-hidden="true" />
        <span className="min-w-0">
          {!paymentsKnown ? (
            payments.error ? (
              t('roadmap.complete.paymentsGeneric')
            ) : (
              <span className="text-muted-foreground">{t('roadmap.complete.paymentsLoading')}</span>
            )
          ) : linked.length > 0 ? (
            <>
              <span className="block">{t('roadmap.complete.payments')}</span>
              {linked.map((p) => (
                <span key={p.id} className="mt-1 block font-medium tabular">
                  {t('roadmap.complete.paymentItem', { name: p.name, percent: formatPercent(p.percent), amount: formatMoney(p.amount) })}
                </span>
              ))}
            </>
          ) : (
            t('roadmap.complete.noPayments')
          )}
        </span>
      </span>
      <span className="mt-3 block">{t('roadmap.complete.irreversible')}</span>
    </>
  );

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('roadmap.complete.title', { name: m.name })}
      description={description}
      confirmLabel={t('roadmap.complete.confirm')}
      onConfirm={confirm}
    />
  );
}
