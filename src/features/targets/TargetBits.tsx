// Small display pieces shared by the targeting screens: lead status badge, follow-up label, owner label,
// multi-select chip group, drawer / builder section.
import type { ReactNode } from 'react';
import { AlarmClock, Ban, CalendarClock, Check, CircleCheck, CircleDot, PhoneCall, Sprout, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LeadStatus } from '@/domain/crmTypes';
import { diffDays } from '@/domain/dates';
import type { ISODate } from '@/domain/types';
import type { UserRef } from '@/services/contract';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/cn';
import { UserAvatar } from '@/components/common/user-avatar';
import { SMALL } from '@/components/common/cx';
import { capitalize, t } from '@/i18n';
import { formatRelativeDays } from '@/lib/format';
import { followUpInfo, leadStatusLabel, shortPersonName } from './targetLabels';

const STATUS_LOOK: Record<LeadStatus, { icon: LucideIcon; variant: 'default' | 'success' | 'outline' }> = {
  new: { icon: CircleDot, variant: 'default' },
  contacted: { icon: PhoneCall, variant: 'default' },
  // neutral: the fit badge already carries the row's one blue accent
  interested: { icon: Star, variant: 'default' },
  nurturing: { icon: Sprout, variant: 'default' },
  disqualified: { icon: Ban, variant: 'outline' },
  converted: { icon: CircleCheck, variant: 'success' },
};

export function LeadStatusBadge({ status, size = 'default', className }: { status: LeadStatus; size?: 'sm' | 'default'; className?: string }) {
  const look = STATUS_LOOK[status];
  const Icon = look.icon;
  return (
    <Badge variant={look.variant} size={size} className={className}>
      <Icon aria-hidden="true" />
      {leadStatusLabel(status)}
    </Badge>
  );
}

export function leadStatusIcon(status: LeadStatus): LucideIcon {
  return STATUS_LOOK[status].icon;
}

/**
 * "Quá hạn 3 ngày" (danger, alarm icon) · "Hôm nay" · "12/10/2026 · còn 6 ngày" · "Chưa hẹn".
 * `relative` (lists, DESIGN §6): a later date reads "Còn 6 ngày", the date itself is in the tooltip.
 */
export function FollowUpLabel({
  date,
  today,
  open = true,
  relative = false,
  className,
}: {
  date: ISODate | null;
  today: ISODate;
  /** closed leads show the date without urgency */
  open?: boolean;
  relative?: boolean;
  className?: string;
}) {
  const info = followUpInfo(date, today);
  if (relative && open && date && info.kind === 'future') {
    return (
      <span className={cn('tabular text-muted-foreground', className)} title={info.date}>
        {capitalize(formatRelativeDays(diffDays(date, today)))}
        <span className="sr-only"> · {info.date}</span>
      </span>
    );
  }
  if (info.kind === 'none') return <span className={cn('text-muted-foreground', className)}>{info.text}</span>;
  if (!open) return <span className={cn('tabular text-muted-foreground', className)}>{info.date}</span>;
  if (info.kind === 'overdue') {
    return (
      <span className={cn('inline-flex items-center gap-1 font-medium text-danger', className)} title={info.date}>
        <AlarmClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="tabular">
          {info.text}
          <span className="sr-only"> · {info.date}</span>
        </span>
      </span>
    );
  }
  if (info.kind === 'today') {
    return (
      <span className={cn('inline-flex items-center gap-1 font-medium text-foreground', className)} title={info.date}>
        <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {info.text}
      </span>
    );
  }
  return <span className={cn('tabular text-muted-foreground', className)}>{info.text}</span>;
}

export function OwnerLabel({ owner, short = false, className }: { owner: UserRef | null; short?: boolean; className?: string }) {
  if (!owner) return <span className={cn('text-muted-foreground', className)}>{t('targets.leads.unassigned')}</span>;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)} title={owner.full_name}>
      <UserAvatar user={owner} size="xs" />
      <span className="truncate">{short ? shortPersonName(owner.full_name) : owner.full_name}</span>
    </span>
  );
}

export interface ToggleChipOption<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * Multi-select pill toggles (aria-pressed), the ChipFilter look (32px, 44px on touch); wraps on every width.
 * Read-only mode shows only the chosen ones as quiet chips.
 */
export function ToggleChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  readOnly = false,
  emptyText,
  className,
}: {
  options: ToggleChipOption<T>[];
  value: readonly T[];
  onChange?: (next: T[]) => void;
  ariaLabel: string;
  readOnly?: boolean;
  /** shown when nothing is available (or, read-only, nothing chosen) */
  emptyText?: string;
  className?: string;
}) {
  if (readOnly) {
    const chosen = options.filter((o) => value.includes(o.value));
    if (chosen.length === 0) return <p className="text-caption">{emptyText ?? t('targets.icp.noneSelected')}</p>;
    return (
      <ul aria-label={ariaLabel} className={cn('flex flex-wrap gap-1.5', className)}>
        {chosen.map((o) => (
          <li key={o.value} className={cn('inline-flex h-7 items-center rounded-full bg-muted px-3 text-foreground', SMALL)}>
            {o.label}
          </li>
        ))}
      </ul>
    );
  }
  if (options.length === 0) return <p className="text-caption">{emptyText ?? t('targets.builder.noOptions')}</p>;
  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(active ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              'touch-tap inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 font-medium ring-1 ring-inset transition-colors duration-150 sm:h-8 sm:px-3',
              SMALL,
              active
                ? 'bg-primary-soft text-primary ring-primary-border'
                : 'bg-card text-muted-foreground shadow-xs ring-border-strong/80 hover:bg-subtle hover:text-foreground',
            )}
          >
            {active ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Titled section inside drawers and the builder (sections are separated by the parent's hairlines) */
export function Block({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0 space-y-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-table font-semibold text-ink">{title}</h3>
          {description ? <p className="mt-0.5 text-caption">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
