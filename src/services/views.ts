// Viewer-aware DTO builders (ARCHITECTURE §8). Every task / milestone / project / account / file / comment /
// activity DTO the api returns is built here (commercial DTOs in commercialViews.ts), already filtered for the
// viewer. sanitize.ts runs afterwards as defence in depth only.

import type {
  Account,
  Activity,
  Contact,
  FileItem,
  Health,
  ID,
  ISODate,
  Milestone,
  PaymentSchedule,
  Project,
  Task,
  TaskComment,
  User,
} from '@/domain/types';
import type {
  AccountDetail,
  AccountRef,
  AccountSummary,
  ActivityView,
  BlockerRef,
  ChainNode,
  CommentView,
  ContactView,
  FileView,
  HealthInfo,
  HealthReason,
  MilestoneRef,
  MilestoneView,
  ProjectView,
  TaskActionKind,
  TaskDetail,
  TaskPermissions,
  TaskView,
  UserRef,
  Viewer,
  WaitingCounts,
} from '@/services/contract';
import { todayISO } from '@/domain/clock';
import { isOverdue } from '@/domain/dates';
import { buildAccountGraph, launchMilestone, type AccountGraph, type ForecastInfo } from '@/domain/graph';
import { computeHealth, type Headline } from '@/domain/health';
import { actionForType, dueInfo, priorityRank } from '@/domain/taskRules';
import { sampleFileUrl } from '@/data/sampleFiles';
import { hasKey, t } from '@/i18n';
import { accountMoney, canAccessCommercial, commercialSummary } from '@/services/commercialViews';
import { accessibleAccountIds, isManagerOf, toUserRef } from '@/services/context';
import { db } from '@/services/db';

// ───────────────────────────── caches (per db.version) ─────────────────────────────

let cacheKey = '';
let generation = 0;
let loaded = false;
const projectAccount = new Map<ID, ID>();
const projectsByAccount = new Map<ID, Project[]>();
const milestonesByProject = new Map<ID, Milestone[]>();
const tasksByAccount = new Map<ID, Task[]>();
const graphs = new Map<ID, AccountGraph>();
const healths = new Map<ID, { auto: Health; reasons: HealthReason[] }>();
const access = new Map<string, Set<ID>>();

function fresh(): void {
  const key = `${db.version}|${generation}|${todayISO()}`;
  if (key === cacheKey) return;
  cacheKey = key;
  loaded = false;
  projectAccount.clear();
  projectsByAccount.clear();
  milestonesByProject.clear();
  tasksByAccount.clear();
  graphs.clear();
  healths.clear();
  access.clear();
}

function load(): void {
  fresh();
  if (loaded) return;
  loaded = true;
  for (const p of db.rows('projects')) {
    projectAccount.set(p.id, p.account_id);
    const list = projectsByAccount.get(p.account_id);
    if (list) list.push(p);
    else projectsByAccount.set(p.account_id, [p]);
  }
  for (const list of projectsByAccount.values()) {
    list.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.name.localeCompare(b.name, 'vi'));
  }
  for (const m of db.rows('milestones')) {
    if (!projectAccount.has(m.project_id)) continue;
    const list = milestonesByProject.get(m.project_id);
    if (list) list.push(m);
    else milestonesByProject.set(m.project_id, [m]);
  }
  for (const list of milestonesByProject.values()) list.sort((a, b) => a.order_no - b.order_no);
}

/**
 * Drop memoized graphs/health. db.version only moves when a batch commits, so service code that
 * mutates inside a batch and then reads views again (in the same batch) must call this first.
 */
export function invalidateViewCache(): void {
  generation += 1;
}

export function accountIdOfProject(projectId: ID): ID | null {
  load();
  return projectAccount.get(projectId) ?? null;
}

/** live projects of an account, oldest first */
export function accountProjects(accountId: ID): Project[] {
  load();
  return projectsByAccount.get(accountId) ?? [];
}

/** live milestones of a project in order_no */
export function projectMilestones(projectId: ID): Milestone[] {
  load();
  return milestonesByProject.get(projectId) ?? [];
}

export function accountMilestones(accountId: ID): Milestone[] {
  return accountProjects(accountId).flatMap((p) => projectMilestones(p.id));
}

/** live tasks of an account (all projects, all statuses) */
export function accountTasks(accountId: ID): Task[] {
  load();
  let list = tasksByAccount.get(accountId);
  if (!list) {
    const projectIds = new Set(accountProjects(accountId).map((p) => p.id));
    list = db.rows('tasks').filter((x) => projectIds.has(x.project_id));
    tasksByAccount.set(accountId, list);
  }
  return list;
}

export function accountPayments(accountId: ID): PaymentSchedule[] {
  const contractIds = new Set(db.rows('contracts').filter((c) => c.account_id === accountId).map((c) => c.id));
  return db.rows('payment_schedules').filter((p) => contractIds.has(p.contract_id));
}

/** memoized accessibleAccountIds */
export function accessibleIds(v: Viewer): Set<ID> {
  fresh();
  const key = `${v.org_type}|${v.role}|${v.user.id}|${v.account_id ?? ''}`;
  let ids = access.get(key);
  if (!ids) {
    ids = accessibleAccountIds(v);
    access.set(key, ids);
  }
  return ids;
}

export function graphForAccount(accountId: ID): AccountGraph {
  load();
  let g = graphs.get(accountId);
  if (!g) {
    const tasks = accountTasks(accountId);
    const milestones = accountMilestones(accountId);
    const taskIds = new Set(tasks.map((x) => x.id));
    const milestoneIds = new Set(milestones.map((m) => m.id));
    const deps = db
      .rows('task_dependencies')
      .filter(
        (d) =>
          taskIds.has(d.task_id) &&
          ((d.blocks_task_id !== null && taskIds.has(d.blocks_task_id)) ||
            (d.blocks_milestone_id !== null && milestoneIds.has(d.blocks_milestone_id))),
      );
    g = buildAccountGraph({ tasks, deps, milestones, today: todayISO() });
    graphs.set(accountId, g);
  }
  return g;
}

function rawHealth(accountId: ID): { auto: Health; reasons: HealthReason[] } {
  load();
  let h = healths.get(accountId);
  if (!h) {
    h = computeHealth(graphForAccount(accountId), accountTasks(accountId), accountPayments(accountId), todayISO());
    healths.set(accountId, h);
  }
  return h;
}

// ───────────────────────────── small helpers ─────────────────────────────

export const isClientViewer = (v: Viewer): boolean => v.org_type === 'client';

export function nonNull<T>(x: T | null | undefined): x is T {
  return x !== null && x !== undefined;
}

export const newestFirst = (a: { created_at: string }, b: { created_at: string }): number =>
  b.created_at.localeCompare(a.created_at);

/** readable list of changed field keys for activity params ('stage, tier' → 'giai đoạn, hạng') */
export function fieldLabels(keys: string[]): string {
  return keys.map((k) => (hasKey(`activity.field.${k}`) ? t(`activity.field.${k}`) : k)).join(', ');
}

export function milestoneVisible(m: Milestone, v: Viewer): boolean {
  return !isClientViewer(v) || m.client_visible;
}

function forecastOf(m: Milestone): ForecastInfo {
  const fallback: ForecastInfo = {
    milestone_id: m.id,
    planned_date: m.planned_date,
    forecast_date: m.planned_date,
    delay_days: 0,
    source: m.status === 'done' ? 'done' : 'on_plan',
    cause_task_id: null,
    cause_delay_days: 0,
    cascade_from_milestone_id: null,
    override_reason: null,
  };
  const accountId = accountIdOfProject(m.project_id);
  if (!accountId) return fallback;
  try {
    return graphForAccount(accountId).forecast(m.id);
  } catch (err) {
    console.error('[views] forecast failed', m.id, err);
    return fallback;
  }
}

// ───────────────────────────── refs ─────────────────────────────

export function accountRef(a: Account): AccountRef {
  return { id: a.id, name: a.name, short_name: a.short_name, logo_url: a.logo_url, brand_color: a.brand_color };
}

function accountRefById(id: ID): AccountRef {
  const a = db.find('accounts', id);
  return a ? accountRef(a) : { id, name: '', short_name: '', logo_url: null, brand_color: '#64748B' };
}

export function userRefById(id: ID | null | undefined): UserRef | null {
  if (!id) return null;
  const u = db.find('users', id);
  return u ? toUserRef(u) : null;
}

/** never null: falls back to soft-deleted users, then to a neutral placeholder */
export function userRefAny(id: ID): UserRef {
  const u: User | undefined = db.find('users', id) ?? db.allRows('users').find((x) => x.id === id);
  if (u) return toUserRef(u);
  return {
    id,
    full_name: t('activity.unknown_user'),
    title: null,
    salutation: null,
    org_type: 'internal',
    role: 'member',
    avatar_url: null,
    email: '',
    phone: null,
  };
}

export function milestoneRef(m: Milestone): MilestoneRef {
  const f = forecastOf(m);
  return {
    id: m.id,
    name: m.name,
    project_id: m.project_id,
    planned_date: m.planned_date,
    forecast_date: f.forecast_date,
    status: m.status,
  };
}

// ───────────────────────────── milestones & projects ─────────────────────────────

export function milestoneView(m: Milestone, v: Viewer): MilestoneView {
  const f = forecastOf(m);
  let cause: MilestoneView['cause'] = null;
  if (f.cause_task_id) {
    const ct = db.find('tasks', f.cause_task_id);
    if (ct) {
      cause = {
        task_id: ct.id,
        task_title: canViewTask(ct, v) ? ct.title : null,
        side: ct.side,
        waiting_on: ct.waiting_on,
        delay_days: f.cause_delay_days,
      };
    }
  }
  let cascade_from: MilestoneView['cascade_from'] = null;
  if (f.cascade_from_milestone_id) {
    const cm = db.find('milestones', f.cascade_from_milestone_id);
    if (cm && milestoneVisible(cm, v)) cascade_from = { milestone_id: cm.id, milestone_name: cm.name };
  }
  const accountId = accountIdOfProject(m.project_id);
  const tasks = accountId ? accountTasks(accountId).filter((x) => x.milestone_id === m.id && canViewTask(x, v)) : [];
  const done = tasks.filter((x) => x.status === 'done').length;
  return {
    id: m.id,
    project_id: m.project_id,
    name: m.name,
    order_no: m.order_no,
    status: m.status,
    planned_date: m.planned_date,
    forecast_date: f.forecast_date,
    delay_days: f.delay_days,
    forecast_source: f.source,
    cause,
    cascade_from,
    // SPEC 5.4: clients see "lý do nếu lùi", including the AM's reason for a manual forecast
    // (only the account HEALTH override reason is internal — see healthFor + sanitize)
    override_reason: f.source === 'manual' ? f.override_reason ?? m.forecast_override_reason ?? null : null,
    client_visible: m.client_visible,
    completed_at: m.completed_at,
    description: m.description,
    open_task_count: tasks.length - done,
    done_task_count: done,
  };
}

export function projectView(p: Project, v: Viewer): ProjectView {
  const milestones = projectMilestones(p.id)
    .filter((m) => milestoneVisible(m, v))
    .map((m) => milestoneView(m, v));
  const current = milestones.find((m) => m.status !== 'done') ?? null;
  const done = milestones.filter((m) => m.status === 'done').length;
  return {
    id: p.id,
    account_id: p.account_id,
    name: p.name,
    code: p.code,
    start_date: p.start_date,
    end_date: p.end_date,
    status: p.status,
    milestones,
    current_milestone_id: current ? current.id : null,
    next_milestone: current,
    final_milestone: milestones.length ? milestones[milestones.length - 1] : null,
    progress_pct: milestones.length ? Math.round((done * 100) / milestones.length) : 0,
  };
}

/**
 * Milestone named in a headline ("Mốc Go-live đang chờ…"): the project's launch milestone (Go-live, else the final
 * not-done milestone, as seen by the viewer) when the delay reaches it, else the milestone itself.
 */
export function headlineFor(milestoneId: ID, v: Viewer): Headline {
  const m = db.find('milestones', milestoneId);
  if (!m) return { name: '', delay_days: 0, id: milestoneId };
  const own = forecastOf(m);
  const open = projectMilestones(m.project_id).filter((x) => x.status !== 'done' && milestoneVisible(x, v));
  const final = launchMilestone(open);
  if (final && final.id !== m.id && final.order_no > m.order_no) {
    const ff = forecastOf(final);
    if (ff.delay_days > 0) return { name: final.name, delay_days: ff.delay_days, id: final.id };
  }
  return { name: m.name, delay_days: own.delay_days, id: m.id };
}

// ───────────────────────────── tasks ─────────────────────────────

/** quote-approval and payment tasks carry commercial content (SPEC §2: a client_member has no "Thương mại") */
export function isCommercialTask(task: Task): boolean {
  return task.quote_id !== null || task.payment_schedule_id !== null || task.type === 'payment';
}

/**
 * Client rule of a task of the viewer's own company, regardless of deletion: client tasks always, New Era tasks only
 * when client_visible; a client_member does not see commercial tasks unless they are assigned to them.
 */
function clientMayKnowTask(task: Task, v: Viewer): boolean {
  if (task.side !== 'client' && !task.client_visible) return false;
  if (v.role === 'client_member' && isCommercialTask(task) && task.assignee_id !== v.user.id) return false;
  return true;
}

export function canViewTask(task: Task, v: Viewer): boolean {
  if (task.deleted_at) return false;
  const accountId = accountIdOfProject(task.project_id);
  if (!accountId || !accessibleIds(v).has(accountId)) return false;
  if (isClientViewer(v)) return clientMayKnowTask(task, v);
  return true;
}

/**
 * Stored text about a task (bell item, email) is shown to a client only while the task itself would be: hiding a
 * task later (client_visible off) also hides what was sent about it. Deleted tasks keep their history.
 */
export function taskMentionVisible(taskId: ID, v: Viewer): boolean {
  if (!isClientViewer(v)) return true;
  const task = db.allRows('tasks').find((x) => x.id === taskId);
  if (!task) return true;
  const project = db.allRows('projects').find((p) => p.id === task.project_id);
  if (!project || project.account_id !== v.account_id) return false;
  return clientMayKnowTask(task, v);
}

/**
 * The client viewer is the person expected to act on this task now (SPEC §2, §5.3).
 * Ignores read-only mode and blocking (callers check those) so "Xem như khách hàng" lists the same tasks.
 */
export function clientShouldAct(task: Task, v: Viewer): boolean {
  if (v.org_type !== 'client' || task.side !== 'client' || task.type === 'work') return false;
  if (task.status === 'done' || task.waiting_on !== 'client') return false;
  const me = v.user.id;
  const owner = v.role === 'client_owner';
  if (task.requires_owner) return owner && (task.assignee_id === null || task.assignee_id === me);
  if (owner) return task.assignee_id === null || task.assignee_id === me;
  return task.assignee_id === me;
}

const NO_PERMISSIONS: TaskPermissions = {
  act: false,
  delegate: false,
  ask: false,
  change_status: false,
  unblock: false,
  remind: false,
  edit: false,
  review: false,
  comment_internal: false,
  comment_shared: false,
};

export function taskPermissions(task: Task, v: Viewer, blocked: boolean): TaskPermissions {
  if (v.read_only) return { ...NO_PERMISSIONS };
  const open = task.status !== 'done';
  const me = v.user.id;
  if (isClientViewer(v)) {
    const owner = v.role === 'client_owner';
    const involved = owner || task.assignee_id === me;
    return {
      ...NO_PERMISSIONS,
      act: !blocked && clientShouldAct(task, v),
      delegate:
        owner &&
        !blocked &&
        task.side === 'client' &&
        open &&
        task.waiting_on === 'client' &&
        !task.requires_owner &&
        (task.assignee_id === null || task.assignee_id === me || task.delegated_by === me),
      ask: open && involved,
      comment_shared: involved,
    };
  }
  const accountId = accountIdOfProject(task.project_id);
  const manager = accountId !== null && isManagerOf(v, accountId);
  const ownInternal = task.side === 'internal' && task.assignee_id === me;
  return {
    ...NO_PERMISSIONS,
    change_status: manager || ownInternal,
    unblock: manager && blocked,
    // same rule as remindClient / getZaloReminder: a blocked task cannot be handled yet, so it is not chased
    remind: manager && task.side === 'client' && open && task.waiting_on === 'client' && !blocked,
    edit: manager,
    review: manager && task.side === 'client' && open && task.waiting_on === 'internal',
    comment_internal: true,
    comment_shared: manager || task.assignee_id === me,
  };
}

function primaryAction(task: Task, v: Viewer, can: TaskPermissions, blocked: boolean): TaskActionKind | null {
  if (isClientViewer(v)) {
    if (!can.act || task.type === 'work') return null;
    return actionForType(task.type);
  }
  if (task.status === 'done') return null;
  if (task.side === 'client') return can.review ? 'review_submission' : null;
  if (!can.change_status) return null;
  if (task.status === 'todo') return blocked ? null : 'start';
  return 'complete';
}

function blockerRef(b: Task, v: Viewer, today: ISODate): BlockerRef {
  const visible = canViewTask(b, v);
  return {
    id: b.id,
    title: visible ? b.title : null,
    side: b.side,
    status: b.status,
    assignee: visible ? userRefById(b.assignee_id) : null,
    due: dueInfo(b.due_date, b.status === 'done', today),
  };
}

/** Caller must have checked canViewTask(task, v). */
export function taskView(task: Task, v: Viewer): TaskView {
  const today = todayISO();
  const client = isClientViewer(v);
  const accountId = accountIdOfProject(task.project_id) ?? '';
  const g = graphForAccount(accountId);
  const project = db.find('projects', task.project_id);
  const done = task.status === 'done';
  const due = dueInfo(task.due_date, done, today);
  const blocked = !done && g.isBlocked(task.id);
  const held = done ? [] : g.milestonesHeldBy(task.id).filter((m) => milestoneVisible(m, v));
  const isBlockingMilestone = held.length > 0;
  const ms = task.milestone_id ? db.find('milestones', task.milestone_id) : undefined;
  const milestone = ms && milestoneVisible(ms, v) ? ms : undefined;
  const can = taskPermissions(task, v, blocked);

  const view: TaskView = {
    id: task.id,
    project_id: task.project_id,
    milestone_id: milestone ? milestone.id : client ? null : task.milestone_id,
    title: task.title,
    description: task.description,
    side: task.side,
    type: task.type,
    status: task.status,
    waiting_on: task.waiting_on,
    due_date: task.due_date,
    impact_text: task.impact_text,
    // client tasks are always visible to their company
    client_visible: task.side === 'client' ? true : task.client_visible,
    requires_owner: task.requires_owner,
    reminder_count: task.reminder_count,
    last_reminded_at: task.last_reminded_at,
    completed_at: task.completed_at,
    revision: task.revision,
    answer_text: task.answer_text,
    quote_id: task.quote_id,
    payment_schedule_id: task.payment_schedule_id,
    created_at: task.created_at,
    updated_at: task.updated_at,

    account: accountRefById(accountId),
    project: { id: task.project_id, name: project ? project.name : '' },
    milestone: milestone ? milestoneRef(milestone) : null,
    assignee: userRefById(task.assignee_id),
    delegated_by: userRefById(task.delegated_by),
    delegated_at: task.delegated_at,
    delegation_note: task.delegation_note,

    due,
    blocked,
    blocked_by: blocked ? g.blockersOf(task.id).map((b) => blockerRef(b, v, today)) : [],
    blocks_tasks: g.blocksTasks(task.id).map((b) => ({ id: b.id, title: canViewTask(b, v) ? b.title : null, side: b.side })),
    blocks_milestones: held.map(milestoneRef),
    is_blocking_milestone: isBlockingMilestone,
    priority_rank: priorityRank({ due, is_blocking_milestone: isBlockingMilestone }),
    primary_action: primaryAction(task, v, can, blocked),
    can,
  };
  if (!client) {
    view.manual_unblock_reason = task.manual_unblock_reason;
    view.manual_unblocked_by = userRefById(task.manual_unblocked_by);
  }
  return view;
}

function chainFor(task: Task, v: Viewer): ChainNode[] {
  const accountId = accountIdOfProject(task.project_id);
  if (!accountId) return [];
  const g = graphForAccount(accountId);
  let raw: ReturnType<AccountGraph['chain']> = [];
  try {
    // clients: the chain never runs through (or ends on) a milestone hidden from them
    raw = g.chain(task.id, isClientViewer(v) ? (m: Milestone) => milestoneVisible(m, v) : undefined);
  } catch (err) {
    console.error('[views] chain failed', task.id, err);
  }
  const nodes: ChainNode[] = [];
  for (const n of raw) {
    if (n.kind === 'task') {
      const x = g.task(n.id);
      nodes.push({ kind: 'task', id: n.id, label: x && canViewTask(x, v) ? x.title : null, state: n.state, side: x ? x.side : undefined });
      continue;
    }
    const m = g.milestone(n.id);
    // defence in depth: a hidden milestone is dropped, never sent with its id and dates
    if (!m || !milestoneVisible(m, v)) continue;
    nodes.push({
      kind: 'milestone',
      id: n.id,
      label: m.name,
      state: n.state,
      forecast_date: forecastOf(m).forecast_date,
      planned_date: m.planned_date,
    });
  }
  return nodes;
}

/** Raw dependency ids of a task (live tasks only). */
export function taskDependencies(taskId: ID): TaskDetail['dependencies'] {
  const deps = db.rows('task_dependencies');
  const live = (id: ID | null): id is ID => id !== null && !!db.find('tasks', id);
  return {
    blocks_task_ids: deps.filter((d) => d.task_id === taskId).map((d) => d.blocks_task_id).filter(live),
    blocks_milestone_ids: deps
      .filter((d) => d.task_id === taskId)
      .map((d) => d.blocks_milestone_id)
      .filter((id): id is ID => id !== null && !!db.find('milestones', id)),
    blocked_by_task_ids: deps.filter((d) => d.blocks_task_id === taskId).map((d) => d.task_id).filter(live),
  };
}

export function taskDetail(task: Task, v: Viewer): TaskDetail {
  const comments = db
    .rows('comments')
    .filter((c) => c.task_id === task.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((c) => commentView(c, v))
    .filter(nonNull);
  const files = groupFileVersions(
    db.rows('files').filter((f) => f.task_id === task.id),
    v,
  );
  const history = db
    .rows('activities')
    .filter((a) => (a.target_type === 'task' && a.target_id === task.id) || a.params.task_id === task.id)
    .sort(newestFirst)
    .map((a) => activityView(a, v))
    .filter(nonNull);
  return {
    ...taskView(task, v),
    comments,
    files,
    history,
    chain: chainFor(task, v),
    // raw ids are for the internal edit form only; clients get the readable blocked_by / blocks_* lists instead
    dependencies: isClientViewer(v)
      ? { blocks_task_ids: [], blocks_milestone_ids: [], blocked_by_task_ids: [] }
      : taskDependencies(task.id),
  };
}

// ───────────────────────────── health & counters ─────────────────────────────

function reasonVisible(r: HealthReason, v: Viewer): boolean {
  if (!isClientViewer(v)) return true;
  if (r.kind === 'overdue_payment') return v.role === 'client_owner';
  const task = db.find('tasks', r.task_id);
  if (!task || !canViewTask(task, v)) return false;
  if (r.kind === 'overdue_blocking' || r.kind === 'due_soon_blocking') {
    const m = db.find('milestones', r.milestone_id);
    return !!m && m.client_visible;
  }
  return true;
}

export function healthFor(accountId: ID, v: Viewer, opts: { projectId?: ID } = {}): HealthInfo {
  const account = db.find('accounts', accountId);
  const raw = rawHealth(accountId);
  let auto = raw.auto;
  let visible = raw.reasons.filter((r) => reasonVisible(r, v));
  const projectId = opts.projectId;
  if (projectId) {
    // project scope (portal project selector): the colour follows that project's own reasons (same rules as
    // computeHealth), so an on-plan project is not painted red by another project of the account
    const inProject = (r: HealthReason): boolean => r.kind === 'overdue_payment' || db.find('tasks', r.task_id)?.project_id === projectId;
    const scoped = raw.reasons.filter(inProject);
    auto = scoped.some((r) => r.kind === 'overdue_blocking') ? 'blocked' : scoped.length > 0 ? 'attention' : 'on_track';
    visible = visible.filter(inProject);
  }
  const override = account ? account.health_override : null;
  const info: HealthInfo = {
    value: override ?? auto,
    auto,
    overridden: override !== null,
    reasons: visible,
  };
  if (!isClientViewer(v)) info.override_reason = account ? account.health_override_reason : null;
  return info;
}

/** "Đang chờ khách / Đang chờ New Era": open, not blocked tasks by waiting_on (clients: visible tasks only). */
export function countsFor(accountId: ID, v: Viewer, opts: { projectId?: ID } = {}): WaitingCounts {
  const today = todayISO();
  const g = graphForAccount(accountId);
  const counts: WaitingCounts = { waiting_client: 0, waiting_internal: 0, overdue_client: 0, overdue_internal: 0 };
  for (const task of accountTasks(accountId)) {
    if (task.status === 'done' || task.waiting_on === null) continue;
    if (opts.projectId && task.project_id !== opts.projectId) continue;
    if (isClientViewer(v) && !canViewTask(task, v)) continue;
    if (g.isBlocked(task.id)) continue;
    const overdue = isOverdue(task.due_date, today);
    if (task.waiting_on === 'client') {
      counts.waiting_client += 1;
      if (overdue) counts.overdue_client += 1;
    } else {
      counts.waiting_internal += 1;
      if (overdue) counts.overdue_internal += 1;
    }
  }
  return counts;
}

// ───────────────────────────── accounts ─────────────────────────────

const ZERO_MONEY = { contract_value: 0, invoiced: 0, collected: 0, receivable: 0, receivable_overdue: 0 };

function nextMilestoneOf(accountId: ID, v: Viewer): AccountSummary['next_milestone'] {
  let best: { m: Milestone; project: Project; forecast: ISODate } | null = null;
  for (const project of accountProjects(accountId)) {
    for (const m of projectMilestones(project.id)) {
      if (m.status === 'done' || !milestoneVisible(m, v)) continue;
      const forecast = forecastOf(m).forecast_date;
      if (!best || forecast < best.forecast) best = { m, project, forecast };
    }
  }
  return best ? { ...milestoneView(best.m, v), project_name: best.project.name } : null;
}

function lastActivityAt(accountId: ID, v: Viewer): string | null {
  let last: string | null = null;
  for (const a of db.rows('activities')) {
    if (a.account_id !== accountId) continue;
    if (last !== null && a.created_at <= last) continue;
    if (activityVisible(a, v)) last = a.created_at;
  }
  return last;
}

export function accountSummary(a: Account, v: Viewer): AccountSummary {
  const money = canAccessCommercial(v) ? accountMoney(a.id) : ZERO_MONEY;
  return {
    ...accountRef(a),
    industry: a.industry,
    tier: a.tier,
    stage: a.stage,
    email_domain: a.email_domain,
    am: userRefAny(a.am_id),
    health: healthFor(a.id, v),
    next_milestone: nextMilestoneOf(a.id, v),
    counts: countsFor(a.id, v),
    contract_value: money.contract_value,
    receivable: money.receivable,
    receivable_overdue: money.receivable_overdue,
    last_activity_at: lastActivityAt(a.id, v),
    updated_at: a.updated_at,
  };
}

const DECISION_ORDER: Record<Contact['decision_role'], number> = { decision_maker: 0, approver: 1, ops_contact: 2 };

export function compareContacts(a: ContactView, b: ContactView): number {
  return DECISION_ORDER[a.decision_role] - DECISION_ORDER[b.decision_role] || a.full_name.localeCompare(b.full_name, 'vi');
}

export function contactView(c: Contact, v: Viewer): ContactView {
  const u = c.user_id ? db.find('users', c.user_id) : undefined;
  return {
    id: c.id,
    account_id: c.account_id,
    full_name: c.full_name,
    salutation: c.salutation,
    title: c.title,
    decision_role: c.decision_role,
    email: c.email,
    phone: c.phone,
    // AM's interaction log (time + note, also fed by CRM touchpoints) is internal working data
    last_interaction_at: isClientViewer(v) ? null : c.last_interaction_at,
    last_interaction_note: isClientViewer(v) ? null : c.last_interaction_note,
    user: u ? { ...toUserRef(u), status: u.status, last_login_at: u.last_login_at } : null,
  };
}

export function accountDetail(a: Account, v: Viewer): AccountDetail {
  const contacts = db
    .rows('contacts')
    .filter((c) => c.account_id === a.id)
    .map((c) => contactView(c, v))
    .sort(compareContacts);
  const detail: AccountDetail = {
    ...accountSummary(a, v),
    exec_summary: a.exec_summary,
    exec_summary_updated_at: a.exec_summary_updated_at,
    health_override: a.health_override,
    projects: accountProjects(a.id).map((p) => projectView(p, v)),
    contacts,
    decision_makers: contacts.filter((c) => c.decision_role === 'decision_maker'),
    commercial: canAccessCommercial(v) ? commercialSummary(a.id, v) : null,
    created_at: a.created_at,
  };
  if (!isClientViewer(v)) detail.internal_notes = a.internal_notes;
  return detail;
}

// ───────────────────────────── files ─────────────────────────────

const sessionFileUrls = new Map<string, string>();

/** Uploads too large for localStorage live only in this tab: 'session:<key>' → blob:/data: URL. */
export function rememberSessionFile(key: string, url: string): void {
  sessionFileUrls.set(key, url);
}

const PLACEHOLDER_FILE_URL =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">' +
      '<rect width="320" height="240" rx="16" fill="#F6F8FC"/>' +
      '<path d="M128 70h44l20 20v80h-64z" fill="#FFFFFF" stroke="#64748B" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M172 70v20h20" fill="none" stroke="#64748B" stroke-width="3" stroke-linejoin="round"/></svg>',
  );

export function resolveFileUrl(f: FileItem): string {
  const path = f.storage_path;
  if (path.startsWith('data:') || path.startsWith('blob:')) return path;
  if (path.startsWith('sample:')) return sampleFileUrl(path.slice('sample:'.length)) ?? PLACEHOLDER_FILE_URL;
  if (path.startsWith('session:')) return sessionFileUrls.get(path.slice('session:'.length)) ?? PLACEHOLDER_FILE_URL;
  return PLACEHOLDER_FILE_URL;
}

function fileVisible(f: FileItem, v: Viewer): boolean {
  if (f.deleted_at) return false;
  if (!accessibleIds(v).has(f.account_id)) return false;
  // contracts and payment proofs are commercial documents (no access for client_member / internal member)
  if (!canAccessCommercial(v) && (f.kind === 'proof' || f.kind === 'contract')) return false;
  if (isClientViewer(v)) {
    if (f.visibility !== 'shared') return false;
    if (f.task_id) {
      const task = db.find('tasks', f.task_id);
      if (task && !canViewTask(task, v)) return false;
    }
  }
  return true;
}

/**
 * Clients: the version number counts only the versions of the document they can see (v1, v2… of the shared ones),
 * so a hidden internal version in the same group cannot be inferred from a gap.
 */
function versionFor(f: FileItem, v: Viewer): number {
  if (!isClientViewer(v)) return f.version;
  return db
    .rows('files')
    .filter((x) => x.account_id === f.account_id && x.doc_key === f.doc_key && x.version <= f.version && fileVisible(x, v)).length;
}

/** null when the file is hidden from the viewer */
export function fileView(f: FileItem, v: Viewer): FileView | null {
  if (!fileVisible(f, v)) return null;
  return {
    id: f.id,
    account_id: f.account_id,
    project_id: f.project_id,
    task_id: f.task_id,
    name: f.name,
    doc_key: f.doc_key,
    version: versionFor(f, v),
    mime: f.mime,
    size: f.size,
    url: resolveFileUrl(f),
    visibility: f.visibility,
    kind: f.kind,
    uploaded_by: userRefAny(f.uploaded_by),
    uploaded_at: f.uploaded_at,
    note: f.note,
  };
}

/** Newest visible version per doc_key, with the older visible versions attached (newest first). */
export function groupFileVersions(items: FileItem[], v: Viewer): FileView[] {
  const groups = new Map<string, FileView[]>();
  for (const f of items) {
    const view = fileView(f, v);
    if (!view) continue;
    const key = `${view.account_id}|${view.doc_key}`;
    const list = groups.get(key);
    if (list) list.push(view);
    else groups.set(key, [view]);
  }
  const out: FileView[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => b.version - a.version || b.uploaded_at.localeCompare(a.uploaded_at));
    const [newest, ...older] = list;
    out.push({ ...newest, older_versions: older });
  }
  return out.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
}

// ───────────────────────────── comments & activities ─────────────────────────────

function replyTargetVisible(commentId: ID, v: Viewer): boolean {
  if (!isClientViewer(v)) return true;
  const parent = db.find('comments', commentId);
  return !!parent && parent.visibility === 'shared';
}

export function commentView(c: TaskComment, v: Viewer): CommentView | null {
  if (c.deleted_at) return null;
  if (isClientViewer(v) && c.visibility !== 'shared') return null;
  const task = db.find('tasks', c.task_id);
  if (!task || !canViewTask(task, v)) return null;
  return {
    id: c.id,
    task_id: c.task_id,
    author: userRefAny(c.author_id),
    body: c.body,
    visibility: c.visibility,
    // a reply to a comment the viewer cannot see (an internal note) is shown as a plain comment
    reply_to_id: c.reply_to_id && replyTargetVisible(c.reply_to_id, v) ? c.reply_to_id : null,
    created_at: c.created_at,
    mine: c.author_id === v.user.id,
  };
}

const COMMERCIAL_ACTION_PREFIXES = ['quote.', 'contract.', 'payment.'];

function activityTaskId(a: Activity): ID | null {
  if (a.target_type === 'task') return a.target_id;
  const id = a.params.task_id;
  return typeof id === 'string' ? id : null;
}

export function activityVisible(a: Activity, v: Viewer): boolean {
  // company-wide entries (settings, staff accounts) belong to the director
  if (a.account_id === null) return v.org_type === 'internal' && v.role === 'director' && !v.read_only;
  if (!accessibleIds(v).has(a.account_id)) return false;
  // quotes, contracts and payments belong to the commercial module (canAccessCommercial)
  if (!canAccessCommercial(v) && COMMERCIAL_ACTION_PREFIXES.some((p) => a.action.startsWith(p))) return false;
  if (!isClientViewer(v)) return true;
  if (a.visibility !== 'shared') return false;
  const taskId = activityTaskId(a);
  if (taskId) {
    // history survives deletion, so look at soft-deleted rows too
    const task = db.allRows('tasks').find((x) => x.id === taskId);
    if (task && !clientMayKnowTask(task, v)) return false;
  }
  if (a.target_type === 'milestone') {
    const m = db.allRows('milestones').find((x) => x.id === a.target_id);
    if (m && !m.client_visible) return false;
  }
  return true;
}

/**
 * A client's decision on a quote through its approval task is logged twice: quote.accepted / quote.changes_requested
 * (the decision) and task.approved / task.changes_requested (the task). Feeds that list decisions keep the quote one.
 */
export function isQuoteTaskEcho(a: Activity): boolean {
  if (a.action !== 'task.approved' && a.action !== 'task.changes_requested') return false;
  const taskId = activityTaskId(a);
  const task = taskId ? db.allRows('tasks').find((x) => x.id === taskId) : undefined;
  return !!task && task.quote_id !== null;
}

export function activityView(a: Activity, v: Viewer): ActivityView | null {
  if (!activityVisible(a, v)) return null;
  const params = { ...a.params };
  // the stored version number counts New Era's internal versions too (see versionFor)
  if (isClientViewer(v) && a.action === 'file.uploaded') delete params.version;
  return {
    id: a.id,
    account_id: a.account_id,
    actor: a.actor_id ? userRefAny(a.actor_id) : null,
    action: a.action,
    target_type: a.target_type,
    target_id: a.target_id,
    params,
    visibility: a.visibility,
    created_at: a.created_at,
  };
}
