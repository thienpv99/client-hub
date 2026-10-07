// Small parts of TaskFormDialog: a switch row (label + hint left, switch right), the due-date hint and the
// assignee option text.
import type { UserRef } from '@/services/contract';
import { todayISO } from '@/domain/clock';
import { diffDays, isValidISODate } from '@/domain/dates';
import { t } from '@/i18n';
import { formatDate, formatRelativeDays, formatWeekday } from '@/lib/format';
import { Switch } from '@/components/ui/switch';

/** the native date input shows the browser's locale format: repeat the date as "Thứ Ba, 13/10/2026 · còn 7 ngày" */
export function dueHint(due: string): string | undefined {
  if (!due || !isValidISODate(due)) return undefined;
  return t('tasks.form.dueHint', {
    weekday: formatWeekday(due),
    date: formatDate(due),
    relative: formatRelativeDays(diffDays(due, todayISO())),
  });
}

export function userOption(u: UserRef): string {
  const parts = [u.full_name];
  if (u.title) parts.push(u.title);
  const text = parts.join(' · ');
  return u.role === 'client_owner' ? t('tasks.form.ownerSuffix', { text }) : text;
}

export function SwitchRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-tap items-start justify-between gap-4 py-1">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-table font-medium text-foreground">{label}</span>
        <span id={`${id}-hint`} className="mt-0.5 block text-caption">
          {hint}
        </span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-describedby={`${id}-hint`} className="mt-0.5" />
    </div>
  );
}
