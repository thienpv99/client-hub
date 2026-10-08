// Add / edit a client contact (drawer). Saves through api.upsertContact.
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Lock } from 'lucide-react';
import type { DecisionRole, Salutation } from '@/domain/types';
import type { AccountDetail, Contact, ContactView } from '@/services/contract';
import { api } from '@/services/api';
import { atTime, dateOf, nowISO, todayISO } from '@/domain/clock';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { apiErrorMessage } from '@/lib/errors';
import { toastSuccess } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { DecisionRoleOptions, FormAlert, SalutationField, isDecisionRole, isEmailError } from './formParts';

interface Draft {
  full_name: string;
  salutation: Salutation | null;
  title: string;
  decision_role: DecisionRole;
  email: string;
  phone: string;
  interaction_date: string;
  interaction_note: string;
}

function draftOf(c: ContactView | null): Draft {
  return {
    full_name: c?.full_name ?? '',
    salutation: c?.salutation ?? null,
    title: c?.title ?? '',
    decision_role: c?.decision_role ?? 'ops_contact',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    interaction_date: c?.last_interaction_at ? dateOf(c.last_interaction_at) : '',
    interaction_note: c?.last_interaction_note ?? '',
  };
}

export interface ContactSheetProps {
  account: AccountDetail;
  /** null = new contact */
  contact: ContactView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactSheet({ account, contact, open, onOpenChange }: ContactSheetProps) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(contact));
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { run, pending, pendingVisible } = useAction();
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(draftOf(contact));
      setEmailError(null);
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact?.id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const hasLogin = !!contact?.user;
  // `ready` draws the submit button (it shows its own busy look after 150 ms); `canSubmit` also guards a double submit
  const ready = draft.full_name.trim().length > 0 && draft.salutation !== null;
  const canSubmit = ready && !pending;

  function interactionAt(): string | null | undefined {
    const original = contact?.last_interaction_at ?? null;
    if (!draft.interaction_date) return original === null ? undefined : null;
    if (original && dateOf(original) === draft.interaction_date) return undefined;
    return draft.interaction_date === todayISO() ? nowISO() : atTime(draft.interaction_date, '09:00');
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || draft.salutation === null) return;
    setEmailError(null);
    setFormError(null);
    const input: Partial<Contact> & { full_name: string } = {
      full_name: draft.full_name.trim(),
      salutation: draft.salutation,
      title: draft.title.trim(),
      decision_role: draft.decision_role,
      phone: draft.phone.trim() || null,
      last_interaction_note: draft.interaction_note.trim() || null,
    };
    if (contact) input.id = contact.id;
    if (!hasLogin) input.email = draft.email.trim();
    const at = interactionAt();
    if (at !== undefined) input.last_interaction_at = at;

    // errors stay in the drawer (under the email field, or above the buttons) instead of a second toast
    const result = await run(async () => {
      try {
        return await api.upsertContact(account.id, input);
      } catch (err) {
        if (isEmailError(err)) {
          setEmailError(apiErrorMessage(err));
          emailRef.current?.focus();
        } else {
          setFormError(apiErrorMessage(err));
        }
        return null;
      }
    });
    if (!result) return;
    toastSuccess(t(contact ? 'account.contacts.saved' : 'account.contacts.added', { name: result.full_name }));
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <SheetContent side="right" mobileFullScreen className="md:max-w-lg lg:max-w-lg">
        <SheetHeader className="border-b border-border/70">
          <SheetTitle>{contact ? t('account.contacts.editTitle', { name: contact.full_name }) : t('account.contacts.addTitle')}</SheetTitle>
          <SheetDescription>{t('account.contacts.formDescription', { account: account.name })}</SheetDescription>
        </SheetHeader>
        <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5 pt-5 md:pt-6">
            <FormField label={t('account.contacts.form.name')} htmlFor={`${id}-name`} required>
              <Input id={`${id}-name`} value={draft.full_name} onChange={(e) => set('full_name', e.target.value)} autoComplete="off" disabled={pending} />
            </FormField>
            <SalutationField id={`${id}-sal`} value={draft.salutation} onChange={(v) => set('salutation', v)} disabled={pending} />
            <FormField label={t('account.contacts.form.title')} htmlFor={`${id}-title`}>
              <Input
                id={`${id}-title`}
                value={draft.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder={t('account.contacts.form.titlePlaceholder')}
                disabled={pending}
              />
            </FormField>
            <FormField label={t('account.contacts.form.role')} htmlFor={`${id}-role`} hint={t('account.contacts.form.roleHint')}>
              <NativeSelect
                id={`${id}-role`}
                value={draft.decision_role}
                onChange={(e) => {
                  if (isDecisionRole(e.target.value)) set('decision_role', e.target.value);
                }}
                disabled={pending}
              >
                <DecisionRoleOptions />
              </NativeSelect>
            </FormField>
            <FormField
              label={t('common.email')}
              htmlFor={`${id}-email`}
              hint={hasLogin ? t('account.contacts.form.emailLocked') : undefined}
              error={emailError}
            >
              <Input
                ref={emailRef}
                id={`${id}-email`}
                type="email"
                inputMode="email"
                autoComplete="off"
                value={draft.email}
                onChange={(e) => {
                  set('email', e.target.value);
                  setEmailError(null);
                }}
                placeholder={`ten@${account.email_domain}`}
                disabled={pending || hasLogin}
              />
            </FormField>
            <FormField label={t('common.phone')} htmlFor={`${id}-phone`}>
              <Input id={`${id}-phone`} type="tel" inputMode="tel" value={draft.phone} onChange={(e) => set('phone', e.target.value)} disabled={pending} />
            </FormField>

            {/* a section under a hairline, not a box in the drawer (a floated legend does not cut the border) */}
            <fieldset className="border-t border-border/60 pt-5">
              <legend className="float-left mb-4 flex w-full items-center gap-1.5 text-table font-semibold text-ink">
                {t('account.contacts.form.interaction')}
                <Lock className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              </legend>
              <div className="clear-both space-y-5">
                <FormField label={t('account.contacts.form.interactionDate')} htmlFor={`${id}-date`}>
                  <div className="flex gap-2">
                    <Input
                      id={`${id}-date`}
                      type="date"
                      value={draft.interaction_date}
                      max={todayISO()}
                      onChange={(e) => set('interaction_date', e.target.value)}
                      disabled={pending}
                      className="min-w-0 flex-1"
                    />
                    <Button type="button" variant="secondary" onClick={() => set('interaction_date', todayISO())} disabled={pending}>
                      {t('common.today')}
                    </Button>
                  </div>
                </FormField>
                <FormField
                  label={t('account.contacts.form.interactionNote')}
                  htmlFor={`${id}-note`}
                  hint={t('account.contacts.form.interactionHint')}
                >
                  <Textarea
                    id={`${id}-note`}
                    value={draft.interaction_note}
                    onChange={(e) => set('interaction_note', e.target.value)}
                    rows={3}
                    placeholder={t('account.contacts.form.interactionPlaceholder')}
                    disabled={pending}
                  />
                </FormField>
              </div>
            </fieldset>

            {formError ? <FormAlert>{formError}</FormAlert> : null}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!ready} loading={pending}>
              {contact ? t('common.save') : t('account.contacts.addSubmit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
