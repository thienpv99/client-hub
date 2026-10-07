// Step 2 — Người liên hệ & mời vào hệ thống: repeatable contact blocks (hairline-separated, no box in a box);
// at least one Người quyết định.
import { useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { DecisionRole } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { t } from '@/i18n';
import { DomainEmailInput, FieldError, GroupField, SalutationToggle } from '@/features/settings/fieldParts';
import { DECISION_ROLES, newContact, type ContactDraft, type ContactErrors } from './wizardModel';

export function contactFieldId(key: string, field: string): string {
  return `wz-c-${key}-${field}`;
}

export function ContactsStep({
  contacts,
  domain,
  errors,
  general,
  onChange,
}: {
  contacts: ContactDraft[];
  domain: string;
  /** per contact key; empty until the step was submitted once */
  errors: Record<string, ContactErrors>;
  general: string | null;
  /** functional update, so quick successive edits never work on a stale list */
  onChange: (update: (prev: ContactDraft[]) => ContactDraft[]) => void;
}) {
  const prevCount = useRef(contacts.length);
  const lastKey = contacts[contacts.length - 1]?.key;

  // focus the name of a newly added contact
  useEffect(() => {
    if (contacts.length > prevCount.current && lastKey) document.getElementById(contactFieldId(lastKey, 'name'))?.focus();
    prevCount.current = contacts.length;
  }, [contacts.length, lastKey]);

  const update = (key: string, patch: Partial<ContactDraft>) =>
    onChange((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  function add() {
    onChange((prev) => [
      ...prev,
      newContact(prev.some((c) => c.decision_role === 'decision_maker') ? 'approver' : 'decision_maker'),
    ]);
  }

  function remove(key: string, index: number) {
    onChange((prev) => prev.filter((c) => c.key !== key));
    // keep keyboard focus nearby
    const neighbour = contacts[index + 1] ?? contacts[index - 1];
    if (neighbour) setTimeout(() => document.getElementById(contactFieldId(neighbour.key, 'name'))?.focus(), 0);
  }

  return (
    <div className="space-y-6">
      <ol className="divide-y divide-border/60">
        {contacts.map((c, i) => {
          const e = errors[c.key] ?? {};
          const n = i + 1;
          return (
            <li key={c.key} className="py-6 first:pt-0 last:pb-0">
              <div className="flex min-h-tap items-center justify-between gap-3 md:min-h-8">
                <h3 className="flex min-w-0 items-center gap-2.5 text-heading font-semibold tracking-tightish text-ink">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-micro font-semibold tabular text-muted-foreground"
                  >
                    {n}
                  </span>
                  <span className="min-w-0 truncate">
                    <span className="sr-only">{t('wizard.contacts.item', { n })}: </span>
                    {c.full_name.trim() || <span className="font-medium text-muted-foreground">{t('wizard.contacts.unnamed')}</span>}
                  </span>
                </h3>
                {contacts.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="-mr-1.5"
                    aria-label={t('wizard.contacts.remove', { n })}
                    onClick={() => remove(c.key, i)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <FormField label={t('wizard.contacts.name')} htmlFor={contactFieldId(c.key, 'name')} required error={e.full_name}>
                  <Input
                    id={contactFieldId(c.key, 'name')}
                    autoComplete="off"
                    value={c.full_name}
                    placeholder={t('wizard.contacts.namePlaceholder')}
                    onChange={(ev) => update(c.key, { full_name: ev.target.value })}
                  />
                </FormField>
                <GroupField id={contactFieldId(c.key, 'salutation')} label={t('settings.salutation.label')} required error={e.salutation}>
                  {(a11y) => (
                    <SalutationToggle
                      id={contactFieldId(c.key, 'salutation')}
                      value={c.salutation}
                      a11y={a11y}
                      onChange={(salutation) => update(c.key, { salutation })}
                    />
                  )}
                </GroupField>
                <FormField label={t('wizard.contacts.title')} htmlFor={contactFieldId(c.key, 'title')}>
                  <Input
                    id={contactFieldId(c.key, 'title')}
                    autoComplete="off"
                    value={c.title}
                    placeholder={t('wizard.contacts.titlePlaceholder')}
                    onChange={(ev) => update(c.key, { title: ev.target.value })}
                  />
                </FormField>
                <FormField label={t('wizard.contacts.decisionRole')} htmlFor={contactFieldId(c.key, 'role')}>
                  <NativeSelect
                    id={contactFieldId(c.key, 'role')}
                    value={c.decision_role}
                    onChange={(ev) => update(c.key, { decision_role: ev.target.value as DecisionRole })}
                  >
                    {DECISION_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`enums.decisionRole.${r}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  label={t('wizard.contacts.email')}
                  htmlFor={contactFieldId(c.key, 'email')}
                  required={c.invite}
                  error={e.email}
                >
                  <DomainEmailInput
                    id={contactFieldId(c.key, 'email')}
                    domain={domain}
                    value={c.email}
                    placeholder={t('wizard.contacts.emailPlaceholder')}
                    onValueChange={(email) => update(c.key, { email })}
                  />
                </FormField>
                <FormField label={t('wizard.contacts.phone')} htmlFor={contactFieldId(c.key, 'phone')} error={e.phone}>
                  <Input
                    id={contactFieldId(c.key, 'phone')}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    value={c.phone}
                    placeholder={t('wizard.contacts.phonePlaceholder')}
                    onChange={(ev) => update(c.key, { phone: ev.target.value })}
                  />
                </FormField>
              </div>
              <label
                htmlFor={contactFieldId(c.key, 'invite')}
                className="mt-5 flex min-h-tap cursor-pointer items-start gap-3 rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60"
              >
                <Switch
                  id={contactFieldId(c.key, 'invite')}
                  checked={c.invite}
                  className="mt-0.5"
                  aria-describedby={contactFieldId(c.key, 'invite-hint')}
                  onCheckedChange={(invite) => update(c.key, { invite })}
                />
                <span className="min-w-0">
                  <span className="block text-table font-medium text-foreground">{t('wizard.contacts.invite')}</span>
                  <span id={contactFieldId(c.key, 'invite-hint')} className="mt-0.5 block text-caption">
                    {c.invite
                      ? t(c.decision_role === 'decision_maker' ? 'wizard.contacts.inviteOwner' : 'wizard.contacts.inviteMember')
                      : t('wizard.contacts.inviteOff')}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ol>

      {general ? (
        <div role="alert">
          <FieldError live={false}>{general}</FieldError>
        </div>
      ) : null}

      <Button type="button" variant="secondary" onClick={add} className="w-full sm:w-auto">
        <Plus aria-hidden="true" />
        {t('wizard.contacts.add')}
      </Button>
    </div>
  );
}
