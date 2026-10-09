// "Cần chú ý hôm nay" — the dashboard's focal block (SPEC §4.1, SPEC-CARE §6.2, DESIGN §5): most severe first —
// requests owed to clients (delivery debt), requests waiting more than 7 days, clients overdue for a care touch, plus
// the classic exceptions (a milestone held up, a quote to approve, a late payment). Each row = severity icon in a soft
// circle + one sentence (account name semibold) + caption meta + a soft primary action and a ghost one. The first
// VISIBLE rows show; "Xem thêm" opens the rest. Requests open in the shared triage sheet right here.
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgePercent,
  ChevronDown,
  ChevronUp,
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
import type { ChangeRequestView } from '@/services/careContract';
import { api } from '@/services/api';
import { CrTriageSheet } from '@/components/care/CrTriageSheet';
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
import { REQUESTS_HREF, type FocusItem } from '../careModel';
import { CareRow, NextStepRow, RequestRow, RowShell } from './FocusRows';

/** rows shown before "Xem thêm" — the list stays a one-look block at 1440×900 */
const VISIBLE = 8;

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
  const actions = item.actions.slice(0, 2);
  return (
    <RowShell
      icon={Icon}
      severity={item.severity}
      parts={parts}
      meta={attentionMeta(item)}
      rise={rise}
      actions={
        actions.length > 0
          ? actions.map((a, i) => <ActionButton key={a} item={item} action={a} primary={i === 0} onApprove={onApprove} />)
          : undefined
      }
    />
  );
}

/** "2 nghiêm trọng · 3 cần xử lý" — only the non-zero severities */
function severitySummary(items: FocusItem[]): string {
  return ([1, 2, 3] as const)
    .map((s) => ({ s, count: items.filter((i) => i.severity === s).length }))
    .filter((x) => x.count > 0)
    .map((x) => t(`dashboard.attention.bySeverity.${x.s}`, { count: x.count }))
    .join(' · ');
}

export function AttentionPanel({ items, today, className }: { items: FocusItem[]; today: string; className?: string }) {
  const { run } = useAction();
  const listId = useId();
  // the panel mounts with its data: only that first appearance staggers (an approval or a triage refetch does not)
  const rise = useStagger(true);
  const [expanded, setExpanded] = useState(false);
  // the item stays set while the dialog animates out, so its sentence never shows raw placeholders
  const [approving, setApproving] = useState<AttentionItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // the request stays set while the triage sheet slides out (the row may already be gone after a save)
  const [triage, setTriage] = useState<ChangeRequestView | null>(null);
  const [triageOpen, setTriageOpen] = useState(false);
  const approveParams = approving ? attentionParams(approving) : undefined;
  const critical = items.some((i) => i.severity === 1);
  const hidden = Math.max(0, items.length - VISIBLE);
  const shown = expanded || hidden === 0 ? items : items.slice(0, VISIBLE);

  function askApproval(item: AttentionItem) {
    setApproving(item);
    setConfirmOpen(true);
  }

  function openRequest(r: ChangeRequestView) {
    setTriage(r);
    setTriageOpen(true);
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

  const linkClass = '-ml-2 text-primary hover:text-primary';

  return (
    <SectionCard
      className={cn('flex flex-col', className)}
      contentClassName="flex-1"
      flush
      footer={
        items.length > 0 ? (
          <>
            {hidden > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className={linkClass}
                aria-expanded={expanded}
                aria-controls={listId}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                {expanded ? t('carePortfolio.attention.less') : t('carePortfolio.attention.more', { count: hidden })}
              </Button>
            ) : null}
            <span className="-mx-2 flex flex-wrap items-center sm:ml-auto">
              <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary">
                <Link to={REQUESTS_HREF}>
                  {t('carePortfolio.attention.viewRequests')}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary">
                <Link to="/app/tasks?flag=overdue">
                  {t('dashboard.attention.viewOverdue')}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </span>
          </>
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
          title={t('carePortfolio.attention.empty.title')}
          description={t('carePortfolio.attention.empty.description')}
          compact
        />
      ) : (
        <ul id={listId} className="mt-1 divide-y divide-border/60 border-t border-border/60" aria-label={t('dashboard.attention.listLabel')}>
          {shown.map((f, i) => {
            switch (f.type) {
              case 'attention':
                return <AttentionRow key={f.key} item={f.item} onApprove={askApproval} rise={rise(i)} />;
              case 'debt':
              case 'untriaged':
              case 'undated':
                return <RequestRow key={f.key} item={f} onOpen={openRequest} rise={rise(i)} />;
              case 'care':
                return <CareRow key={f.key} item={f} today={today} rise={rise(i)} />;
              case 'nextStep':
                return <NextStepRow key={f.key} item={f} today={today} rise={rise(i)} />;
            }
          })}
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
      <CrTriageSheet request={triage} open={triageOpen && triage !== null} onOpenChange={setTriageOpen} />
    </SectionCard>
  );
}