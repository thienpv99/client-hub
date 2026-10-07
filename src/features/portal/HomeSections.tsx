// Blocks of the client home (SPEC §5.1): my tasks, delegated, submitted, New Era work, updates, summary.
// DESIGN §4: section titles text-heading, lists inside cards are full-bleed hairline rows, no boxes in boxes.
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import type { To } from 'react-router-dom';
import { CheckCheck, ChevronDown, ChevronRight, Mail, Phone, Send, ShieldCheck } from 'lucide-react';
import type { ActivityView, TaskView, UserRef, WaitingCounts } from '@/services/contract';
import { t } from '@/i18n';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ActivityFeed } from '@/components/common/activity-feed';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { UserAvatar } from '@/components/common/user-avatar';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import type { Salute } from './portalText';
import { personName, telHref } from './portalText';
import { CARD_LIST, COUNT_PILL, QUIET_LINK, SECTION_TITLE } from './styles';
import { TaskCardList } from './TaskCards';
import { ClientRowStatus, ClientWaitingLine, CompactTaskRow, NewEraRowStatus } from './TaskRows';

// ───────────────────────────── Việc cần anh xử lý (focal block) ─────────────────────────────

export interface MyTasksSectionProps {
  tasks: TaskView[];
  showProject: boolean;
  salute: Salute;
  /** health is on track → "Dự án đang chạy theo kế hoạch." in the empty state */
  onTrack: boolean;
  /** '?project=…' for the "Xem tất cả việc" link */
  search: string;
  className?: string;
}

export function MyTasksSection({ tasks, showProject, salute, onTrack, search, className }: MyTasksSectionProps) {
  const headingId = useId();
  const { you } = salute;
  return (
    <section aria-labelledby={headingId} className={cn('min-w-0', className)}>
      <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
        <h2 id={headingId} className={cn(SECTION_TITLE, 'flex items-center gap-2')}>
          {t('portal.home.myTasks.title', { you })}
          {tasks.length > 0 ? (
            <span className={COUNT_PILL}>
              <span aria-hidden="true">{tasks.length}</span>
              <span className="sr-only">{t('portal.home.myTasks.count', { count: tasks.length })}</span>
            </span>
          ) : null}
        </h2>
        {tasks.length > 0 ? (
          <Link to={{ pathname: '/portal/tasks', search }} className={QUIET_LINK}>
            {t('portal.home.myTasks.viewAll')}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      {tasks.length > 0 ? (
        <TaskCardList tasks={tasks} showProject={showProject} />
      ) : (
        <Card>
          <EmptyState
            icon={onTrack ? CheckCheck : ShieldCheck}
            title={onTrack ? t('portal.home.myTasks.emptyOnTrack', { you }) : t('portal.home.myTasks.emptyNeutral', { you })}
            description={onTrack ? t('portal.home.myTasks.emptyHint', { you }) : t('portal.home.myTasks.emptyNeutralHint', { you })}
          />
        </Card>
      )}
    </section>
  );
}

// ───────────────────────────── Đã giao cho người khác ─────────────────────────────

export function DelegatedCard({ tasks, showProject, salute, className }: { tasks: TaskView[]; showProject: boolean; salute: Salute; className?: string }) {
  const { open } = useTaskDrawer();
  return (
    <SectionCard
      title={t('portal.home.delegated.title')}
      description={t('portal.home.delegated.description', { you: salute.you })}
      className={cn('overflow-hidden', className)}
      flush
    >
      <ul className={CARD_LIST}>
        {tasks.map((task) => (
          <CompactTaskRow
            key={task.id}
            task={task}
            onOpen={open}
            showProject={showProject}
            leading={<UserAvatar user={task.assignee} size="sm" />}
            meta={
              <>
                <span className="font-medium text-foreground">{personName(task.assignee)}</span>
                <ClientRowStatus task={task} />
              </>
            }
          />
        ))}
      </ul>
    </SectionCard>
  );
}

// ───────────────────────────── Đã gửi, chờ New Era phản hồi (collapsible) ─────────────────────────────

export function WaitingCard({ tasks, showProject, salute, className }: { tasks: TaskView[]; showProject: boolean; salute: Salute; className?: string }) {
  const { open } = useTaskDrawer();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return (
    <Card className={cn('min-w-0 overflow-hidden', className)}>
      <h2>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((x) => !x)}
          className="flex w-full min-h-tap items-center gap-3 px-4 py-4 text-left transition-colors duration-150 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
        >
          <span className="min-w-0 flex-1">
            <span className={cn('block', SECTION_TITLE)}>{t('portal.home.waiting.title')}</span>
            <span className="mt-0.5 block text-caption">{t('portal.home.waiting.description', { you: salute.you })}</span>
          </span>
          <span className={COUNT_PILL}>{tasks.length}</span>
          <ChevronDown
            className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-quart', expanded && 'rotate-180')}
            aria-hidden="true"
          />
          <span className="sr-only">{expanded ? t('portal.home.waiting.hide') : t('portal.home.waiting.show')}</span>
        </button>
      </h2>
      <ul id={panelId} hidden={!expanded} className={CARD_LIST}>
        {tasks.map((task) => (
          <CompactTaskRow
            key={task.id}
            task={task}
            onOpen={open}
            showProject={showProject}
            meta={
              <>
                <span className="font-medium text-foreground">{personName(task.assignee)}</span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap tabular">
                  <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t('portal.common.sentAt', { when: formatRelativeTime(task.updated_at) })}
                </span>
              </>
            }
          />
        ))}
      </ul>
    </Card>
  );
}

// ───────────────────────────── New Era đang làm ─────────────────────────────

export interface NewEraCardProps {
  tasks: TaskView[];
  counts: WaitingCounts;
  salute: Salute;
  showProject: boolean;
  /** decision maker: where "Đang chờ phía anh N" leads (every open company-side task); null = plain figure */
  waitingTo?: To | null;
  /** member: how many of "Đang chờ phía chị N" colleagues hold ("3 của đồng nghiệp") */
  colleagues?: number | null;
  className?: string;
}

export function NewEraCard({ tasks, counts, salute, showProject, waitingTo = null, colleagues = null, className }: NewEraCardProps) {
  const { open } = useTaskDrawer();
  return (
    <SectionCard
      title={t('portal.home.newEra.title')}
      description={t('portal.home.newEra.description')}
      className={cn('overflow-hidden', className)}
      flush
      footer={<ClientWaitingLine counts={counts} you={salute.you} clientTo={waitingTo} colleagues={colleagues} className="py-0.5" />}
    >
      {tasks.length > 0 ? (
        <ul className={CARD_LIST}>
          {tasks.map((task) => (
            <CompactTaskRow key={task.id} task={task} onOpen={open} showProject={showProject} meta={<NewEraRowStatus task={task} />} />
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-table text-muted-foreground sm:px-5">{t('portal.home.newEra.empty')}</p>
      )}
    </SectionCard>
  );
}

// ───────────────────────────── Cập nhật mới ─────────────────────────────

const UPDATES_VISIBLE = 4;

export function UpdatesCard({ items, className }: { items: ActivityView[]; className?: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, UPDATES_VISIBLE);
  const rest = items.length - UPDATES_VISIBLE;
  return (
    <SectionCard
      title={t('portal.home.updates.title')}
      className={className}
      footer={
        rest > 0 ? (
          <Button variant="ghost" size="sm" className="-mx-2 -my-1.5" aria-expanded={all} onClick={() => setAll((x) => !x)}>
            {all ? t('portal.common.showLess') : t('portal.common.showMore', { count: rest })}
            <ChevronDown className={cn('transition-transform duration-200', all && 'rotate-180')} aria-hidden="true" />
          </Button>
        ) : undefined
      }
    >
      <ActivityFeed items={shown} compact emptyText={t('portal.home.updates.empty')} className="pt-1" />
    </SectionCard>
  );
}

// ───────────────────────────── Tóm tắt từ New Era ─────────────────────────────

/** The account manager as the client's contact: avatar, name, "Đầu mối của anh tại New Era · phone", call / email. */
export function AmContact({ am, salute }: { am: UserRef; salute: Salute }) {
  return (
    <div className="flex w-full min-w-0 items-center gap-3 py-0.5">
      <UserAvatar user={am} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-table font-medium text-foreground">{am.full_name}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-micro text-muted-foreground">
          <span>{t('portal.home.summary.contact', { you: salute.you })}</span>
          {am.phone ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap tabular">{am.phone}</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="-mr-1.5 flex shrink-0 items-center gap-0.5">
        {am.phone ? (
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={telHref(am.phone)} aria-label={t('portal.home.summary.call', { name: am.full_name, phone: am.phone })} title={am.phone}>
              <Phone aria-hidden="true" />
            </a>
          </Button>
        ) : null}
        <Button variant="ghost" size="icon-sm" asChild>
          <a href={`mailto:${am.email}`} aria-label={t('portal.home.summary.email', { name: am.full_name })} title={am.email}>
            <Mail aria-hidden="true" />
          </a>
        </Button>
      </div>
    </div>
  );
}

export function SummaryCard({ summary, am, salute, className }: { summary: string; am: UserRef; salute: Salute; className?: string }) {
  const lines = summary
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <SectionCard title={t('portal.home.summary.title')} className={className} footer={<AmContact am={am} salute={salute} />}>
      {lines.length > 0 ? (
        <ul className="space-y-2.5">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-table text-foreground">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-caption" aria-hidden="true" />
              <span className="min-w-0 break-words">{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-table text-muted-foreground">{t('portal.home.summary.empty')}</p>
      )}
    </SectionCard>
  );
}
