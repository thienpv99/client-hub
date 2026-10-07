// "Lịch sử phê duyệt" (SPEC 5.4): what the company approved or asked to change, who, when — newest first.
// Status = icon + word + soft tint: approved (success check), asked for changes (neutral pencil).
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, CircleCheck, PencilLine } from 'lucide-react';
import type { ActivityView } from '@/services/contract';
import { t } from '@/i18n';
import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { activitySentence } from '@/components/common/activity-feed';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';

const PAGE = 8;
const APPROVED = new Set<string>(['task.approved', 'quote.accepted', 'quote.approved']);

function bolden(sentence: string, actor: string | undefined): ReactNode {
  if (!actor || !sentence.startsWith(actor)) return sentence;
  return (
    <>
      <span className="font-semibold text-ink">{actor}</span>
      {sentence.slice(actor.length)}
    </>
  );
}

function ApprovalItem({ item }: { item: ActivityView }) {
  const approved = APPROVED.has(item.action);
  const Icon = approved ? CircleCheck : PencilLine;
  // older than a week the relative text is the date itself — do not repeat it
  const relative = formatRelativeTime(item.created_at);
  const showRelative = relative !== formatDate(item.created_at);
  return (
    <li className="flex gap-3 px-4 py-3.5 sm:px-5">
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          approved ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{approved ? t('portal.progress.approvals.approved') : t('portal.progress.approvals.changes')}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-table text-foreground">{bolden(activitySentence(item), item.actor?.full_name)}</p>
        <p className="mt-1 text-micro tabular text-muted-foreground">
          <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
          {showRelative ? (
            <>
              <span aria-hidden="true"> · </span>
              <span>{relative}</span>
            </>
          ) : null}
        </p>
      </div>
    </li>
  );
}

export function ApprovalHistory({ items, company, className }: { items: ActivityView[]; company: string; className?: string }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;
  return (
    <SectionCard
      className={cn('overflow-hidden', className)}
      title={t('portal.progress.approvals.title')}
      description={
        company ? t('portal.progress.approvals.description', { company }) : t('portal.progress.approvals.descriptionNoCompany')
      }
      flush
      footer={
        rest > 0 ? (
          <Button variant="ghost" size="sm" className="-mx-2 -my-1.5" onClick={() => setLimit((n) => n + PAGE)}>
            {t('portal.common.showMore', { count: Math.min(rest, PAGE) })}
            <ChevronDown aria-hidden="true" />
          </Button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState compact icon={CircleCheck} title={t('portal.progress.approvals.empty')} description={t('portal.progress.approvals.emptyHint')} />
      ) : (
        <ol className="divide-y divide-border/60 border-t border-border/60">
          {shown.map((item) => (
            <ApprovalItem key={item.id} item={item} />
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
