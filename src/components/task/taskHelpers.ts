// Shared helpers of the task card / drawer (task-detail). Display logic only: permissions come from TaskView.can.
import {
  Banknote,
  CalendarCheck,
  Check,
  CircleCheck,
  Clock,
  Eye,
  Hourglass,
  Lock,
  MessageSquareReply,
  PenLine,
  Upload,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityView, ClientTaskType, TaskActionKind, TaskView, UserRef, Viewer } from '@/services/contract';
import { capitalize, t } from '@/i18n';
import { formatDateShort } from '@/lib/format';
import { dateOf } from '@/domain/clock';
import { addressName } from '@/domain/naming';

/** DESIGN §7.5 inset panel (instead of a box in a box): quotes, notes, delegation, property lists. */
export const INSET = 'rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60';

/**
 * TaskTypeIcon `boxed` in a neutral tile: the card / drawer already carries one blue accent (the primary button),
 * so the type icon stays quiet (DESIGN §1.6).
 */
export const NEUTRAL_TYPE_TILE = 'bg-subtle text-muted-foreground ring-border/80';

/** 'anh' / 'chị' of the viewer ('anh/chị' when unknown) */
export function viewerSalutation(viewer: Viewer | null): string {
  return viewer?.user.salutation ?? t('task.salutationFallback');
}

/** { salutation, Salutation } params for i18n sentences */
export function salutationParams(viewer: Viewer | null): { salutation: string; Salutation: string } {
  const s = viewerSalutation(viewer);
  return { salutation: s, Salutation: capitalize(s) };
}

export function isClientViewer(viewer: Viewer | null): boolean {
  return viewer?.org_type === 'client';
}

const ACTION_BY_TYPE: Record<ClientTaskType, TaskActionKind> = {
  approval: 'approve',
  upload: 'upload',
  confirm: 'confirm',
  sign: 'sign',
  payment: 'payment',
  attend: 'attend',
  answer: 'answer',
};

export interface ClientAffordances {
  /** "Xem như khách hàng": everything shown, nothing clickable */
  readOnly: boolean;
  /** the primary action shown on the card / in the drawer (null = none) */
  primary: TaskActionKind | null;
  delegate: boolean;
  ask: boolean;
  /** decision-maker only task: "Giao cho đồng nghiệp" shown disabled with the reason */
  ownerOnly: boolean;
}

/**
 * What a client viewer sees on a task. Normally TaskView.can / primary_action (computed by the service layer).
 * In read-only "Xem như khách hàng" mode the service returns no permissions at all, so the controls the decision
 * maker would see are previewed here — display only, every one of them is rendered disabled.
 */
export function clientAffordances(task: TaskView, viewer: Viewer | null): ClientAffordances {
  const readOnly = !!viewer?.read_only;
  const open = task.status !== 'done';
  const waitingClient = open && task.side === 'client' && task.type !== 'work' && task.waiting_on === 'client';
  const owner = viewer?.role === 'client_owner';
  const ownerOnly = owner && waitingClient && task.requires_owner;
  if (!readOnly || !viewer) {
    return {
      readOnly,
      primary: task.primary_action,
      delegate: task.can.delegate,
      ask: task.can.ask,
      ownerOnly,
    };
  }
  const me = viewer.user.id;
  const assignee = task.assignee?.id ?? null;
  const mine = owner ? assignee === null || assignee === me : assignee === me;
  return {
    readOnly,
    primary: waitingClient && !task.blocked && mine && task.type !== 'work' ? ACTION_BY_TYPE[task.type] : null,
    delegate: owner && waitingClient && !task.blocked && !task.requires_owner && (mine || task.delegated_by?.id === me),
    ask: open && (owner || assignee === me),
    ownerOnly,
  };
}

export const PRIMARY_ICONS: Partial<Record<TaskActionKind, LucideIcon>> = {
  approve: Eye,
  upload: Upload,
  sign: PenLine,
  payment: Banknote,
  confirm: Check,
  attend: CalendarCheck,
  answer: MessageSquareReply,
};

export type StatusTone = 'success' | 'neutral';

export interface StatusPhrase {
  text: string;
  tone: StatusTone;
  icon: LucideIcon;
}

/** One status phrase for the header of the drawer (client wording for client viewers). */
export function statusPhrase(task: TaskView, viewer: Viewer | null): StatusPhrase {
  if (task.status === 'done') {
    const date = task.completed_at ? formatDateShort(dateOf(task.completed_at)) : null;
    return { text: date ? t('task.status.doneOn', { date }) : t('task.status.done'), tone: 'success', icon: CircleCheck };
  }
  if (task.blocked) return { text: t('task.status.blocked'), tone: 'neutral', icon: Lock };
  const client = isClientViewer(viewer);
  if (task.side === 'client') {
    if (task.waiting_on === 'internal') return { text: t('task.status.checking'), tone: 'neutral', icon: Hourglass };
    if (client) {
      const aff = clientAffordances(task, viewer);
      if (aff.primary) return { text: t('task.status.yourTurn', { salutation: viewerSalutation(viewer) }), tone: 'neutral', icon: UserRound };
      if (task.assignee) return { text: t('task.status.waitingPerson', { name: personAddress(task.assignee) }), tone: 'neutral', icon: Clock };
    }
    return { text: t('task.status.waitingClient'), tone: 'neutral', icon: Clock };
  }
  if (client) {
    if (task.status === 'in_progress') return { text: t('task.status.newEraDoing'), tone: 'neutral', icon: Clock };
    if (task.status === 'waiting') return { text: t('task.status.newEraWaiting'), tone: 'neutral', icon: Hourglass };
    return { text: t('task.status.newEraTodo'), tone: 'neutral', icon: Clock };
  }
  return { text: t(`enums.taskStatus.${task.status}`), tone: 'neutral', icon: task.status === 'waiting' ? Hourglass : Clock };
}

/** Max bytes read into a data: URL; bigger files use URL.createObjectURL (kept in this tab only). */
export const INLINE_UPLOAD_MAX_BYTES = 400 * 1024;

/** 'chị Lan' (mid-sentence) for a person of the client company; full name when no salutation is stored. */
export function personAddress(user: UserRef): string {
  return addressName(user.salutation, user.full_name);
}

/**
 * What New Era does with a client task that waits on it (TaskView.primary_action === 'review_submission'):
 * - 'quote'      approval of a quote with changes asked → a new quote version (quote page) closes this task
 * - 'newVersion' approval with changes asked → send a new version back ("Chấp nhận" would approve in the client's place)
 * - 'payment'    transfer reported → confirm the money arrived, or ask again
 * - 'files'      files sent (upload / sign) → accept, or return with a message
 */
export type ReviewMode = 'quote' | 'newVersion' | 'payment' | 'files';

export function reviewMode(task: Pick<TaskView, 'type' | 'quote_id' | 'payment_schedule_id'>): ReviewMode {
  if (task.type === 'approval') return task.quote_id ? 'quote' : 'newVersion';
  if (task.type === 'payment' || task.payment_schedule_id) return 'payment';
  return 'files';
}

/** The latest "Yêu cầu chỉnh sửa" of the client (reason + when), from the task history. */
export function latestChangeRequest(history: ActivityView[]): { reason: string; at: string; actor: UserRef | null } | null {
  let best: ActivityView | null = null;
  for (const a of history) {
    if (a.action !== 'task.changes_requested') continue;
    if (!best || a.created_at > best.created_at) best = a;
  }
  if (!best) return null;
  const reason = best.params.reason;
  return typeof reason === 'string' && reason.trim() ? { reason, at: best.created_at, actor: best.actor } : null;
}

const SUBMISSIONS = new Set<string>(['task.files_submitted', 'task.signed_submitted', 'task.payment_reported']);

/** The note the client sent with their latest files / payment report, if any. */
export function latestSubmissionNote(history: ActivityView[]): { text: string; author: string | null } | null {
  let best: ActivityView | null = null;
  for (const a of history) {
    if (!SUBMISSIONS.has(a.action)) continue;
    if (!best || a.created_at > best.created_at) best = a;
  }
  const note = best?.params.note;
  return best && typeof note === 'string' && note.trim() ? { text: note, author: best.actor?.full_name ?? null } : null;
}

/** i18n key of the "sent, New Era is checking" sentence for a client task waiting on New Era ({when}). */
export function submittedKey(task: Pick<TaskView, 'type' | 'payment_schedule_id'>): string {
  if (task.type === 'approval') return 'task.submitted.changes';
  if (task.type === 'payment' || task.payment_schedule_id) return 'task.submitted.payment';
  return 'task.submitted.files';
}
