// Editable quote draft ↔ QuoteDetail / QuoteInput, live pricing (domain quoteMath) and live diff vs the previous version.
import type { ID, ISODate, PriceUnit, QuoteLine, VatRate } from '@/domain/types';
import type { AccountPriceView, PriceItemView, QuoteDetail, QuoteInput, QuoteLineView, QuoteTotals } from '@/services/contract';
import type { PricingLookup } from '@/domain/quoteMath';
import { computeQuote, diffQuoteLines } from '@/domain/quoteMath';
import { addDays } from '@/domain/dates';
import { newId } from '@/lib/utils';
import { parseDecimal } from '../lib';

export const VAT_RATES: VatRate[] = [0, 5, 8, 10];

export interface DraftLine {
  /** stable React key (server line id, or a local id for new lines) */
  key: string;
  /** server line id (kept so a version diff stays stable) */
  id: ID | null;
  price_item_id: ID;
  description: string;
  qty: string;
  /** whole VND; 0 = use the account's applicable price */
  unit_price: number;
  discount_pct: string;
  vat_rate: VatRate;
}

export interface QuoteDraft {
  title: string;
  project_id: ID | null;
  valid_until: ISODate;
  discount_pct_total: string;
  notes: string;
  internal_note: string;
  lines: DraftLine[];
}

/** decimal text for an input: 12.5 → '12,5', 0 → '0' */
export function decimalText(v: number): string {
  return String(v).replace('.', ',');
}

export function draftFromDetail(q: QuoteDetail): QuoteDraft {
  return {
    title: q.title,
    project_id: q.project_id,
    valid_until: q.valid_until,
    discount_pct_total: decimalText(q.discount_pct_total),
    notes: q.notes ?? '',
    internal_note: q.internal_note ?? '',
    lines: q.lines.map((l) => ({
      key: l.id,
      id: l.id,
      price_item_id: l.price_item_id,
      description: l.description ?? '',
      qty: decimalText(l.qty),
      unit_price: l.unit_price,
      discount_pct: decimalText(l.discount_pct),
      vat_rate: l.vat_rate,
    })),
  };
}

export function emptyDraft(today: ISODate): QuoteDraft {
  return { title: '', project_id: null, valid_until: addDays(today, 30), discount_pct_total: '0', notes: '', internal_note: '', lines: [] };
}

export function newDraftLine(itemId: ID, applicablePrice: number): DraftLine {
  return { key: newId('dl'), id: null, price_item_id: itemId, description: '', qty: '1', unit_price: applicablePrice, discount_pct: '0', vat_rate: 10 };
}

function num(raw: string): number {
  const v = parseDecimal(raw);
  return Number.isFinite(v) ? v : 0;
}

export function draftToInput(d: QuoteDraft): QuoteInput {
  return {
    title: d.title.trim(),
    project_id: d.project_id,
    valid_until: d.valid_until,
    discount_pct_total: num(d.discount_pct_total),
    notes: d.notes.trim() || null,
    internal_note: d.internal_note.trim() || null,
    lines: d.lines.map((l) => ({
      id: l.id ?? undefined,
      price_item_id: l.price_item_id,
      description: l.description.trim() || null,
      qty: num(l.qty),
      unit_price: l.unit_price,
      discount_pct: num(l.discount_pct),
      vat_rate: l.vat_rate,
    })),
  };
}

/** comparable form (ignores local keys and formatting) */
export function draftSignature(d: QuoteDraft): string {
  const input = draftToInput(d);
  return JSON.stringify({ ...input, lines: input.lines.map((l) => ({ ...l, id: l.id ?? null })) });
}

// ───────────────────────────── validation ─────────────────────────────

export interface DraftErrors {
  title: boolean;
  valid_until: boolean;
  discount_total: boolean;
  lines: Record<string, { qty: boolean; discount: boolean }>;
  any: boolean;
}

function badPct(raw: string): boolean {
  const v = parseDecimal(raw);
  return !Number.isFinite(v) || v < 0 || v > 100;
}

export function validateDraft(d: QuoteDraft): DraftErrors {
  const lines: DraftErrors['lines'] = {};
  let anyLine = false;
  for (const l of d.lines) {
    const q = parseDecimal(l.qty);
    const qty = !Number.isFinite(q) || q <= 0;
    const discount = badPct(l.discount_pct);
    if (qty || discount) anyLine = true;
    lines[l.key] = { qty, discount };
  }
  const title = !d.title.trim();
  const valid_until = !/^\d{4}-\d{2}-\d{2}$/.test(d.valid_until);
  const discount_total = badPct(d.discount_pct_total);
  return { title, valid_until, discount_total, lines, any: title || valid_until || discount_total || anyLine };
}

// ───────────────────────────── pricing ─────────────────────────────

export interface CatalogItem {
  id: ID;
  code: string;
  name: string;
  unit: PriceUnit;
  category: string;
  active: boolean;
  description: string | null;
  list_price: number;
  negotiated: number | null;
  /** only when the api returned it */
  cost_price?: number;
}

export interface Catalog {
  items: Map<ID, CatalogItem>;
  /** active items for the picker, by category then code */
  pickable: CatalogItem[];
  costVisible: boolean;
  applicable(id: ID): number;
  lookup: PricingLookup;
}

/** price list + the account's negotiated prices (+ lines of the quote itself, for items no longer listed) */
export function buildCatalog(items: PriceItemView[], accountPrices: AccountPriceView[], quoteLines: QuoteLineView[] = []): Catalog {
  const negotiated = new Map<ID, number>();
  for (const ap of accountPrices) if (ap.negotiated_price !== null) negotiated.set(ap.price_item_id, ap.negotiated_price);
  const map = new Map<ID, CatalogItem>();
  for (const i of items) {
    map.set(i.id, {
      id: i.id,
      code: i.code,
      name: i.name,
      unit: i.unit,
      category: i.category,
      active: i.active,
      description: i.description,
      list_price: i.list_price,
      negotiated: negotiated.get(i.id) ?? null,
      cost_price: i.cost_price,
    });
  }
  for (const l of quoteLines) {
    if (map.has(l.price_item_id)) continue;
    map.set(l.price_item_id, {
      id: l.price_item_id,
      code: l.code,
      name: l.name,
      unit: l.unit,
      category: '',
      active: false,
      description: null,
      list_price: l.list_price,
      negotiated: l.applicable_price !== l.list_price ? l.applicable_price : null,
    });
  }
  const costVisible = items.some((i) => i.cost_price !== undefined);
  const applicable = (id: ID): number => {
    const it = map.get(id);
    return it ? (it.negotiated ?? it.list_price) : 0;
  };
  const pickable = [...map.values()]
    .filter((i) => i.active)
    .sort((a, b) => a.category.localeCompare(b.category, 'vi') || a.code.localeCompare(b.code));
  return {
    items: map,
    pickable,
    costVisible,
    applicable,
    lookup: {
      item(id: ID) {
        const it = map.get(id);
        return it ? { code: it.code, name: it.name, unit: it.unit, list_price: it.list_price, cost_price: it.cost_price ?? 0 } : undefined;
      },
      applicable,
    },
  };
}

export function draftQuoteLines(d: QuoteDraft, catalog: Catalog): QuoteLine[] {
  return d.lines.map((l, i) => ({
    id: l.id ?? l.key,
    quote_id: 'draft',
    price_item_id: l.price_item_id,
    description: l.description.trim() || null,
    qty: num(l.qty),
    unit_price: l.unit_price > 0 ? l.unit_price : catalog.applicable(l.price_item_id),
    discount_pct: Math.min(100, Math.max(0, num(l.discount_pct))),
    vat_rate: l.vat_rate,
    sort_order: i,
  }));
}

export interface LivePricing {
  /** by draft line key */
  lines: Map<string, { amount: number; total: number; applicable: number; list: number }>;
  totals: QuoteTotals;
}

export function priceDraft(d: QuoteDraft, catalog: Catalog): LivePricing {
  const ql = draftQuoteLines(d, catalog);
  const { lines, totals } = computeQuote(ql, Math.min(100, Math.max(0, num(d.discount_pct_total))), catalog.lookup);
  const byId = new Map(lines.map((cl) => [cl.line.id, cl]));
  const out: LivePricing['lines'] = new Map();
  for (const l of d.lines) {
    const cl = byId.get(l.id ?? l.key);
    if (!cl) continue;
    out.set(l.key, { amount: cl.subtotal - cl.discount_amount, total: cl.total, applicable: cl.applicable_price, list: cl.list_price });
  }
  const shown: QuoteTotals = { ...totals };
  if (!catalog.costVisible) {
    delete shown.cost_total;
    delete shown.margin;
    delete shown.margin_pct;
  }
  return { lines: out, totals: shown };
}

// ───────────────────────────── diff vs previous version ─────────────────────────────

export type LineDiff = { change: 'added' | 'modified' | null; changed: QuoteLineView['changed_fields'] };

function asQuoteLines(lines: QuoteLineView[]): QuoteLine[] {
  return lines.map((l, i) => ({
    id: l.id,
    quote_id: 'parent',
    price_item_id: l.price_item_id,
    description: l.description,
    qty: l.qty,
    unit_price: l.unit_price,
    discount_pct: l.discount_pct,
    vat_rate: l.vat_rate,
    sort_order: i,
  }));
}

/** live diff of the draft against the previous version's lines; removed = parent lines no longer present */
export function diffDraft(
  d: QuoteDraft,
  catalog: Catalog,
  parentLines: QuoteLineView[],
): { byKey: Map<string, LineDiff>; removed: QuoteLineView[] } {
  const draftLines = draftQuoteLines(d, catalog);
  const { byLineId, removed } = diffQuoteLines(asQuoteLines(parentLines), draftLines);
  const byKey = new Map<string, LineDiff>();
  for (const l of d.lines) {
    const ch = byLineId.get(l.id ?? l.key);
    if (!ch) continue;
    byKey.set(l.key, { change: ch.change === 'removed' ? null : ch.change, changed: ch.changed_fields });
  }
  const removedIds = new Set(removed.map((r) => r.id));
  return { byKey, removed: parentLines.filter((l) => removedIds.has(l.id)) };
}
