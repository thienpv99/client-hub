// "Cần chú ý hôm nay" — the dashboard's focal block (SPEC §4.1, DESIGN §5): ≤7 exceptions, most severe first.
// Each row = severity icon in a soft circle + one sentence (account name semibold) + caption meta + a soft primary
// action and a ghost one.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgePercent,
  CalendarClock,
  CircleCheck,
  Clock,
  Hourglass,
  MessageSquareText,
  Siren,
  Timer,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AttentionAction, AttentionItem, AttentionKind } from '@/services/contract';
import { api } from '@/services/api';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { RemindClientButton, ZaloRemindButton } from '@/components/remind/RemindButtons';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { useAction } from '@/hooks/useAction';
import { useStagger } from '@/hooks/useMotion';
import type { RiseProps } from '@/hooks/useMotion';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { t } from '@/i18n';
import { attentionMeta, attentionParams, attentionSentenceParts } from '../attentionText';

const KIND_ICON: Record<AttentionKind, LucideIcon> = {
  client_overdue_blocking: Hourglass,
  internal_overdue_blocking: Timer,
  escalation: Siren,
  quote_pending_approval: BadgePercent,
  payment_overdue: Wallet,
  quote_changes_requested: MessageSquareText,
  due_soon_blocking: CalendarClock,
  internal_overdue: Clock,
};

/** severity is a status: danger / warning / neutral "theo dõi" — always with an icon and the word */
const SEVERITY_TONE: Record<AttentionItem['severity'], string> = {
  1: 'bg-danger-soft text-danger',
  2: 'bg-warning-soft text-warning',
  3: 'bg-muted text-muted-foreground',
};

/** the severity word under the sentence, in the same status colour as its icon */
const SEVERITY_WORD: Record<AttentionItem['severity'], string> = {
  1: 'text-danger',
  2: 'text-warning',
  3: '',
};

function accountPath(id: string): string {
  return `/app/accounts/${id}`;
}

interface RowProps {
  item: AttentionItem;
  onApprove(item: AttentionItem): void;
}

function ActionButton({ item, action, primary, onApprove }: RowProps & { action: AttentionAction; primary: boolean }) {
  const drawer = useTaskDrawer();
  // one soft "primary-ish" action per row, the other one ghost (DESIGN §5)
  const variant = primary ? 'soft' : 'ghost';
  const label = t(`dashboard.attention.actions.${action}`);
  switch (action) {
    case 'remind_client':
      return item.task_id ? <RemindClientButton taskIds={[item.task_id]} size="sm" variant={variant} label={label} /> : null;
    case 'zalo':
      return item.task_id ? <ZaloRemindButton taskId={item.task_id} size="sm" variant={variant} /> : null;
    case 'open_account':
      return (
        <Button asChild size="sm" variant={variant}>
          <Link to={accountPath(item.account.id)}>{label}</Link>
        </Button>
      );
    case 'approve_quote':
      return item.quote_id ? (
        <Button size="sm" variant={variant} onClick={() => onApprove(item)}>
          {label}
        </Button>
      ) : null;
    case 'view_quote':
      return item.quote_id ? (
        <Button asChild size="sm" variant={variant}>
          <Link to={`/app/commercial/quotes/${item.quote_id}`}>{label}</Link>
        </Button>
      ) : null;
    case 'open_task': {
      const taskId = item.task_id;
      return taskId ? (
        <Button size="sm" variant={variant} onClick={() => drawer.open(taskId)}>
          {label}
        </Button>
      ) : null;
    }
    case 'view_receivables':
      return (
        <Button asChild size="sm" variant={variant}>
          <Link to="/app/commercial/receivables">{label}</Link>
        </Button>
      );
  }
}

function AttentionRow({ item, onApprove, rise }: RowProps & { rise: RiseProps }) {
  const Icon = KIND_ICON[item.kind] ?? Clock;
  const { parts } = attentionSentenceParts(item);
  const meta = attentionMeta(item);
  const actions = item.actions.slice(0, 2);
  return (
    // side by side from lg only: on iPad portrait the text column would be ~250px and its meta line would clip.
    // Rows rise one after another on the page's first paint only (DESIGN §8.4: the focal list).
    <li
      className={cn(
        'flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:gap-6',
        rise.className,
      )}
      style={rise.style}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span
          className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', SEVERITY_TONE[item.severity])}
          aria-hidden="true"
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 pt-px">
          <p className="text-body leading-6 text-foreground">
            {parts.map((p, i) =>
              i % 2 === 1 ? (
                <span key={i} className="font-semibold text-ink">
                  {p}
                </span>
              ) : (
                <span key={i}>{p}</span>
              ),
            )}
          </p>
          {/* may wrap (a client's quote note can be long): two lines at most, the whole note in the tooltip */}
          <p className="mt-0.5 line-clamp-2 break-words text-caption" title={meta || undefined}>
            <span className={cn('font-medium', SEVERITY_WORD[item.severity])}>{t(`dashboard.attention.severity.${item.severity}`)}</span>
            {meta ? <span aria-hidden="true"> · </span> : null}
            {meta ? <span className="sr-only">, </span> : null}
            {meta}
          </p>
        </div>
      </div>
      {actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 pl-[50px] lg:shrink-0 lg:justify-end lg:pl-0">
          {actions.map((a, i) => (
            <ActionButton key={a} item={item} action={a} primary={i === 0} onApprove={onApprove} />
          ))}
        </div>
      ) : null}
    </li>
  );
}

/** "2 nghiêm trọng · 3 cần xử lý" — only the non-zero severities */
function severitySummary(items: AttentionItem[]): string {
  return ([1, 2, 3] as const)
    .map((s) => ({ s, count: items.filter((i) => i.severity === s).length }))
    .filter((x) => x.count > 0)
    .map((x) => t(`dashboard.attention.bySeverity.${x.s}`, { count: x.count }))
    .join(' · ');
}

export function AttentionPanel({ items, className }: { items: AttentionItem[]; className?: string }) {
  const { run } = useAction();
  // the panel mounts with its data: only that first appearance staggers (an approval refetch does not)
  const rise = useStagger(true);
  // the item stays set while the dialog animates out, so its sentence never shows raw placeholders
  const [approving, setApproving] = useState<AttentionItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const approveParams = approving ? attentionParams(approving) : undefined;
  const critical = items.some((i) => i.severity === 1);

  function askApproval(item: AttentionItem) {
    setApproving(item);
    setConfirmOpen(true);
  }

  async function approve(): Promise<boolean> {
    const item = approving;
    if (!item?.quote_id || !approveParams) return false;
    const quoteId = item.quote_id;
    const result = await run(() => api.approveQuote(quoteId), {
      success: 'dashboard.attention.approve.done',
      successParams: { version: approveParams.version, account: approveParams.account },
    });
    return result !== undefined;
  }

  return (
    <SectionCard
      className={cn('flex flex-col', className)}
      contentClassName="flex-1"
      flush
      footer={
        items.length > 0 ? (
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-primary hover:text-primary">
            <Link to="/app/tasks?flag=overdue">
              {t('dashboard.attention.viewOverdue')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : undefined
      }
      title={
        <span className="inline-flex items-center gap-2">
          {t('dashboard.attention.title')}
          {items.length > 0 ? (
            <span
              className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-micro font-medium tabular',
                critical ? 'bg-danger-soft text-danger' : 'bg-muted text-muted-foreground',
              )}
              aria-label={t('dashboard.attention.countLabel', { count: items.length })}
            >
              {items.length}
            </span>
          ) : null}
        </span>
      }
      description={items.length > 0 ? severitySummary(items) : undefined}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title={t('dashboard.attention.empty.title')}
          description={t('dashboard.attention.empty.description')}
          compact
        />
      ) : (
        <ul className="mt-1 divide-y divide-border/60 border-t border-border/60" aria-label={t('dashboard.attention.listLabel')}>
          {items.map((item, i) => (
            <AttentionRow key={item.id} item={item} onApprove={askApproval} rise={rise(i)} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmOpen && approving !== null}
        onOpenChange={setConfirmOpen}
        title={t('dashboard.attention.approve.title', approveParams)}
        description={t('dashboard.attention.approve.description', approveParams)}
        confirmLabel={t('dashboard.attention.approve.confirm')}
        onConfirm={approve}
      />
    </SectionCard>
  );
}
