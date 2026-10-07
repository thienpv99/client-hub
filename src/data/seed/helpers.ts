// Small builders shared by every seed module. Everything is relative to `today` and deterministic
// (no Math.random / Date.now): ids are readable constants written by hand in each account file.

import type {
  Account,
  AccountPrice,
  Activity,
  ActivityAction,
  ActivityTargetType,
  AppNotification,
  Contact,
  Contract,
  FileItem,
  FileKind,
  ID,
  ISODate,
  ISODateTime,
  Milestone,
  NotificationKind,
  PaymentSchedule,
  Project,
  Quote,
  QuoteLine,
  Task,
  TaskComment,
  TaskDependency,
  TaskSide,
  TaskType,
  User,
  Visibility,
} from '@/domain/types';
import { addDays, minDate } from '@/domain/dates';
import { atTime } from '@/domain/clock';
import { sampleFileMeta } from '@/data/sampleFiles';

export interface SeedCtx {
  today: ISODate;
  /** calendar date today + n */
  d(n: number): ISODate;
  /** instant on day today + n at HH:mm (Vietnam wall time) */
  at(n: number, hhmm?: string): ISODateTime;
  /** 'dd/mm' of today + n — used inside impact texts */
  dm(n: number): string;
  /** 'YYYY' of today + n — used in document codes */
  y(n?: number): string;
}

export function makeCtx(today: ISODate): SeedCtx {
  const d = (n: number): ISODate => addDays(today, n);
  return {
    today,
    d,
    at: (n: number, hhmm = '09:00') => atTime(d(n), hhmm),
    dm: (n: number) => {
      const x = d(n);
      return `${x.slice(8, 10)}/${x.slice(5, 7)}`;
    },
    y: (n = 0) => d(n).slice(0, 4),
  };
}

/** Rows contributed by one seed module (one account, the catalogue, …). */
export interface Bundle {
  users: User[];
  accounts: Account[];
  contacts: Contact[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  task_dependencies: TaskDependency[];
  comments: TaskComment[];
  files: FileItem[];
  account_prices: AccountPrice[];
  quotes: Quote[];
  quote_lines: QuoteLine[];
  contracts: Contract[];
  payment_schedules: PaymentSchedule[];
  activities: Activity[];
  notifications: AppNotification[];
}

export function mergeBundles(parts: Partial<Bundle>[]): Bundle {
  const out: Bundle = {
    users: [],
    accounts: [],
    contacts: [],
    projects: [],
    milestones: [],
    tasks: [],
    task_dependencies: [],
    comments: [],
    files: [],
    account_prices: [],
    quotes: [],
    quote_lines: [],
    contracts: [],
    payment_schedules: [],
    activities: [],
    notifications: [],
  };
  for (const part of parts) {
    out.users.push(...(part.users ?? []));
    out.accounts.push(...(part.accounts ?? []));
    out.contacts.push(...(part.contacts ?? []));
    out.projects.push(...(part.projects ?? []));
    out.milestones.push(...(part.milestones ?? []));
    out.tasks.push(...(part.tasks ?? []));
    out.task_dependencies.push(...(part.task_dependencies ?? []));
    out.comments.push(...(part.comments ?? []));
    out.files.push(...(part.files ?? []));
    out.account_prices.push(...(part.account_prices ?? []));
    out.quotes.push(...(part.quotes ?? []));
    out.quote_lines.push(...(part.quote_lines ?? []));
    out.contracts.push(...(part.contracts ?? []));
    out.payment_schedules.push(...(part.payment_schedules ?? []));
    out.activities.push(...(part.activities ?? []));
    out.notifications.push(...(part.notifications ?? []));
  }
  return out;
}

function pick<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

function latest(values: (ISODateTime | null | undefined)[]): ISODateTime {
  let best = '';
  for (const v of values) if (v && v > best) best = v;
  return best;
}

// ───────────────────────────── Accounts & people ─────────────────────────────

export interface AccountSpec {
  id: ID;
  name: string;
  short_name: string;
  brand_color: string;
  industry: string;
  tier: Account['tier'];
  stage: Account['stage'];
  am_id: ID;
  email_domain: string;
  /** exactly 3 short lines */
  exec_summary: string[];
  exec_summary_updated_at: ISODateTime;
  internal_notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export function makeAccount(s: AccountSpec): Account {
  return {
    id: s.id,
    name: s.name,
    short_name: s.short_name,
    logo_url: null,
    brand_color: s.brand_color,
    industry: s.industry,
    tier: s.tier,
    stage: s.stage,
    am_id: s.am_id,
    health_override: null,
    health_override_reason: null,
    health_override_by: null,
    health_override_at: null,
    exec_summary: s.exec_summary.join('\n'),
    exec_summary_updated_at: s.exec_summary_updated_at,
    email_domain: s.email_domain,
    internal_notes: s.internal_notes,
    created_at: s.created_at,
    updated_at: s.updated_at,
    deleted_at: null,
  };
}

export function makeProject(
  id: ID,
  accountId: ID,
  name: string,
  code: string,
  start: ISODate,
  end: ISODate,
  status: Project['status'] = 'active',
): Project {
  return { id, account_id: accountId, name, code, start_date: start, end_date: end, status, deleted_at: null };
}

export interface UserSpec extends Partial<User> {
  id: ID;
  full_name: string;
  email: string;
  role: User['role'];
}

export function makeUser(s: UserSpec): User {
  const internal = s.role === 'director' || s.role === 'am' || s.role === 'member';
  const user: User = {
    id: s.id,
    full_name: s.full_name,
    email: s.email,
    phone: pick(s.phone, null),
    org_type: internal ? 'internal' : 'client',
    account_id: pick(s.account_id, null),
    role: s.role,
    can_view_cost: s.role === 'director' ? true : s.role === 'am' ? pick(s.can_view_cost, false) : false,
    title: pick(s.title, null),
    salutation: pick(s.salutation, null),
    avatar_url: null,
    notification_pref: pick(s.notification_pref, 'all'),
    onboarded_at: pick(s.onboarded_at, null),
    invited_at: pick(s.invited_at, null),
    invited_by: pick(s.invited_by, null),
    last_login_at: pick(s.last_login_at, null),
    status: pick(s.status, 'active'),
    deleted_at: null,
  };
  if (s.password !== undefined) user.password = s.password;
  return user;
}

export interface ContactSpec extends Partial<Contact> {
  id: ID;
  account_id: ID;
  full_name: string;
  salutation: Contact['salutation'];
  title: string;
  decision_role: Contact['decision_role'];
  email: string;
}

export function makeContact(s: ContactSpec): Contact {
  return {
    id: s.id,
    account_id: s.account_id,
    full_name: s.full_name,
    salutation: s.salutation,
    title: s.title,
    decision_role: s.decision_role,
    email: s.email,
    phone: pick(s.phone, null),
    user_id: pick(s.user_id, null),
    last_interaction_at: pick(s.last_interaction_at, null),
    last_interaction_note: pick(s.last_interaction_note, null),
    deleted_at: null,
  };
}

// ───────────────────────────── Delivery ─────────────────────────────

export interface MilestoneSpec {
  id: ID;
  name: string;
  /** planned date offset from today */
  planned: number;
  /** completion day offset (set = done) */
  done?: number;
  doneTime?: string;
  visible?: boolean;
  description?: string | null;
}

/** Milestones of one project in order; the first not-done one is 'in_progress'. */
export function makeMilestones(c: SeedCtx, projectId: ID, specs: MilestoneSpec[]): Milestone[] {
  let current = false;
  return specs.map((s, i) => {
    const done = s.done !== undefined;
    let status: Milestone['status'] = 'upcoming';
    if (done) status = 'done';
    else if (!current) {
      status = 'in_progress';
      current = true;
    }
    return {
      id: s.id,
      project_id: projectId,
      name: s.name,
      order_no: i + 1,
      planned_date: c.d(s.planned),
      forecast_override_date: null,
      forecast_override_reason: null,
      status,
      completed_at: s.done !== undefined ? c.at(s.done, s.doneTime ?? '17:00') : null,
      client_visible: s.visible ?? true,
      description: s.description ?? null,
      deleted_at: null,
    };
  });
}

export interface TaskSpec extends Partial<Task> {
  id: ID;
  project_id: ID;
  title: string;
  side: TaskSide;
  type: TaskType;
  due_date: ISODate;
}

/** Task factory with sensible defaults: waiting_on follows the state machine, done tasks finish on time. */
export function taskMaker(c: SeedCtx, createdBy: ID): (s: TaskSpec) => Task {
  return (s) => {
    const status = s.status ?? 'todo';
    const done = status === 'done';
    const doneDay = minDate(addDays(s.due_date, -1), c.d(-1));
    const completed_at = pick(s.completed_at, done ? atTime(doneDay, '16:30') : null);
    const defaultWaiting: Task['waiting_on'] = done ? null : s.side === 'internal' || status === 'waiting' ? 'internal' : 'client';
    const milestone_id = pick(s.milestone_id, null);
    const created_at = s.created_at ?? atTime(minDate(addDays(s.due_date, -21), c.d(-2)), '10:00');
    const task: Task = {
      id: s.id,
      project_id: s.project_id,
      milestone_id,
      title: s.title,
      description: s.description ?? '',
      side: s.side,
      type: s.type,
      assignee_id: pick(s.assignee_id, null),
      delegated_by: pick(s.delegated_by, null),
      delegated_at: pick(s.delegated_at, null),
      delegation_note: pick(s.delegation_note, null),
      requires_owner: s.requires_owner ?? false,
      waiting_on: pick(s.waiting_on, defaultWaiting),
      due_date: s.due_date,
      status,
      impact_text: s.impact_text ?? '',
      client_visible: s.client_visible ?? (s.side === 'client' ? true : milestone_id !== null),
      reminder_count: s.reminder_count ?? 0,
      last_reminded_at: pick(s.last_reminded_at, null),
      manual_unblock_reason: null,
      manual_unblocked_by: null,
      manual_unblocked_at: null,
      completed_at,
      quote_id: pick(s.quote_id, null),
      payment_schedule_id: pick(s.payment_schedule_id, null),
      revision: s.revision ?? 1,
      answer_text: pick(s.answer_text, null),
      created_by: s.created_by ?? createdBy,
      created_at,
      updated_at: '',
      deleted_at: null,
    };
    task.updated_at = s.updated_at ?? latest([created_at, completed_at, task.last_reminded_at, task.delegated_at]);
    return task;
  };
}

/** Dependency factory: `blocks` is either { task } or { milestone }. */
export function depMaker(c: SeedCtx, createdBy: ID): (id: ID, taskId: ID, blocks: { task?: ID; milestone?: ID }, createdOffset?: number) => TaskDependency {
  return (id, taskId, blocks, createdOffset = -20) => ({
    id,
    task_id: taskId,
    blocks_task_id: blocks.task ?? null,
    blocks_milestone_id: blocks.task ? null : blocks.milestone ?? null,
    created_by: createdBy,
    created_at: c.at(createdOffset, '10:15'),
  });
}

export function makeComment(
  id: ID,
  taskId: ID,
  authorId: ID,
  body: string,
  visibility: Visibility,
  createdAt: ISODateTime,
  replyToId: ID | null = null,
): TaskComment {
  return { id, task_id: taskId, author_id: authorId, body, visibility, reply_to_id: replyToId, created_at: createdAt, deleted_at: null };
}

// ───────────────────────────── Files ─────────────────────────────

export interface FileSpec {
  id: ID;
  account_id: ID;
  project_id?: ID | null;
  task_id?: ID | null;
  name: string;
  /** sample key → storage_path 'sample:<key>' */
  key: string;
  doc_key?: string;
  version?: number;
  visibility: Visibility;
  kind: FileKind;
  uploaded_by: ID;
  uploaded_at: ISODateTime;
  note?: string | null;
}

export function makeFile(s: FileSpec): FileItem {
  const meta = sampleFileMeta(s.key);
  return {
    id: s.id,
    account_id: s.account_id,
    project_id: s.project_id ?? null,
    task_id: s.task_id ?? null,
    name: s.name,
    doc_key: s.doc_key ?? s.key,
    version: s.version ?? 1,
    mime: meta ? meta.mime : 'application/octet-stream',
    size: meta ? meta.size : 0,
    storage_path: `sample:${s.key}`,
    visibility: s.visibility,
    kind: s.kind,
    uploaded_by: s.uploaded_by,
    uploaded_at: s.uploaded_at,
    note: s.note ?? null,
    deleted_at: null,
  };
}

// ───────────────────────────── Log & messaging ─────────────────────────────

export interface ActivitySpec {
  id: ID;
  account_id: ID | null;
  actor_id: ID | null;
  action: ActivityAction;
  target_type: ActivityTargetType;
  target_id: ID;
  params?: Record<string, string | number>;
  visibility: Visibility;
  at: ISODateTime;
}

export function makeActivity(s: ActivitySpec): Activity {
  return {
    id: s.id,
    account_id: s.account_id,
    actor_id: s.actor_id,
    action: s.action,
    target_type: s.target_type,
    target_id: s.target_id,
    params: s.params ?? {},
    visibility: s.visibility,
    created_at: s.at,
  };
}

/** Positional activity factory bound to one account. */
export function activityMaker(
  accountId: ID,
): (
  id: ID,
  actorId: ID | null,
  action: ActivityAction,
  targetType: ActivityTargetType,
  targetId: ID,
  params: Record<string, string | number>,
  visibility: Visibility,
  at: ISODateTime,
) => Activity {
  return (id, actorId, action, targetType, targetId, params, visibility, at) =>
    makeActivity({ id, account_id: accountId, actor_id: actorId, action, target_type: targetType, target_id: targetId, params, visibility, at });
}

export interface NotificationSpec {
  id: ID;
  user_id: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  account_id: ID | null;
  task_id?: ID | null;
  urgent?: boolean;
  read_at?: ISODateTime | null;
  at: ISODateTime;
  dedupe_key?: string | null;
}

export function makeNotification(s: NotificationSpec): AppNotification {
  return {
    id: s.id,
    user_id: s.user_id,
    kind: s.kind,
    title: s.title,
    body: s.body,
    link: s.link,
    account_id: s.account_id,
    task_id: s.task_id ?? null,
    urgent: s.urgent ?? false,
    read_at: s.read_at ?? null,
    created_at: s.at,
    dedupe_key: s.dedupe_key ?? null,
  };
}

/** Deep links per ARCHITECTURE §8. */
export const links = {
  portalTask: (taskId: ID): string => `/portal/tasks/${taskId}`,
  appTask: (accountId: ID, taskId: ID): string => `/app/accounts/${accountId}/tasks?task=${taskId}`,
  appQuote: (quoteId: ID): string => `/app/commercial/quotes/${quoteId}`,
  portalQuote: (quoteId: ID): string => `/portal/commercial/quotes/${quoteId}`,
};
