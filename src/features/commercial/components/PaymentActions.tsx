// Manager actions on one installment: Đến hạn xuất HĐ · Xuất hóa đơn (invoice no.) · Đã thu · Mở lại,
// and the "Tự tạo việc Thanh toán" switch. Data refreshes through useQuery after each mutation.
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CircleCheck, Ellipsis, FileClock, ListChecks, Receipt, RotateCcw } from 'lucide-react';
import type { PaymentAction, PaymentView } from '@/services/contract';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAction } from '@/hooks/useAction';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { t } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { toastSuccess } from '@/lib/toast';
import { cn } from '@/components/ui/cn';
import { api } from '@/services/api';

const SUCCESS: Record<Exclude<PaymentAction, 'invoice'>, string> = {
  mark_invoice_due: 'commercial.payment.toast.invoiceDue',
  mark_paid: 'commercial.payment.toast.paid',
  reopen: 'commercial.payment.toast.reopened',
};

function InvoiceDialog({ payment, open, onOpenChange }: { payment: PaymentView; open: boolean; onOpenChange: (o: boolean) => void }) {
  const id = useId();
  const [value, setValue] = useState('');
  const { run, pending, pendingVisible } = useAction();
  const tooLong = value.trim().length > 40;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (tooLong || pending) return;
    const r = await run(() => api.updatePayment(payment.id, 'invoice', { invoice_no: value.trim() || undefined }));
    if (r) {
      toastSuccess(t('commercial.payment.toast.invoiced', { name: r.name, invoice: r.invoice_no ?? '' }));
      onOpenChange(false);
      setValue('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('commercial.payment.invoiceDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('commercial.payment.invoiceDialog.description', { name: payment.name, amount: formatMoney(payment.amount) })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <FormField
            label={t('commercial.payment.invoiceDialog.label')}
            htmlFor={id}
            hint={t('commercial.payment.invoiceDialog.hint')}
            error={tooLong ? t('commercial.payment.invoiceDialog.tooLong') : undefined}
          >
            <Input
              id={id}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('commercial.payment.invoiceDialog.placeholder')}
              autoFocus
              autoComplete="off"
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} disabled={tooLong}>
              {t('commercial.payment.invoiceDialog.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** next step for the installment (null for none) + secondary steps in the "…" menu */
function stepsFor(p: PaymentView): { primary: PaymentAction | null; more: PaymentAction[] } {
  switch (p.status) {
    case 'not_due':
      return { primary: 'mark_invoice_due', more: ['invoice'] };
    case 'invoice_due':
      return { primary: 'invoice', more: [] };
    case 'invoiced':
    case 'overdue':
      return { primary: 'mark_paid', more: [] };
    case 'paid':
      return { primary: null, more: ['reopen'] };
    default:
      return { primary: null, more: [] };
  }
}

const ICON = { mark_invoice_due: FileClock, invoice: Receipt, mark_paid: CircleCheck, reopen: RotateCcw } as const;

export function PaymentActionButtons({ payment, className }: { payment: PaymentView; className?: string }) {
  const { run, pending } = useAction();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const { primary, more } = stepsFor(payment);

  const perform = (action: PaymentAction) => {
    if (pending) return;
    if (action === 'invoice') {
      setInvoiceOpen(true);
      return;
    }
    void run(() => api.updatePayment(payment.id, action), { success: SUCCESS[action], successParams: { name: payment.name } });
  };

  if (!primary && more.length === 0) return null;
  const PrimaryIcon = primary ? ICON[primary] : null;
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {primary && PrimaryIcon ? (
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          onClick={() => perform(primary)}
          aria-label={`${t(`commercial.payment.action.${primary}`)} – ${payment.name}`}
        >
          {/* the Button swaps the icon for its spinner itself (after 150 ms) */}
          <PrimaryIcon aria-hidden="true" />
          {t(`commercial.payment.action.${primary}`)}
        </Button>
      ) : null}
      {more.length > 0 ? (
        // non-modal: the invoice dialog opened from an item must not inherit the menu's focus lock
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              loading={!primary && pending}
              aria-label={t('commercial.payment.moreActions', { name: payment.name })}
            >
              <Ellipsis aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {more.map((a) => {
              const Icon = ICON[a];
              return (
                <DropdownMenuItem key={a} onSelect={() => perform(a)}>
                  <Icon aria-hidden="true" />
                  {t(`commercial.payment.action.${a}Long`)}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <InvoiceDialog payment={payment} open={invoiceOpen} onOpenChange={setInvoiceOpen} />
    </div>
  );
}

/** "Tự tạo việc Thanh toán" switch + a link to the live payment task */
export function PaymentAutoTask({ payment, manage, showLabel = false }: { payment: PaymentView; manage: boolean; showLabel?: boolean }) {
  const { run, pending, pendingVisible } = useAction();
  const { open } = useTaskDrawer();
  const id = useId();
  const paid = payment.status === 'paid';
  // optimistic: the thumb travels at once (spring); the refetched payment then takes over, a refusal snaps back
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  useEffect(() => {
    if (optimistic !== null && payment.auto_task_enabled === optimistic) setOptimistic(null);
  }, [payment.auto_task_enabled, optimistic]);

  async function toggle(on: boolean) {
    if (pending) return;
    setOptimistic(on);
    const r = await run(() => api.setPaymentAutoTask(payment.id, on), {
      success: on ? 'commercial.payment.toast.autoOn' : 'commercial.payment.toast.autoOff',
      successParams: { name: payment.name },
    });
    if (!r) setOptimistic(null);
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {!paid ? (
        <label
          htmlFor={id}
          className={cn('flex items-center gap-2.5', showLabel ? 'touch-tap min-h-tap md:min-h-0' : '', manage ? 'cursor-pointer' : 'cursor-default')}
        >
          <Switch
            id={id}
            checked={optimistic ?? payment.auto_task_enabled}
            disabled={!manage || pendingVisible}
            aria-busy={pending || undefined}
            onCheckedChange={(on) => void toggle(on)}
            aria-label={showLabel ? undefined : t('commercial.payment.autoTaskFor', { name: payment.name })}
          />
          {showLabel ? <span className="text-table text-muted-foreground">{t('commercial.payment.autoTask')}</span> : null}
        </label>
      ) : null}
      {payment.task_id ? (
        <Button variant="link" size="sm" className="gap-1" onClick={() => open(payment.task_id as string)}>
          <ListChecks aria-hidden="true" />
          {t('commercial.payment.viewTask')}
        </Button>
      ) : null}
    </div>
  );
}
