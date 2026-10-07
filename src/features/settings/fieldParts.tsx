// Small form pieces shared by Settings and the new-account wizard (both owned by the settings feature).
import * as React from 'react';
import { CircleAlert } from 'lucide-react';
import type { Salutation } from '@/domain/types';
import { cn } from '@/components/ui/cn';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n';
import { normalizeEmailLocal } from './emailRules';

/**
 * Radio "choice card" inside a form card (DESIGN §7.5 inset panel, not a box in a box): a ringed row with the radio,
 * a title and a caption. Selected = soft primary tint (selection is one of blue's jobs).
 */
export const CHOICE_CARD =
  'flex cursor-pointer items-start gap-3 rounded-lg p-3.5 ring-1 ring-inset transition-colors duration-150 ease-out-quart has-[button:disabled]:cursor-not-allowed';
export const CHOICE_CARD_OFF = 'bg-card ring-border-strong/70 hover:bg-subtle';
export const CHOICE_CARD_ON = 'bg-primary-soft/60 ring-primary-border';

/** error line under a field: same look as FormField's (danger 13px with a 14px icon) */
export function FieldError({ id, children, live = true }: { id?: string; children: React.ReactNode; live?: boolean }) {
  return (
    <p id={id} aria-live={live ? 'polite' : undefined} className="flex items-start gap-1.5 text-[13px] leading-[18px] text-danger">
      <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export interface AffixInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** text shown glued to the right of the field ("%", "@coxanh.vn") */
  suffix?: React.ReactNode;
  /** text shown glued to the left ("@") */
  leading?: React.ReactNode;
  wrapperClassName?: string;
}

const affixClass =
  'inline-flex shrink-0 items-center border border-border-strong bg-subtle px-3 text-base text-muted-foreground md:text-table';

/** Input with a fixed prefix / suffix in the same box. aria-* props reach the input (FormField clones them in). */
export const AffixInput = React.forwardRef<HTMLInputElement, AffixInputProps>(
  ({ suffix, leading, wrapperClassName, className, ...props }, ref) => {
    const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';
    return (
      <div className={cn('flex w-full min-w-0 items-stretch rounded-lg shadow-xs', wrapperClassName)}>
        {leading !== undefined ? (
          <span aria-hidden="true" className={cn(affixClass, 'rounded-l-lg border-r-0', invalid && 'border-danger')}>
            {leading}
          </span>
        ) : null}
        <Input
          ref={ref}
          className={cn(
            'relative min-w-0 flex-1 shadow-none focus:z-10',
            leading !== undefined && 'rounded-l-none',
            suffix !== undefined && 'rounded-r-none',
            className,
          )}
          {...props}
        />
        {suffix !== undefined ? (
          <span className={cn(affixClass, 'max-w-[60%] rounded-r-lg border-l-0', invalid && 'border-danger')}>
            <span className="truncate">{suffix}</span>
          </span>
        ) : null}
      </div>
    );
  },
);
AffixInput.displayName = 'AffixInput';

export interface DomainEmailInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** the part before "@" */
  value: string;
  domain: string;
  onValueChange: (local: string) => void;
}

/** Email field where only the part before "@" is typed; "@domain" is shown and enforced. */
export const DomainEmailInput = React.forwardRef<HTMLInputElement, DomainEmailInputProps>(
  ({ value, domain, onValueChange, ...props }, ref) => (
    <AffixInput
      ref={ref}
      type="text"
      inputMode="email"
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      value={value}
      onChange={(e) => onValueChange(normalizeEmailLocal(e.target.value, domain))}
      suffix={<span title={`@${domain}`}>@{domain || t('settings.email.noDomain')}</span>}
      {...props}
    />
  ),
);
DomainEmailInput.displayName = 'DomainEmailInput';

export interface GroupFieldA11y {
  labelId: string;
  describedBy: string | undefined;
  invalid: boolean;
}

/** Label + hint + error around a control that is a group (toggle buttons, radio cards), not a single input. */
export function GroupField({
  id,
  label,
  required = false,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: (a11y: GroupFieldA11y) => React.ReactNode;
}) {
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <p id={labelId} className="text-table font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </p>
      {children({ labelId, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-caption">
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

const SALUTATIONS: readonly Salutation[] = ['anh', 'chị'];

/** Anh / Chị segmented choice (single, cannot be cleared once chosen). */
export function SalutationToggle({
  id,
  value,
  onChange,
  disabled,
  a11y,
  className,
}: {
  id?: string;
  value: Salutation | '';
  onChange: (value: Salutation) => void;
  disabled?: boolean;
  a11y: GroupFieldA11y;
  className?: string;
}) {
  return (
    <ToggleGroup
      id={id}
      type="single"
      variant="segmented"
      value={value}
      disabled={disabled}
      onValueChange={(next: string) => {
        if (next === 'anh' || next === 'chị') onChange(next);
      }}
      aria-labelledby={a11y.labelId}
      aria-describedby={a11y.describedBy}
      className={cn('flex w-full sm:w-fit', a11y.invalid && value === '' && 'ring-1 ring-inset ring-danger', className)}
    >
      {SALUTATIONS.map((s) => (
        <ToggleGroupItem key={s} value={s} className="flex-1 sm:min-w-24 sm:flex-none">
          {t(`enums.salutationTitle.${s}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
