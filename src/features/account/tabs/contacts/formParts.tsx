// Form pieces shared by the contact and invite drawers.
import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import type { DecisionRole, Salutation } from '@/domain/types';
import { errorMessageKey } from '@/lib/errors';
import { t } from '@/i18n';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { enumLabel } from '@/components/common/labels';

export const DECISION_ROLES: DecisionRole[] = ['decision_maker', 'approver', 'ops_contact'];
const SALUTATIONS: Salutation[] = ['anh', 'chị'];

export function isDecisionRole(v: string): v is DecisionRole {
  return (DECISION_ROLES as string[]).includes(v);
}

/** error keys that belong under the email field */
const EMAIL_ERRORS = new Set(['errors.domain_mismatch', 'errors.invalid_email', 'errors.email_exists']);

export function isEmailError(err: unknown): boolean {
  const key = errorMessageKey(err);
  return key !== null && EMAIL_ERRORS.has(key);
}

export function SalutationField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: Salutation | null;
  onChange: (v: Salutation) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-table font-medium text-foreground">
        {t('account.contacts.form.salutation')}
        <span className="ml-0.5 text-danger" aria-hidden="true">
          *
        </span>
      </legend>
      <RadioGroup
        value={value ?? ''}
        onValueChange={(v) => {
          const next = SALUTATIONS.find((s) => s === v);
          if (next) onChange(next);
        }}
        className="mt-1.5 flex gap-2"
        disabled={disabled}
        aria-required="true"
      >
        {SALUTATIONS.map((s) => (
          <label
            key={s}
            htmlFor={`${id}-${s}`}
            className="touch-tap flex min-h-tap flex-1 cursor-pointer items-center gap-3 rounded-lg bg-card px-3 ring-1 ring-inset ring-border-strong/70 transition-[background-color,box-shadow] duration-150 hover:bg-subtle has-[[data-state=checked]]:bg-primary-soft has-[[data-state=checked]]:ring-primary-border sm:flex-none sm:pr-6 md:min-h-10"
          >
            <RadioGroupItem id={`${id}-${s}`} value={s} />
            <span className="text-table font-medium text-foreground">{enumLabel('salutationTitle', s)}</span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

export function DecisionRoleOptions() {
  return (
    <>
      {DECISION_ROLES.map((r) => (
        <option key={r} value={r}>
          {enumLabel('decisionRole', r)}
        </option>
      ))}
    </>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-table text-danger ring-1 ring-inset ring-danger/15">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
