// Dependency graph of one account: blocking, milestone forecasts (with cascade) and impact chains (SPEC §3).
// Pure and memoized: build once per data version, query many times.
import type { ID, ISODate, Milestone, Task, TaskDependency } from './types';
import type { ForecastSource } from '@/services/contract';
import { dateOf } from './clock';
import { addDays, diffDays } from './dates';

export interface AccountGraphInput {
  tasks: Task[];
  deps: TaskDependency[];
  milestones: Milestone[];
  today: ISODate;
}

export interface ForecastInfo {
  milestone_id: ID;
  planned_date: ISODate;
  forecast_date: ISODate;
  delay_days: number;
  source: ForecastSource;
  cause_task_id: ID | null;
  cause_delay_days: number;
  cascade_from_milestone_id: ID | null;
  override_reason: string | null;
}

export interface RawChainNode {
  kind: 'task' | 'milestone';
  id: ID;
  state: 'done' | 'stuck' | 'pending';
}

export interface AccountGraph {
  readonly today: ISODate;
  task(id: ID): Task | undefined;
  milestone(id: ID): Milestone | undefined;
  /** unfinished direct blockers (empty when the task was manually unblocked) */
  blockersOf(taskId: ID): Task[];
  isBlocked(taskId: ID): boolean;
  /** direct downstream tasks */
  blocksTasks(taskId: ID): Task[];
  /** not-done milestones this NOT-done task holds back, directly or through downstream not-done tasks */
  milestonesHeldBy(taskId: ID): Milestone[];
  /** every live milestone has one */
  forecast(milestoneId: ID): ForecastInfo;
  /**
   * Impact chain. `visibleMilestone` (client viewers: `m.client_visible`) keeps hidden milestones out of the chain:
   * the route then ends on a milestone the viewer may see — or, when the task only reaches hidden milestones, on the
   * visible launch milestone they push back (cascade), when there is one later in that project.
   */
  chain(taskId: ID, visibleMilestone?: (m: Milestone) => boolean): RawChainNode[];
}

/** Days late: not done → max(0, today − due); done → max(0, completion day (Vietnam) − due). */
export function taskDelayDays(task: Task, today: ISODate): number {
  if (task.status === 'done') {
    if (!task.completed_at) return 0;
    return Math.max(0, diffDays(dateOf(task.completed_at), task.due_date));
  }
  return Math.max(0, diffDays(today, task.due_date));
}

// ───────────────────────────── launch milestone ─────────────────────────────

/** 'Go-live' / 'Go live' / 'golive' (any case) — not 'Hỗ trợ sau go-live'. */
export function isLaunchMilestoneName(name: string): boolean {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, '') === 'golive';
}

/**
 * The milestone a headline / impact chain ends on, from a project's not-done milestones in order_no:
 * the last one named like Go-live when there is one (a trailing "Hỗ trợ sau go-live" is support, not delivery),
 * else the last one.
 */
export function launchMilestone<M extends { name: string }>(openInOrder: M[]): M | null {
  for (let i = openInOrder.length - 1; i >= 0; i--) {
    const m = openInOrder[i];
    if (m && isLaunchMilestoneName(m.name)) return m;
  }
  return openInOrder.length > 0 ? openInOrder[openInOrder.length - 1] ?? null : null;
}

// ───────────────────────────── helpers ─────────────────────────────

function isDone(t: Task): boolean {
  return t.status === 'done';
}

/** A task with a manual-unblock reason ignores every edge into it (blocking and delay propagation). */
function isManuallyUnblocked(t: Task): boolean {
  return typeof t.manual_unblock_reason === 'string' && t.manual_unblock_reason.trim().length > 0;
}

function cmpId(a: ID, b: ID): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** earliest due first, then id */
function byDue(a: Task, b: Task): number {
  if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  return cmpId(a.id, b.id);
}

/** project order: order_no, planned_date, id */
function byOrder(a: Milestone, b: Milestone): number {
  if (a.order_no !== b.order_no) return a.order_no - b.order_no;
  if (a.planned_date !== b.planned_date) return a.planned_date < b.planned_date ? -1 : 1;
  return cmpId(a.id, b.id);
}

/** calendar order: planned_date, order_no, id */
function byPlanned(a: Milestone, b: Milestone): number {
  if (a.planned_date !== b.planned_date) return a.planned_date < b.planned_date ? -1 : 1;
  if (a.order_no !== b.order_no) return a.order_no - b.order_no;
  return cmpId(a.id, b.id);
}

function pushTo(map: Map<ID, ID[]>, key: ID, value: ID): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

interface UpstreamInfo {
  /** tasks whose delay reaches the milestone (direct + indirect) */
  taskIds: ID[];
  max_delay: number;
  cause: Task | null;
}

interface PathResult {
  /** downstream tasks between the start task and the milestone (start excluded) */
  tasks: Task[];
  milestone: Milestone;
}

// ───────────────────────────── graph ─────────────────────────────

export function buildAccountGraph(input: AccountGraphInput): AccountGraph {
  const today = input.today;

  const taskById = new Map<ID, Task>();
  for (const t of input.tasks) if (!t.deleted_at) taskById.set(t.id, t);
  const msById = new Map<ID, Milestone>();
  for (const m of input.milestones) if (!m.deleted_at) msById.set(m.id, m);

  /** blocked task → its blockers */
  const inEdges = new Map<ID, ID[]>();
  /** blocker → tasks it blocks */
  const outEdges = new Map<ID, ID[]>();
  /** task → milestones it blocks directly */
  const taskMs = new Map<ID, ID[]>();
  /** milestone → tasks blocking it directly */
  const msTasks = new Map<ID, ID[]>();

  const seenEdges = new Set<string>();
  for (const d of input.deps) {
    if (!taskById.has(d.task_id)) continue;
    if (d.blocks_task_id) {
      if (d.blocks_task_id === d.task_id || !taskById.has(d.blocks_task_id)) continue;
      const key = `t|${d.task_id}|${d.blocks_task_id}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      pushTo(outEdges, d.task_id, d.blocks_task_id);
      pushTo(inEdges, d.blocks_task_id, d.task_id);
    } else if (d.blocks_milestone_id) {
      if (!msById.has(d.blocks_milestone_id)) continue;
      const key = `m|${d.task_id}|${d.blocks_milestone_id}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      pushTo(taskMs, d.task_id, d.blocks_milestone_id);
      pushTo(msTasks, d.blocks_milestone_id, d.task_id);
    }
  }

  function tasksOf(ids: ID[] | undefined): Task[] {
    const out: Task[] = [];
    for (const id of ids ?? []) {
      const t = taskById.get(id);
      if (t) out.push(t);
    }
    return out;
  }

  // Deterministic adjacency order (earliest due first) so BFS results are stable.
  for (const [key, ids] of outEdges) outEdges.set(key, tasksOf(ids).sort(byDue).map((t) => t.id));
  for (const [key, ids] of inEdges) inEdges.set(key, tasksOf(ids).sort(byDue).map((t) => t.id));

  // ── memo tables ──
  const delayMemo = new Map<ID, number>();
  const blockersMemo = new Map<ID, Task[]>();
  const heldMemo = new Map<ID, Milestone[]>();
  const upstreamMemo = new Map<ID, UpstreamInfo>();
  const forecastMemo = new Map<ID, ForecastInfo>();
  const chainMemo = new Map<ID, RawChainNode[]>();

  function delayOf(t: Task): number {
    let d = delayMemo.get(t.id);
    if (d === undefined) {
      d = taskDelayDays(t, today);
      delayMemo.set(t.id, d);
    }
    return d;
  }

  function blockersOf(taskId: ID): Task[] {
    const cached = blockersMemo.get(taskId);
    if (cached) return cached;
    const t = taskById.get(taskId);
    let result: Task[] = [];
    if (t && !isDone(t) && !isManuallyUnblocked(t)) {
      result = tasksOf(inEdges.get(taskId)).filter((b) => !isDone(b));
    }
    blockersMemo.set(taskId, result);
    return result;
  }

  function milestonesHeldBy(taskId: ID): Milestone[] {
    const cached = heldMemo.get(taskId);
    if (cached) return cached;
    const start = taskById.get(taskId);
    let result: Milestone[] = [];
    if (start && !isDone(start)) {
      const visited = new Set<ID>([taskId]);
      const queue: ID[] = [taskId];
      const held = new Set<ID>();
      for (let i = 0; i < queue.length; i++) {
        const id = queue[i] as ID;
        for (const mId of taskMs.get(id) ?? []) {
          const m = msById.get(mId);
          if (m && m.status !== 'done') held.add(mId);
        }
        for (const nextId of outEdges.get(id) ?? []) {
          if (visited.has(nextId)) continue;
          const n = taskById.get(nextId);
          if (!n || isDone(n) || isManuallyUnblocked(n)) continue;
          visited.add(nextId);
          queue.push(nextId);
        }
      }
      result = [];
      for (const mId of held) {
        const m = msById.get(mId);
        if (m) result.push(m);
      }
      result.sort(byPlanned);
    }
    heldMemo.set(taskId, result);
    return result;
  }

  /** Upstream set of a milestone: direct blockers, then (through not-done, not manually unblocked tasks) their blockers. */
  function upstreamOf(milestoneId: ID): UpstreamInfo {
    const cached = upstreamMemo.get(milestoneId);
    if (cached) return cached;
    const visited = new Set<ID>();
    const queue: ID[] = [];
    for (const id of msTasks.get(milestoneId) ?? []) {
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(id);
    }
    for (let i = 0; i < queue.length; i++) {
      const t = taskById.get(queue[i] as ID);
      if (!t || isDone(t) || isManuallyUnblocked(t)) continue;
      for (const bId of inEdges.get(t.id) ?? []) {
        if (visited.has(bId)) continue;
        visited.add(bId);
        queue.push(bId);
      }
    }
    let cause: Task | null = null;
    let maxDelay = 0;
    for (const id of queue) {
      const t = taskById.get(id);
      if (!t) continue;
      const d = delayOf(t);
      if (d <= 0) continue;
      if (cause === null || d > maxDelay || (d === maxDelay && byDue(t, cause) < 0)) {
        cause = t;
        maxDelay = d;
      }
    }
    const info: UpstreamInfo = { taskIds: queue, max_delay: maxDelay, cause };
    upstreamMemo.set(milestoneId, info);
    return info;
  }

  function projectMilestones(projectId: ID): Milestone[] {
    const list: Milestone[] = [];
    for (const m of msById.values()) if (m.project_id === projectId) list.push(m);
    return list.sort(byOrder);
  }

  /** Forecasts of every milestone of a project, walking milestones in order_no and carrying the largest shift. */
  function computeProjectForecasts(projectId: ID): void {
    let carry: { shift: number; from: Milestone | null; causeId: ID | null; causeDelay: number } = {
      shift: 0,
      from: null,
      causeId: null,
      causeDelay: 0,
    };
    for (const m of projectMilestones(projectId)) {
      if (m.status === 'done') {
        const f = m.completed_at ? dateOf(m.completed_at) : m.planned_date;
        forecastMemo.set(m.id, {
          milestone_id: m.id,
          planned_date: m.planned_date,
          forecast_date: f,
          delay_days: diffDays(f, m.planned_date),
          source: 'done',
          cause_task_id: null,
          cause_delay_days: 0,
          cascade_from_milestone_id: null,
          override_reason: null,
        });
        continue;
      }

      if (m.forecast_override_date) {
        const delay = diffDays(m.forecast_override_date, m.planned_date);
        forecastMemo.set(m.id, {
          milestone_id: m.id,
          planned_date: m.planned_date,
          forecast_date: m.forecast_override_date,
          delay_days: delay,
          source: 'manual',
          cause_task_id: null,
          cause_delay_days: 0,
          cascade_from_milestone_id: null,
          override_reason: m.forecast_override_reason ?? null,
        });
        const push = Math.max(0, delay);
        if (push > carry.shift) carry = { shift: push, from: m, causeId: null, causeDelay: 0 };
        continue;
      }

      const up = upstreamOf(m.id);
      let info: ForecastInfo;
      if (carry.from !== null && carry.shift > up.max_delay) {
        info = {
          milestone_id: m.id,
          planned_date: m.planned_date,
          forecast_date: addDays(m.planned_date, carry.shift),
          delay_days: carry.shift,
          source: 'cascade',
          cause_task_id: carry.causeId,
          cause_delay_days: carry.causeDelay,
          cascade_from_milestone_id: carry.from.id,
          override_reason: null,
        };
      } else if (up.max_delay > 0 && up.cause !== null) {
        info = {
          milestone_id: m.id,
          planned_date: m.planned_date,
          forecast_date: addDays(m.planned_date, up.max_delay),
          delay_days: up.max_delay,
          source: 'dependency',
          cause_task_id: up.cause.id,
          cause_delay_days: up.max_delay,
          cascade_from_milestone_id: null,
          override_reason: null,
        };
        if (up.max_delay > carry.shift) {
          carry = { shift: up.max_delay, from: m, causeId: up.cause.id, causeDelay: up.max_delay };
        }
      } else {
        info = {
          milestone_id: m.id,
          planned_date: m.planned_date,
          forecast_date: m.planned_date,
          delay_days: 0,
          source: 'on_plan',
          cause_task_id: null,
          cause_delay_days: 0,
          cascade_from_milestone_id: null,
          override_reason: null,
        };
      }
      forecastMemo.set(m.id, info);
    }
  }

  function forecast(milestoneId: ID): ForecastInfo {
    let info = forecastMemo.get(milestoneId);
    if (info) return info;
    const m = msById.get(milestoneId);
    if (!m) throw new Error(`[graph] unknown milestone ${milestoneId}`);
    computeProjectForecasts(m.project_id);
    info = forecastMemo.get(milestoneId);
    if (!info) throw new Error(`[graph] no forecast for milestone ${milestoneId}`);
    return info;
  }

  /**
   * BFS downstream from `startId` over every reachable milestone, then pick the route with the most impact:
   * a milestone of the start task's own project first, then the HIGHEST order_no, then the shortest route
   * (fewest hops), then the earliest planned date. Edges into manually-unblocked tasks are skipped.
   */
  function pathToMilestone(
    startId: ID,
    allowTask: (t: Task) => boolean,
    allowMilestone: (m: Milestone) => boolean,
  ): PathResult | null {
    const home = taskById.get(startId)?.project_id ?? null;
    const better = (m: Milestone, dist: number, best: { m: Milestone; dist: number }): boolean => {
      const sameA = m.project_id === home;
      const sameB = best.m.project_id === home;
      if (sameA !== sameB) return sameA;
      if (m.order_no !== best.m.order_no) return m.order_no > best.m.order_no;
      if (dist !== best.dist) return dist < best.dist;
      return byPlanned(m, best.m) < 0;
    };
    const parent = new Map<ID, ID | null>([[startId, null]]);
    const depth = new Map<ID, number>([[startId, 0]]);
    const queue: ID[] = [startId];
    let best: { m: Milestone; via: ID; dist: number } | null = null;
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i] as ID;
      const dist = depth.get(id) ?? 0;
      for (const mId of taskMs.get(id) ?? []) {
        const m = msById.get(mId);
        if (!m || !allowMilestone(m)) continue;
        if (best === null || better(m, dist, best)) best = { m, via: id, dist };
      }
      for (const nId of outEdges.get(id) ?? []) {
        if (parent.has(nId)) continue;
        const n = taskById.get(nId);
        if (!n || isManuallyUnblocked(n) || !allowTask(n)) continue;
        parent.set(nId, id);
        depth.set(nId, dist + 1);
        queue.push(nId);
      }
    }
    if (best === null) return null;
    const tasks: Task[] = [];
    let cur: ID | null = best.via;
    while (cur !== null && cur !== startId) {
      const t = taskById.get(cur);
      if (t) tasks.push(t);
      cur = parent.get(cur) ?? null;
    }
    tasks.reverse();
    return { tasks, milestone: best.m };
  }

  function finalOpenMilestone(projectId: ID, visible: (m: Milestone) => boolean = () => true): Milestone | null {
    return launchMilestone(projectMilestones(projectId).filter((m) => m.status !== 'done' && visible(m)));
  }

  /**
   * [first unfinished blocker if blocked] → task → downstream route to the milestone with the most impact
   * (highest order_no; ties → shortest route) → the project's launch milestone (Go-live, else the last not-done
   * milestone) when it comes later.
   * State: done nodes 'done'; the first not-done node that is late (task delay > 0, milestone past its planned date) 'stuck'.
   */
  function chain(taskId: ID, visibleMilestone?: (m: Milestone) => boolean): RawChainNode[] {
    const cached = visibleMilestone ? undefined : chainMemo.get(taskId);
    if (cached) return cached;
    const start = taskById.get(taskId);
    if (!start) return [];
    const shown = visibleMilestone ?? (() => true);

    const nodes: { kind: 'task' | 'milestone'; id: ID; done: boolean; late: boolean }[] = [];
    const taskNode = (t: Task) => ({ kind: 'task' as const, id: t.id, done: isDone(t), late: !isDone(t) && delayOf(t) > 0 });
    const msNode = (m: Milestone) => ({
      kind: 'milestone' as const,
      id: m.id,
      done: m.status === 'done',
      late: m.status !== 'done' && today > m.planned_date,
    });

    const blocker = blockersOf(taskId)[0];
    if (blocker) nodes.push(taskNode(blocker));
    nodes.push(taskNode(start));

    const route = (allow: (m: Milestone) => boolean): PathResult | null =>
      pathToMilestone(taskId, (t) => !isDone(t), (m) => m.status !== 'done' && allow(m)) ??
      pathToMilestone(taskId, () => true, (m) => m.status !== 'done' && allow(m)) ??
      pathToMilestone(taskId, () => true, allow);

    const found = route(shown);
    if (found) {
      for (const t of found.tasks) nodes.push(taskNode(t));
      nodes.push(msNode(found.milestone));
      const final = finalOpenMilestone(found.milestone.project_id, shown);
      if (final && final.id !== found.milestone.id && byOrder(final, found.milestone) > 0) nodes.push(msNode(final));
    } else if (visibleMilestone) {
      // only hidden milestones downstream: name the visible launch milestone they push back, if it comes later
      const hidden = route(() => true);
      const final = hidden ? finalOpenMilestone(hidden.milestone.project_id, shown) : null;
      if (hidden && final && byOrder(final, hidden.milestone) > 0) {
        for (const t of hidden.tasks) nodes.push(taskNode(t));
        nodes.push(msNode(final));
      }
    }

    let stuckUsed = false;
    const result: RawChainNode[] = nodes.map((n): RawChainNode => {
      if (n.done) return { kind: n.kind, id: n.id, state: 'done' };
      if (!stuckUsed && n.late) {
        stuckUsed = true;
        return { kind: n.kind, id: n.id, state: 'stuck' };
      }
      return { kind: n.kind, id: n.id, state: 'pending' };
    });
    if (!visibleMilestone) chainMemo.set(taskId, result);
    return result;
  }

  // Public accessors hand out copies so callers cannot disturb the memo tables.
  return {
    today,
    task: (id) => taskById.get(id),
    milestone: (id) => msById.get(id),
    blockersOf: (taskId) => blockersOf(taskId).slice(),
    isBlocked: (taskId) => blockersOf(taskId).length > 0,
    blocksTasks: (taskId) => tasksOf(outEdges.get(taskId)),
    milestonesHeldBy: (taskId) => milestonesHeldBy(taskId).slice(),
    forecast: (milestoneId) => ({ ...forecast(milestoneId) }),
    chain: (taskId, visibleMilestone) => chain(taskId, visibleMilestone).map((n) => ({ ...n })),
  };
}

// ───────────────────────────── cycles ─────────────────────────────

/**
 * Returns the task-id path of a cycle if the `proposed` edges (task_id blocks blocks_task_id) were added, else null.
 * The path is closed: [a, b, c, a] (a self-dependency gives [a, a]). Milestone edges are sinks and ignored.
 */
export function findCycle(
  existing: { task_id: ID; blocks_task_id: ID | null }[],
  proposed: { task_id: ID; blocks_task_id: ID }[],
): ID[] | null {
  for (const e of proposed) {
    if (e.task_id === e.blocks_task_id) return [e.task_id, e.task_id];
  }
  const adj = new Map<ID, ID[]>();
  for (const e of existing) {
    if (e.blocks_task_id) pushTo(adj, e.task_id, e.blocks_task_id);
  }
  for (const e of proposed) pushTo(adj, e.task_id, e.blocks_task_id);

  for (const e of proposed) {
    // Adding u → v closes a cycle when v already reaches u. BFS gives the shortest such cycle.
    const u = e.task_id;
    const v = e.blocks_task_id;
    const parent = new Map<ID, ID | null>([[v, null]]);
    const queue: ID[] = [v];
    let reached = false;
    for (let i = 0; i < queue.length && !reached; i++) {
      const cur = queue[i] as ID;
      for (const n of adj.get(cur) ?? []) {
        if (parent.has(n)) continue;
        parent.set(n, cur);
        if (n === u) {
          reached = true;
          break;
        }
        queue.push(n);
      }
    }
    if (reached) {
      const back: ID[] = [];
      let cur: ID | null = u;
      while (cur !== null) {
        back.push(cur);
        cur = parent.get(cur) ?? null;
      }
      // back = [u, …, v] walking parents; the cycle is u → v → … → u
      back.reverse();
      return [u, ...back];
    }
  }
  return null;
}
