// "Mời vào hệ thống": create a client login (and contact) and send the invitation. The email must use the
// company's domain; the server's domain error is shown under the field.
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AtSign, Send } from 'lucide-react';
import type { DecisionRole, Salutation } from '@/domain/types';
import type { AccountDetail, ContactView } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { apiErrorMessage } from '@/lib/errors';
import { toastSuccess } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { enumLabel } from '@/components/common/labels';
import { DecisionRoleOptions, FormAlert, SalutationField, isDecisionRole, isEmailError } from './formParts';

interface Draft {
  full_name: string;
  salutation: Salutation | null;
  title: string;
  email: string;
  decision_role: DecisionRole;
}

function draftOf(c: ContactView | null): Draft {
  return {
    full_name: c?.full_name ?? '',
    salutation: c?.salutation ?? null,
    title: c?.title ?? '',
    email: c?.email ?? '',
    decision_role: c?.decision_role ?? 'ops_contact',
  };
}

export interface InviteSheetProps {
  account: AccountDetail;
  /** an existing contact without a login; null = a new person */
  contact: ContactView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteSheet({ account, contact, open, onOpenChange }: InviteSheetProps) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(contact));
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { run, pending } = useAction();
  const emailRef = useRef<HTMLInputElement>(null);
  const domain = account.email_domain;

  useEffect(() => {
    if (open) {
      setDraft(draftOf(contact));
      setEmailError(null);
      setFormError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact?.id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const owner = draft.decision_role === 'decision_maker';
  const canSubmit = draft.full_name.trim().length > 0 && draft.email.trim().length > 0 && draft.salutation !== null && !pending;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const salutation = draft.salutation;
    if (!canSubmit || salutation === null) return;
    setEmailError(null);
    setFormError(null);
    const email = draft.email.trim().toLowerCase();
    const fullName = draft.full_name.trim();
    const title = draft.title.trim();

    // an existing contact is matched by email: keep its row in step before inviting, but never store an email
    // outside the company domain on it (the same rule the server applies to the invite)
    if (contact && !email.endsWith(`@${domain.toLowerCase()}`)) {
      setEmailError(t('errors.domain_mismatch_detail', { domain }));
      emailRef.current?.focus();
      return;
    }
    const contactChanged =
      !!contact &&
      (contact.email.toLowerCase() !== email ||
        contact.full_name !== fullName ||
        contact.salutation !== salutation ||
        contact.title !== title ||
        contact.decision_role !== draft.decision_role);

    // errors stay in the drawer (under the email field, or above the buttons) instead of a second toast
    const result = await run(async () => {
      try {
        if (contact && contactChanged) {
          await api.upsertContact(account.id, {
            id: contact.id,
            full_name: fullName,
            salutation,
            title,
            decision_role: draft.decision_role,
            email,
          });
        }
        return await api.inviteClientUser(account.id, {
          full_name: fullName,
          email,
          salutation,
          title,
          role: owner ? 'client_owner' : 'client_member',
          decision_role: draft.decision_role,
        });
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
    toastSuccess(t('account.contacts.invited', { name: fullName, email }));
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
          <SheetTitle>{contact ? t('account.contacts.inviteTitleFor', { name: contact.full_name }) : t('account.contacts.inviteTitle')}</SheetTitle>
          <SheetDescription>{t('account.contacts.inviteDescription', { account: account.name })}</SheetDescription>
        </SheetHeader>
        <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5 pt-5 md:pt-6">
            <FormField
              label={t('common.email')}
              htmlFor={`${id}-email`}
              required
              hint={
                <span className="inline-flex items-center gap-1">
                  <AtSign className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t('account.contacts.form.domainHint', { domain })}
                </span>
              }
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
                placeholder={`ten@${domain}`}
                disabled={pending}
                autoFocus={!contact}
              />
            </FormField>
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
            <FormField
              label={t('account.contacts.form.role')}
              htmlFor={`${id}-role`}
              hint={t(owner ? 'account.contacts.form.accessOwner' : 'account.contacts.form.accessMember', {
                role: enumLabel('role', owner ? 'client_owner' : 'client_member'),
              })}
            >
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
            {formError ? <FormAlert>{formError}</FormAlert> : null}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit} loading={pending}>
              {pending ? null : <Send aria-hidden="true" />}
              {t('account.contacts.inviteSubmit')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
