// After a file is picked: new document or new version of an existing one, kind, visibility (default Nội bộ), note.
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CircleAlert, Lock, Users } from 'lucide-react';
import type { FileKind } from '@/domain/types';
import type { FileView, UploadInput, Visibility } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { formatFileSize } from '@/lib/format';
import { toastSuccess } from '@/lib/toast';
import { newId } from '@/lib/utils';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SMALL } from '@/components/common/cx';
import { FileTypeTile } from '@/components/common/file-list';
import { enumLabel } from '@/components/common/labels';

export const FILE_KINDS: FileKind[] = ['document', 'design', 'data', 'report', 'contract', 'proof', 'other'];

const MAX_BYTES = 25 * 1024 * 1024;
/** small files go inline as data: URLs (stored with the db); larger ones as blob: URLs (this tab only) */
const INLINE_BYTES = 300 * 1024;

function guessKind(file: File): FileKind {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith('image/') || /\.(fig|sketch|svg|png|jpe?g)$/.test(name)) return 'design';
  if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv' || /\.(xlsx?|csv)$/.test(name)) return 'data';
  return 'document';
}

function readUpload(file: File): Promise<UploadInput> {
  const base = { name: file.name, mime: file.type || 'application/octet-stream', size: file.size };
  if (file.size > INLINE_BYTES) return Promise.resolve({ ...base, url: URL.createObjectURL(file) });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ ...base, url: String(reader.result) });
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function isVisibility(v: string): v is Visibility {
  return v === 'internal' || v === 'shared';
}

export interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  accountId: string;
  /** newest version of each document of the account */
  documents: FileView[];
  /** preselected document when the upload is a new version */
  defaultDocKey: string | null;
  canShare: boolean;
  onPickAnother: () => void;
}

export function UploadDialog({ open, onOpenChange, file, accountId, documents, defaultDocKey, canShare, onPickAnother }: UploadDialogProps) {
  const id = useId();
  const [target, setTarget] = useState<string>('new');
  const [kind, setKind] = useState<FileKind>('document');
  const [visibility, setVisibility] = useState<Visibility>('internal');
  const [note, setNote] = useState('');
  const { run, pending, pendingVisible } = useAction();

  // a new file (or reopening) starts from the defaults: same-name document → its next version
  useEffect(() => {
    if (!open || !file) return;
    const sameName = documents.find((d) => d.name.toLowerCase() === file.name.toLowerCase());
    const doc = (defaultDocKey ? documents.find((d) => d.doc_key === defaultDocKey) : undefined) ?? sameName;
    setTarget(doc ? doc.doc_key : 'new');
    setKind(doc ? doc.kind : guessKind(file));
    setVisibility('internal');
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  const tooBig = !!file && file.size > MAX_BYTES;
  const targetDoc = target === 'new' ? undefined : documents.find((d) => d.doc_key === target);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || tooBig || pending) return;
    const docKey = target === 'new' ? newId('doc') : target;
    const result = await run(async () => {
      const upload = await readUpload(file);
      return api.uploadFile(accountId, { ...upload, visibility, kind, doc_key: docKey, note: note.trim() || null });
    });
    if (!result) return;
    toastSuccess(t('account.documents.uploaded', { name: result.name, version: result.version }));
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('account.documents.uploadTitle')}</DialogTitle>
          <DialogDescription>{t('account.documents.uploadDescription')}</DialogDescription>
        </DialogHeader>
        {file ? (
          <form onSubmit={(e) => void submit(e)} className="space-y-5">
            <div className="flex items-center gap-3 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60">
              <FileTypeTile file={{ mime: file.type, name: file.name }} className="bg-card" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-table font-medium text-foreground">{file.name}</p>
                <p className="text-micro tabular text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => (pending ? undefined : onPickAnother())} disabled={pendingVisible}>
                {t('account.documents.pickAnother')}
              </Button>
            </div>
            {tooBig ? (
              <p className={cn('flex items-start gap-1.5 text-danger', SMALL)} role="alert">
                <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t('account.documents.tooBig', { max: formatFileSize(MAX_BYTES) })}
              </p>
            ) : null}

            <FormField
              label={t('account.documents.targetLabel')}
              htmlFor={`${id}-target`}
              hint={targetDoc ? t('account.documents.targetHint', { version: targetDoc.version + 1 }) : undefined}
            >
              <NativeSelect
                id={`${id}-target`}
                value={target}
                onChange={(e) => {
                  const next = e.target.value;
                  setTarget(next);
                  const doc = documents.find((d) => d.doc_key === next);
                  if (doc) setKind(doc.kind);
                }}
                disabled={pending}
              >
                <option value="new">{t('account.documents.targetNew')}</option>
                {documents.map((d) => (
                  <option key={d.doc_key} value={d.doc_key}>
                    {t('account.documents.targetVersion', { name: d.name, version: d.version + 1 })}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label={t('account.documents.kindLabel')} htmlFor={`${id}-kind`}>
              <NativeSelect
                id={`${id}-kind`}
                value={kind}
                onChange={(e) => {
                  const next = FILE_KINDS.find((k) => k === e.target.value);
                  if (next) setKind(next);
                }}
                disabled={pending}
              >
                {FILE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {enumLabel('fileKind', k)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <fieldset>
              <legend className="mb-1.5 text-table font-medium text-foreground">{t('account.documents.visibilityTitle')}</legend>
              <RadioGroup
                value={visibility}
                onValueChange={(v) => {
                  if (isVisibility(v)) setVisibility(v);
                }}
                className="gap-2"
                disabled={pending}
              >
                {(['internal', 'shared'] as const).map((v) => {
                  const disabled = v === 'shared' && !canShare;
                  const VIcon = v === 'internal' ? Lock : Users;
                  return (
                    <label
                      key={v}
                      htmlFor={`${id}-vis-${v}`}
                      className={cn(
                        'flex min-h-tap items-start gap-3 rounded-lg bg-card px-3 py-2.5 ring-1 ring-inset ring-border-strong/70 transition-[background-color,box-shadow] duration-150 has-[[data-state=checked]]:bg-primary-soft has-[[data-state=checked]]:ring-primary-border',
                        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-subtle',
                      )}
                    >
                      <RadioGroupItem id={`${id}-vis-${v}`} value={v} disabled={disabled} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-table font-medium text-foreground">
                          <VIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          {enumLabel('visibility', v)}
                        </span>
                        <span className="mt-0.5 block text-caption">
                          {t(
                            v === 'internal'
                              ? 'account.documents.internalHint'
                              : canShare
                                ? 'account.documents.sharedHint'
                                : 'account.documents.sharedManagerOnly',
                          )}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            </fieldset>

            <FormField label={t('account.documents.noteLabel')} htmlFor={`${id}-note`} hint={t('common.optional')}>
              <Input
                id={`${id}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('account.documents.notePlaceholder')}
                disabled={pending}
                maxLength={200}
              />
            </FormField>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={tooBig} loading={pending}>
                {t('account.documents.uploadSubmit')}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
