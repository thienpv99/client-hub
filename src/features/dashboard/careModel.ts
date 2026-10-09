// Care side of the overview (SPEC-CARE §6.2), pure: the KPI numbers, the merged "Cần chú ý hôm nay" list (delivery
// debt, requests waiting too long or taken in without a date, overdue care, the expansion map's next steps due this
// week + the classic attention items) and the room to grow per signed client.
import type { AttentionItem } from '@/services/contract';
import type { CarePortfolioRow, ChangeRequestView, DebtReason, EcosystemRef, ExpansionNextStep } from '@/services/careContract';
import type { ISODate } from '@/domain/types';
import { isSignedStage } from '@/domain/care';
import { diffDays } from '@/domain/dates';

// ───────────────────────────── links ─────────────────────────────

/**
 * account page, optionally on one of its tabs (delivery · expansion · relationships …) with the tab's deep-link
 * parameters (features/account/accountTabs: delivery `?filter=debt|untriaged`, `?cr=<id>` …)
 */
export function accountHref(accountId: string, tab?: string, params?: Record<string, string>): string {
  const base = `/app/accounts/${encodeURIComponent(accountId)}`;
  const path = tab ? `${base}/${tab}` : base;
  const query = params ? new URLSearchParams(params).toString() : '';
  return query ? `${path}?${query}` : path;
}

/** the group matrix ("Ma trận" view of /app/map), optionally opened on one business group */
export function matrixHref(ecosystemId?: string | null): string {
  return ecosystemId ? `/app/map?view=matrix&eco=${encodeURIComponent(ecosystemId)}` : '/app/map?view=matrix';
}

/** every change request (Dự án › Yêu cầu) */
export const REQUESTS_HREF = '/app/projects/requests';

// ───────────────────────────── KPIs ─────────────────────────────

export interface CareKpiNumbers {
  /** requests owed to clients (Σ debt) and the clients they sit with */
  debt: number;
  debtAccounts: number;
  /** requests 'new' for more than 7 days */
  untriaged: number;
  untriagedAccounts: number;
  /** open requests (all clients) */
  open: number;
  careOverdue: number;
  careDueSoon: number;
  careOk: number;
  total: number;
}

/** care is about signed clients (SPEC-CARE §0): prospects are not counted in the care rhythm */
export function isSignedRow(r: Pick<CarePortfolioRow, 'stage'>): boolean {
  return isSignedStage(r.stage);
}

export function careKpis(rows: CarePortfolioRow[]): CareKpiNumbers {
  const signed = rows.filter(isSignedRow);
  const out: CareKpiNumbers = {
    debt: 0,
    debtAccounts: 0,
    untriaged: 0,
    untriagedAccounts: 0,
    open: 0,
    careOverdue: 0,
    careDueSoon: 0,
    careOk: 0,
    total: signed.length,
  };
  for (const r of rows) {
    out.debt += r.requests.debt;
    if (r.requests.debt > 0) out.debtAccounts += 1;
    out.untriaged += r.requests.untriaged;
    if (r.requests.untriaged > 0) out.untriagedAccounts += 1;
    out.open += r.requests.open;
  }
  for (const r of signed) {
    if (r.care.status === 'overdue') out.careOverdue += 1;
    else if (r.care.status === 'due_soon') out.careDueSoon += 1;
    else out.careOk += 1;
  }
  return out;
}

// ───────────────────────────── "Cần chú ý hôm nay" ─────────────────────────────

export type Severity = 1 | 2 | 3;

export type FocusItem =
  | { key: string; type: 'attention'; severity: Severity; item: AttentionItem }
  /** requests owed to one client (delivery debt), most urgent first */
  | { key: string; type: 'debt'; severity: Severity; account: CarePortfolioRow['account']; requests: ChangeRequestView[] }
  /** requests of one client waiting more than 7 days to be picked up, longest first */
  | { key: string; type: 'untriaged'; severity: Severity; account: CarePortfolioRow['account']; requests: ChangeRequestView[] }
  /** requests of one client taken in more than 14 days ago with no date told to the client, longest first */
  | { key: string; type: 'undated'; severity: Severity; account: CarePortfolioRow['account']; requests: ChangeRequestView[] }
  /** a client overdue (or nearly due) for a care touch */
  | { key: string; type: 'care'; severity: Severity; row: CarePortfolioRow }
  /** the expansion map's next steps of one client due within 7 days or overdue (Mở rộng), soonest first */
  | { key: string; type: 'nextStep'; severity: Severity; row: CarePortfolioRow; steps: ExpansionNextStep[] };

const DEBT_REASON_ORDER: Record<DebtReason, number> = { date_passed: 0, no_plan: 1, no_owner: 2 };

function debtRank(r: ChangeRequestView): number {
  return r.flags.debt_reason ? DEBT_REASON_ORDER[r.flags.debt_reason] : 3;
}

function groupByAccount(requests: ChangeRequestView[]): Map<string, ChangeRequestView[]> {
  const out = new Map<string, ChangeRequestView[]>();
  for (const r of requests) {
    const list = out.get(r.account.id) ?? [];
    list.push(r);
    out.set(r.account.id, list);
  }
  return out;
}

/**
 * Order of the list: delivery debt → the severe classic items (a milestone held up, an escalation) → requests waiting
 * too long → requests taken in without a date → overdue care → overdue expansion steps → the other classic items →
 * care due soon → expansion steps due this week → "theo dõi" items. Within a tier the api order (attention) or the
 * most urgent first.
 */
const TIER = {
  debt: 0,
  attention1: 1,
  untriaged: 2,
  undated: 3,
  careOverdue: 4,
  nextStepOverdue: 5,
  attention2: 6,
  careDueSoon: 7,
  nextStepSoon: 8,
  attention3: 9,
} as const;

/** days a client is past its care date or rhythm (negative = still within it); never touched = very late */
export function careLateness(row: CarePortfolioRow, today: ISODate): number {
  const c = row.care;
  if (c.days_since === null) return 10_000;
  const pastRhythm = c.days_since - c.cadence_days;
  const pastAction = c.next_action_overdue && c.next_action_due ? diffDays(today, c.next_action_due) : -10_000;
  return Math.max(pastRhythm, pastAction);
}

export function buildFocusItems(
  attention: AttentionItem[],
  rows: CarePortfolioRow[],
  requests: ChangeRequestView[],
  today: ISODate,
): FocusItem[] {
  const ranked: { tier: number; order: number; item: FocusItem }[] = [];

  const debt = groupByAccount(requests.filter((r) => r.flags.debt));
  for (const list of debt.values()) {
    list.sort((a, b) => debtRank(a) - debtRank(b) || (a.promised_date ?? '').localeCompare(b.promised_date ?? '') || a.code.localeCompare(b.code));
    const first = list[0];
    if (!first) continue;
    ranked.push({
      tier: TIER.debt,
      order: -list.length,
      item: { key: `debt:${first.account.id}`, type: 'debt', severity: 1, account: first.account, requests: list },
    });
  }

  const waiting = groupByAccount(requests.filter((r) => r.flags.untriaged));
  for (const list of waiting.values()) {
    list.sort((a, b) => b.flags.days_waiting - a.flags.days_waiting || a.code.localeCompare(b.code));
    const first = list[0];
    if (!first) continue;
    ranked.push({
      tier: TIER.untriaged,
      order: -first.flags.days_waiting,
      item: { key: `untriaged:${first.account.id}`, type: 'untriaged', severity: 2, account: first.account, requests: list },
    });
  }

  const undated = groupByAccount(requests.filter((r) => r.flags.undated));
  for (const list of undated.values()) {
    list.sort((a, b) => b.flags.days_since_triage - a.flags.days_since_triage || a.code.localeCompare(b.code));
    const first = list[0];
    if (!first) continue;
    ranked.push({
      tier: TIER.undated,
      order: -first.flags.days_since_triage,
      item: { key: `undated:${first.account.id}`, type: 'undated', severity: 2, account: first.account, requests: list },
    });
  }

  for (const row of rows) {
    // prospects are not in the care rhythm (no signed contract yet)
    if (row.care.status === 'ok' || !isSignedRow(row)) continue;
    const overdue = row.care.status === 'overdue';
    // the most neglected first: never touched, then the longest past its date or its rhythm
    ranked.push({
      tier: overdue ? TIER.careOverdue : TIER.careDueSoon,
      order: -careLateness(row, today),
      item: { key: `care:${row.account.id}`, type: 'care', severity: overdue ? 2 : 3, row },
    });
  }

  // the AM's weekly selling steps (Mở rộng): one row per signed client, overdue ones as "cần xử lý"
  for (const row of rows) {
    const steps = row.expansion.next_steps ?? [];
    const first = steps[0];
    if (!first || !isSignedRow(row)) continue;
    const overdue = steps.some((s) => s.overdue);
    ranked.push({
      tier: overdue ? TIER.nextStepOverdue : TIER.nextStepSoon,
      order: diffDays(first.next_step_due, today),
      item: { key: `nextStep:${row.account.id}`, type: 'nextStep', severity: overdue ? 2 : 3, row, steps },
    });
  }

  attention.forEach((item, i) => {
    const tier = item.severity === 1 ? TIER.attention1 : item.severity === 2 ? TIER.attention2 : TIER.attention3;
    ranked.push({ tier, order: i, item: { key: `attention:${item.id}`, type: 'attention', severity: item.severity, item } });
  });

  return ranked.sort((a, b) => a.tier - b.tier || a.order - b.order).map((r) => r.item);
}

// ───────────────────────────── room to grow ─────────────────────────────


export interface RoomGroup {
  ecosystem: EcosystemRef;
  value: number;
  units: number;
}

export interface RoomToGrow {
  /** signed clients with an opportunity, largest estimated value first */
  rows: CarePortfolioRow[];
  /** Σ estimated value of those opportunities, VND */
  total: number;
  /** business groups holding at least one of those clients, largest value first */
  groups: RoomGroup[];
}

export function roomToGrow(rows: CarePortfolioRow[]): RoomToGrow {
  const open = rows
    // signed clients only: the room to grow is about selling more to them, not prospecting
    .filter((r) => isSignedRow(r) && r.expansion.opportunity_count > 0)
    .sort(
      (a, b) =>
        b.expansion.est_value_total - a.expansion.est_value_total ||
        b.expansion.opportunity_count - a.expansion.opportunity_count ||
        a.account.name.localeCompare(b.account.name, 'vi'),
    );
  const groups = new Map<string, RoomGroup>();
  for (const r of open) {
    if (!r.ecosystem) continue;
    const g = groups.get(r.ecosystem.id) ?? { ecosystem: r.ecosystem, value: 0, units: 0 };
    g.value += r.expansion.est_value_total;
    g.units += 1;
    groups.set(r.ecosystem.id, g);
  }
  return {
    rows: open,
    total: open.reduce((s, r) => s + r.expansion.est_value_total, 0),
    groups: [...groups.values()].sort((a, b) => b.value - a.value || a.ecosystem.name.localeCompare(b.ecosystem.name, 'vi')),
  };
}
