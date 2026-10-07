// Viewer-aware DTO builders for the commercial module: quotes, contracts, payments, money (owner: D).
// Filtering for the viewer happens here; sanitizeOutgoing is only defence in depth.
// Rules: client_member never sees commercial data; client_owner sees own account, quotes only once sent;
// cost / margin only for canSeeCost(viewer).

import type { Contract, ID, ISODate, PaymentSchedule, PriceItem, Quote, QuoteLine, QuoteStatus, Task } from '@/domain/types';
import type {
  AccountRef,
  CommercialSummary,
  ContractView,
  LineChange,
  PaymentView,
  QuoteDetail,
  QuoteLineView,
  QuoteSummary,
  QuoteTotals,
  UserRef,
  Viewer,
} from './contract';
import type { ComputedLine, PricingLookup } from '@/domain/quoteMath';
import { dateOf, todayISO } from '@/domain/clock';
import { monthOf } from '@/domain/dates';
import { computeQuote, diffQuoteLines, needsDirectorApproval } from '@/domain/quoteMath';
import { effectivePaymentStatus, paymentOverdueDays } from '@/domain/payments';
import { db } from './db';
import { accessibleAccountIds, canSeeCost, isManagerOf } from './context';
import { accountRef, fileView, milestoneRef, userRefAny, userRefById } from './views';

/** statuses a client may see */
const CLIENT_QUOTE_STATUSES: readonly QuoteStatus[] = ['sent', 'accepted', 'changes_requested', 'expired'];
/** statuses a new version may be created from */
export const NEW_VERSION_FROM: readonly QuoteStatus[] = ['sent', 'changes_requested', 'expired', 'accepted'];

export type QuoteComputation = ReturnType<typeof computeQuote>;
export interface MoneyTotals {
  contract_value: number;
  invoiced: number;
  collected: number;
  receivable: number;
  receivable_overdue: number;
}

// ───────────────────────────── small helpers ─────────────────────────────

function sum(values: number[]): number {
  return values.reduce((acc, n) => acc + n, 0);
}

function byDueDate(a: PaymentSchedule, b: PaymentSchedule): number {
  return a.due_date.localeCompare(b.due_date) || a.name.localeCompare(b.name, 'vi');
}

export function accountRefById(id: ID): AccountRef {
  const a = db.allRows('accounts').find((x) => x.id === id);
  return a ? accountRef(a) : { id, name: '', short_name: '', logo_url: null, brand_color: '' };
}

/** UserRef that never fails (soft-deleted users keep their name; unknown ids get a neutral placeholder). */
export function userRefOrStub(id: ID): UserRef {
  return userRefAny(id);
}

// ───────────────────────────── pricing & quote math ─────────────────────────────

export function quoteThresholdPct(): number {
  return db.settings.discount_approval_threshold_pct;
}

/** Applicable price = account negotiated price, else list price. Soft-deleted items still price old quotes. */
export function pricingFor(accountId: ID): PricingLookup {
  const items = new Map<ID, PriceItem>(db.allRows('price_items').map((i) => [i.id, i]));
  const negotiated = new Map<ID, number>(
    db
      .rows('account_prices')
      .filter((p) => p.account_id === accountId)
      .map((p) => [p.price_item_id, p.negotiated_price]),
  );
  return {
    item(id: ID) {
      const it = items.get(id);
      return it ? { code: it.code, name: it.name, unit: it.unit, list_price: it.list_price, cost_price: it.cost_price } : undefined;
    },
    applicable(id: ID): number {
      return negotiated.get(id) ?? items.get(id)?.list_price ?? 0;
    },
  };
}

export function quoteLinesOf(quoteId: ID): QuoteLine[] {
  return db
    .rows('quote_lines')
    .filter((l) => l.quote_id === quoteId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function computeQuoteRow(q: Quote): QuoteComputation {
  return computeQuote(quoteLinesOf(q.id), q.discount_pct_total, pricingFor(q.account_id));
}

export function quoteNeedsApproval(q: Quote): boolean {
  return needsDirectorApproval(computeQuoteRow(q).totals.effective_discount_pct, quoteThresholdPct());
}

/** 'sent' past valid_until is reported as 'expired' (the daily sweep also persists it). */
export function effectiveQuoteStatus(q: Quote, today: ISODate = todayISO()): QuoteStatus {
  return q.status === 'sent' && q.valid_until < today ? 'expired' : q.status;
}

function sameCode(a: Quote, b: Quote): boolean {
  return a.code === b.code && a.account_id === b.account_id;
}

/** no newer version of the same code exists */
export function isLatestQuoteVersion(q: Quote): boolean {
  return !db.rows('quotes').some((x) => sameCode(x, q) && x.version > q.version);
}

/** a newer version of the same code has been sent to the client → this one can no longer be decided */
export function isQuoteSuperseded(q: Quote): boolean {
  return db.rows('quotes').some((x) => sameCode(x, q) && x.version > q.version && x.sent_at !== null);
}

/** highest version per (account, code) */
export function latestPerCode(quotes: Quote[]): Quote[] {
  const best = new Map<string, Quote>();
  for (const q of quotes) {
    const key = `${q.account_id}|${q.code}`;
    const cur = best.get(key);
    if (!cur || q.version > cur.version) best.set(key, q);
  }
  return [...best.values()];
}

// ───────────────────────────── visibility ─────────────────────────────

/**
 * Quotes, contracts, payments and receivables: director, AM and the client's decision maker. Neither a client_member
 * (SPEC §2: no "Thương mại") nor an internal member (SPEC §2: sees and does assigned work — deals, internal quote
 * notes and negotiated prices are the AM's and the director's) reads them.
 */
export function canAccessCommercial(v: Viewer): boolean {
  return v.role !== 'client_member' && v.role !== 'member';
}

export function canViewQuote(q: Quote, v: Viewer, accountIds: Set<ID> = accessibleAccountIds(v)): boolean {
  if (q.deleted_at || !canAccessCommercial(v)) return false;
  if (!accountIds.has(q.account_id)) return false;
  if (v.org_type === 'internal') return true;
  return CLIENT_QUOTE_STATUSES.includes(effectiveQuoteStatus(q));
}

export function canViewContract(c: Contract, v: Viewer, accountIds: Set<ID> = accessibleAccountIds(v)): boolean {
  if (c.deleted_at || !canAccessCommercial(v)) return false;
  if (!accountIds.has(c.account_id)) return false;
  return v.org_type === 'internal' || c.status !== 'draft';
}

/** contracts visible to the viewer among `accountIds` (pass a subset of the accessible accounts) */
export function visibleContracts(v: Viewer, accountIds: Set<ID>): Contract[] {
  return db.rows('contracts').filter((c) => canViewContract(c, v, accountIds));
}

export function visiblePayments(v: Viewer, accountIds: Set<ID>): PaymentSchedule[] {
  const contractIds = new Set(visibleContracts(v, accountIds).map((c) => c.id));
  return db.rows('payment_schedules').filter((p) => contractIds.has(p.contract_id));
}

/** contracts that count in money totals: live and active | completed */
function countedContracts(accountIds: Set<ID>): Contract[] {
  return db.rows('contracts').filter((c) => accountIds.has(c.account_id) && (c.status === 'active' || c.status === 'completed'));
}

function paymentsOf(contracts: Contract[]): PaymentSchedule[] {
  const ids = new Set(contracts.map((c) => c.id));
  return db.rows('payment_schedules').filter((p) => ids.has(p.contract_id));
}

export function accountIdOfPayment(p: PaymentSchedule): ID | null {
  return db.allRows('contracts').find((c) => c.id === p.contract_id)?.account_id ?? null;
}

/** the live client "Thanh toán" task of an installment, if any */
export function livePaymentTask(p: PaymentSchedule): Task | undefined {
  const direct = p.task_id ? db.find('tasks', p.task_id) : undefined;
  if (direct) return direct;
  return db.rows('tasks').find((task) => task.payment_schedule_id === p.id);
}

// ───────────────────────────── payments & contracts ─────────────────────────────

export function paymentView(p: PaymentSchedule, v: Viewer): PaymentView {
  const today = todayISO();
  const contract = db.allRows('contracts').find((c) => c.id === p.contract_id);
  const ms = p.milestone_id ? db.find('milestones', p.milestone_id) : undefined;
  const milestone = ms && (v.org_type === 'internal' || ms.client_visible) ? milestoneRef(ms) : null;
  const proof = p.proof_file_id ? db.find('files', p.proof_file_id) : undefined;
  return {
    id: p.id,
    contract_id: p.contract_id,
    contract_code: contract?.code ?? '',
    account: accountRefById(contract?.account_id ?? ''),
    name: p.name,
    percent: p.percent,
    amount: p.amount,
    milestone,
    due_date: p.due_date,
    status: effectivePaymentStatus(p, today),
    overdue_days: paymentOverdueDays(p, today),
    invoice_no: p.invoice_no,
    invoiced_at: p.invoiced_at,
    paid_at: p.paid_at,
    client_reported_at: p.client_reported_at,
    proof_file: proof ? fileView(proof, v) : null,
    auto_task_enabled: p.auto_task_enabled,
    task_id: livePaymentTask(p)?.id ?? null,
  };
}

export function contractView(c: Contract, v: Viewer): ContractView {
  const today = todayISO();
  const payments = db
    .rows('payment_schedules')
    .filter((p) => p.contract_id === c.id)
    .sort(byDueDate);
  const collected = sum(payments.filter((p) => effectivePaymentStatus(p, today) === 'paid').map((p) => p.amount));
  const file = c.file_id ? db.find('files', c.file_id) : undefined;
  return {
    id: c.id,
    account: accountRefById(c.account_id),
    quote_id: c.quote_id,
    code: c.code,
    title: c.title,
    value: c.value,
    signed_date: c.signed_date,
    start_date: c.start_date,
    end_date: c.end_date,
    status: c.status,
    file: file ? fileView(file, v) : null,
    payments: payments.map((p) => paymentView(p, v)),
    collected,
    outstanding: Math.max(0, c.value - collected),
  };
}

// ───────────────────────────── quotes ─────────────────────────────

function lineView(cl: ComputedLine, cost: boolean, change: LineChange, changed: QuoteLineView['changed_fields']): QuoteLineView {
  const view: QuoteLineView = {
    id: cl.line.id,
    price_item_id: cl.line.price_item_id,
    code: cl.code,
    name: cl.name,
    unit: cl.unit,
    description: cl.line.description,
    qty: cl.line.qty,
    list_price: cl.list_price,
    applicable_price: cl.applicable_price,
    unit_price: cl.line.unit_price,
    discount_pct: cl.line.discount_pct,
    vat_rate: cl.line.vat_rate,
    subtotal: cl.subtotal,
    discount_amount: cl.discount_amount,
    net: cl.net,
    vat_amount: cl.vat_amount,
    total: cl.total,
    change,
    changed_fields: [...changed],
  };
  if (cost) view.cost_total = cl.cost_total;
  return view;
}

function totalsView(all: Required<QuoteTotals>, cost: boolean, internal: boolean): QuoteTotals {
  const totals: QuoteTotals = {
    gross_applicable: all.gross_applicable,
    subtotal: all.subtotal,
    line_discount: all.line_discount,
    header_discount: all.header_discount,
    net_before_vat: all.net_before_vat,
    vat: all.vat,
    grand_total: all.grand_total,
    // the effective discount drives New Era's approval threshold (internal workflow): clients get a neutral 0
    effective_discount_pct: internal ? all.effective_discount_pct : 0,
  };
  if (cost) {
    totals.cost_total = all.cost_total;
    totals.margin = all.margin;
    totals.margin_pct = all.margin_pct;
  }
  return totals;
}

function summaryFrom(q: Quote, v: Viewer, totals: Required<QuoteTotals>): QuoteSummary {
  const internal = v.org_type === 'internal';
  return {
    id: q.id,
    code: q.code,
    title: q.title,
    version: q.version,
    status: effectiveQuoteStatus(q),
    account: accountRefById(q.account_id),
    valid_until: q.valid_until,
    grand_total: totals.grand_total,
    // the approval workflow is internal: clients get neutral values
    effective_discount_pct: internal ? totals.effective_discount_pct : 0,
    needs_approval: internal && needsDirectorApproval(totals.effective_discount_pct, quoteThresholdPct()),
    approved: internal && q.director_approved_by !== null,
    sent_at: q.sent_at,
    client_decision: q.client_decision,
    client_decided_at: q.client_decided_at,
    created_by: userRefOrStub(q.created_by),
    created_at: q.created_at,
    updated_at: q.updated_at,
  };
}

export function quoteSummary(q: Quote, v: Viewer): QuoteSummary {
  return summaryFrom(q, v, computeQuoteRow(q).totals);
}

export function quoteDetail(q: Quote, v: Viewer): QuoteDetail {
  const today = todayISO();
  const internal = v.org_type === 'internal';
  const cost = canSeeCost(v);
  const pricing = pricingFor(q.account_id);
  const lines = quoteLinesOf(q.id);
  const computed = computeQuote(lines, q.discount_pct_total, pricing);
  const summary = summaryFrom(q, v, computed.totals);
  const status = effectiveQuoteStatus(q, today);

  // diff vs the previous version (only when the viewer may see that version)
  const accountIds = accessibleAccountIds(v);
  const parentRow = q.parent_id ? db.find('quotes', q.parent_id) : undefined;
  const parent = parentRow && canViewQuote(parentRow, v, accountIds) ? parentRow : undefined;
  let lineViews: QuoteLineView[];
  let removed: QuoteLineView[] = [];
  if (parent) {
    const parentLines = quoteLinesOf(parent.id);
    const diff = diffQuoteLines(parentLines, lines);
    lineViews = computed.lines.map((cl) => {
      const ch = diff.byLineId.get(cl.line.id);
      return lineView(cl, cost, ch?.change ?? null, ch?.changed_fields ?? []);
    });
    if (diff.removed.length > 0) {
      const removedIds = new Set(diff.removed.map((l) => l.id));
      removed = computeQuote(parentLines, parent.discount_pct_total, pricing)
        .lines.filter((cl) => removedIds.has(cl.line.id))
        .map((cl) => lineView(cl, cost, 'removed', []));
    }
  } else {
    lineViews = computed.lines.map((cl) => lineView(cl, cost, null, []));
  }

  const versions = db
    .rows('quotes')
    .filter((x) => sameCode(x, q) && canViewQuote(x, v, accountIds))
    .sort((a, b) => b.version - a.version)
    .map((x) => quoteSummary(x, v));

  const threshold = quoteThresholdPct();
  const needs = needsDirectorApproval(computed.totals.effective_discount_pct, threshold);
  const approved = q.director_approved_by !== null;
  const manager = isManagerOf(v, q.account_id);
  const isDraft = status === 'draft';

  let sendBlock: QuoteDetail['send_block_reason'] = null;
  if (internal) {
    if (needs && !approved && (isDraft || status === 'pending_approval')) sendBlock = 'needs_director_approval';
    else if (!isDraft) sendBlock = 'not_draft';
  }

  const detail: QuoteDetail = {
    ...summary,
    project_id: q.project_id,
    parent_id: internal || parent ? q.parent_id : null,
    discount_pct_total: q.discount_pct_total,
    notes: q.notes,
    approval_requested_at: internal ? q.approval_requested_at : null,
    approval_requested_by: internal ? userRefById(q.approval_requested_by) : null,
    director_approved_by: internal ? userRefById(q.director_approved_by) : null,
    director_approved_at: internal ? q.director_approved_at : null,
    approval_note: internal ? q.approval_note : null,
    sent_by: userRefById(q.sent_by),
    client_decided_by: userRefById(q.client_decided_by),
    client_note: q.client_note,
    lines: lineViews,
    removed_lines: removed,
    totals: totalsView(computed.totals, cost, internal),
    versions,
    threshold_pct: internal ? threshold : 0,
    send_block_reason: sendBlock,
    can: {
      edit: manager && isDraft,
      request_approval: manager && isDraft && needs && !approved,
      approve: internal && v.role === 'director' && !v.read_only && status === 'pending_approval',
      send: manager && isDraft && (!needs || approved),
      new_version: manager && NEW_VERSION_FROM.includes(status) && isLatestQuoteVersion(q),
      client_decide:
        v.role === 'client_owner' && !v.read_only && v.account_id === q.account_id && status === 'sent' && !isQuoteSuperseded(q),
    },
  };
  if (internal) detail.internal_note = q.internal_note;
  return detail;
}

/** quotes waiting for the director, oldest request first */
export function quotesPendingApproval(accountIds: Set<ID>): Quote[] {
  return db
    .rows('quotes')
    .filter((q) => accountIds.has(q.account_id) && q.status === 'pending_approval')
    .sort((a, b) => (a.approval_requested_at ?? a.updated_at).localeCompare(b.approval_requested_at ?? b.updated_at));
}

// ───────────────────────────── money ─────────────────────────────

export function accountMoney(accountId: ID): MoneyTotals {
  const today = todayISO();
  const contracts = countedContracts(new Set([accountId]));
  let invoiced = 0;
  let collected = 0;
  let receivable = 0;
  let receivableOverdue = 0;
  for (const p of paymentsOf(contracts)) {
    const status = effectivePaymentStatus(p, today);
    if (status === 'paid') {
      invoiced += p.amount;
      collected += p.amount;
    } else if (status === 'invoiced') {
      invoiced += p.amount;
      receivable += p.amount;
    } else if (status === 'overdue') {
      invoiced += p.amount;
      receivable += p.amount;
      receivableOverdue += p.amount;
    }
  }
  return {
    contract_value: sum(contracts.map((c) => c.value)),
    invoiced,
    collected,
    receivable,
    receivable_overdue: receivableOverdue,
  };
}

export function commercialSummary(accountId: ID, v: Viewer): CommercialSummary | null {
  if (!canAccessCommercial(v)) return null;
  const accountIds = accessibleAccountIds(v);
  if (!accountIds.has(accountId)) return null;
  const today = todayISO();
  const scope = new Set([accountId]);

  const visibleQuotes = db.rows('quotes').filter((q) => q.account_id === accountId && canViewQuote(q, v, accountIds));
  const openQuote = latestPerCode(visibleQuotes)
    .filter((q) => {
      const s = effectiveQuoteStatus(q, today);
      return s !== 'accepted' && s !== 'expired';
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

  const nextPayment = visiblePayments(v, scope)
    .filter((p) => effectivePaymentStatus(p, today) !== 'paid')
    .sort(byDueDate)[0];

  return {
    ...accountMoney(accountId),
    open_quote: openQuote ? quoteSummary(openQuote, v) : null,
    next_payment: nextPayment ? paymentView(nextPayment, v) : null,
  };
}

/** 12 months 'YYYY-MM': planned = Σ amount by due month; actual = Σ amount by paid month. */
export function cashflowForYear(year: number, accountIds: Set<ID>): { month: string; planned: number; actual: number }[] {
  const rows = Array.from({ length: 12 }, (_, i) => ({ month: `${year}-${String(i + 1).padStart(2, '0')}`, planned: 0, actual: 0 }));
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  for (const p of paymentsOf(countedContracts(accountIds))) {
    const plannedRow = byMonth.get(monthOf(p.due_date));
    if (plannedRow) plannedRow.planned += p.amount;
    if (p.status === 'paid' && p.paid_at) {
      const actualRow = byMonth.get(monthOf(dateOf(p.paid_at)));
      if (actualRow) actualRow.actual += p.amount;
    }
  }
  return rows;
}

/** effectively overdue installments, most overdue first */
export function overduePayments(accountIds: Set<ID>): PaymentSchedule[] {
  const today = todayISO();
  return paymentsOf(countedContracts(accountIds))
    .filter((p) => effectivePaymentStatus(p, today) === 'overdue')
    .sort((a, b) => paymentOverdueDays(b, today) - paymentOverdueDays(a, today) || b.amount - a.amount);
}
