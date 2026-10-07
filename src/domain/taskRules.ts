// Task rules: due state, client ordering, client actions and the waiting_on state machine (SPEC §3).
import type { ClientTaskType, ISODate, ISODateTime, Task, TaskStatus } from './types';
import type { DueInfo, TaskActionKind, TaskView } from '@/services/contract';
import { diffDays } from './dates';

/** Days before the due date that count as "sắp đến hạn" (inclusive). */
export const DUE_SOON_DAYS = 3;

/**
 * days_left = due − today. Overdue once today > due (after 23:59 of the due day) and not done.
 * due_soon: not done, not overdue and 0 ≤ days_left ≤ 3. Done tasks are never overdue / due soon.
 */
export function dueInfo(dueDate: ISODate, done: boolean, today: ISODate): DueInfo {
  const daysLeft = diffDays(dueDate, today);
  const overdue = !done && today > dueDate;
  return {
    due_date: dueDate,
    days_left: daysLeft,
    overdue,
    overdue_days: overdue ? Math.max(0, -daysLeft) : 0,
    due_soon: !done && !overdue && daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS,
  };
}

/** 1 overdue & blocking a milestone · 2 due soon & blocking · 3 other overdue · 4 everything else */
export function priorityRank(x: { due: DueInfo; is_blocking_milestone: boolean }): 1 | 2 | 3 | 4 {
  if (x.due.overdue && x.is_blocking_milestone) return 1;
  if (x.due.due_soon && x.is_blocking_milestone) return 2;
  if (x.due.overdue) return 3;
  return 4;
}

/** Client ordering: priority rank, then nearest due date, then title (Vietnamese collation). */
export function compareClientTasks(a: TaskView, b: TaskView): number {
  if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
  if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  const byTitle = a.title.localeCompare(b.title, 'vi');
  if (byTitle !== 0) return byTitle;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function actionForType(type: ClientTaskType): TaskActionKind {
  switch (type) {
    case 'approval':
      return 'approve';
    case 'upload':
      return 'upload';
    case 'confirm':
      return 'confirm';
    case 'sign':
      return 'sign';
    case 'payment':
      return 'payment';
    case 'attend':
      return 'attend';
    case 'answer':
      return 'answer';
    default: {
      const never: never = type;
      return never;
    }
  }
}

export type ClientAction = 'approve' | 'request_changes' | 'submit_files' | 'report_payment' | 'confirm' | 'answer';

/** Which client task types accept which action. */
function actionFitsType(task: Task, action: ClientAction): boolean {
  switch (action) {
    case 'approve':
    case 'request_changes':
      return task.type === 'approval';
    case 'submit_files':
      return task.type === 'upload' || task.type === 'sign';
    case 'report_payment':
      return task.type === 'payment';
    case 'confirm':
      return task.type === 'confirm' || task.type === 'attend';
    case 'answer':
      return task.type === 'answer';
    default: {
      const never: never = action;
      return never;
    }
  }
}

/**
 * The client may act only on an open client task that is waiting on the client and whose type fits the action.
 * (Being blocked by another task and the viewer's role are checked by the caller.)
 */
export function clientActionAllowed(task: Task, action: ClientAction): boolean {
  if (task.deleted_at) return false;
  if (task.side !== 'client') return false;
  if (task.status === 'done') return false;
  if (task.waiting_on !== 'client') return false;
  return actionFitsType(task, action);
}

/**
 * approve / confirm (+attend) / answer → done, waiting_on null, completed_at = at.
 * request_changes / submit_files (upload, sign) / report_payment → status 'waiting', waiting_on 'internal'.
 * (answer_text, files, notes are stored by the caller.)
 */
export function clientActionPatch(task: Task, action: ClientAction, at: ISODateTime): Partial<Task> {
  void task;
  switch (action) {
    case 'approve':
    case 'confirm':
    case 'answer':
      return { status: 'done', waiting_on: null, completed_at: at, updated_at: at };
    case 'request_changes':
    case 'submit_files':
    case 'report_payment':
      return { status: 'waiting', waiting_on: 'internal', completed_at: null, updated_at: at };
    default: {
      const never: never = action;
      return never;
    }
  }
}

/**
 * New Era checks what the client sent.
 * accept → done; return (new version / redo) → back to the client: todo, waiting_on client, revision + 1.
 */
export function reviewPatch(task: Task, decision: 'accept' | 'return', at: ISODateTime): Partial<Task> {
  if (decision === 'accept') {
    return { status: 'done', waiting_on: null, completed_at: at, updated_at: at };
  }
  return { status: 'todo', waiting_on: 'client', completed_at: null, revision: task.revision + 1, updated_at: at };
}

/**
 * Staff moving a task between Kanban columns.
 * - same column → ok (no-op);
 * - client tasks may only be moved to 'todo' or 'done' ('invalid' otherwise);
 * - a blocked task can only stay in / go back to 'todo' ('blocked').
 */
export function canMoveTo(
  task: Task,
  to: TaskStatus,
  blocked: boolean,
): { ok: true } | { ok: false; reason: 'blocked' | 'invalid' } {
  if (to === task.status) return { ok: true };
  if (task.side === 'client' && to !== 'todo' && to !== 'done') return { ok: false, reason: 'invalid' };
  if (blocked && to !== 'todo') return { ok: false, reason: 'blocked' };
  return { ok: true };
}

/**
 * Status change by staff, keeping completed_at and waiting_on consistent:
 * - done → completed_at set (kept when already done), waiting_on null;
 * - not done → completed_at null; internal tasks wait on 'internal';
 *   client tasks: todo → 'client', waiting → 'internal', in_progress → unchanged (default 'client').
 */
export function statusPatch(task: Task, to: TaskStatus, at: ISODateTime): Partial<Task> {
  if (to === 'done') {
    const completed = task.status === 'done' && task.completed_at ? task.completed_at : at;
    return { status: 'done', waiting_on: null, completed_at: completed, updated_at: at };
  }
  if (task.side === 'internal') {
    return { status: to, waiting_on: 'internal', completed_at: null, updated_at: at };
  }
  switch (to) {
    case 'todo':
      return { status: 'todo', waiting_on: 'client', completed_at: null, updated_at: at };
    case 'waiting':
      return { status: 'waiting', waiting_on: 'internal', completed_at: null, updated_at: at };
    case 'in_progress':
      return { status: 'in_progress', waiting_on: task.waiting_on ?? 'client', completed_at: null, updated_at: at };
    default: {
      const never: never = to;
      return never;
    }
  }
}
