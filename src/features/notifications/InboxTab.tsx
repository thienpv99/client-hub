// "Thông báo" tab of /app/notifications: the viewer's bell items, grouped by day.
// Toolbar: Tất cả / Chưa đọc (segmented) · kind select · "Đánh dấu đã đọc tất cả".
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck, Inbox, TriangleAlert } from 'lucide-react';
import type { NotificationView } from '@/services/contract';
import { api } from '@/services/api';
import { DateText } from '@/components/common/date-text';
import { EmptyState, SearchEmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { ListSkeleton } from '@/components/common/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { dateOf, todayISO } from '@/domain/clock';
import { addDays } from '@/domain/dates';
import { useAction } from '@/hooks/useAction';
import type { RiseProps } from '@/hooks/useMotion';
import type { QueryResult } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { KIND_ORDER, kindIcon, kindLabel } from './kinds';
import type { NotificationKind } from './kinds';

type ReadFilter = 'all' | 'unread';
type DayGroup = 'today' | 'yesterday' | 'earlier';
const GROUPS: DayGroup[] = ['today', 'yesterday', 'earlier'];

function dayGroup(createdAt: string, today: string): DayGroup {
  const day = dateOf(createdAt);
  if (day >= today) return 'today';
  if (day === addDays(today, -1)) return 'yesterday';
  return 'earlier';
}

export interface InboxTabProps {
  query: QueryResult<NotificationView[]>;
  /** false in "Xem như khách hàng" (read-only) */
  canMarkRead: boolean;
  /**
   * Stagger of the page's first load (`useStagger` held by the page, so switching back to this tab or filtering
   * never replays it). Omitted: no motion.
   */
  rise?: (index: number) => RiseProps;
}

const NO_RISE = (): RiseProps => ({});

function InboxSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2" aria-hidden="true">
        <Skeleton className="h-10 w-48 rounded-lg md:h-8" />
        <Skeleton className="hidden h-10 w-60 rounded-lg sm:block" />
      </div>
      <div className="space-y-2">
        <Skeleton className="ml-1 h-3 w-24" />
        <ListSkeleton rows={6} />
      </div>
    </div>
  );
}

export function InboxTab({ query, canMarkRead, rise = NO_RISE }: InboxTabProps) {
  const navigate = useNavigate();
  const markAll = useAction();
  const markOne = useAction();
  const [read, setRead] = useState<ReadFilter>('all');
  const [kind, setKind] = useState<NotificationKind | ''>('');

  const items = useMemo(() => query.data ?? [], [query.data]);
  const unread = items.filter((n) => !n.read_at).length;

  const kinds = useMemo(() => {
    const counts = new Map<NotificationKind, number>();
    for (const n of items) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
    return KIND_ORDER.filter((k) => counts.has(k)).map((k) => ({ kind: k, count: counts.get(k) ?? 0 }));
  }, [items]);

  const visible = useMemo(
    () => items.filter((n) => (read === 'all' || !n.read_at) && (!kind || n.kind === kind)),
    [items, read, kind],
  );

  const grouped = useMemo(() => {
    const today = todayISO();
    const map = new Map<DayGroup, NotificationView[]>();
    for (const n of visible) {
      const g = dayGroup(n.created_at, today);
      const list = map.get(g) ?? [];
      list.push(n);
      map.set(g, list);
    }
    return GROUPS.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g) ?? [] }));
  }, [visible]);

  function openItem(n: NotificationView) {
    if (!n.read_at && canMarkRead) void markOne.run(() => api.markNotificationsRead([n.id]));
    if (n.link) navigate(n.link);
  }

  if (query.loading) return <InboxSkeleton />;
  if (query.error && !query.data) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState icon={Inbox} title={t('notify.inbox.empty')} description={t('notify.inbox.emptyHint')} />
      </Card>
    );
  }

  const filtered = read !== 'all' || kind !== '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="segmented"
          value={read}
          onValueChange={(v: string) => {
            if (v === 'all' || v === 'unread') setRead(v);
          }}
          aria-label={t('notify.inbox.filterLabel')}
        >
          <ToggleGroupItem value="all">{t('notify.inbox.all')}</ToggleGroupItem>
          <ToggleGroupItem value="unread" className="group">
            {t('notify.inbox.unread')}
            {unread > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1.5 text-micro font-medium tabular text-muted-foreground group-data-[state=on]:bg-primary-soft group-data-[state=on]:text-primary">
                {unread}
              </span>
            ) : null}
          </ToggleGroupItem>
        </ToggleGroup>
        {canMarkRead ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-primary hover:text-primary-hover sm:order-last md:h-10"
            disabled={unread === 0}
            loading={markAll.pending}
            aria-label={t('notify.inbox.markAll')}
            onClick={() => void markAll.run(() => api.markNotificationsRead(), { success: 'notify.inbox.markedAll' })}
          >
            {/* kept while busy: the Button swaps it for its spinner after 150 ms (DESIGN §8.2) */}
            <CheckCheck aria-hidden="true" />
            {/* short label up to lg: the toolbar stays on one row on iPad portrait (rail + 648px column) */}
            <span className="lg:hidden">{t('notify.inbox.markAllShort')}</span>
            <span className="hidden lg:inline">{t('notify.inbox.markAll')}</span>
          </Button>
        ) : null}
        {kinds.length > 1 ? (
          <NativeSelect
            aria-label={t('notify.inbox.kindLabel')}
            value={kind}
            onChange={(e) => {
              const next = kinds.find((k) => k.kind === e.target.value);
              setKind(next ? next.kind : '');
            }}
            wrapperClassName="w-full sm:w-60"
          >
            <option value="">{t('notify.inbox.allKinds')}</option>
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {t('notify.inbox.kindOption', { label: kindLabel(k.kind), count: k.count })}
              </option>
            ))}
          </NativeSelect>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <Card>
          {read === 'unread' && !kind ? (
            <EmptyState
              compact
              icon={CheckCheck}
              title={t('notify.inbox.emptyUnread')}
              action={
                <Button type="button" variant="secondary" size="sm" onClick={() => setRead('all')}>
                  {t('notify.inbox.showAll')}
                </Button>
              }
            />
          ) : filtered ? (
            <SearchEmptyState
              compact
              entity="notification"
              icon={BellOff}
              onClear={() => {
                setRead('all');
                setKind('');
              }}
            />
          ) : (
            <EmptyState compact icon={BellOff} title={t('notify.inbox.emptyFiltered')} />
          )}
        </Card>
      ) : (
        grouped.map(({ group, items: list }, g) => {
          // one running index over the day groups, so the stagger flows from "Hôm nay" into "Hôm qua"
          const offset = grouped.slice(0, g).reduce((sum, x) => sum + x.items.length, 0);
          return (
            <section key={group} aria-labelledby={`ntf-group-${group}`} className="space-y-2">
              <h2 id={`ntf-group-${group}`} className="flex items-center gap-2 px-1 text-caption font-medium">
                {t(`notify.inbox.groups.${group}`)}
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
                  <span aria-hidden="true">{list.length}</span>
                  <span className="sr-only">{t('notify.inbox.groupCount', { count: list.length })}</span>
                </span>
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-border/60">
                  {list.map((n, i) => {
                    const motion = rise(offset + i);
                    return (
                      <li key={n.id} className={motion.className} style={motion.style}>
                        <NotificationRow n={n} onOpen={openItem} />
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}

function NotificationRow({ n, onOpen }: { n: NotificationView; onOpen(n: NotificationView): void }) {
  const Icon = kindIcon(n.kind);
  const unread = !n.read_at;
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      aria-label={t('notify.inbox.open', { title: n.title })}
      aria-describedby={`ntf-body-${n.id}`}
      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 ease-out-quart hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:gap-3.5 sm:px-5"
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          n.urgent ? 'bg-danger-soft text-danger' : 'bg-muted text-muted-foreground',
        )}
        aria-hidden="true"
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-3">
          <span
            className={cn(
              'line-clamp-2 min-w-0 flex-1 break-words text-body',
              unread ? 'font-semibold text-ink' : 'text-foreground',
            )}
          >
            {n.title}
          </span>
          {/* phones: the time moves to the meta line so the title gets the whole width; the unread dot stays */}
          <span className="flex shrink-0 items-center gap-2 pt-1.5 sm:pt-0.5">
            <DateText value={n.created_at} relative className="hidden text-micro text-muted-foreground sm:inline" />
            {unread ? <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> : null}
          </span>
        </span>
        <span id={`ntf-body-${n.id}`} className="block">
          {n.body ? (
            // no `block` next to line-clamp: it would replace the clamp's -webkit-box and show the whole text
            <span className="mt-0.5 line-clamp-2 break-words text-table text-muted-foreground">{n.body}</span>
          ) : null}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {n.urgent ? (
              <Badge variant="danger" size="sm">
                <TriangleAlert aria-hidden="true" />
                {t('notify.inbox.urgent')}
              </Badge>
            ) : null}
            <span className="text-micro text-muted-foreground">{kindLabel(n.kind)}</span>
            <span className="inline-flex items-center gap-2 text-micro text-muted-foreground sm:hidden">
              <span aria-hidden="true" className="h-0.5 w-0.5 rounded-full bg-muted-foreground/60" />
              <DateText value={n.created_at} relative />
            </span>
            {unread ? <span className="sr-only">{t('notify.inbox.unreadDot')}</span> : null}
          </span>
        </span>
      </span>
    </button>
  );
}
