// Pieces of a client request shared by "Yêu cầu của anh/chị" (Tiến độ) and the home card "Yêu cầu đang xử lý":
// the one-line "when" (sent / promised / done), the "Trễ 4 ngày" badge of a slipped promise, New Era's note and
// the list row.
// Client wording only: status words from care.crStatusClient, never owner / plan / internal flags (the data layer
// does not send them to clients anyway).
import { CalendarCheck, CalendarClock, ChevronRight, Clock, Send } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import type { ClientChangeRequestView } from '@/services/careContract';
import { capitalize, t } from '@/i18n';
import { formatDate, formatDateShort } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CrStatusChip } from '@/components/care/badges';
import { SMALL } from '@/components/common/cx';
import { NewEraMark } from '@/components/common/new-era-logo';
import { Badge } from '@/components/ui/badge';
import { requestWhen } from './requestModel';
import { LIST_ROW } from './styles';

/** "Gửi 07/10" · "Chị Lan gửi 07/10" · "New Era ghi nhận 07/10" (who only when it is not the viewer) */
export function sentText(r: Pick<ClientChangeRequestView, 'mine' | 'requested_by_name'>, date: ISODate): string {
  const d = formatDateShort(date);
  if (r.mine) return t('carePortal.requests.sentOn', { date: d });
  if (r.requested_by_name) return t('carePortal.requests.sentByOn', { name: capitalize(r.requested_by_name), date: d });
  return t('carePortal.requests.loggedOn', { date: d });
}

/**
 * One quiet line about time: "YC-07 · Dự kiến xong 21/10" · "Gửi 07/10" · "Hoàn thành 27/09" (+ the project when
 * the list mixes projects). A promise that slipped shows as RequestLateBadge beside the status chip.
 */
export function RequestWhenLine({
  request,
  today,
  code = null,
  project = null,
  className,
}: {
  request: ClientChangeRequestView;
  today: ISODate;
  /** "YC-07" to lead the line (list rows) */
  code?: string | null;
  /** project name to end the line with (lists that mix projects) */
  project?: string | null;
  className?: string;
}) {
  const when = requestWhen(request, today);
  let Icon = Send;
  let text: string;
  if (when.kind === 'done') {
    Icon = CalendarCheck;
    text = t('carePortal.requests.doneOn', { date: formatDateShort(when.date) });
  } else if (when.kind === 'promised') {
    Icon = CalendarClock;
    text =
      when.date === today ? t('carePortal.requests.promisedToday') : t('carePortal.requests.promised', { date: formatDateShort(when.date) });
  } else {
    text = sentText(request, when.date);
  }
  return (
    <span className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular text-muted-foreground', SMALL, className)}>
      {code ? <span className="whitespace-nowrap font-medium text-foreground">{code}</span> : null}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={formatDate(when.date)}>
        {code ? <span aria-hidden="true">·</span> : null}
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {text}
      </span>
      {project ? (
        <span className="min-w-0 max-w-full truncate">
          <span aria-hidden="true" className="mr-1.5">
            ·
          </span>
          {project}
        </span>
      ) : null}
    </span>
  );
}

/** "Trễ 4 ngày" next to the status chip of a request whose promised date has passed (warning: icon + word). */
export function RequestLateBadge({ request, today }: { request: ClientChangeRequestView; today: ISODate }) {
  const when = requestWhen(request, today);
  if (when.kind !== 'promised' || when.lateDays <= 0) return null;
  return (
    <Badge variant="warning" size="sm" title={formatDate(when.date)}>
      <Clock aria-hidden="true" />
      {t('carePortal.requests.lateBadge', { days: when.lateDays })}
    </Badge>
  );
}

/** New Era's note to the client, or the reason it cannot be done — the words the client is waiting for. */
export function requestNote(r: Pick<ClientChangeRequestView, 'status' | 'client_note' | 'decline_reason'>): string | null {
  if (r.status === 'declined' && r.decline_reason) return t('carePortal.requests.declineReason', { reason: r.decline_reason });
  return r.client_note ? t('carePortal.requests.newEraNote', { note: r.client_note }) : null;
}

export function RequestNoteLine({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-start gap-1.5 text-muted-foreground', SMALL, className)}>
      <NewEraMark className="mt-px h-4 w-4 shrink-0" />
      <span className="line-clamp-2 min-w-0 break-words">{text}</span>
    </span>
  );
}

export interface RequestRowProps {
  request: ClientChangeRequestView;
  today: ISODate;
  /** the list mixes projects: the time line ends with the project name */
  showProject: boolean;
  /** the row whose detail sheet is open */
  selected?: boolean;
  onOpen(id: string): void;
}

/** A request as a full-bleed row of a card list (button → detail sheet). */
export function RequestRow({ request: r, today, showProject, selected = false, onOpen }: RequestRowProps) {
  const note = requestNote(r);
  return (
    <li data-request-id={r.id}>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => onOpen(r.id)}
        className={cn(LIST_ROW, selected && 'bg-subtle')}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <CrStatusChip status={r.status} audience="client" />
            <RequestLateBadge request={r} today={today} />
          </span>
          <span className="mt-1.5 line-clamp-2 break-words text-table font-medium text-foreground">{r.title}</span>
          <RequestWhenLine request={r} today={today} code={r.code} project={showProject ? r.project?.name : null} className="mt-1" />
          {note ? <RequestNoteLine text={note} className="mt-1.5" /> : null}
        </span>
        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-caption transition-colors duration-150 group-hover:text-foreground"
          aria-hidden="true"
        />
        <span className="sr-only">{t('carePortal.requests.openDetail')}</span>
      </button>
    </li>
  );
}
