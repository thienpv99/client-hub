// Building blocks of the task drawer body.
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Hourglass } from 'lucide-react';
import type { ActivityView, ChainNode, FileView, MilestoneRef, TaskDetail } from '@/services/contract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDate, formatDateShort, formatMoney, formatRelativeTime } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountLogo } from '@/components/common/account-logo';
import { ActivityFeed } from '@/components/common/activity-feed';
import { FileList } from '@/components/common/file-list';
import { ImpactBox } from '@/components/common/impact-box';
import { ImpactChain } from '@/components/common/impact-chain';
import { UserAvatar } from '@/components/common/user-avatar';
import { INSET, latestChangeRequest, latestSubmissionNote, reviewMode, submittedKey } from './taskHelpers';
import type { StatusPhrase } from './taskHelpers';

export function Section({
  title,
  children,
  action,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('space-y-3', className)}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 id={id} className="text-table font-semibold text-ink">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Status of the task as a pill (icon + word, success tint only when done). */
export function StatusBadge({ phrase }: { phrase: StatusPhrase }) {
  const Icon = phrase.icon;
  return (
    <Badge variant={phrase.tone === 'success' ? 'success' : 'default'}>
      <Icon aria-hidden="true" />
      {phrase.text}
    </Badge>
  );
}

const SEP = (
  <span aria-hidden="true" className="text-border-strong">
    ·
  </span>
);

/**
 * Eyebrow above the title: account (internal viewers) · project · milestone + planned date. One quiet line; on
 * phones an internal viewer's line drops the project (account + milestone say enough there).
 */
export function TaskContext({ task, internal, className }: { task: TaskDetail; internal: boolean; className?: string }) {
  const parts: { key: string; node: ReactNode; phone: boolean }[] = [];
  if (internal) {
    parts.push({
      key: 'account',
      phone: true,
      node: (
        <Link
          to={`/app/accounts/${task.account.id}/tasks?task=${encodeURIComponent(task.id)}`}
          className="inline-flex min-w-0 items-center gap-1.5 rounded font-medium text-foreground hover:text-primary hover:underline"
        >
          <AccountLogo account={task.account} size="xs" />
          <span className="truncate">{task.account.short_name || task.account.name}</span>
        </Link>
      ),
    });
  }
  if (task.project.name) {
    parts.push({
      key: 'project',
      // never the first part on phones: that would leave a leading separator
      phone: parts.length === 0,
      node: (
        <span className="min-w-0 truncate" title={t('task.card.project', { name: task.project.name })}>
          {task.project.name}
        </span>
      ),
    });
  }
  if (task.milestone) {
    parts.push({
      key: 'milestone',
      phone: true,
      node: (
        <span
          className="min-w-0 truncate"
          title={t('task.drawer.milestoneTag', { name: task.milestone.name, date: formatDateShort(task.milestone.planned_date) })}
        >
          {t('task.drawer.milestoneTag', { name: task.milestone.name, date: formatDateShort(task.milestone.planned_date) })}
        </span>
      ),
    });
  }
  if (parts.length === 0) return null;
  return (
    // one line (it shares the row with "…" and the close button): long names truncate, the full text is the tooltip
    <p className={cn('flex min-w-0 items-center gap-x-2 overflow-hidden whitespace-nowrap text-caption', className)}>
      {parts.map((p, i) => (
        <span
          key={p.key}
          className={cn('min-w-0 items-center gap-2', p.phone ? 'inline-flex' : 'hidden sm:inline-flex', p.key === 'account' && 'shrink-0')}
        >
          {i > 0 ? SEP : null}
          {p.node}
        </span>
      ))}
    </p>
  );
}

/**
 * "Nếu chưa làm" and the impact chain in ONE inset panel. The chain already names the milestones (with their
 * forecast dates), so the milestone tags of the impact box are left out when the chain is shown.
 */
export function ImpactPanel({
  text,
  milestones,
  chain,
  showText,
  showChain,
}: {
  text: string;
  milestones: MilestoneRef[];
  chain: ChainNode[];
  showText: boolean;
  showChain: boolean;
}) {
  const hasText = showText && text.trim() !== '';
  if (!showChain) {
    return showText ? <ImpactBox text={text} milestones={milestones} /> : null;
  }
  return (
    <div className="rounded-lg bg-subtle ring-1 ring-inset ring-border/60">
      {hasText ? <ImpactBox text={text} milestones={[]} className="rounded-none bg-transparent ring-0" /> : null}
      <div className={cn('p-3 sm:p-4', hasText && 'border-t border-border/60')}>
        <p className="text-micro font-semibold text-muted-foreground">{t('task.drawer.sections.chain')}</p>
        <ImpactChain nodes={chain} className="mt-2.5" />
      </div>
    </div>
  );
}

/** "Đã gửi … New Era đang kiểm tra" (client viewer, submission waiting for New Era) */
export function WaitingCheckNote({ task }: { task: TaskDetail }) {
  return (
    <div className={cn('flex items-start gap-3 text-table text-foreground', INSET)}>
      <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p>
        {t(submittedKey(task), { when: formatRelativeTime(task.updated_at) })} {t('task.drawer.waitingCheckNext')}
      </p>
    </div>
  );
}

/** The client's words, quoted ("Khách yêu cầu chỉnh sửa: …"). */
function ClientQuote({ text, author }: { text: string; author: string | null }) {
  return (
    <figure className={INSET}>
      <blockquote className="whitespace-pre-line break-words border-l-2 border-primary-border pl-3 text-table text-foreground">
        {text}
      </blockquote>
      {author ? <figcaption className="mt-1.5 pl-3.5 text-micro text-muted-foreground">{author}</figcaption> : null}
    </figure>
  );
}

/** Internal viewer, client task waiting on New Era: what the client sent or asked, and what to do next. */
export function ReviewSection({ task, onPreview }: { task: TaskDetail; onPreview: (f: FileView) => void }) {
  const mode = reviewMode(task);
  const request = mode === 'quote' || mode === 'newVersion' ? latestChangeRequest(task.history) : null;
  const when = formatRelativeTime(request?.at ?? task.updated_at);
  const clientFiles = task.files.filter((f) => f.uploaded_by.org_type === 'client');
  const note = latestSubmissionNote(task.history);

  if (mode === 'quote' || mode === 'newVersion') {
    return (
      <Section title={t(mode === 'quote' ? 'task.drawer.sections.quoteChanges' : 'task.drawer.sections.changes')}>
        <p className="text-table text-muted-foreground">
          {t(mode === 'quote' ? 'task.review.quoteIntro' : 'task.review.changesIntro', { when })}
        </p>
        {request ? <ClientQuote text={request.reason} author={request.actor?.full_name ?? null} /> : null}
        <p className="text-caption">{t(mode === 'quote' ? 'task.review.quoteNext' : 'task.review.changesNext')}</p>
      </Section>
    );
  }
  return (
    <Section title={t('task.drawer.sections.review')}>
      <p className="text-table text-muted-foreground">
        {t(mode === 'payment' ? 'task.review.paymentIntro' : 'task.review.filesIntro', { when })}
      </p>
      {clientFiles.length > 0 ? (
        <FileList files={clientFiles} onPreview={onPreview} showVisibility={false} />
      ) : (
        <p className="text-caption">{t('task.review.noFiles')}</p>
      )}
      {note ? <ClientQuote text={note.text} author={note.author} /> : null}
    </Section>
  );
}

export function DelegationInfo({ task }: { task: TaskDetail }) {
  if (!task.delegated_by || !task.assignee) return null;
  return (
    <div className={cn('flex items-start gap-3', INSET)}>
      <UserAvatar user={task.assignee} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-table text-foreground">
          {t('task.drawer.delegation.to', { name: task.assignee.full_name })}
          {task.assignee.title ? <span className="text-muted-foreground"> · {task.assignee.title}</span> : null}
        </p>
        <p className="mt-0.5 text-micro text-muted-foreground">
          {t('task.drawer.delegation.by', {
            name: task.delegated_by.full_name,
            when: task.delegated_at ? formatRelativeTime(task.delegated_at) : '',
          })}
        </p>
        {task.delegation_note ? (
          <p className="mt-2 break-words text-table text-muted-foreground">{t('task.card.note', { note: task.delegation_note })}</p>
        ) : null}
      </div>
    </div>
  );
}

const HISTORY_STEP = 5;

export function TaskHistory({ items }: { items: ActivityView[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, HISTORY_STEP);
  const hidden = items.length - HISTORY_STEP;
  return (
    <div className="space-y-3">
      <ActivityFeed items={shown} compact emptyText={t('task.drawer.historyEmpty')} />
      {hidden > 0 ? (
        <Button type="button" variant="link" size="sm" onClick={() => setAll((v) => !v)}>
          {all ? t('task.drawer.historyLess') : t('task.drawer.historyMore', { count: hidden })}
        </Button>
      ) : null}
    </div>
  );
}

/** Approval task of a quote: the quote at a glance (the total is the hero) + a link to the full quote page. */
export function QuoteSummaryBlock({ quoteId, client }: { quoteId: string; client: boolean }) {
  const q = useQuery(() => api.getQuote(quoteId), [quoteId]);
  if (q.loading) return <Skeleton className="h-40 w-full rounded-lg" />;
  const quote = q.data;
  // no commercial access (internal member): the task text says enough
  if (!quote) return null;
  const href = client ? `/portal/commercial/quotes/${quote.id}` : `/app/commercial/quotes/${quote.id}`;
  return (
    <div className={cn(INSET, 'p-4 sm:p-5')}>
      <p className="text-body font-semibold text-ink">{quote.title}</p>
      <p className="mt-0.5 text-caption">{t('task.drawer.quote.version', { code: quote.code, version: quote.version })}</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-caption font-medium">{t('task.drawer.quote.total')}</p>
          <p className="mt-1 text-kpi font-semibold tracking-display tabular text-ink">{formatMoney(quote.grand_total)}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-caption tabular">{t('task.drawer.quote.validUntil', { date: formatDate(quote.valid_until) })}</p>
          <p className="text-caption tabular">{t('task.drawer.quote.lines', { count: quote.lines.length })}</p>
        </div>
      </div>
      <Button asChild variant="secondary" size="sm" className="mt-4">
        <Link to={href}>
          <ExternalLink aria-hidden="true" />
          {t('task.drawer.quote.open')}
        </Link>
      </Button>
    </div>
  );
}
