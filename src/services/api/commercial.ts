// Commercial API (owner: D): price list, account prices, quotes, contracts, payments, receivables.
// Every mutation: requireViewer → assertWritable → permission → db.batch(logActivity + notify*).
// client_member and internal member get 'forbidden' on every method (canAccessCommercial); the price list and
// account prices are for the director and AMs; cost keys only for canSeeCost.

import type { ID, PaymentSchedule, PriceItem, PriceUnit, Quote, QuoteLine, VatRate } from '@/domain/types';
import type { AccountPriceView, Api, PaymentView, PriceItemView, QuoteInput, Viewer } from '@/services/contract';
import { ApiError } from '@/services/contract';
import { nowISO, todayISO } from '@/domain/clock';
import { addDays, isValidISODate } from '@/domain/dates';
import { isOpenStage } from '@/domain/crm';
import { effectivePaymentStatus, isReceivable } from '@/domain/payments';
import { t } from '@/i18n';
import { formatPercent } from '@/lib/format';
import { newId, normalizeText } from '@/lib/utils';
import { db } from '@/services/db';
import {
  accessibleAccountIds,
  assertInternal,
  assertManagerOf,
  assertRole,
  assertWritable,
  canSeeCost,
  noAccess,
  requireViewer,
} from '@/services/context';
import { logActivity } from '@/services/effects';
import { notifyPaymentEvent, notifyQuoteEvent } from '@/services/notifyEvents';
import { accountRef } from '@/services/views';
import { withUnblockNotices } from '@/services/unblockNotices';
import {
  NEW_VERSION_FROM,
  canAccessCommercial,
  canViewQuote,
  computeQuoteRow,
  contractView,
  effectiveQuoteStatus,
  isLatestQuoteVersion,
  latestPerCode,
  livePaymentTask,
  paymentView,
  pricingFor,
  quoteDetail,
  quoteLinesOf,
  quoteNeedsApproval,
  quoteSummary,
  userRefOrStub,
  visibleContracts,
  visiblePayments,
} from '@/services/commercialViews';
import {
  applyQuoteDecision,
  assertQuoteDecidable,
  closeEarlierQuoteTasks,
  createQuoteApprovalTask,
  ensurePaymentTask,
  markPaymentPaid,
  paymentParams,
  quoteParams,
  withNote,
} from '@/services/commercialEffects';

type CommercialApi = Pick<
  Api,
  | 'listPriceItems'
  | 'upsertPriceItem'
  | 'listAccountPrices'
  | 'setAccountPrice'
  | 'listQuotes'
  | 'getQuote'
  | 'createQuote'
  | 'saveQuoteDraft'
  | 'createQuoteVersion'
  | 'requestQuoteApproval'
  | 'approveQuote'
  | 'rejectQuoteApproval'
  | 'sendQuote'
  | 'clientAcceptQuote'
  | 'clientRequestQuoteChanges'
  | 'listContracts'
  | 'listPayments'
  | 'updatePayment'
  | 'setPaymentAutoTask'
  | 'getReceivables'
>;

// ───────────────────────────── errors & access ─────────────────────────────

const forbidden = (): ApiError => new ApiError('forbidden', 'errors.forbidden');
const notFound = (): ApiError => new ApiError('not_found', 'errors.not_found');
const invalid = (field: string, messageKey = 'errors.validation'): ApiError => new ApiError('validation', messageKey, { field });
const conflict = (reason: string): ApiError => new ApiError('conflict', 'errors.conflict', { reason });

/** any viewer allowed to read commercial data: director, AM, client_owner (canAccessCommercial) */
function readViewer(): Viewer {
  const v = requireViewer();
  if (!canAccessCommercial(v)) throw forbidden();
  return v;
}

function writeViewer(): Viewer {
  const v = requireViewer();
  assertWritable(v);
  if (!canAccessCommercial(v)) throw forbidden();
  return v;
}

/** the price list and negotiated account prices: New Era's director and AMs */
function pricingViewer(): Viewer {
  const v = requireViewer();
  assertInternal(v);
  assertRole(v, ['director', 'am']);
  return v;
}

/** accessible accounts, narrowed to `accountId` when given */
function scopeIds(v: Viewer, accountId: ID | undefined): Set<ID> {
  const ids = accessibleAccountIds(v);
  if (!accountId) return ids;
  if (!ids.has(accountId)) throw noAccess(v);
  return new Set([accountId]);
}

function quoteFor(id: ID, v: Viewer): Quote {
  const q = db.find('quotes', id);
  if (!q) throw notFound();
  const ids = accessibleAccountIds(v);
  if (!ids.has(q.account_id)) throw noAccess(v);
  if (!canViewQuote(q, v, ids)) throw notFound();
  return q;
}

function paymentFor(id: ID): { p: PaymentSchedule; accountId: ID } {
  const p = db.find('payment_schedules', id);
  const contract = p ? db.find('contracts', p.contract_id) : undefined;
  if (!p || !contract) throw notFound();
  return { p, accountId: contract.account_id };
}

// ───────────────────────────── price items ─────────────────────────────

const UNITS: readonly PriceUnit[] = ['month', 'user', 'package', 'manday'];
const VAT_RATES: readonly VatRate[] = [0, 5, 8, 10];

function isMoney(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function priceItemView(i: PriceItem, cost: boolean): PriceItemView {
  const view: PriceItemView = {
    id: i.id,
    code: i.code,
    name: i.name,
    unit: i.unit,
    list_price: i.list_price,
    category: i.category,
    active: i.active,
    description: i.description,
  };
  if (cost) {
    view.cost_price = i.cost_price;
    view.margin_pct = i.list_price > 0 ? Math.round(((i.list_price - i.cost_price) / i.list_price) * 1000) / 10 : 0;
  }
  return view;
}

function accountPriceView(item: PriceItem, accountId: ID): AccountPriceView {
  const ap = db.rows('account_prices').find((x) => x.account_id === accountId && x.price_item_id === item.id);
  return {
    price_item_id: item.id,
    code: item.code,
    name: item.name,
    unit: item.unit,
    list_price: item.list_price,
    negotiated_price: ap ? ap.negotiated_price : null,
    note: ap ? ap.note : null,
  };
}

function byCategoryCode(a: PriceItem, b: PriceItem): number {
  return a.category.localeCompare(b.category, 'vi') || a.code.localeCompare(b.code);
}

// ───────────────────────────── quotes: input & lines ─────────────────────────────

interface CleanLine {
  id: ID | null;
  price_item_id: ID;
  description: string | null;
  qty: number;
  /** null → applicable price of the account */
  unit_price: number | null;
  discount_pct: number;
  vat_rate: VatRate;
}

interface CleanQuote {
  title: string;
  project_id: ID | null;
  valid_until: string;
  discount_pct_total: number;
  notes: string | null;
  internal_note: string | null;
  lines: CleanLine[];
}

function textOrNull(s: string | null | undefined): string | null {
  const v = typeof s === 'string' ? s.trim() : '';
  return v ? v : null;
}

function isPct(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
}

function cleanQuoteInput(input: QuoteInput, accountId: ID): CleanQuote {
  if (!input || typeof input !== 'object') throw invalid('input');
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) throw invalid('title');
  if (typeof input.valid_until !== 'string' || !isValidISODate(input.valid_until)) throw invalid('valid_until', 'errors.invalid_date');
  const discountTotal = input.discount_pct_total ?? 0;
  if (!isPct(discountTotal)) throw invalid('discount_pct_total');
  let projectId: ID | null = null;
  if (input.project_id) {
    const project = db.find('projects', input.project_id);
    if (!project || project.account_id !== accountId) throw invalid('project_id');
    projectId = project.id;
  }
  if (!Array.isArray(input.lines)) throw invalid('lines');
  const lines = input.lines.map((l, i): CleanLine => {
    const field = (name: string): string => `lines.${i}.${name}`;
    if (!l || !db.find('price_items', l.price_item_id)) throw invalid(field('price_item_id'));
    if (typeof l.qty !== 'number' || !Number.isFinite(l.qty) || l.qty <= 0) throw invalid(field('qty'));
    const discount = l.discount_pct ?? 0;
    if (!isPct(discount)) throw invalid(field('discount_pct'));
    if (!VAT_RATES.includes(l.vat_rate)) throw invalid(field('vat_rate'));
    const price: unknown = l.unit_price;
    if (price !== undefined && price !== null && !isMoney(price)) throw invalid(field('unit_price'));
    return {
      id: l.id ?? null,
      price_item_id: l.price_item_id,
      description: textOrNull(l.description),
      qty: l.qty,
      unit_price: isMoney(price) && price > 0 ? price : null,
      discount_pct: discount,
      vat_rate: l.vat_rate,
    };
  });
  return {
    title,
    project_id: projectId,
    valid_until: input.valid_until,
    discount_pct_total: discountTotal,
    notes: textOrNull(input.notes),
    internal_note: textOrNull(input.internal_note),
    lines,
  };
}

/** Replace the lines of a quote (keeps ids of lines that are edited in place). Inside a batch. */
function writeQuoteLines(quoteId: ID, accountId: ID, lines: CleanLine[]): void {
  const pricing = pricingFor(accountId);
  const existing = db.rows('quote_lines').filter((l) => l.quote_id === quoteId);
  const keep = new Set<ID>();
  lines.forEach((l, index) => {
    const fields = {
      price_item_id: l.price_item_id,
      description: l.description,
      qty: l.qty,
      unit_price: l.unit_price ?? pricing.applicable(l.price_item_id),
      discount_pct: l.discount_pct,
      vat_rate: l.vat_rate,
      sort_order: index,
    };
    const match = l.id ? existing.find((e) => e.id === l.id && !keep.has(e.id)) : undefined;
    if (match) {
      db.update('quote_lines', match.id, fields);
      keep.add(match.id);
    } else {
      const row: QuoteLine = { id: newId('ql'), quote_id: quoteId, ...fields };
      db.insert('quote_lines', row);
      keep.add(row.id);
    }
  });
  for (const e of existing) if (!keep.has(e.id)) db.hardDelete('quote_lines', e.id);
}

/** 'BG-TA-2026-03': account initials, year, running number */
function nextQuoteCode(accountId: ID): string {
  const account = db.get('accounts', accountId);
  const initials = normalizeText(account.short_name || account.name)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  const prefix = `BG-${initials || 'KH'}-${todayISO().slice(0, 4)}-`;
  const used = new Set(db.allRows('quotes').map((q) => q.code));
  let n = new Set([...used].filter((c) => c.startsWith(prefix))).size + 1;
  while (used.has(`${prefix}${String(n).padStart(2, '0')}`)) n += 1;
  return `${prefix}${String(n).padStart(2, '0')}`;
}

/** e-invoice numbers ("số hóa đơn"): 7 digits, zero-padded — the format of every issued invoice */
const INVOICE_DIGITS = 7;

/** Next number of the one invoice sequence: the highest numeric number issued so far + 1 ('0000575' → '0000576'). */
function nextInvoiceNo(): string {
  let max = 0;
  for (const p of db.allRows('payment_schedules')) {
    const no = (p.invoice_no ?? '').trim();
    if (/^\d+$/.test(no)) max = Math.max(max, Number(no));
  }
  return String(max + 1).padStart(INVOICE_DIGITS, '0');
}

/** groups by code (most recently touched group first), newest version first inside a group */
function sortQuotes(quotes: Quote[]): Quote[] {
  const key = (q: Quote): string => `${q.account_id}|${q.code}`;
  const groupLatest = new Map<string, string>();
  for (const q of quotes) {
    const cur = groupLatest.get(key(q));
    if (!cur || q.updated_at > cur) groupLatest.set(key(q), q.updated_at);
  }
  return [...quotes].sort((a, b) => {
    const ga = groupLatest.get(key(a)) ?? '';
    const gb = groupLatest.get(key(b)) ?? '';
    if (ga !== gb) return gb.localeCompare(ga);
    if (key(a) !== key(b)) return key(a).localeCompare(key(b));
    return b.version - a.version;
  });
}

function logQuote(q: Quote, actorId: ID, action: 'quote.created' | 'quote.updated' | 'quote.version_created' | 'quote.approval_requested' | 'quote.approved' | 'quote.approval_rejected' | 'quote.sent', params: Record<string, string | number>): void {
  logActivity({
    account_id: q.account_id,
    actor_id: actorId,
    action,
    target_type: 'quote',
    target_id: q.id,
    params: { ...quoteParams(q), ...params },
    visibility: action === 'quote.sent' ? 'shared' : 'internal',
  });
}

function discountLabel(q: Quote): string {
  return formatPercent(computeQuoteRow(q).totals.effective_discount_pct, 1);
}

// ───────────────────────────── the API ─────────────────────────────

export const commercialApi: CommercialApi = {
  // ── price list ──
  async listPriceItems(params) {
    const v = pricingViewer();
    const cost = canSeeCost(v);
    return db
      .rows('price_items')
      .filter((i) => params?.includeInactive || i.active)
      .sort(byCategoryCode)
      .map((i) => priceItemView(i, cost));
  },

  async upsertPriceItem(input) {
    const v = requireViewer();
    assertWritable(v);
    assertRole(v, ['director']);
    const code = typeof input.code === 'string' ? input.code.trim() : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!code) throw invalid('code');
    if (!name) throw invalid('name');
    if (!UNITS.includes(input.unit)) throw invalid('unit');
    if (!isMoney(input.list_price)) throw invalid('list_price');
    if (input.cost_price !== undefined && !isMoney(input.cost_price)) throw invalid('cost_price');
    const existing = input.id ? db.find('price_items', input.id) : undefined;
    if (input.id && !existing) throw notFound();
    const duplicate = db.rows('price_items').some((i) => i.id !== input.id && i.code.toLowerCase() === code.toLowerCase());
    if (duplicate) throw conflict('duplicate_code');

    const { result } = db.batch(() => {
      const fields = {
        code,
        name,
        unit: input.unit,
        list_price: input.list_price,
        cost_price: input.cost_price ?? existing?.cost_price ?? 0,
        category: typeof input.category === 'string' ? input.category.trim() : '',
        active: !!input.active,
        description: textOrNull(input.description),
      };
      const row: PriceItem = existing
        ? db.update('price_items', existing.id, fields)
        : db.insert('price_items', { id: newId('pi'), deleted_at: null, ...fields });
      logActivity({
        account_id: null,
        actor_id: v.user.id,
        action: 'settings.updated',
        target_type: 'settings',
        target_id: row.id,
        params: { section: t('activity.commercialGen.price_list_section', { item: `${row.code} – ${row.name}` }) },
        visibility: 'internal',
      });
      return row;
    });
    return priceItemView(result, canSeeCost(v));
  },

  async listAccountPrices(accountId) {
    const v = pricingViewer();
    scopeIds(v, accountId);
    const negotiatedIds = new Set(db.rows('account_prices').filter((x) => x.account_id === accountId).map((x) => x.price_item_id));
    return db
      .rows('price_items')
      .filter((i) => i.active || negotiatedIds.has(i.id))
      .sort(byCategoryCode)
      .map((i) => accountPriceView(i, accountId));
  },

  async setAccountPrice(accountId, priceItemId, price, note) {
    const v = requireViewer();
    assertWritable(v);
    if (!db.find('accounts', accountId)) throw notFound();
    assertManagerOf(v, accountId);
    const item = db.find('price_items', priceItemId);
    if (!item) throw notFound();
    if (price !== null && !isMoney(price)) throw invalid('price');

    db.batch(() => {
      const current = db.rows('account_prices').find((x) => x.account_id === accountId && x.price_item_id === priceItemId);
      if (price === null) {
        if (current) db.hardDelete('account_prices', current.id);
      } else if (current) {
        db.update('account_prices', current.id, { negotiated_price: price, note: note === undefined ? current.note : textOrNull(note) });
      } else {
        db.insert('account_prices', { id: newId('ap'), account_id: accountId, price_item_id: priceItemId, negotiated_price: price, note: textOrNull(note) });
      }
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'account.updated',
        target_type: 'account',
        target_id: accountId,
        params: { fields: t('activity.commercialGen.account_price_field', { item: item.name }) },
        visibility: 'internal',
      });
    });
    return accountPriceView(item, accountId);
  },

  // ── quotes: reads ──
  async listQuotes(filter) {
    const v = readViewer();
    const ids = scopeIds(v, filter?.accountId);
    let quotes = db.rows('quotes').filter((q) => canViewQuote(q, v, ids));
    if (filter?.latestOnly) quotes = latestPerCode(quotes);
    const status = filter?.status;
    if (status) {
      const today = todayISO();
      quotes = quotes.filter((q) => effectiveQuoteStatus(q, today) === status);
    }
    return sortQuotes(quotes).map((q) => quoteSummary(q, v));
  },

  async getQuote(id) {
    const v = readViewer();
    return quoteDetail(quoteFor(id, v), v);
  },

  // ── quotes: internal workflow ──
  async createQuote(accountId, input) {
    const v = writeViewer();
    if (!db.find('accounts', accountId)) throw notFound();
    assertManagerOf(v, accountId);
    const clean = cleanQuoteInput(input, accountId);
    const { result: id } = db.batch(() => {
      const at = nowISO();
      const q: Quote = {
        id: newId('q'),
        account_id: accountId,
        project_id: clean.project_id,
        code: nextQuoteCode(accountId),
        title: clean.title,
        version: 1,
        parent_id: null,
        status: 'draft',
        valid_until: clean.valid_until,
        discount_pct_total: clean.discount_pct_total,
        approval_requested_at: null,
        approval_requested_by: null,
        director_approved_by: null,
        director_approved_at: null,
        approval_note: null,
        sent_at: null,
        sent_by: null,
        client_decision: null,
        client_decided_by: null,
        client_decided_at: null,
        client_note: null,
        notes: clean.notes,
        internal_note: clean.internal_note,
        created_by: v.user.id,
        created_at: at,
        updated_at: at,
        deleted_at: null,
      };
      db.insert('quotes', q);
      writeQuoteLines(q.id, accountId, clean.lines);
      logQuote(q, v.user.id, 'quote.created', {});
      return q.id;
    });
    return quoteDetail(db.get('quotes', id), v);
  },

  async saveQuoteDraft(id, input) {
    const v = writeViewer();
    const q = quoteFor(id, v);
    assertManagerOf(v, q.account_id);
    if (q.status !== 'draft') throw conflict('not_draft');
    const clean = cleanQuoteInput(input, q.account_id);
    db.batch(() => {
      const before = computeQuoteRow(q).totals;
      db.update('quotes', id, {
        title: clean.title,
        project_id: clean.project_id,
        valid_until: clean.valid_until,
        discount_pct_total: clean.discount_pct_total,
        notes: clean.notes,
        internal_note: clean.internal_note,
        updated_at: nowISO(),
      });
      writeQuoteLines(id, q.account_id, clean.lines);
      const fresh = db.get('quotes', id);
      const after = computeQuoteRow(fresh).totals;
      const priceChanged = after.effective_discount_pct !== before.effective_discount_pct || after.grand_total !== before.grand_total;
      // a director approval covers the prices it saw: a price change that still exceeds the threshold voids it
      if (fresh.director_approved_by && priceChanged && quoteNeedsApproval(fresh)) {
        db.update('quotes', id, { director_approved_by: null, director_approved_at: null, approval_note: null });
      }
      logQuote(fresh, v.user.id, 'quote.updated', {});
    });
    return quoteDetail(db.get('quotes', id), v);
  },

  async createQuoteVersion(id) {
    const v = writeViewer();
    const q = quoteFor(id, v);
    assertManagerOf(v, q.account_id);
    if (!NEW_VERSION_FROM.includes(effectiveQuoteStatus(q)) || !isLatestQuoteVersion(q)) throw conflict('not_versionable');
    const { result: nextId } = db.batch(() => {
      const at = nowISO();
      const today = todayISO();
      const version = Math.max(...db.rows('quotes').filter((x) => x.code === q.code && x.account_id === q.account_id).map((x) => x.version)) + 1;
      const next: Quote = {
        ...q,
        id: newId('q'),
        version,
        parent_id: q.id,
        status: 'draft',
        valid_until: q.valid_until < today ? addDays(today, 30) : q.valid_until,
        approval_requested_at: null,
        approval_requested_by: null,
        director_approved_by: null,
        director_approved_at: null,
        approval_note: null,
        sent_at: null,
        sent_by: null,
        client_decision: null,
        client_decided_by: null,
        client_decided_at: null,
        client_note: null,
        created_by: v.user.id,
        created_at: at,
        updated_at: at,
        deleted_at: null,
      };
      db.insert('quotes', next);
      for (const line of quoteLinesOf(q.id)) db.insert('quote_lines', { ...line, id: newId('ql'), quote_id: next.id });
      // an open deal follows its quote to the newest version (its stage, stage date and history stay as they are);
      // a won / lost deal keeps the version it was closed on
      const versionIds = new Set(
        db
          .rows('quotes')
          .filter((x) => x.code === q.code && x.account_id === q.account_id && x.id !== next.id)
          .map((x) => x.id),
      );
      for (const o of db.rows('opportunities')) {
        if (o.quote_id && versionIds.has(o.quote_id) && isOpenStage(o.stage)) db.update('opportunities', o.id, { quote_id: next.id, updated_at: at });
      }
      logQuote(next, v.user.id, 'quote.version_created', { from_version: q.version });
      return next.id;
    });
    return quoteDetail(db.get('quotes', nextId), v);
  },

  async requestQuoteApproval(id, note) {
    const v = writeViewer();
    const q = quoteFor(id, v);
    assertManagerOf(v, q.account_id);
    if (q.status !== 'draft') throw conflict('not_draft');
    if (!quoteNeedsApproval(q) || q.director_approved_by) throw conflict('approval_not_needed');
    const text = textOrNull(note);
    db.batch(() => {
      const at = nowISO();
      db.update('quotes', id, { status: 'pending_approval', approval_requested_at: at, approval_requested_by: v.user.id, updated_at: at });
      logQuote(q, v.user.id, 'quote.approval_requested', withNote({ discount: discountLabel(q) }, 'note', text));
      notifyQuoteEvent('approval_requested', id, v.user.id, text ? { note: text } : undefined);
    });
    return quoteDetail(db.get('quotes', id), v);
  },

  async approveQuote(id, note) {
    const v = writeViewer();
    assertRole(v, ['director']);
    const q = quoteFor(id, v);
    if (q.status !== 'pending_approval') throw conflict('not_pending');
    const text = textOrNull(note);
    db.batch(() => {
      const at = nowISO();
      // back to draft so the AM can send it; director_approved_by marks the approval
      db.update('quotes', id, { status: 'draft', director_approved_by: v.user.id, director_approved_at: at, approval_note: text, updated_at: at });
      logQuote(q, v.user.id, 'quote.approved', withNote({ discount: discountLabel(q) }, 'note', text));
      notifyQuoteEvent('approved', id, v.user.id, text ? { note: text } : undefined);
    });
    return quoteDetail(db.get('quotes', id), v);
  },

  async rejectQuoteApproval(id, reason) {
    const v = writeViewer();
    assertRole(v, ['director']);
    const q = quoteFor(id, v);
    const text = textOrNull(reason);
    if (!text) throw invalid('reason', 'errors.reason_required');
    if (q.status !== 'pending_approval') throw conflict('not_pending');
    db.batch(() => {
      // notify first: the recipient is the requester stored on the quote, cleared just below
      notifyQuoteEvent('approval_rejected', id, v.user.id, { note: text });
      logQuote(q, v.user.id, 'quote.approval_rejected', { reason: text });
      db.update('quotes', id, {
        status: 'draft',
        director_approved_by: null,
        director_approved_at: null,
        approval_note: null,
        approval_requested_at: null,
        approval_requested_by: null,
        updated_at: nowISO(),
      });
    });
    return quoteDetail(db.get('quotes', id), v);
  },

  async sendQuote(id) {
    const v = writeViewer();
    const q = quoteFor(id, v);
    assertManagerOf(v, q.account_id);
    const needs = quoteNeedsApproval(q);
    if (q.status === 'pending_approval' || (q.status === 'draft' && needs && !q.director_approved_by)) {
      throw new ApiError('needs_approval', 'errors.needs_approval');
    }
    if (q.status !== 'draft') throw conflict('not_draft');
    if (quoteLinesOf(q.id).length === 0) throw invalid('lines');
    if (q.valid_until < todayISO()) throw invalid('valid_until', 'errors.invalid_date');
    db.batch(() => {
      const at = nowISO();
      db.update('quotes', id, { status: 'sent', sent_at: at, sent_by: v.user.id, updated_at: at });
      const sent = db.get('quotes', id);
      closeEarlierQuoteTasks(sent, at, v.user.id);
      createQuoteApprovalTask(sent, v.user.id);
      logQuote(sent, v.user.id, 'quote.sent', {});
      notifyQuoteEvent('sent', id, v.user.id);
    });
    return quoteDetail(db.get('quotes', id), v);
  },

  // ── quotes: client decision (client_owner of the account) ──
  async clientAcceptQuote(id, note) {
    const v = writeViewer();
    if (v.role !== 'client_owner') throw forbidden();
    const q = quoteFor(id, v);
    assertQuoteDecidable(q);
    db.batch(() => applyQuoteDecision(q, 'accepted', v.user.id, note, { touchTask: true }));
    return quoteDetail(db.get('quotes', id), v);
  },

  async clientRequestQuoteChanges(id, note) {
    const v = writeViewer();
    if (v.role !== 'client_owner') throw forbidden();
    const q = quoteFor(id, v);
    const text = textOrNull(note);
    if (!text) throw invalid('note', 'errors.reason_required');
    assertQuoteDecidable(q);
    db.batch(() => applyQuoteDecision(q, 'changes_requested', v.user.id, text, { touchTask: true }));
    return quoteDetail(db.get('quotes', id), v);
  },

  // ── contracts & payments ──
  async listContracts(filter) {
    const v = readViewer();
    const ids = scopeIds(v, filter?.accountId);
    return visibleContracts(v, ids)
      .sort((a, b) => b.start_date.localeCompare(a.start_date) || a.code.localeCompare(b.code))
      .map((c) => contractView(c, v));
  },

  async listPayments(filter) {
    const v = readViewer();
    const ids = scopeIds(v, filter?.accountId);
    const status = filter?.status;
    return visiblePayments(v, ids)
      .map((p) => paymentView(p, v))
      .filter((p) => !status || p.status === status)
      .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.name.localeCompare(b.name, 'vi'));
  },

  async updatePayment(id, action, data) {
    const v = requireViewer();
    assertWritable(v);
    const { p, accountId } = paymentFor(id);
    assertManagerOf(v, accountId);
    const contract = db.find('contracts', p.contract_id);
    const log = (
      act: 'payment.invoice_due' | 'payment.invoiced' | 'payment.reopened',
      params: Record<string, string | number>,
    ): void => {
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: act,
        target_type: 'payment',
        target_id: p.id,
        params: { ...paymentParams(p, contract), ...params },
        // a reopen is New Era's bookkeeping correction → internal
        visibility: act === 'payment.invoiced' ? 'shared' : 'internal',
      });
    };

    switch (action) {
      case 'mark_invoice_due': {
        if (p.status !== 'not_due') throw conflict('invalid_transition');
        db.batch(() => {
          db.update('payment_schedules', p.id, { status: 'invoice_due' });
          log('payment.invoice_due', {});
          notifyPaymentEvent('invoice_due', p.id, v.user.id);
        });
        break;
      }
      case 'invoice': {
        if (p.status !== 'not_due' && p.status !== 'invoice_due') throw conflict('invalid_transition');
        const given = textOrNull(data?.invoice_no);
        if (given && given.length > 40) throw invalid('invoice_no');
        db.batch(() => {
          const invoiceNo = given ?? nextInvoiceNo();
          db.update('payment_schedules', p.id, { status: 'invoiced', invoice_no: invoiceNo, invoiced_at: nowISO() });
          log('payment.invoiced', { invoice: invoiceNo });
          ensurePaymentTask(p.id, v.user.id);
          notifyPaymentEvent('invoiced', p.id, v.user.id);
        });
        break;
      }
      case 'mark_paid': {
        if (p.status === 'paid') throw conflict('invalid_transition');
        db.batch(() => markPaymentPaid(p, v.user.id, { touchTask: true }));
        break;
      }
      case 'reopen': {
        if (p.status !== 'paid') throw conflict('invalid_transition');
        db.batch(() => {
          db.update('payment_schedules', p.id, { status: 'invoiced', paid_at: null, invoiced_at: p.invoiced_at ?? nowISO() });
          log('payment.reopened', {});
        });
        break;
      }
      default: {
        const never: never = action;
        throw invalid(String(never));
      }
    }
    return paymentView(db.get('payment_schedules', id), v);
  },

  async setPaymentAutoTask(id, enabled) {
    const v = requireViewer();
    assertWritable(v);
    const { p, accountId } = paymentFor(id);
    assertManagerOf(v, accountId);
    const contract = db.find('contracts', p.contract_id);
    db.batch(() => {
      db.update('payment_schedules', p.id, { auto_task_enabled: enabled });
      if (!enabled) {
        const task = livePaymentTask(p);
        // only withdraw a task the client has not acted on yet
        if (task && task.status !== 'done' && task.waiting_on === 'client') {
          withUnblockNotices(accountId, v.user.id, () => db.softDelete('tasks', task.id, nowISO()));
          db.update('payment_schedules', p.id, { task_id: null });
        }
      } else {
        ensurePaymentTask(p.id, v.user.id);
      }
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'payment.auto_task_toggled',
        target_type: 'payment',
        target_id: p.id,
        params: { ...paymentParams(p, contract), state: t(enabled ? 'activity.commercialGen.auto_on' : 'activity.commercialGen.auto_off') },
        visibility: 'internal',
      });
    });
    return paymentView(db.get('payment_schedules', id), v);
  },

  async getReceivables() {
    const v = readViewer();
    const today = todayISO();
    const byAccount = new Map<ID, PaymentView[]>();
    for (const p of visiblePayments(v, accessibleAccountIds(v))) {
      if (!isReceivable(effectivePaymentStatus(p, today))) continue;
      const view = paymentView(p, v);
      const list = byAccount.get(view.account.id);
      if (list) list.push(view);
      else byAccount.set(view.account.id, [view]);
    }
    const rows = [...byAccount.entries()].flatMap(([accountId, payments]) => {
      const account = db.find('accounts', accountId);
      if (!account) return [];
      payments.sort((a, b) => a.due_date.localeCompare(b.due_date));
      return [
        {
          account: accountRef(account),
          am: userRefOrStub(account.am_id),
          total: payments.reduce((s, x) => s + x.amount, 0),
          overdue: payments.filter((x) => x.status === 'overdue').reduce((s, x) => s + x.amount, 0),
          next_due: payments[0] ?? null,
          payments,
        },
      ];
    });
    rows.sort((a, b) => b.overdue - a.overdue || b.total - a.total);
    return {
      total: rows.reduce((s, r) => s + r.total, 0),
      overdue: rows.reduce((s, r) => s + r.overdue, 0),
      by_account: rows,
    };
  },
};
