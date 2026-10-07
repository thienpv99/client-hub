// Quote arithmetic (integer VND) and version diff.
import type { ID, PriceUnit, QuoteLine } from './types';
import type { LineChange, QuoteLineView, QuoteTotals } from '@/services/contract';

export interface PricingLookup {
  item(id: ID): { code: string; name: string; unit: PriceUnit; list_price: number; cost_price: number } | undefined;
  /** price that applies to this account: negotiated price, else list price */
  applicable(id: ID): number;
}

export interface ComputedLine {
  line: QuoteLine;
  code: string;
  name: string;
  unit: PriceUnit;
  list_price: number;
  applicable_price: number;
  subtotal: number;
  discount_amount: number;
  header_share: number;
  net: number;
  vat_amount: number;
  total: number;
  cost_total: number;
}

/** whole VND (never -0) */
function vnd(x: number): number {
  return Math.round(x) + 0;
}

/** 2 decimals (never -0) */
function round2(x: number): number {
  return Math.round((x + (x >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100 + 0;
}

function num(x: number): number {
  return Number.isFinite(x) ? x : 0;
}

/**
 * subtotal = qty × unit_price; discount_amount = subtotal × discount_pct%;
 * header_share = (subtotal − discount_amount) × discount_pct_total%; net = subtotal − discount_amount − header_share;
 * vat = net × vat_rate%; total = net + vat. Every money value is rounded to whole VND.
 * effective_discount_pct = (1 − Σnet / Σ(qty × applicable_price)) × 100, 2 decimals.
 * Lines are returned in sort_order.
 */
export function computeQuote(
  lines: QuoteLine[],
  discountPctTotal: number,
  pricing: PricingLookup,
): { lines: ComputedLine[]; totals: Required<QuoteTotals> } {
  const headerPct = num(discountPctTotal);
  const sorted = lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => a.line.sort_order - b.line.sort_order || a.index - b.index)
    .map((x) => x.line);

  let grossApplicable = 0;
  let subtotal = 0;
  let lineDiscount = 0;
  let headerDiscount = 0;
  let netBeforeVat = 0;
  let vat = 0;
  let grandTotal = 0;
  let costTotal = 0;

  const computed: ComputedLine[] = sorted.map((line) => {
    const item = pricing.item(line.price_item_id);
    const qty = num(line.qty);
    const unitPrice = num(line.unit_price);
    const applicablePrice = item ? num(pricing.applicable(line.price_item_id)) : unitPrice;
    const lineSubtotal = vnd(qty * unitPrice);
    const discountAmount = vnd((lineSubtotal * num(line.discount_pct)) / 100);
    const headerShare = vnd(((lineSubtotal - discountAmount) * headerPct) / 100);
    const net = lineSubtotal - discountAmount - headerShare;
    const vatAmount = vnd((net * num(line.vat_rate)) / 100);
    const total = net + vatAmount;
    const lineCost = vnd(qty * (item ? num(item.cost_price) : 0));
    const gross = vnd(qty * applicablePrice);

    grossApplicable += gross;
    subtotal += lineSubtotal;
    lineDiscount += discountAmount;
    headerDiscount += headerShare;
    netBeforeVat += net;
    vat += vatAmount;
    grandTotal += total;
    costTotal += lineCost;

    return {
      line,
      code: item?.code ?? '',
      name: item?.name ?? line.description ?? '',
      unit: item?.unit ?? 'package',
      list_price: item ? num(item.list_price) : unitPrice,
      applicable_price: applicablePrice,
      subtotal: lineSubtotal,
      discount_amount: discountAmount,
      header_share: headerShare,
      net,
      vat_amount: vatAmount,
      total,
      cost_total: lineCost,
    };
  });

  const effective = grossApplicable > 0 ? round2((1 - netBeforeVat / grossApplicable) * 100) : 0;
  const margin = netBeforeVat - costTotal;
  const marginPct = netBeforeVat > 0 ? round2((margin / netBeforeVat) * 100) : 0;

  return {
    lines: computed,
    totals: {
      gross_applicable: grossApplicable,
      subtotal,
      line_discount: lineDiscount,
      header_discount: headerDiscount,
      net_before_vat: netBeforeVat,
      vat,
      grand_total: grandTotal,
      effective_discount_pct: effective,
      cost_total: costTotal,
      margin,
      margin_pct: marginPct,
    },
  };
}

/** Director approval is needed only when the effective discount is strictly above the threshold. */
export function needsDirectorApproval(effectiveDiscountPct: number, thresholdPct: number): boolean {
  return effectiveDiscountPct > thresholdPct;
}

type ChangedField = QuoteLineView['changed_fields'][number];
const COMPARED_FIELDS: ChangedField[] = ['qty', 'unit_price', 'discount_pct', 'vat_rate'];

function lineKey(l: QuoteLine): string {
  return `${l.price_item_id}\u0000${l.description || ''}`;
}

/**
 * Compare two versions. Lines match by price_item_id + (description || '') — in order when a key repeats.
 * Matched lines: 'modified' with the changed fields, or null when equal. Unmatched next lines: 'added'.
 * Unmatched previous lines are returned in `removed`.
 */
export function diffQuoteLines(
  prev: QuoteLine[],
  next: QuoteLine[],
): { byLineId: Map<ID, { change: LineChange; changed_fields: QuoteLineView['changed_fields'] }>; removed: QuoteLine[] } {
  const pool = new Map<string, QuoteLine[]>();
  for (const l of prev) {
    const key = lineKey(l);
    const list = pool.get(key);
    if (list) list.push(l);
    else pool.set(key, [l]);
  }
  const matched = new Set<QuoteLine>();
  const byLineId = new Map<ID, { change: LineChange; changed_fields: QuoteLineView['changed_fields'] }>();

  for (const l of next) {
    const candidates = pool.get(lineKey(l));
    const old = candidates && candidates.length > 0 ? candidates.shift() : undefined;
    if (!old) {
      byLineId.set(l.id, { change: 'added', changed_fields: [] });
      continue;
    }
    matched.add(old);
    const changed = COMPARED_FIELDS.filter((f) => old[f] !== l[f]);
    byLineId.set(l.id, { change: changed.length > 0 ? 'modified' : null, changed_fields: changed });
  }

  return { byLineId, removed: prev.filter((l) => !matched.has(l)) };
}
