// One request on the "Yêu cầu" board (DESIGN §5 kanban card): account + code, title (2 lines, opens the triage sheet),
// flags with the reason (Nợ triển khai · Quá ngày hẹn / Chưa xử lý 9 ngày), promised date, urgency and owner.
// "Chuyển sang…" (the kanban MoveMenu pattern) moves it — keyboard and touch friendly, no drag needed.
import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRightLeft, CalendarCheck, CalendarClock, CalendarX, CircleCheck, CircleDot, CircleX, Flame, Inbox, MessageSquareText, Play } from 'lucide-react';
import type { CrStatus } from '@/domain/careTypes';
import type { ISODate } from '@/domain/types';
import { dateOf } from '@/domain/clock';
import type { ChangeRequestView } from '@/services/careContract';
import { CrFlags, hasCrFlag } from '@/components/care/badges';
import { AccountLogo } from '@/components/common/account-logo';
import { SMALL } from '@/components/common/cx';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDelayedFlag } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { BOARD_COLUMNS, daysToPromise } from './requestsModel';

/** the same icons as the kit's CrStatusChip */
export const CR_STATUS_ICONS: Record<CrStatus, LucideIcon> = {
  new: Inbox,
  triaged: CircleDot,
  planned: CalendarCheck,
  in_progress: Play,
  done: CircleCheck,
  declined: CircleX,
};

// ───────────────────────────── move menu ─────────────────────────────

function CrMoveMenu({ request, current, onMove }: { request: ChangeRequestView; current: CrStatus; onMove(to: CrStatus): void }) {
  // after a move the card re-mounts in its new column and takes the focus itself; Escape returns it here as usual
  const moved = useRef(false);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative z-10 -my-1.5 -mr-1.5 h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={t('carePm.board.moveMenu', { code: request.code, title: request.title })}
          title={t('carePm.board.moveTo')}
        >
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60"
        onCloseAutoFocus={(e) => {
          if (!moved.current) return;
          moved.current = false;
          e.preventDefault();
        }}
      >
        <DropdownMenuLabel>{t('carePm.board.moveTo')}</DropdownMenuLabel>
        {/* a request already taken in never goes back to "Mới" (the service refuses it) */}
        {BOARD_COLUMNS.filter((s) => s !== current && (s !== 'new' || request.status === 'new')).map((s) => {
          const Icon = CR_STATUS_ICONS[s];
          return (
            <DropdownMenuItem
              key={s}
              onSelect={() => {
                moved.current = true;
                onMove(s);
              }}
            >
              <Icon aria-hidden="true" />
              {t(`care.crStatus.${s}`)}
              {s === 'declined' || (s === 'planned' && !request.promised_date) ? (
                <span className="ml-auto text-micro text-muted-foreground">{t(`carePm.board.asks.${s}`)}</span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ───────────────────────────── date line ─────────────────────────────

/**
 * The one date that matters for the column: done → "Xong 03/10"; a promised date → "Hẹn 14/10" (passed: danger
 * "Quá hẹn 4 ngày · 05/10"); a new request → "Nhận 30/09"; otherwise "Chưa hẹn ngày".
 */
export function RequestDate({ request: cr, status, today, className }: { request: ChangeRequestView; status: CrStatus; today: ISODate; className?: string }) {
  const base = cn('inline-flex items-center gap-1 whitespace-nowrap tabular', SMALL, className);
  if (status === 'done' && cr.done_at) {
    return (
      <span className={cn(base, 'text-muted-foreground')}>
        <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('carePm.date.done', { date: formatDateShort(cr.done_at) })}
      </span>
    );
  }
  if (status === 'declined') {
    return (
      <span className={cn(base, 'text-muted-foreground')}>
        <CircleX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('carePm.date.declined', { date: formatDateShort(dateOf(cr.updated_at)) })}
      </span>
    );
  }
  const left = daysToPromise(cr, today);
  if (cr.promised_date && left !== null) {
    if (left < 0) {
      return (
        <span className={cn(base, 'font-medium text-danger')}>
          <CalendarX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('carePm.date.late', { days: -left, date: formatDateShort(cr.promised_date) })}
        </span>
      );
    }
    return (
      <span className={cn(base, 'text-foreground')}>
        <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {left === 0 ? t('carePm.date.promisedToday') : t('carePm.date.promised', { date: formatDateShort(cr.promised_date) })}
      </span>
    );
  }
  if (status === 'new') {
    return (
      <span className={cn(base, 'text-muted-foreground')}>
        <Inbox className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('carePm.date.received', { date: formatDateShort(cr.received_at) })}
      </span>
    );
  }
  return <span className={cn(base, 'text-muted-foreground')}>{t('carePm.date.noPromise')}</span>;
}

/** owner avatar, or the dashed "chưa phân công" circle */
export function OwnerMark({ request, className }: { request: ChangeRequestView; className?: string }) {
  const label = request.owner ? t('carePm.owner', { name: request.owner.full_name }) : t('care.kit.triage.ownerNone');
  return (
    <span className={cn('inline-flex shrink-0', className)} title={label}>
      {request.owner ? (
        <UserAvatar user={request.owner} size="xs" />
      ) : (
        <span aria-hidden="true" className="inline-flex h-5 w-5 rounded-full border border-dashed border-caption/60 bg-card" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

// ───────────────────────────── card ─────────────────────────────

export interface RequestCardProps {
  request: ChangeRequestView;
  /** the column it is drawn in (optimistic) */
  status: CrStatus;
  today: ISODate;
  moving: boolean;
  /** moved with the keyboard menu: take the focus when (re-)mounted in its new column */
  focusRequest?: boolean;
  onOpen(): void;
  onMove(to: CrStatus): void;
}

export function RequestCard({ request: cr, status, today, moving, focusRequest = false, onOpen, onMove }: RequestCardProps) {
  const titleRef = useRef<HTMLButtonElement | null>(null);
  const movingVisible = useDelayedFlag(moving);
  // mounted while its move is in flight = it just landed in this column: a 150 ms fade shows where it went
  const [landed] = useState(moving);
  const closed = status === 'done' || status === 'declined';
  const account = cr.account.short_name || cr.account.name;

  useEffect(() => {
    if (!focusRequest) return;
    const id = window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [focusRequest, status]);

  return (
    <div
      aria-busy={moving || undefined}
      className={cn(
        'group relative space-y-2 rounded-lg border border-border/70 bg-card p-3 shadow-xs',
        'transition-[transform,border-color,opacity,box-shadow] duration-200 ease-out-quart',
        'hover:-translate-y-px hover:border-border hover:shadow-card-hover active:translate-y-0 focus-within:border-primary-border',
        landed && 'animate-fade-in',
        movingVisible && 'opacity-70',
      )}
    >
      <div className="flex min-h-6 items-center gap-1.5 text-micro font-medium text-muted-foreground">
        <AccountLogo account={cr.account} size="xs" />
        <span className="min-w-0 truncate">
          {account}
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, </span>
          <span className="tabular">{cr.code}</span>
        </span>
        {cr.source === 'client_portal' ? (
          <span className="inline-flex shrink-0 items-center" title={t('care.crSource.client_portal')}>
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{t('care.crSource.client_portal')}</span>
          </span>
        ) : null}
        <span className="flex-1" />
        {cr.can.update ? <CrMoveMenu request={cr} current={status} onMove={onMove} /> : null}
      </div>

      <button
        ref={titleRef}
        type="button"
        onClick={onOpen}
        title={cr.title}
        className={cn(
          'block w-full text-left text-table font-medium leading-5 line-clamp-2',
          closed ? 'text-muted-foreground' : 'text-ink',
          "after:absolute after:inset-0 after:rounded-lg after:content-['']",
          'focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary',
        )}
      >
        {cr.title}
      </button>

      {/* one chip "Nợ triển khai · <lý do>" as on every other screen; in a narrow column it wraps instead of overflowing */}
      {!closed && hasCrFlag(cr.flags) ? <CrFlags flags={cr.flags} wrap className="flex" /> : null}

      {/* wraps in narrow columns: the date first, urgency next, the owner always flush right */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
        <RequestDate request={cr} status={status} today={today} />
        {cr.priority === 'high' && !closed ? (
          <span className={cn('inline-flex items-center gap-1 whitespace-nowrap font-medium text-foreground', SMALL)}>
            <Flame className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {t('care.crPriority.high')}
          </span>
        ) : null}
        <OwnerMark request={cr} className="ml-auto" />
      </div>
    </div>
  );
}
