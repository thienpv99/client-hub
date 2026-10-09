// Small pieces shared by the account care screens (Tổng quan cards, Triển khai, Mở rộng, Quan hệ).
import type { ReactNode } from 'react';
import { CalendarX } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import type { SolutionCategory } from '@/domain/careTypes';
import type { UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDate, formatDateShort, formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { CATEGORY_ICONS } from '@/components/care/badges';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';

/** the "triệu ₫" fields of the care forms: '480' → 480 000 000; '' → null; NaN → undefined (invalid) */
export function millionsToVnd(text: string): number | null | undefined {
  const s = text.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 1_000_000);
}

export function vndToMillions(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const m = v / 1_000_000;
  return Number.isInteger(m) ? String(m) : String(Math.round(m * 100) / 100).replace('.', ',');
}

/** "≈ 480 tr ₫" under a millions field */
export function millionsPreview(text: string): string | null {
  const v = millionsToVnd(text);
  return typeof v === 'number' && v > 0 ? t('careAccount.common.approx', { value: formatMoneyCompact(v) }) : null;
}

/** whole numbers ≥ 0 ('' → null, invalid → undefined) */
export function parseCount(text: string): number | null | undefined {
  const s = text.trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) return undefined;
  return n;
}

/** solution category as a quiet icon tile (cards, rows) */
export function CategoryTile({ category, size = 'md', className }: { category: SolutionCategory; size?: 'sm' | 'md'; className?: string }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg bg-subtle text-muted-foreground ring-1 ring-inset ring-border/70',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </span>
  );
}

/** the care query failed (the rest of the page still works) */
export function CareErrorCard({ error, onRetry, className }: { error: unknown; onRetry: () => void; className?: string }) {
  return (
    <SectionCard className={className}>
      <ErrorState error={error} onRetry={onRetry} compact />
    </SectionCard>
  );
}

/** active New Era people for owner pickers (sorted by name by the api) */
export function useInternalPeople(enabled: boolean): UserRef[] {
  const q = useQuery(() => api.listUsers({ orgType: 'internal' }), [], { enabled });
  return q.data ?? [];
}

/** "Nguyễn Thu Hà · Account Manager" option label */
export function personOption(u: Pick<UserRef, 'full_name' | 'title'>): string {
  return u.title ? `${u.full_name} · ${u.title}` : u.full_name;
}

/**
 * A care due date ("Hạn 12/10", "Hôm nay", "Quá hạn 3 ngày · 06/10"): only a passed date is coloured (danger, with an
 * icon). `label` = the i18n key of the plain form (param {date}).
 */
export function CareDue({ date, label = 'careAccount.overview.care.due', className }: { date: ISODate; label?: string; className?: string }) {
  const late = diffDays(todayISO(), date);
  if (late > 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 whitespace-nowrap font-medium tabular text-danger', className)} title={formatDate(date)}>
        <CalendarX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('careAccount.overview.care.dueOverdue', { days: late, date: formatDateShort(date) })}
      </span>
    );
  }
  return (
    <span className={cn('whitespace-nowrap tabular', className)} title={formatDate(date)}>
      {late === 0 ? t('careAccount.overview.care.dueToday') : t(label, { date: formatDateShort(date) })}
    </span>
  );
}

/** label/value pair used in cards ("Bắt đầu dùng · 01/07/2026") */
export function Fact({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 break-words text-table text-foreground">{children}</dd>
    </div>
  );
}
