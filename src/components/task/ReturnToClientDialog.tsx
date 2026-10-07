// "Gửi lại cho khách": a required message + optional new-version files → the task waits on the client again.
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
import { fileTypeIcon } from '@/components/common/file-list';
import { toUploadInputs, useFilePicker } from './uploads';

export interface ReturnToClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'return': ask the client to redo / complete what they sent; 'newVersion': a new version after a change request */
  mode?: 'return' | 'newVersion';
  /** resolves true when it went through (the dialog then closes) */
  onSubmit: (input: { message: string; files: UploadInput[] }) => Promise<boolean>;
}

export function ReturnToClientDialog({ open, onOpenChange, mode = 'return', onSubmit }: ReturnToClientDialogProps) {
  const id = useId();
  const k = mode === 'newVersion' ? 'task.dialog.newVersion' : 'task.dialog.returnToClient';
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<UploadInput[]>([]);
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setMessage('');
      setFiles([]);
      setSubmitted(false);
      setPending(false);
    }
  }, [open]);

  const picker = useFilePicker({
    multiple: true,
    onPick: (picked) => {
      setReading(true);
      toUploadInputs(picked)
        .then((uploads) => setFiles((prev) => [...prev, ...uploads]))
        .catch(() => toastError(t('task.files.readFailed')))
        .finally(() => setReading(false));
    },
  });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    const text = message.trim();
    if (!text) return;
    setPending(true);
    const ok = await onSubmit({ message: text, files });
    setPending(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!pending ? onOpenChange(o) : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(`${k}.title`)}</DialogTitle>
          <DialogDescription>{t(`${k}.description`)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          {picker.input}
          <FormField
            label={t('task.dialog.returnToClient.message')}
            htmlFor={`${id}-message`}
            required
            error={submitted && !message.trim() ? t('task.dialog.returnToClient.messageRequired') : undefined}
          >
            <Textarea
              id={`${id}-message`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t(`${k}.messagePlaceholder`)}
              rows={4}
              disabled={pending}
              autoFocus
            />
          </FormField>
          <div className="space-y-2">
            <p className="text-table font-medium text-foreground">
              {t('task.dialog.returnToClient.files')}{' '}
              <span className="font-normal text-muted-foreground">({t('common.optional').toLowerCase()})</span>
            </p>
            {files.length > 0 ? (
              <ul className="divide-y divide-border/60 rounded-lg bg-subtle ring-1 ring-inset ring-border/60">
                {files.map((f, i) => {
                  const Icon = fileTypeIcon(f);
                  return (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-3 py-1.5 pl-3 pr-1">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-table text-foreground">{f.name}</span>
                      <span className="shrink-0 text-micro tabular text-muted-foreground">{formatFileSize(f.size)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        disabled={pending}
                        aria-label={t('task.dialog.returnToClient.remove', { name: f.name })}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-caption">{t('task.dialog.returnToClient.noFiles')}</p>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={picker.open} loading={reading} disabled={pending}>
              {!reading && <Paperclip aria-hidden="true" />}
              {reading ? t('task.files.reading') : t('task.dialog.returnToClient.addFiles')}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} disabled={reading}>
              {t(`${k}.confirm`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
