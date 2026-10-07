// User-facing sentence for an error thrown by `api` (shared by useAction toasts and ErrorState).
// ApiError.messageKey is translated; when the error carries `details` and '<messageKey>_detail' exists
// (errors.blocked_detail, errors.cycle_detail, errors.domain_mismatch_detail…), the detailed sentence is used:
// arrays are joined with ' → ' for a cycle `path` and ', ' otherwise; strings / numbers are used as is.
import { hasKey, t, type TParams } from '@/i18n';

interface KeyedError {
  messageKey: string;
  details?: Record<string, unknown>;
}

function keyedError(err: unknown): KeyedError | null {
  if (!err || typeof err !== 'object') return null;
  const key = (err as { messageKey?: unknown }).messageKey;
  if (typeof key !== 'string') return null;
  const details = (err as { details?: unknown }).details;
  return {
    messageKey: key,
    details: details && typeof details === 'object' && !Array.isArray(details) ? (details as Record<string, unknown>) : undefined,
  };
}

/** ApiError details → i18n params ({ path: ['A', 'B', 'A'] } → { path: 'A → B → A' }) */
export function detailParams(details: Record<string, unknown>): TParams {
  const out: TParams = {};
  for (const [name, value] of Object.entries(details)) {
    if (Array.isArray(value)) {
      const parts = value.filter((x): x is string | number => typeof x === 'string' || typeof x === 'number').map(String);
      if (parts.length > 0) out[name] = parts.join(name === 'path' ? ' → ' : ', ');
    } else if (typeof value === 'string' || typeof value === 'number') {
      out[name] = value;
    }
  }
  return out;
}

/** The api error's message key, or null for errors that are not ApiError-like. */
export function errorMessageKey(err: unknown): string | null {
  return keyedError(err)?.messageKey ?? null;
}

/**
 * Translated message of an api error. Falls back to `fallbackKey` (default errors.unexpected, then
 * common.toast.failed) for unknown errors and untranslatable keys.
 */
export function apiErrorMessage(err: unknown, fallbackKey?: string): string {
  const e = keyedError(err);
  if (e && hasKey(e.messageKey)) {
    const detailKey = `${e.messageKey}_detail`;
    if (e.details && hasKey(detailKey)) {
      const text = t(detailKey, detailParams(e.details));
      // only when every placeholder was filled
      if (!/\{\w+\}/.test(text)) return text;
    }
    return t(e.messageKey);
  }
  if (fallbackKey && hasKey(fallbackKey)) return t(fallbackKey);
  if (hasKey('errors.unexpected')) return t('errors.unexpected');
  return t('common.toast.failed');
}
