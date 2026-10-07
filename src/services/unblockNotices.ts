// "Việc … đã sẵn sàng" (SPEC §6): a client task that starts blocked is not announced at creation; its assignee is
// told when its last blocker is done / removed. Every path that completes or removes a task takes a snapshot of the
// blocked client tasks BEFORE the change and announces the ones that became actionable AFTER it (inside its batch):
// task actions and internal edits (api/tasks.ts), quote decisions from the quote page, payment acceptance,
// withdrawn approval tasks (commercialEffects.ts) and the daily sweep.

import type { ID } from '@/domain/types';
import { db } from './db';
import { notifyTaskEvent } from './notifyEvents';
import { accountTasks, graphForAccount, invalidateViewCache } from './views';

/** open client tasks of the account that wait on the client but are blocked (snapshot taken before a change) */
export function blockedClientTasks(accountId: ID): Set<ID> {
  // a change earlier in the same batch does not move db.version: never read a stale memoized graph
  invalidateViewCache();
  const g = graphForAccount(accountId);
  return new Set(
    accountTasks(accountId)
      .filter((x) => x.side === 'client' && x.status !== 'done' && x.waiting_on === 'client' && g.isBlocked(x.id))
      .map((x) => x.id),
  );
}

/**
 * Inside the batch, after the change: tell the client about the tasks of `before` that can be handled now.
 * `actorId` null = system; `skip` = a task the caller already announced.
 */
export function announceUnblocked(accountId: ID, before: Set<ID>, actorId: ID | null, skip: ID | null = null): void {
  if (before.size === 0) return;
  invalidateViewCache();
  const g = graphForAccount(accountId);
  for (const id of before) {
    if (id === skip) continue;
    const task = db.find('tasks', id);
    if (!task || task.status === 'done' || task.waiting_on !== 'client' || g.isBlocked(id)) continue;
    notifyTaskEvent('unblocked', id, actorId);
  }
}

/** Snapshot of several accounts (e.g. every account a sweep step may touch). */
export function blockedClientTasksOf(accountIds: Iterable<ID>): Map<ID, Set<ID>> {
  const out = new Map<ID, Set<ID>>();
  for (const id of new Set(accountIds)) out.set(id, blockedClientTasks(id));
  return out;
}

export function announceUnblockedOf(snapshot: Map<ID, Set<ID>>, actorId: ID | null): void {
  for (const [accountId, before] of snapshot) announceUnblocked(accountId, before, actorId);
}

/** Runs `fn` (inside the caller's batch) and announces the client tasks of `accountId` it made actionable. */
export function withUnblockNotices<R>(accountId: ID, actorId: ID | null, fn: () => R): R {
  const before = blockedClientTasks(accountId);
  const result = fn();
  announceUnblocked(accountId, before, actorId);
  return result;
}
