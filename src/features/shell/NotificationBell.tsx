// Bell in both layouts: latest 20 notifications grouped Hôm nay / Trước đó, unread dots, mark all read.
// Tablet / desktop: popover. Phone: full-screen sheet.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Bell,
  BellRing,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  Clock,
  Forward,
  Info,
  MessageSquare,
  Newspaper,
  Receipt,
  Settings,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import type { NotificationView } from '@/services/contract';
import type { NotificationKind } from '@/domain/types';
import { api } from '@/services/api';
import { dateOf, todayISO } from '@/domain/clock';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAction } from '@/hooks/useAction';
import { useBreakpoint } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/components/ui/cn';

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  due_soon: Clock,
  overdue: CircleAlert,
  escalation: TriangleAlert,
  reminder: BellRing,
  task_update: CircleCheck,
  comment: MessageSquare,
  approval_needed: ClipboardCheck,
  quote: Receipt,
  payment: Wallet,
  delegated: Forward,
  digest: Newspaper,
  system: Info,
};

export interface NotificationBellProps {
  side: 'internal' | 'client';
}

export function NotificationBell({ side }: NotificationBellProps) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  const query = useQuery(() => api.listNotifications({ limit: 20 }), [viewer?.user.id], { enabled: !!viewer });

  const items = query.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  const canMark = !!viewer && !viewer.read_only;
  const triggerLabel = unread > 0 ? t('layout.bell.labelUnread', { count: unread }) : t('layout.bell.label');

  function openItem(n: NotificationView) {
    setOpen(false);
    if (!n.read_at && canMark) {
      api.markNotificationsRead([n.id]).catch((err: unknown) => console.warn('[bell] mark read failed', err));
    }
    if (n.link) navigate(n.link);
  }

  const footerLink = side === 'internal' ? '/app/notifications' : '/portal/settings';
  const footerLabel = side === 'internal' ? t('layout.bell.viewAll') : t('layout.bell.settings');
  const FooterIcon = side === 'internal' ? ArrowRight : Settings;

  // phones (sheet header shares the row with the close button): short "Đọc hết" label, full label for screen readers,
  // and mr-1 on top of the header's close-button gutter keeps 8px between the two tap targets (DESIGN §6);
  // the row may wrap rather than overlap (e.g. "99 chưa đọc" on a 320px screen)
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 whitespace-nowrap text-heading font-semibold tracking-tightish text-ink">{t('layout.bell.title')}</span>
        {unread > 0 ? (
          <span className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full bg-primary-soft px-2 text-micro font-medium tabular text-primary">
            {t('layout.bell.unreadCount', { count: unread })}
          </span>
        ) : null}
      </div>
      {canMark && unread > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mr-1 px-2 text-muted-foreground hover:text-foreground md:-mr-2"
          loading={pending}
          title={t('layout.bell.markAllRead')}
          onClick={() => void run(() => api.markNotificationsRead())}
        >
          {!pending ? <CheckCheck aria-hidden /> : null}
          <span className="whitespace-nowrap sm:hidden" aria-hidden>
            {t('layout.bell.markAllReadShort')}
          </span>
          <span className="sr-only whitespace-nowrap sm:not-sr-only">{t('layout.bell.markAllRead')}</span>
        </Button>
      ) : null}
    </div>
  );

  const list = <NotificationList items={items} loading={query.loading} onOpen={openItem} />;

  const footer = (
    <Link
      to={footerLink}
      onClick={() => setOpen(false)}
      className="touch-tap flex min-h-tap items-center justify-center gap-2 rounded-lg text-table font-medium text-primary transition-colors duration-150 hover:bg-primary-soft md:min-h-10"
    >
      {footerLabel}
      <FooterIcon className="h-4 w-4" aria-hidden />
    </Link>
  );

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={triggerLabel}
      className="relative text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
    >
      <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      {unread > 0 ? (
        <span aria-hidden className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
      ) : null}
    </Button>
  );

  if (breakpoint === 'mobile') {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="right" mobileFullScreen closeLabel={t('common.close')} aria-describedby={undefined}>
          <SheetHeader className="border-b border-border/60 pb-3">
            <SheetTitle className="sr-only">{t('layout.bell.title')}</SheetTitle>
            {header}
          </SheetHeader>
          <SheetBody className="px-2 pt-2">{list}</SheetBody>
          <div className="border-t border-border/60 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">{footer}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[400px] overflow-hidden p-0">
        <div className="border-b border-border/60 px-4 py-3">{header}</div>
        <div className="max-h-[min(520px,70vh)] overflow-y-auto overscroll-contain p-1.5">{list}</div>
        <div className="border-t border-border/60 bg-subtle p-1.5">{footer}</div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationList({
  items,
  loading,
  onOpen,
}: {
  items: NotificationView[];
  loading: boolean;
  onOpen(n: NotificationView): void;
}) {
  if (loading) {
    return (
      <div className="space-y-1 p-2" aria-label={t('common.a11y.loading')}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 py-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary-soft">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-primary shadow-xs">
            <Bell className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </span>
        </span>
        <p className="mt-4 text-heading font-semibold text-ink">{t('layout.bell.emptyTitle')}</p>
        <p className="mt-1 max-w-xs text-table text-muted-foreground">{t('layout.bell.emptyDescription')}</p>
      </div>
    );
  }
  const today = todayISO();
  const groups = [
    { key: 'today', label: t('layout.bell.today'), items: items.filter((n) => dateOf(n.created_at) === today) },
    { key: 'earlier', label: t('layout.bell.earlier'), items: items.filter((n) => dateOf(n.created_at) !== today) },
  ].filter((g) => g.items.length > 0);
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`bell-group-${group.key}`}>
          <h3 id={`bell-group-${group.key}`} className="px-2.5 pb-1 pt-2 text-micro font-medium text-muted-foreground">
            {group.label}
          </h3>
          <ul className="space-y-0.5">
            {group.items.map((n) => (
              <li key={n.id}>
                <NotificationItem n={n} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NotificationItem({ n, onOpen }: { n: NotificationView; onOpen(n: NotificationView): void }) {
  const Icon = KIND_ICON[n.kind] ?? Info;
  const unread = !n.read_at;
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className="group flex w-full gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors duration-150 ease-out-quart hover:bg-subtle focus-visible:bg-subtle"
    >
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          n.urgent ? 'bg-danger-soft text-danger' : unread ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'line-clamp-2 text-table',
            unread ? 'font-semibold text-ink' : 'font-medium text-foreground',
          )}
        >
          {n.title}
        </span>
        {n.body ? <span className="mt-0.5 line-clamp-2 text-caption">{n.body}</span> : null}
        <span className="mt-1 flex items-center gap-2 text-micro text-muted-foreground">
          {n.urgent ? (
            <span className="inline-flex items-center gap-1 font-medium text-danger">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
              {t('layout.bell.urgent')}
            </span>
          ) : null}
          <span className="tabular">{formatRelativeTime(n.created_at)}</span>
        </span>
      </span>
      <span className="flex w-2 shrink-0 justify-center pt-2">
        {unread ? (
          <span className="h-2 w-2 rounded-full bg-primary">
            <span className="sr-only">{t('layout.bell.unreadDot')}</span>
          </span>
        ) : null}
      </span>
    </button>
  );
}
