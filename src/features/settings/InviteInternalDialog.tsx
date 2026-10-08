// "Mời người dùng nội bộ" (director): short required input → dialog. The email must use New Era's domain.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Send } from 'lucide-react';
import type { Role } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { t } from '@/i18n';
import { emailLocalProblem, fullEmail } from './emailRules';
import { DomainEmailInput } from './fieldParts';

type InternalRole = Extract<Role, 'director' | 'am' | 'member'>;
const ROLES: InternalRole[] = ['am', 'member', 'director'];

interface InviteForm {
  full_name: string;
  email: string;
  role: InternalRole;
  title: string;
}

const EMPTY: InviteForm = { full_name: '', email: '', role: 'am', title: '' };

export function InviteInternalDialog({
  open,
  onOpenChange,
  domain,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** New Era's email domain (from the signed-in director's address) */
  domain: string;
}) {
  const [form, setForm] = useState<InviteForm>(EMPTY);
  const [attempted, setAttempted] = useState(false);
  const { run, pending, pendingVisible } = useAction();

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setAttempted(false);
    }
  }, [open]);

  const nameError = form.full_name.trim() ? null : t('settings.users.invite.nameRequired');
  const emailProblem = emailLocalProblem(form.email, true);
  const emailError = emailProblem ? t(emailProblem, { domain }) : null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (nameError || emailError) {
      document.getElementById(nameError ? 'invite-internal-name' : 'invite-internal-email')?.focus();
      return;
    }
    const name = form.full_name.trim();
    const created = await run(
      () =>
        api.inviteInternalUser({
          full_name: name,
          email: fullEmail(form.email, domain),
          role: form.role,
          title: form.title.trim(),
        }),
      { success: 'settings.users.invite.toast', successParams: { name } },
    );
    if (created) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent closeLabel={t('common.close')}>
        <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('settings.users.invite.title')}</DialogTitle>
            <DialogDescription>{t('settings.users.invite.description')}</DialogDescription>
          </DialogHeader>
          <FormField
            label={t('settings.users.invite.name')}
            htmlFor="invite-internal-name"
            required
            error={attempted ? nameError : null}
          >
            <Input
              id="invite-internal-name"
              autoComplete="off"
              value={form.full_name}
              placeholder={t('settings.users.invite.namePlaceholder')}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </FormField>
          <FormField
            label={t('settings.users.invite.email')}
            htmlFor="invite-internal-email"
            required
            error={attempted ? emailError : null}
          >
            <DomainEmailInput
              id="invite-internal-email"
              domain={domain}
              value={form.email}
              placeholder={t('settings.users.invite.emailPlaceholder')}
              onValueChange={(email) => setForm((f) => ({ ...f, email }))}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('settings.users.invite.role')} htmlFor="invite-internal-role">
              <NativeSelect
                id="invite-internal-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as InternalRole }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`enums.role.${r}`)}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('settings.users.invite.jobTitle')} htmlFor="invite-internal-title">
              <Input
                id="invite-internal-title"
                autoComplete="off"
                value={form.title}
                placeholder={t('settings.users.invite.jobTitlePlaceholder')}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </FormField>
          </div>
          <p className="text-caption">{t(`settings.users.invite.roleHint.${form.role}`)}</p>
          <DialogFooter>
            {/* a close while sending is blocked at once (onOpenChange); "Hủy" only looks disabled after 150 ms */}
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pendingVisible}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              <Send aria-hidden="true" />
              {t('settings.users.invite.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
