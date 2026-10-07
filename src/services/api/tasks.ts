// Task mutations: client actions (+ 10-second undo), delegation, questions, and internal task operations.
// Every mutation: requireViewer → assertWritable → permission check (TaskView.can logic) → one db.batch
// with the patch, the activity log, the notification event and the commercial hooks.

import type { ActivityAction, ID, ISODateTime, Task, TaskStatus, User } from '@/domain/types';
import {
  ApiError,
  type ActionResult,
  type Api,
  type TaskInput,
  type TaskView,
  type Viewer,
} from '@/services/contract';
import { nowISO } from '@/domain/clock';
import { isValidISODate } from '@/domain/dates';
import { findCycle } from '@/domain/graph';
import { canMoveTo, clientActionAllowed, clientActionPatch, reviewPatch, statusPatch, type ClientAction } from '@/domain/taskRules';
import { t } from '@/i18n';
import { newId } from '@/lib/utils';
import {
  onPaymentReported,
  onPaymentTaskAccepted,
  onQuoteTaskApproved,
  onQuoteTaskChangesRequested,
} from '@/services/commercialEffects';
import { assertWritable, getSession, isManagerOf, requireViewer } from '@/services/context';
import { db, type ChangeSet, type TableName } from '@/services/db';
import { logActivity } from '@/services/effects';
import { notifyTaskEvent, type TaskEventKind } from '@/services/notifyEvents';
import { announceUnblocked, blockedClientTasks } from '@/services/unblockNotices';
import {
  accessibleIds,
  accountIdOfProject,
  accountTasks,
  canViewTask,
  commentView,
  fieldLabels,
  graphForAccount,
  invalidateViewCache,
  taskDependencies,
  taskView,
} from '@/services/views';
import { assertTaskVisible } from '@/services/api/reads';
import { assertUpload, insertFile, kindForUpload } from '@/services/api/files';
import { assertEmailInDomain, createClientInvite, normalizeEmail } from '@/services/api/accounts';

const forbidden = (): ApiError => new ApiError('forbidden', 'errors.forbidden');
const notFound = (): ApiError => new ApiError('not_found', 'errors.not_found');
const invalid = (key: string, details?: Record<string, unknown>): ApiError => new ApiError('validation', key, details);

// ───────────────────────────── helpers ─────────────────────────────

function loadTask(id: ID): Task {
  const task = db.find('tasks', id);
  if (!task) throw notFound();
  return task;
}

function accountOfTask(task: Task): ID {
  const accountId = accountIdOfProject(task.project_id);
  if (!accountId) throw notFound();
  return accountId;
}

function current(id: ID): Task {
  return db.get('tasks', id);
}

/** activity params: { task, task_id, ...extra } without empty values */
function taskParams(task: Task, extra: Record<string, string | number | null | undefined> = {}): Record<string, string | number> {
  const params: Record<string, string | number> = { task: task.title, task_id: task.id };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== null && value !== undefined && value !== '') params[key] = value;
  }
  return params;
}

function blockerTitles(task: Task, v: Viewer): string[] {
  return graphForAccount(accountOfTask(task))
    .blockersOf(task.id)
    .map((b) => (canViewTask(b, v) ? b.title : t('errors.hidden_blocker')));
}

function uniq(ids: ID[] | undefined): ID[] {
  return [...new Set((ids ?? []).filter((x) => typeof x === 'string' && x))];
}

// ───────────────────────────── blocking side effects ─────────────────────────────

/**
 * A manual unblock waives the blockers the task had when the AM unblocked it. When the task gains a new unfinished
 * blocker, or one of its blockers is reopened, the waiver no longer holds: clear it and log it (call inside db.batch).
 */
function revokeManualUnblock(taskId: ID, accountId: ID, actorId: ID, at: ISODateTime): void {
  const task = db.find('tasks', taskId);
  if (!task || task.status === 'done' || !task.manual_unblock_reason) return;
  db.update('tasks', task.id, { manual_unblock_reason: null, manual_unblocked_by: null, manual_unblocked_at: null, updated_at: at });
  invalidateViewCache();
  logActivity({
    account_id: accountId,
    actor_id: actorId,
    action: 'task.updated',
    target_type: 'task',
    target_id: task.id,
    params: taskParams(task, { fields: fieldLabels(['manual_unblock_reason']) }),
    visibility: 'internal',
  });
}

// blockedClientTasks / announceUnblocked ("Việc … đã sẵn sàng") live in services/unblockNotices.ts (shared with
// the commercial paths that complete or withdraw tasks).

// ───────────────────────────── undo (10 s) ─────────────────────────────

const UNDO_TTL_MS = 10_000;

/** bell items, mails and log lines are reverted with the action without a conflict check */
const UNDO_UNCHECKED: ReadonlySet<string> = new Set(['notifications', 'emails', 'activities']);

interface WatchedRow {
  table: TableName;
  id: ID;
  /** JSON of the row right after the action ('null' = absent) */
  json: string;
}

interface UndoEntry {
  changes: ChangeSet;
  userId: ID;
  expires: number;
  taskId: ID;
  accountId: ID;
  /** rows that must still be exactly as the action left them for the undo to be safe */
  watch: WatchedRow[];
}

const undoStore = new Map<string, UndoEntry>();

function rowJson(table: TableName, id: ID): string {
  const row = (db.allRows(table) as { id: ID }[]).find((r) => r.id === id);
  return row ? JSON.stringify(row) : 'null';
}

/**
 * Rows the undo would put back (business tables only), plus — when the action completed the task — its direct
 * downstream tasks: once someone else edited any of them (or started work the action unblocked), undo is refused.
 */
function watchAfter(changes: ChangeSet, taskId: ID, accountId: ID): WatchedRow[] {
  const watch: WatchedRow[] = [];
  const seen = new Set<string>();
  const add = (table: TableName, id: ID): void => {
    const key = `${table}|${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    watch.push({ table, id, json: rowJson(table, id) });
  };
  for (const c of changes.changes) {
    if (c.table === 'settings' || c.table === 'meta' || UNDO_UNCHECKED.has(c.table)) continue;
    add(c.table, c.id);
  }
  const task = db.find('tasks', taskId);
  if (task && task.status === 'done') {
    for (const d of graphForAccount(accountId).blocksTasks(taskId)) add('tasks', d.id);
  }
  return watch;
}

/** the real person behind the session (not the impersonated client in "Xem như khách hàng") */
function realUserId(v: Viewer): ID {
  const s = getSession();
  return s ? s.user_id : v.user.id;
}

function pruneUndo(): void {
  const nowMs = Date.now();
  for (const [token, entry] of undoStore) if (entry.expires <= nowMs) undoStore.delete(token);
}

function rememberUndo(changes: ChangeSet, v: Viewer, taskId: ID, accountId: ID): string {
  pruneUndo();
  const token = newId('undo');
  undoStore.set(token, {
    changes,
    userId: realUserId(v),
    expires: Date.now() + UNDO_TTL_MS,
    taskId,
    accountId,
    watch: watchAfter(changes, taskId, accountId),
  });
  return token;
}

/** used by resetDemoData: change sets of the old data must never be replayed */
export function clearUndoStore(): void {
  undoStore.clear();
}

// ───────────────────────────── client actions ─────────────────────────────

interface ClientActionSpec {
  action: ClientAction;
  activity: ActivityAction;
  event: TaskEventKind;
  messageKey: string;
  /** extra activity params */
  params?: Record<string, string | number | null | undefined>;
  /** optional note from the client (activity param `note`, and the notification text) */
  note?: string | null;
  /** notification text when it is not the note (reason, answer) */
  notifyNote?: string | null;
  patch?: Partial<Task>;
  /** inside the batch, after the task patch (files, commercial hooks) */
  after?: (task: Task, v: Viewer, accountId: ID) => void;
}

function clientDenial(task: Task, view: TaskView, v: Viewer): ApiError {
  if (task.status === 'done' || task.waiting_on !== 'client') return new ApiError('conflict', 'errors.task_not_waiting');
  if (view.blocked) {
    return new ApiError('blocked', 'errors.blocked', { blockers: view.blocked_by.map((b) => b.title ?? t('errors.hidden_blocker')) });
  }
  if (task.requires_owner && v.role !== 'client_owner') return new ApiError('requires_owner', 'errors.requires_owner');
  return forbidden();
}

function runClientAction(taskId: ID, spec: ClientActionSpec): ActionResult {
  const v = requireViewer();
  assertWritable(v);
  if (v.org_type !== 'client') throw forbidden();
  const task = loadTask(taskId);
  assertTaskVisible(task, v);
  const accountId = accountOfTask(task);
  const view = taskView(task, v);
  if (!view.can.act) throw clientDenial(task, view, v);
  if (!clientActionAllowed(task, spec.action)) throw invalid('errors.action_not_allowed');
  const at = nowISO();
  const note = (spec.note ?? '').trim() || null;
  const notifyNote = (spec.notifyNote ?? '').trim() || note;
  const waitingBefore = blockedClientTasks(accountId);
  const { changes } = db.batch(() => {
    db.update('tasks', task.id, { ...clientActionPatch(task, spec.action, at), ...spec.patch, updated_at: at });
    invalidateViewCache();
    spec.after?.(current(task.id), v, accountId);
    logActivity({
      account_id: accountId,
      actor_id: v.user.id,
      action: spec.activity,
      target_type: 'task',
      target_id: task.id,
      params: taskParams(task, { ...spec.params, note }),
      visibility: 'shared',
    });
    notifyTaskEvent(spec.event, task.id, v.user.id, notifyNote ? { note: notifyNote } : undefined);
    announceUnblocked(accountId, waitingBefore, v.user.id);
    invalidateViewCache();
  });
  return {
    task: taskView(current(task.id), v),
    undo_token: rememberUndo(changes, v, task.id, accountId),
    message_key: spec.messageKey,
  };
}

// ───────────────────────────── internal-task helpers ─────────────────────────────

function managedTask(id: ID, v: Viewer): { task: Task; accountId: ID } {
  if (v.org_type !== 'internal') throw forbidden();
  const task = loadTask(id);
  assertTaskVisible(task, v);
  const accountId = accountOfTask(task);
  if (!isManagerOf(v, accountId)) throw forbidden();
  return { task, accountId };
}

/** Validate a full TaskInput (create, or merged update). Asserts the viewer manages the account. */
function validateTaskInput(input: TaskInput, v: Viewer, selfId: ID): { accountId: ID; clean: TaskInput } {
  if (v.org_type !== 'internal') throw forbidden();
  const project = db.find('projects', input.project_id);
  if (!project) throw invalid('errors.invalid_project');
  const accountId = project.account_id;
  if (!isManagerOf(v, accountId)) throw forbidden();

  const title = (input.title ?? '').trim();
  if (!title) throw invalid('errors.title_required');
  if (!isValidISODate(input.due_date)) throw invalid('errors.invalid_date');
  if (input.side !== 'client' && input.side !== 'internal') throw invalid('errors.invalid_type');
  if (input.side === 'client' ? input.type === 'work' : input.type !== 'work') throw invalid('errors.invalid_type');

  if (input.milestone_id) {
    const m = db.find('milestones', input.milestone_id);
    if (!m || m.project_id !== project.id) throw invalid('errors.invalid_milestone');
  }
  if (input.assignee_id) {
    const u = db.find('users', input.assignee_id);
    const ok =
      !!u &&
      u.status !== 'disabled' &&
      (input.side === 'client' ? u.org_type === 'client' && u.account_id === accountId : u.org_type === 'internal');
    if (!ok) throw invalid('errors.invalid_assignee');
  }

  const blocksTasks = uniq(input.blocks_task_ids);
  const blocksMilestones = uniq(input.blocks_milestone_ids);
  const blockedBy = uniq(input.blocked_by_task_ids);
  for (const id of [...blocksTasks, ...blockedBy]) {
    if (id === selfId) throw new ApiError('cycle', 'errors.cycle', { path: [title] });
    const other = db.find('tasks', id);
    if (!other || accountIdOfProject(other.project_id) !== accountId) throw invalid('errors.dependency_scope');
  }
  for (const id of blocksMilestones) {
    const m = db.find('milestones', id);
    if (!m || accountIdOfProject(m.project_id) !== accountId) throw invalid('errors.dependency_scope');
  }

  const impact = (input.impact_text ?? '').trim();
  if ((input.side === 'client' || blocksTasks.length > 0 || blocksMilestones.length > 0) && !impact) {
    throw invalid('errors.impact_required');
  }

  return {
    accountId,
    clean: {
      project_id: project.id,
      milestone_id: input.milestone_id || null,
      title,
      description: (input.description ?? '').trim(),
      side: input.side,
      type: input.type,
      assignee_id: input.assignee_id || null,
      requires_owner: input.side === 'client' && !!input.requires_owner,
      due_date: input.due_date,
      impact_text: impact,
      client_visible: input.side === 'client' ? true : !!input.client_visible,
      blocks_task_ids: blocksTasks,
      blocks_milestone_ids: blocksMilestones,
      blocked_by_task_ids: blockedBy,
    },
  };
}

/** titles forming a cycle if `selfId`'s task-to-task edges were replaced by the given ones, else null */
function cyclePath(accountId: ID, selfId: ID, selfTitle: string, blocks: ID[], blockedBy: ID[]): string[] | null {
  if (blocks.includes(selfId) || blockedBy.includes(selfId)) return [selfTitle];
  const taskIds = new Set(accountTasks(accountId).map((x) => x.id));
  const existing = db
    .rows('task_dependencies')
    .filter((d) => taskIds.has(d.task_id) && d.blocks_task_id !== null && d.task_id !== selfId && d.blocks_task_id !== selfId);
  const proposed = [
    ...blocks.map((b) => ({ task_id: selfId, blocks_task_id: b })),
    ...blockedBy.map((b) => ({ task_id: b, blocks_task_id: selfId })),
  ];
  const path = findCycle(existing, proposed);
  if (!path) return null;
  return path.map((id) => (id === selfId ? selfTitle : db.find('tasks', id)?.title ?? id));
}

function assertNoCycle(accountId: ID, selfId: ID, selfTitle: string, blocks: ID[], blockedBy: ID[]): void {
  const path = cyclePath(accountId, selfId, selfTitle, blocks, blockedBy);
  if (path) throw new ApiError('cycle', 'errors.cycle', { path });
}

/** Replace the given dependency categories of a task (call inside db.batch). */
function replaceDeps(
  taskId: ID,
  next: { blocks_task_ids?: ID[]; blocks_milestone_ids?: ID[]; blocked_by_task_ids?: ID[] },
  actorId: ID,
  at: ISODateTime,
): void {
  const deps = db.rows('task_dependencies');
  const insert = (task_id: ID, blocks_task_id: ID | null, blocks_milestone_id: ID | null): void => {
    db.insert('task_dependencies', { id: newId('dep'), task_id, blocks_task_id, blocks_milestone_id, created_by: actorId, created_at: at });
  };
  if (next.blocks_task_ids) {
    for (const d of deps.filter((x) => x.task_id === taskId && x.blocks_task_id !== null)) db.hardDelete('task_dependencies', d.id);
    for (const id of next.blocks_task_ids) insert(taskId, id, null);
  }
  if (next.blocks_milestone_ids) {
    for (const d of deps.filter((x) => x.task_id === taskId && x.blocks_milestone_id !== null)) db.hardDelete('task_dependencies', d.id);
    for (const id of next.blocks_milestone_ids) insert(taskId, null, id);
  }
  if (next.blocked_by_task_ids) {
    for (const d of deps.filter((x) => x.blocks_task_id === taskId)) db.hardDelete('task_dependencies', d.id);
    for (const id of next.blocked_by_task_ids) insert(id, taskId, null);
  }
}

const sameSet = (a: ID[], b: ID[]): boolean => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'waiting', 'done'];

// ───────────────────────────── endpoints ─────────────────────────────

export const tasksApi: Pick<
  Api,
  | 'approveTask'
  | 'requestTaskChanges'
  | 'submitTaskFiles'
  | 'reportPayment'
  | 'confirmTask'
  | 'answerTask'
  | 'undoAction'
  | 'delegateTask'
  | 'askNewEra'
  | 'createTask'
  | 'updateTask'
  | 'deleteTask'
  | 'setTaskStatus'
  | 'manualUnblock'
  | 'setTaskClientVisible'
  | 'acceptSubmission'
  | 'returnToClient'
  | 'addComment'
  | 'checkDependencies'
> = {
  async approveTask(taskId, note) {
    const text = (note ?? '').trim();
    return runClientAction(taskId, {
      action: 'approve',
      activity: 'task.approved',
      event: 'client_approved',
      messageKey: 'task.toast.approved',
      note: text,
      patch: text ? { answer_text: text } : undefined,
      after: (task, v) => {
        if (task.quote_id) onQuoteTaskApproved(task.quote_id, v.user.id, text || undefined);
      },
    });
  },

  async requestTaskChanges(taskId, reason) {
    assertWritable(requireViewer());
    const why = (reason ?? '').trim();
    if (!why) throw invalid('errors.reason_required');
    return runClientAction(taskId, {
      action: 'request_changes',
      activity: 'task.changes_requested',
      event: 'client_changes_requested',
      messageKey: 'task.toast.changes_requested',
      params: { reason: why },
      notifyNote: why,
      after: (task, v) => {
        if (task.quote_id) onQuoteTaskChangesRequested(task.quote_id, v.user.id, why);
      },
    });
  },

  async submitTaskFiles(taskId, files, note) {
    assertWritable(requireViewer());
    if (!Array.isArray(files) || files.length === 0) throw invalid('errors.files_required');
    files.forEach((f) => assertUpload(f));
    const text = (note ?? '').trim() || null;
    const isSign = db.find('tasks', taskId)?.type === 'sign';
    return runClientAction(taskId, {
      action: 'submit_files',
      activity: isSign ? 'task.signed_submitted' : 'task.files_submitted',
      event: 'client_submitted',
      messageKey: 'task.toast.submitted',
      params: { count: files.length, files: files.map((f) => f.name).join(', ') },
      note: text,
      after: (task, v, accountId) => {
        for (const upload of files) {
          insertFile({
            account_id: accountId,
            project_id: task.project_id,
            task_id: task.id,
            upload,
            visibility: 'shared',
            kind: task.type === 'sign' ? 'contract' : kindForUpload(upload.mime, 'document'),
            uploaded_by: v.user.id,
            note: text,
          });
        }
      },
    });
  },

  async reportPayment(taskId, proof, note) {
    assertWritable(requireViewer());
    assertUpload(proof);
    const text = (note ?? '').trim() || null;
    return runClientAction(taskId, {
      action: 'report_payment',
      activity: 'task.payment_reported',
      event: 'client_payment_reported',
      messageKey: 'task.toast.payment_reported',
      note: text,
      after: (task, v, accountId) => {
        const file = insertFile({
          account_id: accountId,
          project_id: task.project_id,
          task_id: task.id,
          upload: proof,
          visibility: 'shared',
          kind: 'proof',
          uploaded_by: v.user.id,
          note: text,
        });
        onPaymentReported(task.id, file.id, v.user.id);
      },
    });
  },

  async confirmTask(taskId, note) {
    const text = (note ?? '').trim();
    const attend = db.find('tasks', taskId)?.type === 'attend';
    return runClientAction(taskId, {
      action: 'confirm',
      activity: attend ? 'task.attendance_confirmed' : 'task.confirmed',
      event: 'client_confirmed',
      messageKey: attend ? 'task.toast.attendance_confirmed' : 'task.toast.confirmed',
      note: text,
      patch: text ? { answer_text: text } : undefined,
    });
  },

  async answerTask(taskId, answer) {
    assertWritable(requireViewer());
    const text = (answer ?? '').trim();
    if (!text) throw invalid('errors.answer_required');
    return runClientAction(taskId, {
      action: 'answer',
      activity: 'task.answered',
      event: 'client_answered',
      messageKey: 'task.toast.answered',
      params: { answer: text },
      notifyNote: text,
      patch: { answer_text: text },
    });
  },

  async undoAction(undoToken) {
    const v = requireViewer();
    assertWritable(v);
    pruneUndo();
    const entry = undoStore.get(undoToken);
    if (!entry) throw new ApiError('conflict', 'errors.undo_expired');
    if (entry.userId !== realUserId(v)) throw forbidden();
    undoStore.delete(undoToken);
    // someone changed what the action touched (or started the work it unblocked): putting the old rows back
    // would silently drop their change
    if (entry.watch.some((w) => rowJson(w.table, w.id) !== w.json)) throw new ApiError('conflict', 'errors.undo_conflict');
    db.batch(() => {
      db.revert(entry.changes, { silent: true });
      invalidateViewCache();
      const task = db.find('tasks', entry.taskId);
      logActivity({
        account_id: entry.accountId,
        actor_id: v.user.id,
        action: 'task.action_undone',
        target_type: 'task',
        target_id: entry.taskId,
        params: task ? taskParams(task) : { task_id: entry.taskId },
        visibility: 'internal',
      });
    });
    invalidateViewCache();
    const task = loadTask(entry.taskId);
    return taskView(task, v);
  },

  async delegateTask(taskId, input) {
    const v = requireViewer();
    assertWritable(v);
    if (v.org_type !== 'client' || v.role !== 'client_owner' || !v.account_id) throw forbidden();
    const task = loadTask(taskId);
    assertTaskVisible(task, v);
    if (task.requires_owner) throw new ApiError('requires_owner', 'errors.requires_owner');
    const view = taskView(task, v);
    if (!view.can.delegate) {
      if (task.status === 'done' || task.waiting_on !== 'client') throw new ApiError('conflict', 'errors.task_not_waiting');
      if (view.blocked) throw new ApiError('blocked', 'errors.blocked', { blockers: blockerTitles(task, v) });
      throw forbidden();
    }
    const accountId = accountOfTask(task);
    const account = db.find('accounts', accountId);
    if (!account) throw notFound();
    const note = (input.note ?? '').trim() || null;

    let target: User | null = null;
    let inviteInput: { email: string; full_name: string; salutation: 'anh' | 'chị' } | null = null;
    if (input.to_user_id) {
      const u = db.find('users', input.to_user_id);
      if (!u || u.org_type !== 'client' || u.account_id !== accountId || (u.status !== 'active' && u.status !== 'invited')) {
        throw invalid('errors.invalid_delegate');
      }
      target = u;
    } else if (input.invite) {
      const email = normalizeEmail(input.invite.email);
      assertEmailInDomain(email, account.email_domain);
      const existing = db.rows('users').find((u) => u.email.toLowerCase() === email && u.status !== 'disabled');
      if (existing) {
        if (existing.org_type !== 'client' || existing.account_id !== accountId) throw new ApiError('conflict', 'errors.email_exists');
        target = existing;
      } else {
        inviteInput = { email, full_name: input.invite.full_name, salutation: input.invite.salutation };
      }
    } else {
      throw invalid('errors.delegate_target_required');
    }
    if (target && target.id === v.user.id) throw invalid('errors.delegate_self');

    const at = nowISO();
    const { changes } = db.batch(() => {
      const assignee =
        target ??
        createClientInvite(
          account,
          {
            full_name: inviteInput ? inviteInput.full_name : '',
            email: inviteInput ? inviteInput.email : '',
            salutation: inviteInput ? inviteInput.salutation : 'anh',
            title: '',
            role: 'client_member',
            decision_role: 'ops_contact',
          },
          v.user.id,
        ).user;
      db.update('tasks', task.id, {
        assignee_id: assignee.id,
        delegated_by: v.user.id,
        delegated_at: at,
        delegation_note: note,
        updated_at: at,
      });
      invalidateViewCache();
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'task.delegated',
        target_type: 'task',
        target_id: task.id,
        params: taskParams(task, { to: assignee.full_name, note }),
        visibility: 'shared',
      });
      notifyTaskEvent('delegated', task.id, v.user.id, note ? { note, toUserId: assignee.id } : { toUserId: assignee.id });
      invalidateViewCache();
    });
    return {
      task: taskView(current(task.id), v),
      undo_token: rememberUndo(changes, v, task.id, accountId),
      message_key: 'task.toast.delegated',
    };
  },

  async askNewEra(taskId, question) {
    const v = requireViewer();
    assertWritable(v);
    if (v.org_type !== 'client') throw forbidden();
    const text = (question ?? '').trim();
    if (!text) throw invalid('errors.question_required');
    const task = loadTask(taskId);
    assertTaskVisible(task, v);
    if (!taskView(task, v).can.ask) throw forbidden();
    const accountId = accountOfTask(task);
    const at = nowISO();
    const { result } = db.batch(() => {
      const comment = db.insert('comments', {
        id: newId('cmt'),
        task_id: task.id,
        author_id: v.user.id,
        body: text,
        visibility: 'shared',
        reply_to_id: null,
        created_at: at,
        deleted_at: null,
      });
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'task.question_asked',
        target_type: 'task',
        target_id: task.id,
        params: taskParams(task, { question: text }),
        visibility: 'shared',
      });
      notifyTaskEvent('client_question', task.id, v.user.id, { note: text });
      return comment;
    });
    const view = commentView(result, v);
    if (!view) throw notFound();
    return view;
  },

  async createTask(input) {
    const v = requireViewer();
    assertWritable(v);
    const id = newId('t');
    const { accountId, clean } = validateTaskInput(input, v, id);
    assertNoCycle(accountId, id, clean.title, clean.blocks_task_ids, clean.blocked_by_task_ids);
    const at = nowISO();
    db.batch(() => {
      const row: Task = {
        id,
        project_id: clean.project_id,
        milestone_id: clean.milestone_id,
        title: clean.title,
        description: clean.description,
        side: clean.side,
        type: clean.type,
        assignee_id: clean.assignee_id,
        delegated_by: null,
        delegated_at: null,
        delegation_note: null,
        requires_owner: clean.requires_owner,
        waiting_on: clean.side === 'client' ? 'client' : 'internal',
        due_date: clean.due_date,
        status: 'todo',
        impact_text: clean.impact_text,
        client_visible: clean.client_visible,
        reminder_count: 0,
        last_reminded_at: null,
        manual_unblock_reason: null,
        manual_unblocked_by: null,
        manual_unblocked_at: null,
        completed_at: null,
        quote_id: null,
        payment_schedule_id: null,
        revision: 1,
        answer_text: null,
        created_by: v.user.id,
        created_at: at,
        updated_at: at,
        deleted_at: null,
      };
      db.insert('tasks', row);
      replaceDeps(id, clean, v.user.id, at);
      invalidateViewCache();
      // the new (unfinished) task is a blocker the earlier manual unblocks of its targets did not waive
      for (const target of clean.blocks_task_ids) revokeManualUnblock(target, accountId, v.user.id, at);
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'task.created',
        target_type: 'task',
        target_id: id,
        params: taskParams(row),
        visibility: row.side === 'client' ? 'shared' : 'internal',
      });
      // a client task that starts blocked is announced when it can be handled (announceUnblocked / manual unblock)
      if (row.side === 'client' && !graphForAccount(accountId).isBlocked(id)) notifyTaskEvent('task_assigned_client', id, v.user.id);
    });
    return taskView(current(id), v);
  },

  async updateTask(id, patch) {
    const v = requireViewer();
    assertWritable(v);
    const { task, accountId } = managedTask(id, v);
    const deps = taskDependencies(task.id);
    const merged: TaskInput = {
      project_id: patch.project_id ?? task.project_id,
      milestone_id: patch.milestone_id !== undefined ? patch.milestone_id : task.milestone_id,
      title: patch.title ?? task.title,
      description: patch.description ?? task.description,
      side: patch.side ?? task.side,
      type: patch.type ?? task.type,
      assignee_id: patch.assignee_id !== undefined ? patch.assignee_id : task.assignee_id,
      requires_owner: patch.requires_owner ?? task.requires_owner,
      due_date: patch.due_date ?? task.due_date,
      impact_text: patch.impact_text ?? task.impact_text,
      client_visible: patch.client_visible ?? task.client_visible,
      blocks_task_ids: patch.blocks_task_ids ?? deps.blocks_task_ids,
      blocks_milestone_ids: patch.blocks_milestone_ids ?? deps.blocks_milestone_ids,
      blocked_by_task_ids: patch.blocked_by_task_ids ?? deps.blocked_by_task_ids,
    };
    const { accountId: target, clean } = validateTaskInput(merged, v, task.id);
    if (target !== accountId) throw invalid('errors.dependency_scope');
    assertNoCycle(accountId, task.id, clean.title, clean.blocks_task_ids, clean.blocked_by_task_ids);

    const fields: Partial<Task> = {};
    const changed: string[] = [];
    const set = <K extends keyof Task>(key: K, value: Task[K]): void => {
      if (JSON.stringify(task[key]) !== JSON.stringify(value)) {
        fields[key] = value;
        changed.push(key);
      }
    };
    set('project_id', clean.project_id);
    set('milestone_id', clean.milestone_id);
    set('title', clean.title);
    set('description', clean.description);
    set('side', clean.side);
    set('type', clean.type);
    set('assignee_id', clean.assignee_id);
    set('requires_owner', clean.requires_owner);
    set('due_date', clean.due_date);
    set('impact_text', clean.impact_text);
    set('client_visible', clean.client_visible);
    const assigneeChanged = changed.includes('assignee_id');
    if (assigneeChanged) {
      fields.delegated_by = null;
      fields.delegated_at = null;
      fields.delegation_note = null;
    }
    if (changed.includes('side') && task.status !== 'done') fields.waiting_on = clean.side === 'client' ? 'client' : 'internal';

    const depPatch: { blocks_task_ids?: ID[]; blocks_milestone_ids?: ID[]; blocked_by_task_ids?: ID[] } = {};
    if (!sameSet(clean.blocks_task_ids, deps.blocks_task_ids)) depPatch.blocks_task_ids = clean.blocks_task_ids;
    if (!sameSet(clean.blocks_milestone_ids, deps.blocks_milestone_ids)) depPatch.blocks_milestone_ids = clean.blocks_milestone_ids;
    if (!sameSet(clean.blocked_by_task_ids, deps.blocked_by_task_ids)) depPatch.blocked_by_task_ids = clean.blocked_by_task_ids;
    const depKeys = Object.keys(depPatch);
    if (!changed.length && !depKeys.length) return taskView(task, v);

    const at = nowISO();
    const waitingBefore = blockedClientTasks(accountId);
    db.batch(() => {
      db.update('tasks', task.id, { ...fields, updated_at: at });
      if (depKeys.length) replaceDeps(task.id, depPatch, v.user.id, at);
      invalidateViewCache();
      // a manual unblock does not cover unfinished blockers added after it
      const isOpen = (tid: ID): boolean => {
        const x = db.find('tasks', tid);
        return !!x && x.status !== 'done';
      };
      if (clean.blocked_by_task_ids.some((b) => !deps.blocked_by_task_ids.includes(b) && isOpen(b))) {
        revokeManualUnblock(task.id, accountId, v.user.id, at);
      }
      if (isOpen(task.id)) {
        for (const target of clean.blocks_task_ids) {
          if (!deps.blocks_task_ids.includes(target)) revokeManualUnblock(target, accountId, v.user.id, at);
        }
      }
      invalidateViewCache();
      const updated = current(task.id);
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'task.updated',
        target_type: 'task',
        target_id: task.id,
        params: taskParams(updated, { fields: fieldLabels([...changed, ...depKeys]) }),
        visibility: updated.side === 'client' ? 'shared' : 'internal',
      });
      let announced: ID | null = null;
      if (
        updated.side === 'client' &&
        updated.status !== 'done' &&
        assigneeChanged &&
        updated.assignee_id &&
        !graphForAccount(accountId).isBlocked(task.id)
      ) {
        notifyTaskEvent('task_assigned_client', task.id, v.user.id);
        announced = task.id;
      }
      announceUnblocked(accountId, waitingBefore, v.user.id, announced);
    });
    return taskView(current(task.id), v);
  },

  async deleteTask(id) {
    const v = requireViewer();
    assertWritable(v);
    const { task, accountId } = managedTask(id, v);
    const at = nowISO();
    const waitingBefore = blockedClientTasks(accountId);
    db.batch(() => {
      db.softDelete('tasks', task.id, at);
      for (const d of db.rows('task_dependencies').filter((x) => x.task_id === task.id || x.blocks_task_id === task.id)) {
        db.hardDelete('task_dependencies', d.id);
      }
      invalidateViewCache();
      announceUnblocked(accountId, waitingBefore, v.user.id, task.id);
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'task.deleted',
        target_type: 'task',
        target_id: task.id,
        params: taskParams(task),
        visibility: 'internal',
      });
    });
  },

  async setTaskStatus(id, status) {
    const v = requireViewer();
    assertWritable(v);
    if (v.org_type !== 'internal') throw forbidden();
    const task = loadTask(id);
    assertTaskVisible(task, v);
    const accountId = accountOfTask(task);
    const ownInternal = task.side === 'internal' && task.assignee_id === v.user.id;
    if (!isManagerOf(v, accountId) && !ownInternal) throw forbidden();
    if (!TASK_STATUSES.includes(status)) throw invalid('errors.invalid_transition');
    if (task.status === status) return taskView(task, v);
    const blocked = graphForAccount(accountId).isBlocked(task.id);
    const verdict = canMoveTo(task, status, blocked);
    if (!verdict.ok) {
      if (verdict.reason === 'blocked') throw new ApiError('blocked', 'errors.blocked', { blockers: blockerTitles(task, v) });
      throw invalid('errors.invalid_transition');
    }
    const at = nowISO();
    const reopening = task.status === 'done' && status !== 'done';
    const waitingBefore = status === 'done' ? blockedClientTasks(accountId) : new Set<ID>();
    db.batch(() => {
      db.update('tasks', task.id, { ...statusPatch(task, status, at), updated_at: at });
      invalidateViewCache();
      // a reopened blocker blocks again, even tasks the AM had unblocked by hand
      if (reopening) {
        for (const d of graphForAccount(accountId).blocksTasks(task.id)) revokeManualUnblock(d.id, accountId, v.user.id, at);
      }
      announceUnblocked(accountId, waitingBefore, v.user.id);
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'task.status_changed',
        target_type: 'task',
        target_id: task.id,
        params: taskParams(task, { from: task.status, to: status }),
        visibility: 'internal',
      });
    });
    return taskView(current(task.id), v);
  },

  async manualUnblock(id, reason) {
    const v = requireViewer();
    assertWritable(v);
    const { task, accountId } = managedTask(id, v);
    const why = (reason ?? '').trim();
    if (!why) throw invalid('errors.reason_required');
    if (!graphForAccount(accountId).isBlocked(task.id)) throw invalid('errors.not_blocked');
    const at = nowISO();
    db.batch(() => {
      db.update('tasks', task.id, {
        manual_unblock_reason: why,
        manual_unblocked_by: v.user.id,
        manual_unblocked_at: at,
        updated_at: at,
      });
      invalidateViewCache();
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'task.unblocked',
        target_type: 'task',
        target_id: task.id,
        params: taskParams(task, { reason: why }),
        visibility: 'internal',
      });
      notifyTaskEvent('unblocked', task.id, v.user.id, { note: why });
    });
    return taskView(current(task.id), v);
  },

  async setTaskClientVisible(id, visible) {
    const v = requireViewer();
    assertWritable(v);
    const { task, accountId } = managedTask(id, v);
    if (task.side === 'client') throw invalid('errors.client_task_always_visible');
    if (task.client_visible === visible) return taskView(task, v);
    const at = nowISO();
    db.batch(() => {
      db.update('tasks', task.id, { client_visible: visible, updated_at: at });
      invalidateViewCache();
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'task.visibility_changed',
        target_type: 'task',
        target_id: task.id,
        params: taskParams(task, { visible: visible ? 1 : 0 }),
        visibility: 'internal',
      });
    });
    return taskView(current(task.id), v);
  },

  async acceptSubmission(taskId, note) {
    const v = requireViewer();
    assertWritable(v);
    const { task, accountId } = managedTask(taskId, v);
    if (task.side !== 'client' || task.status === 'done' || task.waiting_on !== 'internal') throw new ApiError('conflict', 'errors.nothing_to_review');
    // an approval waits on New Era only after the client asked for changes: accepting would mark it approved without
    // the client approving — New Era sends a new version instead (returnToClient), a quote gets a new quote version
    if (task.type === 'approval') throw new ApiError('conflict', 'errors.approval_needs_client');
    const text = (note ?? '').trim() || null;
    const at = nowISO();
    const waitingBefore = blockedClientTasks(accountId);
    db.batch(() => {
      db.update('tasks', task.id, { ...reviewPatch(task, 'accept', at), updated_at: at });
      invalidateViewCache();
      announceUnblocked(accountId, waitingBefore, v.user.id);
      if (text) {
        db.insert('comments', {
          id: newId('cmt'),
          task_id: task.id,
          author_id: v.user.id,
          body: text,
          visibility: 'shared',
          reply_to_id: null,
          created_at: at,
          deleted_at: null,
        });
      }
      if (task.type === 'payment' || task.payment_schedule_id) onPaymentTaskAccepted(task.id, v.user.id);
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'task.submission_accepted',
        target_type: 'task',
        target_id: task.id,
        params: taskParams(task, { note: text }),
        visibility: 'shared',
      });
      notifyTaskEvent('submission_accepted', task.id, v.user.id, text ? { note: text } : undefined);
      invalidateViewCache();
    });
    return taskView(current(task.id), v);
  },

  async returnToClient(taskId, input) {
    const v = requireViewer();
    assertWritable(v);
    const { task, accountId } = managedTask(taskId, v);
    if (task.side !== 'client' || task.status === 'done' || task.waiting_on !== 'internal') throw new ApiError('conflict', 'errors.nothing_to_review');
    // a quote's approval task follows the quote: a new quote version closes it and asks the client again
    if (task.quote_id) throw new ApiError('conflict', 'errors.quote_task_needs_version');
    const message = (input.message ?? '').trim();
    if (!message) throw invalid('errors.message_required');
    const files = input.files ?? [];
    files.forEach((f) => assertUpload(f));
    const at = nowISO();
    db.batch(() => {
      db.update('tasks', task.id, { ...reviewPatch(task, 'return', at), updated_at: at });
      invalidateViewCache();
      for (const upload of files) {
        insertFile({
          account_id: accountId,
          project_id: task.project_id,
          task_id: task.id,
          upload,
          visibility: 'shared',
          kind: kindForUpload(upload.mime, 'document'),
          uploaded_by: v.user.id,
          note: null,
        });
      }
      db.insert('comments', {
        id: newId('cmt'),
        task_id: task.id,
        author_id: v.user.id,
        body: message,
        visibility: 'shared',
        reply_to_id: null,
        created_at: at,
        deleted_at: null,
      });
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'task.returned_to_client',
        target_type: 'task',
        target_id: task.id,
        params: taskParams(task, { message, count: files.length || null }),
        visibility: 'shared',
      });
      notifyTaskEvent('returned_to_client', task.id, v.user.id, { note: message });
      invalidateViewCache();
    });
    return taskView(current(task.id), v);
  },

  async addComment(taskId, body, visibility, replyToId) {
    const v = requireViewer();
    assertWritable(v);
    const text = (body ?? '').trim();
    if (!text) throw invalid('errors.comment_required');
    if (visibility !== 'shared' && visibility !== 'internal') throw invalid('errors.invalid_visibility');
    const task = loadTask(taskId);
    assertTaskVisible(task, v);
    const can = taskView(task, v).can;
    if (visibility === 'internal' ? !can.comment_internal : !can.comment_shared) throw forbidden();
    if (replyToId) {
      const parent = db.find('comments', replyToId);
      if (!parent || parent.task_id !== task.id || !commentView(parent, v)) throw invalid('errors.invalid_reply');
    }
    const accountId = accountOfTask(task);
    const at = nowISO();
    const { result } = db.batch(() => {
      const comment = db.insert('comments', {
        id: newId('cmt'),
        task_id: task.id,
        author_id: v.user.id,
        body: text,
        visibility,
        reply_to_id: replyToId ?? null,
        created_at: at,
        deleted_at: null,
      });
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'comment.added',
        target_type: 'comment',
        target_id: comment.id,
        params: taskParams(task),
        visibility,
      });
      if (visibility === 'shared') notifyTaskEvent('comment_shared', task.id, v.user.id, { note: text });
      return comment;
    });
    const view = commentView(result, v);
    if (!view) throw notFound();
    return view;
  },

  async checkDependencies(input) {
    const v = requireViewer();
    if (v.org_type !== 'internal') throw forbidden();
    const blocks = uniq(input.blocks_task_ids);
    const blockedBy = uniq(input.blocked_by_task_ids);
    let accountId: ID | null = null;
    let selfId = '__new_task__';
    let selfTitle = t('errors.this_task');
    if (input.taskId) {
      const task = loadTask(input.taskId);
      assertTaskVisible(task, v);
      accountId = accountOfTask(task);
      selfId = task.id;
      selfTitle = task.title;
    }
    // every id must be a task of ONE account the caller can read — the cycle path names tasks by title
    const readable = accessibleIds(v);
    for (const id of [...blocks, ...blockedBy]) {
      const other = db.find('tasks', id);
      const otherAccount = other ? accountIdOfProject(other.project_id) : null;
      if (!otherAccount || !readable.has(otherAccount) || (accountId !== null && otherAccount !== accountId)) {
        throw invalid('errors.dependency_scope');
      }
      accountId = otherAccount;
    }
    if (!accountId) return { ok: true };
    const path = cyclePath(accountId, selfId, selfTitle, blocks, blockedBy);
    return path ? { ok: false, path } : { ok: true };
  },
};
