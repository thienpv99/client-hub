// Native date input + the chosen day spelled out in Vietnamese ("Thứ Hai, 03/11/2026"), whatever the browser locale.
import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { isValidISODate } from '@/domain/dates';
import { t } from '@/i18n';
import { formatDate, formatWeekday } from '@/lib/format';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

export interface DateFieldProps {
  id: string;
  label: ReactNode;
  value: string;
  onChange(value: string): void;
  required?: boolean;
  disabled?: boolean;
  /** extra sentence after the spelled-out date */
  hint?: ReactNode;
  /** non-blocking warning (amber, with icon) */
  warning?: ReactNode;
  error?: ReactNode;
}

export function DateField({ id, label, value, onChange, required = false, disabled, hint, warning, error }: DateFieldProps) {
  const valid = isValidISODate(value);
  const spelled = valid ? t('roadmap.form.dateSpelled', { weekday: formatWeekday(value), date: formatDate(value) }) : null;
  const hintNode =
    spelled || hint || warning ? (
      <span className="flex flex-col gap-1">
        {spelled || hint ? (
          <span>
            {spelled ? <span className="tabular">{spelled}</span> : null}
            {spelled && hint ? ' · ' : null}
            {hint}
          </span>
        ) : null}
        {warning ? (
          <span className="flex items-start gap-1.5 text-warning">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{warning}</span>
          </span>
        ) : null}
      </span>
    ) : undefined;
  return (
    <FormField label={label} htmlFor={id} required={required} hint={hintNode} error={error}>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="tabular"
      />
    </FormField>
  );
}
