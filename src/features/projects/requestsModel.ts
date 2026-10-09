// Pure helpers of the "Yêu cầu" tab (/app/projects/requests, SPEC-CARE §6.5): filters, board order, KPI figures and
// the promised-date timeline. Requests come from api.listChangeRequests (every account the viewer can read).
import type { CrStatus } from '@/domain/careTypes';
import type { ID, ISODate } from '@/domain/types';
import { addDays, diffDays } from '@/domain/dates';
import { dateOf } from '@/domain/clock';
import type { AccountRef } from '@/services/contract';
import type { ChangeRequestView } from '@/services/careContract';
import { normalizeText } from '@/lib/utils';

// ───────────── views & filters ─────────────

export type RequestView = 'board' | 'timeline';

export function isRequestView(v: string | null | undefined): v is RequestView {
  return v === 'board' || v === 'timeline';
}

/** KPI shortcuts: delivery debt, waiting more than 7 days, open and urgent */
export type RequestFlag = 'debt' | 'untriaged' | 'urgent';
export const REQUEST_FLAGS: readonly RequestFlag[] = ['debt', 'untriaged', 'urgent'];

export function isRequestFlag(v: string | null | undefined): v is RequestFlag {
  return typeof v === 'string' && (REQUEST_FLAGS as readonly string[]).includes(v);
}

/** board column order (SPEC-CARE §6.5): Mới · Đã tiếp nhận · Đã lên kế hoạch · Đang làm · Xong · Từ chối */
export const BOARD_COLUMNS: readonly CrStatus[] = ['new', 'triaged', 'planned', 'in_progress', 'done', 'declined'];
export const OPEN_STATUSES: readonly CrStatus[] = ['new', 'triaged', 'planned', 'in_progress'];

export function isOpenRequest(cr: Pick<ChangeRequestView, 'status'>): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(cr.status);
}

export function matchesFlag(cr: ChangeRequestView, flag: RequestFlag): boolean {
  switch (flag) {
    case 'debt':
      return cr.flags.debt;
    case 'untriaged':
      return cr.flags.untriaged;
    case 'urgent':
      return isOpenRequest(cr) && cr.priority === 'high';
  }
}

/** `query` already normalized with normalizeText */
export function matchesRequestSearch(cr: ChangeRequestView, query: string): boolean {
  if (!query) return true;
  return normalizeText(
    `${cr.code} ${cr.title} ${cr.account.name} ${cr.account.short_name} ${cr.project?.name ?? ''} ${cr.owner?.full_name ?? ''} ${cr.requested_by?.name ?? ''}`,
  ).includes(query);
}

export interface RequestCriteria {
  flag: RequestFlag | null;
  accountId: ID | null;
  /** only the requests the viewer owns */
  mine: boolean;
  viewerId: ID | null;
  /** raw text typed by the user */
  query: string;
}

export function applyRequestCriteria(rows: ChangeRequestView[], c: RequestCriteria): ChangeRequestView[] {
  const q = normalizeText(c.query.trim());
  return rows.filter(
    (cr) =>
      (!c.flag || matchesFlag(cr, c.flag)) &&
      (!c.accountId || cr.account.id === c.accountId) &&
      (!c.mine || (c.viewerId !== null && cr.owner?.id === c.viewerId)) &&
      matchesRequestSearch(cr, q),
  );
}

export interface AccountOption {
  account: AccountRef;
  count: number;
}

/** accounts that have requests (count = open requests), by name */
export function accountOptions(rows: ChangeRequestView[]): AccountOption[] {
  const map = new Map<ID, AccountOption>();
  for (const cr of rows) {
    const o = map.get(cr.account.id) ?? { account: cr.account, count: 0 };
    if (isOpenRequest(cr)) o.count += 1;
    map.set(cr.account.id, o);
  }
  return [...map.values()].sort((a, b) => a.account.name.localeCompare(b.account.name, 'vi'));
}

// ───────────── board order ─────────────

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;

/** open columns: debt → waiting too long → urgent → promised date (soonest; none last) → received (oldest) → code */
export function compareOpen(a: ChangeRequestView, b: ChangeRequestView): number {
  return (
    Number(b.flags.debt) - Number(a.flags.debt) ||
    Number(b.flags.untriaged) - Number(a.flags.untriaged) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.promised_date ?? '9999').localeCompare(b.promised_date ?? '9999') ||
    a.received_at.localeCompare(b.received_at) ||
    a.account.name.localeCompare(b.account.name, 'vi') ||
    a.code.localeCompare(b.code)
  );
}

/** Xong / Từ chối: latest first */
export function compareClosed(a: ChangeRequestView, b: ChangeRequestView): number {
  return (b.done_at ?? b.updated_at).localeCompare(a.done_at ?? a.updated_at) || a.code.localeCompare(b.code);
}

export function boardColumns(rows: ChangeRequestView[], statusOf: (cr: ChangeRequestView) => CrStatus): Record<CrStatus, ChangeRequestView[]> {
  const map: Record<CrStatus, ChangeRequestView[]> = { new: [], triaged: [], planned: [], in_progress: [], done: [], declined: [] };
  for (const cr of rows) map[statusOf(cr)].push(cr);
  for (const s of OPEN_STATUSES) map[s].sort(compareOpen);
  map.done.sort(compareClosed);
  map.declined.sort(compareClosed);
  return map;
}

// ───────────── KPIs & summary ─────────────

export interface RequestKpis {
  open: number;
  /** distinct accounts with an open request */
  openAccounts: number;
  debt: number;
  /** short names of the accounts carrying delivery debt */
  debtAccounts: string[];
  untriaged: number;
  untriagedAccounts: string[];
  /** open + high priority */
  urgent: number;
  /** done in the last 30 days */
  done30: number;
}

function shortName(a: AccountRef): string {
  return a.short_name || a.name;
}

export function requestKpis(rows: ChangeRequestView[], today: ISODate): RequestKpis {
  const open = rows.filter(isOpenRequest);
  const debt = rows.filter((cr) => cr.flags.debt);
  const untriaged = rows.filter((cr) => cr.flags.untriaged);
  const names = (list: ChangeRequestView[]) => [...new Set(list.map((cr) => shortName(cr.account)))];
  return {
    open: open.length,
    openAccounts: new Set(open.map((cr) => cr.account.id)).size,
    debt: debt.length,
    debtAccounts: names(debt),
    untriaged: untriaged.length,
    untriagedAccounts: names(untriaged),
    urgent: open.filter((cr) => cr.priority === 'high').length,
    done30: rows.filter((cr) => cr.status === 'done' && cr.done_at !== null && diffDays(today, dateOf(cr.done_at)) <= 30).length,
  };
}

// ───────────── promised-date timeline ─────────────

export interface TimelineGroup {
  account: AccountRef;
  /** open requests with a promised date, soonest first */
  dated: ChangeRequestView[];
  /** open requests without a promised date ("Chưa hẹn ngày"), oldest first */
  undated: ChangeRequestView[];
  debt: number;
}

/** open requests grouped by account: accounts with delivery debt first, then by their earliest promised date */
export function timelineGroups(rows: ChangeRequestView[]): TimelineGroup[] {
  const map = new Map<ID, TimelineGroup>();
  for (const cr of rows) {
    if (!isOpenRequest(cr)) continue;
    const g = map.get(cr.account.id) ?? { account: cr.account, dated: [], undated: [], debt: 0 };
    if (cr.promised_date) g.dated.push(cr);
    else g.undated.push(cr);
    if (cr.flags.debt) g.debt += 1;
    map.set(cr.account.id, g);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.dated.sort((a, b) => (a.promised_date ?? '').localeCompare(b.promised_date ?? '') || a.code.localeCompare(b.code));
    g.undated.sort((a, b) => Number(b.flags.untriaged) - Number(a.flags.untriaged) || a.received_at.localeCompare(b.received_at));
  }
  const first = (g: TimelineGroup) => g.dated[0]?.promised_date ?? '9999';
  return groups.sort(
    (a, b) => Number(b.debt > 0) - Number(a.debt > 0) || first(a).localeCompare(first(b)) || a.account.name.localeCompare(b.account.name, 'vi'),
  );
}

export interface DayRange {
  start: ISODate;
  /** number of days shown (start included) */
  days: number;
}

/**
 * From two weeks before today (or the earliest promised date, minus a few days) to five weeks after today (or the
 * latest promised date, plus a week); starts on a Monday so the week lines fall on the grid.
 */
export function timelineRange(groups: TimelineGroup[], today: ISODate): DayRange {
  let lo = addDays(today, -14);
  let hi = addDays(today, 35);
  for (const g of groups) {
    for (const cr of g.dated) {
      const d = cr.promised_date as ISODate;
      if (d < addDays(lo, 3)) lo = addDays(d, -3);
      if (d > addDays(hi, -7)) hi = addDays(d, 7);
    }
  }
  // back to the Monday of that week (getUTCDay: 0 = Sunday)
  const dow = new Date(`${lo}T00:00:00Z`).getUTCDay();
  const start = addDays(lo, -((dow + 6) % 7));
  return { start, days: diffDays(hi, start) + 1 };
}

/** Mondays inside the range (week lines + labels) */
export function weekStarts(range: DayRange): ISODate[] {
  const out: ISODate[] = [];
  for (let i = 0; i < range.days; i += 7) out.push(addDays(range.start, i));
  return out;
}

/** "đã quá hẹn 3 ngày" / "còn 5 ngày" helper: promised − today in days (negative = passed) */
export function daysToPromise(cr: Pick<ChangeRequestView, 'promised_date'>, today: ISODate): number | null {
  return cr.promised_date ? diffDays(cr.promised_date, today) : null;
}
