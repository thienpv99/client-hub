// Email-like rendering of the weekly digest ("Bản tin tuần", SPEC §6). Contract: DigestView({ digest }).
// Used by /app/digest (preview for any C-level recipient) and /portal/settings (the client's own digest).
// The digest is already filtered for its recipient; task rows open the task drawer for the current viewer.
// Width is the caller's (reading width on /app/digest, the preview column in the portal).
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, CalendarClock, Check, CircleCheck, Clock, Flag, Hourglass, Inbox, Newspaper, TriangleAlert } from 'lucide-react';
import type { DigestRequestLine, DigestSection, MilestoneView, TaskView, WeeklyDigest } from '@/services/contract';
import { CareStatusBadge } from '@/components/care/badges';
import { AccountLogo } from '@/components/common/account-logo';
import { DueLabel } from '@/components/common/due-label';
import { EmptyState } from '@/components/common/empty-state';
import { ForecastLabel } from '@/components/common/forecast-label';
import { HealthBadge } from '@/components/common/health-badge';
import { NewEraLogo } from '@/components/common/new-era-logo';
import { statusLineText } from '@/components/common/status-band';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { addressName } from '@/domain/naming';
import { homePathFor } from '@/features/shell/routing';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { useViewer } from '@/hooks/useViewer';
import { capitalize, t } from '@/i18n';
import { formatDateShort, formatDateTime, formatWeekday } from '@/lib/format';

const VISIBLE_ITEMS = 5;
const PAD_X = 'px-5 sm:px-8';

export interface DigestViewProps {
  digest: WeeklyDigest;
  className?: string;
}

export function DigestView({ digest, className }: DigestViewProps) {
  const viewer = useViewer();
  const greetingId = useId();
  const recipient = digest.recipient;
  const isClient = recipient.org_type === 'client';
  const salutation = recipient.salutation ?? t('notify.digest.genericSalutation');
  const time = formatDateTime(digest.send_at).split(' ')[1] ?? '';
  const weekday = formatWeekday(digest.send_at);
  // a member's digest lists their own work; the director's / AM's lists everything waiting on New Era
  const waitingTitle =
    isClient || recipient.role === 'member' ? t('notify.digest.waitingYou', { salutation }) : t('notify.digest.waitingNewEra');
  const waitingEmpty =
    isClient || recipient.role === 'member'
      ? t('notify.digest.noneWaitingYou', { salutation })
      : t('notify.digest.noneWaitingNewEra');

  return (
    <article
      className={cn('w-full overflow-hidden rounded-xl border border-border/70 bg-card shadow-card', className)}
      aria-labelledby={greetingId}
    >
      {/* envelope */}
      <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border/60 bg-subtle py-3', PAD_X)}>
        <p className="min-w-0 text-table text-muted-foreground">
          {t('notify.digest.to')}{' '}
          <span className="font-medium text-foreground">{recipient.full_name}</span>{' '}
          <span className="break-all text-micro text-muted-foreground">&lt;{recipient.email}&gt;</span>
        </p>
        <p className="flex items-center gap-1.5 text-micro tabular text-muted-foreground">
          <Newspaper className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('notify.digest.eyebrow', { weekday, date: formatDateShort(digest.send_at), time })}
        </p>
      </div>

      <header className={cn('pb-6 pt-6 sm:pt-8', PAD_X)}>
        <NewEraLogo size="sm" withText />
        <h2 id={greetingId} className="mt-6 text-title font-semibold tracking-tightish text-ink">
          {t('notify.digest.greeting', { name: addressName(recipient.salutation, recipient.full_name) })}
        </h2>
        <p className="mt-1.5 text-body text-muted-foreground">
          {isClient
            ? t('notify.digest.introClient', { salutation })
            : t('notify.digest.introInternal', { count: digest.sections.length })}
        </p>
      </header>

      {digest.sections.length === 0 ? (
        <div className="border-t border-border/60">
          <EmptyState compact icon={Newspaper} title={t('notify.digest.empty')} />
        </div>
      ) : (
        digest.sections.map((s) => (
          <DigestSectionView
            key={s.account.id}
            section={s}
            statusSalutation={isClient ? recipient.salutation : null}
            waitingTitle={waitingTitle}
            waitingEmpty={waitingEmpty}
            showAssignee={!isClient && recipient.role !== 'member'}
            requestsTitle={isClient ? t('notify.digest.requestsClient', { salutation }) : t('notify.digest.requestsInternal')}
            requestsEmpty={isClient ? t('notify.digest.noneRequestsClient', { salutation }) : t('notify.digest.noneRequests')}
            portalLinks={viewer?.org_type === 'client'}
          />
        ))
      )}

      <footer className={cn('border-t border-border/60 bg-subtle/60 py-6', PAD_X)}>
        <Button asChild className="w-full sm:w-auto">
          <Link to={homePathFor(viewer)}>
            {t('notify.digest.open')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <p className="mt-4 text-caption">
          {isClient
            ? t('notify.digest.footerClient', { time, weekday, Salutation: capitalize(salutation) })
            : t('notify.digest.footerInternal', { time, weekday })}
        </p>
      </footer>
    </article>
  );
}

/** same frame as DigestView: envelope bar, greeting, two account sections */
export function DigestSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn('skeleton-reveal w-full overflow-hidden rounded-xl border border-border/70 bg-card shadow-card', className)}>
      <span className="sr-only">{t('common.a11y.loading')}</span>
      <div className={cn('flex justify-between gap-4 border-b border-border/60 bg-subtle py-3.5', PAD_X)}>
        <Skeleton className="h-3.5 w-48 max-w-[60%]" />
        <Skeleton className="h-3.5 w-32" />
      </div>
      <div className={cn('pb-6 pt-6 sm:pt-8', PAD_X)}>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-6 h-6 w-56 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className={cn('space-y-3 border-t border-border/60 py-6', PAD_X)}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-5 w-48 max-w-full" />
          </div>
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

interface SectionProps {
  section: DigestSection;
  statusSalutation: string | null;
  waitingTitle: string;
  waitingEmpty: string;
  showAssignee: boolean;
  requestsTitle: string;
  requestsEmpty: string;
  /** the CURRENT viewer is a client: request rows open the portal's Tiến độ, else the account's Triển khai tab */
  portalLinks: boolean;
}

function DigestSectionView({ section: s, statusSalutation, waitingTitle, waitingEmpty, showAssignee, requestsTitle, requestsEmpty, portalLinks }: SectionProps) {
  const headingId = `digest-acc-${s.account.id}`;
  return (
    <section aria-labelledby={headingId} className={cn('border-t border-border/60 py-6', PAD_X)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <AccountLogo account={s.account} size="sm" />
          <h3 id={headingId} className="min-w-0 break-words text-heading font-semibold tracking-tightish text-ink">
            {s.account.name}
          </h3>
        </div>
        <HealthBadge health={s.health.value} size="sm" />
      </div>
      <p className="mt-3 text-body text-foreground">{statusLineText(s.status_line, statusSalutation)}</p>

      <div className="mt-5 space-y-5">
        <Block icon={CircleCheck} title={t('notify.digest.done')} count={s.done_last_week.length} empty={t('notify.digest.noneDone')}>
          <Expandable items={s.done_last_week} render={(task) => <DoneRow task={task} />} />
        </Block>
        <Block icon={Hourglass} title={waitingTitle} count={s.waiting_on_you.length} empty={waitingEmpty}>
          <Expandable items={s.waiting_on_you} render={(task) => <WaitingRow task={task} showAssignee={showAssignee} />} />
        </Block>
        <Block icon={Flag} title={t('notify.digest.upcoming')} count={s.upcoming_milestones.length} empty={t('notify.digest.noneUpcoming')}>
          <ul className="space-y-3">
            {s.upcoming_milestones.map((m) => (
              <MilestoneRow key={m.id} milestone={m} />
            ))}
          </ul>
        </Block>
        <RequestsBlock section={s} title={requestsTitle} empty={requestsEmpty} portalLinks={portalLinks} />
      </div>
    </section>
  );
}

function Block({
  icon: Icon,
  title,
  count,
  empty,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-caption font-medium">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{title}</span>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
          {count}
        </span>
      </h4>
      <div className="mt-2">{count === 0 ? <p className="text-table text-muted-foreground">{empty}</p> : children}</div>
    </div>
  );
}

function Expandable({ items, render }: { items: TaskView[]; render: (task: TaskView) => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, VISIBLE_ITEMS);
  const hidden = items.length - VISIBLE_ITEMS;
  return (
    <>
      <ul className="-mx-2 space-y-0.5">
        {shown.map((task) => (
          <li key={task.id}>{render(task)}</li>
        ))}
      </ul>
      {hidden > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 mt-1"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('notify.digest.less') : t('notify.digest.more', { count: hidden })}
        </Button>
      ) : null}
    </>
  );
}

/** a task line that opens the task drawer */
function TaskButton({ task, children }: { task: TaskView; children: ReactNode }) {
  const drawer = useTaskDrawer();
  return (
    <button
      type="button"
      onClick={() => drawer.open(task.id)}
      aria-label={t('notify.digest.openTask', { title: task.title })}
      className="touch-tap flex min-h-tap w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 ease-out-quart hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:min-h-0"
    >
      {children}
    </button>
  );
}

function DoneRow({ task }: { task: TaskView }) {
  return (
    <TaskButton task={task}>
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words text-table text-foreground">{task.title}</span>
      {task.completed_at ? (
        <span className="shrink-0 text-micro tabular text-muted-foreground">
          {t('notify.digest.doneOn', { date: formatDateShort(task.completed_at) })}
        </span>
      ) : null}
    </TaskButton>
  );
}

function WaitingRow({ task, showAssignee }: { task: TaskView; showAssignee: boolean }) {
  return (
    <TaskButton task={task}>
      <TaskTypeIcon type={task.type} className="mt-0.5 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-table font-medium text-foreground">{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <DueLabel due={task.due} compact />
          {showAssignee && task.assignee ? (
            <span className="text-caption">
              <span aria-hidden="true">· </span>
              {t('notify.digest.assignee', { name: task.assignee.full_name })}
            </span>
          ) : null}
        </span>
      </span>
    </TaskButton>
  );
}

function MilestoneRow({ milestone: m }: { milestone: MilestoneView }) {
  return (
    <li className="flex items-start gap-3">
      <Flag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-table font-medium text-foreground">{m.name}</p>
        <ForecastLabel milestone={m} className="mt-0.5" />
      </div>
    </li>
  );
}

const FLAG_TONES = {
  debt: { variant: 'danger', icon: TriangleAlert },
  untriaged: { variant: 'warning', icon: Clock },
  undated: { variant: 'warning', icon: CalendarClock },
} as const;

/**
 * "Yêu cầu & chăm sóc" (SPEC-CARE): the care rhythm and next care action (director / AM), then the open requests with
 * their promised date — and, for New Era, the flag that needs someone. Each row opens the request.
 */
function RequestsBlock({ section: s, title, empty, portalLinks }: { section: DigestSection; title: string; empty: string; portalLinks: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const list = s.requests ?? [];
  const b = s.care_brief ?? null;
  const shown = expanded ? list : list.slice(0, VISIBLE_ITEMS);
  const hidden = list.length - VISIBLE_ITEMS;
  return (
    <div>
      <h4 className="flex items-center gap-2 text-caption font-medium">
        <Inbox className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{title}</span>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
          {list.length}
        </span>
      </h4>
      {b ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-table text-foreground">
          <CareStatusBadge status={b.care_status} short={false} />
          <span className="min-w-0 text-pretty text-muted-foreground">
            {b.next_action && b.next_action_due
              ? t('notify.digest.careNext', { action: b.next_action, date: formatDateShort(b.next_action_due) })
              : t('notify.digest.careNoAction')}
          </span>
        </p>
      ) : null}
      <div className="mt-2">
        {list.length === 0 ? (
          <p className="text-table text-muted-foreground">{empty}</p>
        ) : (
          <>
            <ul className="-mx-2 space-y-0.5">
              {shown.map((r) => (
                <li key={r.id}>
                  <RequestRow request={r} href={portalLinks ? `/portal/progress?cr=${encodeURIComponent(r.id)}` : `/app/accounts/${s.account.id}/delivery?cr=${encodeURIComponent(r.id)}`} />
                </li>
              ))}
            </ul>
            {hidden > 0 ? (
              <Button type="button" variant="ghost" size="sm" className="-ml-2 mt-1" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                {expanded ? t('notify.digest.less') : t('notify.digest.moreRequests', { count: hidden })}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function RequestRow({ request: r, href }: { request: DigestRequestLine; href: string }) {
  const tone = r.flag ? FLAG_TONES[r.flag] : null;
  const FlagIcon = tone?.icon;
  return (
    <Link
      to={href}
      className="touch-tap flex min-h-tap w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 ease-out-quart hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:min-h-0"
    >
      <span className="mt-px inline-flex h-5 min-w-[2.75rem] shrink-0 items-center justify-center rounded-md bg-muted px-1.5 text-micro font-semibold tabular text-muted-foreground">
        {r.code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-table font-medium text-foreground">{r.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-micro text-muted-foreground">
          <span>{r.status_label}</span>
          {r.promised_date ? (
            <span className={cn('whitespace-nowrap tabular', r.late && r.flag ? 'font-medium text-danger' : undefined)}>
              <span aria-hidden="true" className="mr-1.5">
                ·
              </span>
              {r.late && r.flag
                ? t('notify.digest.requestDateLate', { date: formatDateShort(r.promised_date) })
                : t('notify.digest.requestDate', { date: formatDateShort(r.promised_date) })}
            </span>
          ) : null}
          {tone && FlagIcon && r.flag ? (
            <Badge variant={tone.variant} size="sm">
              <FlagIcon aria-hidden="true" />
              {t(`notify.digest.requestFlag.${r.flag}`)}
            </Badge>
          ) : null}
        </span>
      </span>
    </Link>
  );
}