// "Báo đã chuyển khoản": a proof file is required, a note is optional (SPEC §3).
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Paperclip, X } from 'lucide-react';
import type { UploadInput } from '@/services/contract';
import { t } from '@/i18n';
import { formatFileSize } from '@/lib/format';
import { toastError } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { FileTypeTile } from '@/components/common/file-list';
import { toUploadInput, useFilePicker } from './uploads';

export interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** resolves true when the report went through (the dialog then closes) */
  onSubmit: (proof: UploadInput, note: string) => Promise<boolean>;
}

export function PaymentDialog({ open, onOpenChange, onSubmit }: PaymentDialogProps) {
  const id = useId();
  const [proof, setProof] = useState<UploadInput | null>(null);
  const [note, setNote] = useState('');
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (open) {
      setProof(null);
      setNote('');
      setShowError(false);
      setPending(false);
    }
  }, [open]);

  const picker = useFilePicker({
    accept: 'image/*,application/pdf',
    onPick: (files) => {
      const file = files[0];
      if (!file) return;
      setReading(true);
      toUploadInput(file)
        .then((u) => {
          setProof(u);
          setShowError(false);
        })
        .catch(() => toastError(t('task.files.readFailed')))
        .finally(() => setReading(false));
    },
  });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!proof) {
      setShowError(true);
      return;
    }
    setPending(true);
    const ok = await onSubmit(proof, note.trim());
    setPending(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!pending ? onOpenChange(o) : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('task.dialog.payment.title')}</DialogTitle>
          <DialogDescription>{t('task.dialog.payment.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          {picker.input}
          <FormField
            label={t('task.dialog.payment.proof')}
            htmlFor={`${id}-proof`}
            required
            error={showError && !proof ? t('task.dialog.payment.required') : undefined}
          >
            {proof ? (
              <div id={`${id}-proof`} className="flex items-center gap-3 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60">
                <FileTypeTile file={proof} className="bg-card" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-table font-medium text-foreground">{proof.name}</p>
                  <p className="text-micro tabular text-muted-foreground">{formatFileSize(proof.size)}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={picker.open} disabled={pending}>
                  {t('task.dialog.payment.change')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setProof(null)}
                  disabled={pending}
                  aria-label={t('task.dialog.payment.remove', { name: proof.name })}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <Button id={`${id}-proof`} type="button" variant="secondary" onClick={picker.open} loading={reading} className="w-full sm:w-auto">
                {!reading && <Paperclip aria-hidden="true" />}
                {reading ? t('task.files.reading') : t('task.dialog.payment.choose')}
              </Button>
            )}
          </FormField>
          <FormField label={t('task.dialog.payment.note')} htmlFor={`${id}-note`} hint={t('common.optional')}>
            <Textarea
              id={`${id}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('task.dialog.payment.notePlaceholder')}
              rows={3}
              disabled={pending}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} disabled={reading}>
              {t('task.dialog.payment.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
