// Client view of the change requests and solutions (SPEC-CARE §6.7): what is still open, how a request is scoped by
// the portal project selector, and the one-line "when" of a request in client wording. Pure helpers, no React.
import type { CrStatus } from '@/domain/careTypes';
import type { ISODate } from '@/domain/types';
import { dateOf } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import type { ClientChangeRequestView, ClientDeploymentView } from '@/services/careContract';

/** the portal's anchor of "Yêu cầu của anh/chị" on /portal/progress (links from the home card) */
export const REQUESTS_ANCHOR = 'yeu-cau';
/** search param opening one request in the detail sheet (notification links: /portal/progress?cr=<id>) */
export const REQUEST_PARAM = 'cr';

const OPEN: readonly CrStatus[] = ['new', 'triaged', 'planned', 'in_progress'];

export function isOpenRequest(r: Pick<ClientChangeRequestView, 'status'>): boolean {
  return OPEN.includes(r.status);
}

/**
 * The selected project scopes the list like every project page; a request (or a solution) tied to no project is
 * company-wide and stays visible under every project.
 */
export function inProjectScope(item: { project: { id: string } | null }, projectId: string | null): boolean {
  return !projectId || !item.project || item.project.id === projectId;
}

/** home card order: the soonest promised date first, then the newest still waiting for New Era */
export function byNextPromise(a: ClientChangeRequestView, b: ClientChangeRequestView): number {
  if (a.promised_date && b.promised_date) return a.promised_date.localeCompare(b.promised_date);
  if (a.promised_date) return -1;
  if (b.promised_date) return 1;
  return b.received_at.localeCompare(a.received_at);
}

/** What the row says about time, in the client's terms. */
export type RequestWhen =
  | { kind: 'done'; date: ISODate }
  | { kind: 'promised'; date: ISODate; lateDays: number }
  | { kind: 'sent'; date: ISODate };

export function requestWhen(r: ClientChangeRequestView, today: ISODate): RequestWhen {
  if (r.status === 'done') return { kind: 'done', date: dateOf(r.done_at ?? r.received_at) };
  if (isOpenRequest(r) && r.promised_date) {
    return { kind: 'promised', date: r.promised_date, lateDays: Math.max(0, diffDays(today, r.promised_date)) };
  }
  return { kind: 'sent', date: dateOf(r.received_at) };
}

// ───────────────────────────── progress steps of one request ─────────────────────────────

export type StepState = 'done' | 'current' | 'upcoming';
export interface RequestStep {
  key: CrStatus;
  state: StepState;
}

const FLOW: readonly CrStatus[] = ['new', 'triaged', 'planned', 'in_progress', 'done'];

/**
 * Đã gửi → New Era tiếp nhận → Lên kế hoạch → Đang thực hiện → Hoàn thành; a declined request stops after
 * "Đã gửi" on its own last step. A request moved straight to "in progress" counts the skipped steps as passed.
 */
export function requestSteps(status: CrStatus): RequestStep[] {
  if (status === 'declined') {
    return [
      { key: 'new', state: 'done' },
      { key: 'declined', state: 'current' },
    ];
  }
  const at = FLOW.indexOf(status);
  return FLOW.map((key, i) => ({
    key,
    state: status === 'done' || i < at ? 'done' : i === at ? 'current' : 'upcoming',
  }));
}

// ───────────────────────────── solutions ─────────────────────────────

const SOLUTION_ORDER: Record<ClientDeploymentView['status'], number> = { live: 0, rolling_out: 1, pilot: 2, paused: 3 };

/** in use first, then rolling out / pilot / paused; earliest start first inside a status */
export function bySolutionStatus(a: ClientDeploymentView, b: ClientDeploymentView): number {
  return (
    SOLUTION_ORDER[a.status] - SOLUTION_ORDER[b.status] ||
    (a.go_live_date ?? '9999').localeCompare(b.go_live_date ?? '9999') ||
    a.name.localeCompare(b.name, 'vi')
  );
}
