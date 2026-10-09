// "Cần chú ý hôm nay": one sentence per AttentionItem from dashboard.attention.<kind> and the params the api sends.
import type { AttentionItem } from '@/services/contract';
import { lowerFirst } from '@/components/common/labels';
import { hasKey, t, type TParams } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';

/** kinds whose sentence puts {task} after a verb ("đang chờ khách duyệt thiết kế…") */
const TASK_MID_SENTENCE: ReadonlySet<AttentionItem['kind']> = new Set<AttentionItem['kind']>([
  'client_overdue_blocking',
  'internal_overdue_blocking',
  'due_soon_blocking',
]);

function sentenceKey(item: AttentionItem): string {
  const base = `dashboard.attention.${item.kind}`;
  if (item.kind === 'due_soon_blocking') {
    const days = Number(item.params.days);
    if (days <= 0 && hasKey(`${base}_today`)) return `${base}_today`;
    if (days === 1 && hasKey(`${base}_tomorrow`)) return `${base}_tomorrow`;
  }
  return hasKey(base) ? base : 'dashboard.attention.generic';
}

/** i18n params with money formatted and task titles lower-cased where they follow a verb */
export function attentionParams(item: AttentionItem): TParams {
  const params: TParams = { ...item.params };
  if (typeof item.params.amount === 'number') params.amount = formatMoneyCompact(item.params.amount);
  if (typeof item.params.discount === 'number') params.discount = Math.round(item.params.discount);
  const task = item.params.task;
  if (typeof task === 'string' && TASK_MID_SENTENCE.has(item.kind)) params.task = lowerFirst(task.trim());
  if (params.account === undefined) params.account = item.account.name;
  return params;
}

/**
 * Caption under the sentence: whose move it is or what it is about ("Phía khách · đang chặn mốc",
 * "Báo giá · tổng 1,2 tỷ ₫", the client's note on a quote). Empty string when there is nothing to add.
 */
export function attentionMeta(item: AttentionItem): string {
  const params = attentionParams(item);
  if (item.kind === 'quote_changes_requested') {
    const note = typeof item.params.note === 'string' ? item.params.note.trim() : '';
    if (note) return t('dashboard.attention.meta.quote_changes_requested_note', { note });
  }
  const key = `dashboard.attention.meta.${item.kind}`;
  return hasKey(key) ? t(key, params) : '';
}

const ACCOUNT_MARK = '\u0001';

/**
 * Any sentence with an {account} placeholder, split around the account name so the UI can set it in semibold:
 * ['', 'Cỏ Xanh Retail', ': Go-live đang chờ khách …'] — odd indexes are the account.
 */
export function sentenceParts(key: string, params: TParams, account: string): string[] {
  const marked = t(key, { ...params, account: ACCOUNT_MARK });
  const parts: string[] = [];
  marked.split(ACCOUNT_MARK).forEach((p, i) => {
    if (i > 0) parts.push(account);
    parts.push(p);
  });
  return parts;
}

/** the sentence of a classic attention item, split around the account name (see sentenceParts) */
export function attentionSentenceParts(item: AttentionItem): { parts: string[]; account: string; text: string } {
  const params = attentionParams(item);
  const account = String(params.account ?? item.account.name);
  const key = sentenceKey(item);
  return { parts: sentenceParts(key, params, account), account, text: t(key, params) };
}
