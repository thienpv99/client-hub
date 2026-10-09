// "Theo trạng thái": the requests of every client on six quiet columns (DESIGN §5 kanban) — Mới · Đã tiếp nhận ·
// Đã lên kế hoạch · Đang làm · Xong · Từ chối. Six columns never fit beside the sidebar, so the board scrolls
// sideways inside its own container (snap points, faded end edge), never the page. From xl the columns are sized so
// exactly four fit (six from 1800px): the four open columns show whole and the edge never cuts a card mid-word
// (review QV-23); Xong / Từ chối are one snap away. Column header = name + count + the flags that need someone (nợ
// triển khai, chờ quá 7 ngày). Closed columns show the latest few first.
import { useRef, useState } from 'react';
import { CircleAlert, Clock } from 'lucide-react';
import type { CrStatus } from '@/domain/careTypes';
import type { ISODate } from '@/domain/types';
import type { ChangeRequestView } from '@/services/careContract';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { SCROLL_FADE_END_CLASS, useScrollFade } from '@/components/ui/use-scroll-fade';
import type { RiseProps } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { CR_STATUS_ICONS, RequestCard } from './RequestCard';
import type { RequestMoves } from './RequestMoves';
import { BOARD_COLUMNS, boardColumns } from './requestsModel';

const CLOSED_PAGE = 6;

export interface RequestBoardProps {
  rows: ChangeRequestView[];
  moves: RequestMoves;
  today: ISODate;
  onOpen(cr: ChangeRequestView): void;
  /** first-appearance stagger of the first column's cards */
  rise?: (index: number) => RiseProps;
}

export function RequestBoard({ rows, moves, today, onOpen, rise }: RequestBoardProps) {
  const [limit, setLimit] = useState<Record<'done' | 'declined', number>>({ done: CLOSED_PAGE, declined: CLOSED_PAGE });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useScrollFade(scrollRef);
  const columns = boardColumns(rows, moves.statusOf);

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={t('carePm.board.label')}
      tabIndex={0}
      className={cn(
        // `relative`: the containing block of the sr-only texts inside, so they never widen the page
        'scrollbar-thin relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        'md:mx-0 md:scroll-px-0 md:px-0 xl:gap-4',
        SCROLL_FADE_END_CLASS,
      )}
    >
      {BOARD_COLUMNS.map((status, col) => {
        const Icon = CR_STATUS_ICONS[status];
        const all = columns[status];
        const closedKey = status === 'done' || status === 'declined' ? status : null;
        const closed = closedKey !== null;
        const max = closedKey ? limit[closedKey] : Infinity;
        const list = all.slice(0, max);
        const hidden = all.length - list.length;
        const debt = closed ? 0 : all.filter((cr) => cr.flags.debt).length;
        const waiting = closed ? 0 : all.filter((cr) => cr.flags.untriaged).length;
        const headingId = `cr-col-${status}`;
        return (
          <section
            key={status}
            aria-labelledby={headingId}
            className="flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl bg-subtle p-2 ring-1 ring-inset ring-border/60 md:w-[280px] xl:w-[calc((100%_-_3rem)_/_4)] min-[1800px]:w-[calc((100%_-_5rem)_/_6)]"
          >
            <header className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 px-1.5 pb-2 pt-1">
              <Icon className={cn('h-4 w-4 shrink-0', status === 'done' ? 'text-success' : 'text-muted-foreground')} aria-hidden="true" />
              <h3 id={headingId} className="truncate text-table font-semibold text-ink">
                {t(`care.crStatus.${status}`)}
              </h3>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1.5 text-micro font-medium tabular text-muted-foreground ring-1 ring-inset ring-border/70">
                <span aria-hidden="true">{all.length}</span>
                <span className="sr-only">{t('carePm.board.columnCount', { count: all.length })}</span>
              </span>
              {debt > 0 || waiting > 0 ? (
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  {debt > 0 ? (
                    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-danger-soft px-1.5 text-micro font-medium tabular text-danger" title={t('carePm.board.debtCount', { count: debt })}>
                      <CircleAlert className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
                      <span aria-hidden="true">{debt}</span>
                      <span className="sr-only">{t('carePm.board.debtCount', { count: debt })}</span>
                    </span>
                  ) : null}
                  {waiting > 0 ? (
                    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-warning-soft px-1.5 text-micro font-medium tabular text-warning" title={t('carePm.board.waitingCount', { count: waiting })}>
                      <Clock className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
                      <span aria-hidden="true">{waiting}</span>
                      <span className="sr-only">{t('carePm.board.waitingCount', { count: waiting })}</span>
                    </span>
                  ) : null}
                </span>
              ) : null}
            </header>

            <ul className="flex min-h-24 flex-1 flex-col gap-2" aria-labelledby={headingId}>
              {list.map((cr, i) => {
                // DESIGN §8.4: only the first column's cards rise in on the tab's first appearance
                const p = col === 0 && rise ? rise(i) : undefined;
                return (
                  <li key={cr.id} className={p?.className} style={p?.style}>
                    <RequestCard
                      request={cr}
                      status={moves.statusOf(cr)}
                      today={today}
                      moving={moves.isMoving(cr.id)}
                      focusRequest={moves.focusId === cr.id}
                      onOpen={() => onOpen(cr)}
                      onMove={(to: CrStatus) => moves.move(cr, to)}
                    />
                  </li>
                );
              })}
              {all.length === 0 ? (
                <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-strong/70 px-3 py-6 text-center text-caption">
                  {t(`carePm.board.empty.${status}`)}
                </li>
              ) : null}
            </ul>

            {closedKey && (hidden > 0 || limit[closedKey] > CLOSED_PAGE) ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 w-full"
                onClick={() => setLimit((l) => ({ ...l, [closedKey]: hidden > 0 ? l[closedKey] + CLOSED_PAGE * 3 : CLOSED_PAGE }))}
              >
                {hidden > 0 ? t('carePm.board.showMore', { count: hidden }) : t('carePm.board.showLess')}
              </Button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
