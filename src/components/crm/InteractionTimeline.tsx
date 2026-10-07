// Timeline of CRM touchpoints (gọi điện, gặp mặt, email, demo, Zalo, ghi chú), newest first as given.
// A quiet rail of kind icons (DESIGN §4: no boxes around items). Outcome is a status → soft pill with icon + word.
// Links to the account / lead / opportunity it belongs to.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Building2, CalendarClock, Crosshair, Handshake, MessagesSquare, Minus, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react';
import type { InteractionOutcome } from '@/domain/crmTypes';
import type { InteractionView } from '@/services/crmContract';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { SMALL } from '@/components/common/cx';
import { DateText } from '@/components/common/date-text';
import { EmptyState } from '@/components/common/empty-state';
import { UserAvatar } from '@/components/common/user-avatar';
import { crmPaths, INTERACTION_ICONS, interactionKindLabel, outcomeLabel } from './crmLabels';

const OUTCOME_LOOK: Record<InteractionOutcome, { icon: LucideIcon; variant: 'success' | 'default' | 'warning' }> = {
  positive: { icon: ThumbsUp, variant: 'success' },
  neutral: { icon: Minus, variant: 'default' },
  negative: { icon: ThumbsDown, variant: 'warning' },
};

export function OutcomeChip({ outcome, className }: { outcome: InteractionOutcome; className?: string }) {
  const look = OUTCOME_LOOK[outcome];
  const Icon = look.icon;
  return (
    <Badge variant={look.variant} size="sm" className={className}>
      <Icon aria-hidden="true" />
      {outcomeLabel(outcome)}
    </Badge>
  );
}

type LinkKind = 'account' | 'lead' | 'opportunity';

// 44px tall on touch screens (phones and iPad), compact for the mouse
const linkClass = cn(
  'touch-tap inline-flex min-w-0 max-w-full items-center gap-1 rounded text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline',
  SMALL,
);

function ItemLinks({ item, hide }: { item: InteractionView; hide: readonly LinkKind[] }) {
  const parts: ReactNode[] = [];
  if (item.account && !hide.includes('account')) {
    parts.push(
      <Link key="a" to={crmPaths.account(item.account.id)} className={linkClass}>
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.account.name}</span>
      </Link>,
    );
  }
  if (item.lead && !hide.includes('lead')) {
    parts.push(
      <Link key="l" to={crmPaths.lead(item.lead.id)} className={linkClass}>
        <Crosshair className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.lead.company_name}</span>
      </Link>,
    );
  }
  if (item.opportunity && !hide.includes('opportunity')) {
    parts.push(
      <Link key="o" to={crmPaths.opportunity(item.opportunity.id)} className={linkClass}>
        <Handshake className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.opportunity.name}</span>
      </Link>,
    );
  }
  if (item.contact) {
    parts.push(
      <span key="c" className={cn('inline-flex min-w-0 max-w-full items-center gap-1 text-muted-foreground', SMALL)}>
        <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {item.contact.title ? t('crm.timeline.contact', { name: item.contact.full_name, title: item.contact.title }) : item.contact.full_name}
        </span>
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">{parts}</div>;
}

export interface InteractionTimelineProps {
  items: InteractionView[];
  /** tighter rows, summary clamped to 2 lines */
  compact?: boolean;
  /** links that are redundant in the current context (e.g. the account on its own page) */
  hideLinks?: readonly LinkKind[];
  /** natural sentence when there is nothing yet */
  emptyText?: string;
  className?: string;
}

export function InteractionTimeline({ items, compact = false, hideLinks = [], emptyText, className }: InteractionTimelineProps) {
  if (items.length === 0) {
    return <EmptyState compact icon={MessagesSquare} title={emptyText ?? t('crm.timeline.empty')} className={className} />;
  }
  return (
    <ol className={cn('relative', className)} aria-label={t('crm.timeline.label')}>
      {items.map((item, i) => {
        const Icon = INTERACTION_ICONS[item.kind];
        const last = i === items.length - 1;
        return (
          <li key={item.id} className={cn('relative flex gap-3', last ? '' : compact ? 'pb-5' : 'pb-6')}>
            {/* rail from under this icon to the next one (icon 32px → centre 16px) */}
            {!last ? <span aria-hidden="true" className="absolute bottom-1 left-[15.5px] top-10 w-px bg-border" /> : null}
            <span
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-subtle text-muted-foreground ring-1 ring-inset ring-border/80"
              title={interactionKindLabel(item.kind)}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 break-words text-table font-medium text-ink">{item.subject}</p>
                {item.outcome ? <OutcomeChip outcome={item.outcome} /> : null}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-micro text-muted-foreground">
                <span>{interactionKindLabel(item.kind)}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <UserAvatar user={item.owner} size="xs" />
                  {item.owner.full_name}
                </span>
                <span aria-hidden="true">·</span>
                <DateText value={item.occurred_at} relative time />
              </div>
              {item.summary ? (
                <p className={cn('mt-2 whitespace-pre-line break-words text-table text-muted-foreground', compact && 'line-clamp-2')}>
                  {item.summary}
                </p>
              ) : null}
              <ItemLinks item={item} hide={hideLinks} />
              {item.next_follow_up_date ? (
                <p className="mt-1.5 inline-flex items-center gap-1 text-micro tabular text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t('crm.timeline.followUp', { date: formatDate(item.next_follow_up_date) })}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
