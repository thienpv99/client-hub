// Small form pieces shared by the CRM dialogs (create / edit opportunity, log interaction).
import { forwardRef, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import type { PriceItemView, UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { addDays, isValidISODate } from '@/domain/dates';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDate, formatNumber, formatWeekday } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { SMALL } from '@/components/common/cx';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

type BaseInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'>;

export interface MoneyInputProps extends BaseInputProps {
  /** whole VND; 0 shows an empty field */
  value: number;
  onValueChange: (v: number) => void;
}

/** Digits only while typing; grouped with '.' ("1.250.000.000") when the field is not focused. */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, onFocus, onBlur, className, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const shown = value > 0 ? (focused ? String(Math.round(value)) : formatNumber(Math.round(value), 0)) : '';
    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
          onValueChange(digits ? Number(digits) : 0);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cn('tabular', className)}
        {...props}
      />
    );
  },
);
MoneyInput.displayName = 'MoneyInput';

export interface DateFieldProps {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: ReactNode;
  /** extra sentence after the spelled-out date */
  hint?: ReactNode;
  min?: string;
  max?: string;
  className?: string;
}

/** Native date input + the chosen day spelled out in Vietnamese ("Thứ Hai, 12/10/2026") whatever the browser locale. */
export function DateField({ id, label, value, onChange, required = false, error, hint, min, max, className }: DateFieldProps) {
  const spelled = isValidISODate(value) ? t('crm.fields.dateSpelled', { weekday: formatWeekday(value), date: formatDate(value) }) : null;
  const hintNode =
    spelled || hint ? (
      <>
        {spelled ? <span className="tabular">{spelled}</span> : null}
        {spelled && hint ? ' · ' : null}
        {hint}
      </>
    ) : undefined;
  return (
    <FormField label={label} htmlFor={id} required={required} error={error} hint={hintNode} className={className}>
      <Input id={id} type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} className="tabular" />
    </FormField>
  );
}

/** "Ngày mai" · "3 ngày nữa" · "1 tuần nữa" — quick picks under a date field */
export function QuickDates({
  today,
  onPick,
  offsets = [1, 3, 7],
  className,
}: {
  today: string;
  onPick: (date: string) => void;
  offsets?: number[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {offsets.map((n) => (
        <Button key={n} type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-muted-foreground" onClick={() => onPick(addDays(today, n))}>
          {t(`crm.fields.quickDate.${n}`)}
        </Button>
      ))}
    </div>
  );
}

/** checkbox list of price items (products of interest) */
export function ProductPicker({
  items,
  value,
  onChange,
  loading = false,
  labelledBy,
}: {
  items: PriceItemView[];
  value: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  /** id of the visible label of the group */
  labelledBy?: string;
}) {
  if (loading) return <p className="text-caption">{t('common.loading')}</p>;
  if (items.length === 0) return <p className="text-caption">{t('crm.fields.products.empty')}</p>;
  const selected = new Set(value);
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="scrollbar-thin relative max-h-52 overflow-y-auto rounded-lg bg-card ring-1 ring-inset ring-border-strong/80"
    >
      <ul className="divide-y divide-border/60">
        {items.map((item) => {
          const checked = selected.has(item.id);
          return (
            <li key={item.id}>
              <label
                className={cn(
                  'flex min-h-tap cursor-pointer items-center gap-3 px-3 py-2 transition-colors duration-150 hover:bg-subtle',
                  checked && 'bg-primary-soft/50 hover:bg-primary-soft/70',
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => {
                    const ids = new Set(selected);
                    if (next === true) ids.add(item.id);
                    else ids.delete(item.id);
                    onChange(items.filter((i) => ids.has(i.id)).map((i) => i.id));
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-table text-foreground">{item.name}</span>
                  <span className={cn('block text-muted-foreground tabular', SMALL)}>{item.code}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** active price items for the product pickers */
export function useActivePriceItems(enabled: boolean) {
  const q = useQuery(() => api.listPriceItems(), [], { enabled });
  return { items: (q.data ?? []).filter((i) => i.active), loading: q.loading };
}

/** people who can own deals: director + AMs (only a director needs this list) */
export function useDealOwners(enabled: boolean): { owners: UserRef[]; loading: boolean } {
  const q = useQuery(() => api.listUsers({ orgType: 'internal' }), [], { enabled });
  const owners = (q.data ?? [])
    .filter((u) => u.role === 'director' || u.role === 'am')
    .sort((a, b) => (a.role === b.role ? a.full_name.localeCompare(b.full_name, 'vi') : a.role === 'director' ? 1 : -1));
  return { owners, loading: q.loading };
}

/** 0–100 from a free text field */
export function parsePercent(raw: string): number | null {
  const n = Number(raw.replace(',', '.').trim());
  if (raw.trim() === '' || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}
