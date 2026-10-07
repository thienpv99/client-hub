// "Giao cho đồng nghiệp" (SPEC 5.3): pick a colleague of the same company or invite one by email (company domain
// only), with an optional message. The task stays in the decision maker's "Đã giao cho người khác" list.
import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Salutation } from '@/domain/types';
import type { TaskView, UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { UserAvatar } from '@/components/common/user-avatar';
import { cn } from '@/components/ui/cn';
import { salutationParams } from './taskHelpers';

export interface DelegateInput {
  to_user_id?: string;
  invite?: { email: string; full_name: string; salutation: Salutation };
  note?: string;
}

export interface DelegateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskView;
  /** resolves true when the delegation went through (the dialog then closes) */
  onSubmit: (input: DelegateInput) => Promise<boolean>;
}

type Mode = 'pick' | 'invite';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Colleagues {
  users: UserRef[];
  invited: Set<string>;
  domain: string;
}

export function DelegateDialog({ open, onOpenChange, task, onSubmit }: DelegateDialogProps) {
  const viewer = useViewer();
  const id = useId();
  const sal = salutationParams(viewer);
  const accountId = task.account.id;

  const query = useQuery<Colleagues>(
    async () => {
      const [users, account] = await Promise.all([api.listUsers(), api.getAccount(accountId)]);
      const invited = new Set<string>();
      for (const c of account.contacts) if (c.user && c.user.status === 'invited') invited.add(c.user.id);
      return { users, invited, domain: account.email_domain };
    },
    [accountId],
    { enabled: open },
  );

  const me = viewer?.user.id ?? null;
  const colleagues = useMemo(() => (query.data?.users ?? []).filter((u) => u.id !== me), [query.data, me]);
  const domain = query.data?.domain ?? '';

  const [mode, setMode] = useState<Mode>('pick');
  const [picked, setPicked] = useState<string>('');
  const [name, setName] = useState('');
  const [salutation, setSalutation] = useState<Salutation>('anh');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  const assigneeId = task.assignee?.id ?? null;
  useEffect(() => {
    if (!open) return;
    setMode('pick');
    // the current assignee (a colleague the task was delegated to) is preselected
    setPicked(assigneeId && assigneeId !== me ? assigneeId : '');
    setName('');
    setSalutation('anh');
    setEmail('');
    setNote('');
    setSubmitted(false);
    setPending(false);
  }, [open, assigneeId, me]);

  // no colleague yet → start on the invite form
  useEffect(() => {
    if (open && query.data && colleagues.length === 0) setMode('invite');
  }, [open, query.data, colleagues.length]);

  const emailClean = email.trim().toLowerCase();
  const nameError = mode === 'invite' && submitted && !name.trim() ? t('task.delegate.nameRequired') : undefined;
  let emailError: string | undefined;
  if (mode === 'invite' && (submitted || emailClean.includes('@'))) {
    if (!EMAIL_RE.test(emailClean)) emailError = submitted ? t('task.delegate.emailInvalid') : undefined;
    else if (domain && !emailClean.endsWith(`@${domain.toLowerCase()}`)) emailError = t('task.delegate.emailDomain', { domain });
  }
  const pickError = mode === 'pick' && submitted && !picked ? t('task.delegate.pickRequired') : undefined;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    const text = note.trim();
    let input: DelegateInput;
    if (mode === 'pick') {
      if (!picked) return;
      input = { to_user_id: picked, note: text || undefined };
    } else {
      const invalid =
        !name.trim() || !EMAIL_RE.test(emailClean) || (!!domain && !emailClean.endsWith(`@${domain.toLowerCase()}`));
      if (invalid) return;
      input = { invite: { email: emailClean, full_name: name.trim(), salutation }, note: text || undefined };
    }
    setPending(true);
    const ok = await onSubmit(input);
    setPending(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!pending ? onOpenChange(o) : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('task.delegate.title')}</DialogTitle>
          <DialogDescription>{t('task.delegate.description', sal)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          <p className="rounded-lg bg-subtle px-3 py-2.5 text-table font-medium text-foreground ring-1 ring-inset ring-border/60">{task.title}</p>

          <ToggleGroup
            type="single"
            variant="segmented"
            value={mode}
            onValueChange={(v) => (v === 'pick' || v === 'invite' ? setMode(v) : undefined)}
            aria-label={t('task.delegate.mode')}
            className="w-full"
          >
            <ToggleGroupItem value="pick" className="flex-1">
              {t('task.delegate.modePick')}
            </ToggleGroupItem>
            <ToggleGroupItem value="invite" className="flex-1">
              {t('task.delegate.modeInvite')}
            </ToggleGroupItem>
          </ToggleGroup>

          {mode === 'pick' ? (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-table font-medium text-foreground">{t('task.delegate.colleagues')}</legend>
              {query.loading ? (
                <div className="space-y-2" aria-hidden="true">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </div>
              ) : colleagues.length === 0 ? (
                <p className="rounded-lg bg-subtle p-3 text-table text-muted-foreground ring-1 ring-inset ring-border/60">{t('task.delegate.noColleagues', sal)}</p>
              ) : (
                <RadioGroup
                  value={picked}
                  onValueChange={setPicked}
                  aria-label={t('task.delegate.colleagues')}
                  aria-invalid={pickError ? true : undefined}
                  className="gap-2"
                >
                  {colleagues.map((u) => {
                    const itemId = `${id}-u-${u.id}`;
                    const active = picked === u.id;
                    return (
                      <Label
                        key={u.id}
                        htmlFor={itemId}
                        className={cn(
                          'flex min-h-tap cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                          active ? 'border-primary-border bg-primary-soft' : 'border-border bg-card hover:bg-subtle',
                        )}
                      >
                        <RadioGroupItem value={u.id} id={itemId} disabled={pending} />
                        <UserAvatar user={u} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-table font-medium text-foreground">{u.full_name}</span>
                          {u.title ? <span className="block truncate text-caption font-normal">{u.title}</span> : null}
                        </span>
                        {query.data?.invited.has(u.id) ? <Badge variant="outline">{t('task.delegate.invited')}</Badge> : null}
                        {task.assignee?.id === u.id ? <Badge variant="default">{t('task.delegate.current')}</Badge> : null}
                      </Label>
                    );
                  })}
                </RadioGroup>
              )}
              {pickError ? (
                <p className="text-[13px] leading-[18px] text-danger" aria-live="polite">
                  {pickError}
                </p>
              ) : null}
            </fieldset>
          ) : (
            <div className="space-y-4">
              <FormField label={t('task.delegate.name')} htmlFor={`${id}-name`} required error={nameError}>
                <Input
                  id={`${id}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('task.delegate.namePlaceholder')}
                  autoComplete="name"
                  disabled={pending}
                />
              </FormField>
              <fieldset>
                <legend className="mb-2 text-table font-medium text-foreground">{t('task.delegate.salutation')}</legend>
                <RadioGroup
                  value={salutation}
                  onValueChange={(v) => (v === 'anh' || v === 'chị' ? setSalutation(v) : undefined)}
                  className="flex gap-2"
                  aria-label={t('task.delegate.salutation')}
                >
                  {(['anh', 'chị'] as const).map((s) => (
                    <Label
                      key={s}
                      htmlFor={`${id}-s-${s}`}
                      className="flex min-h-tap cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-4 hover:bg-subtle"
                    >
                      <RadioGroupItem value={s} id={`${id}-s-${s}`} disabled={pending} />
                      {t(`enums.salutationTitle.${s}`)}
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>
              <FormField
                label={t('task.delegate.email')}
                htmlFor={`${id}-email`}
                required
                hint={domain && !emailError ? t('task.delegate.emailHint', { domain }) : undefined}
                error={emailError}
              >
                <Input
                  id={`${id}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={domain ? t('task.delegate.emailPlaceholder', { domain }) : undefined}
                  disabled={pending}
                />
              </FormField>
            </div>
          )}

          <FormField label={t('task.delegate.note')} htmlFor={`${id}-note`} hint={t('common.optional')}>
            <Textarea
              id={`${id}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('task.delegate.notePlaceholder')}
              rows={3}
              disabled={pending}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} disabled={query.loading && mode === 'pick'}>
              {mode === 'invite' ? t('task.delegate.inviteConfirm') : t('task.delegate.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
