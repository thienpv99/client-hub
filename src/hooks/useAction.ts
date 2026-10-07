// Mutation hook (owner G1): runs an api call, toasts the outcome, offers 5-second undo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';
import { hasKey, t, type TParams } from '@/i18n';
import { apiErrorMessage, errorMessageKey } from '@/lib/errors';
import { toastError, toastSuccess } from '@/lib/toast';

export interface ActionOptions<T> {
  /**
   * Success toast: an i18n key (translated with `successParams`) or an already translated sentence.
   * When omitted and the result carries a `message_key` (ActionResult of client task actions), that key is used.
   */
  success?: string;
  successParams?: TParams;
  /** return the undo token of the result (e.g. r => r.undo_token) to show "Hoàn tác" for 5 s */
  undoToken?: (r: T) => string | null;
}

export interface ActionRunner {
  run<T>(fn: () => Promise<T>, opts?: ActionOptions<T>): Promise<T | undefined>;
  pending: boolean;
}

/**
 * User-facing sentence for any error thrown by `api`: t(messageKey), or the '<messageKey>_detail' sentence filled
 * from ApiError.details when it exists (blockers, cycle path, email domain). See src/lib/errors.ts.
 */
export function errorMessage(err: unknown): string {
  return apiErrorMessage(err);
}

/** Toast an api error (ApiError → its message, anything else → generic sentence). */
export function toastApiError(err: unknown): void {
  if (!errorMessageKey(err)) console.error('[action] unexpected error', err);
  toastError(errorMessage(err));
}

function translate(keyOrText: string, params?: TParams): string {
  return hasKey(keyOrText) ? t(keyOrText, params) : keyOrText;
}

function resultMessageKey(result: unknown): string | null {
  if (result && typeof result === 'object' && typeof (result as { message_key?: unknown }).message_key === 'string') {
    return (result as { message_key: string }).message_key;
  }
  return null;
}

export function useAction(): ActionRunner {
  const [pendingCount, setPendingCount] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async <T,>(fn: () => Promise<T>, opts?: ActionOptions<T>): Promise<T | undefined> => {
    setPendingCount((n) => n + 1);
    try {
      const result = await fn();
      const key = opts?.success ?? resultMessageKey(result);
      if (key) {
        const message = translate(key, opts?.successParams);
        const token = opts?.undoToken ? opts.undoToken(result) : null;
        if (token) {
          toastSuccess(message, {
            onUndo: async () => {
              try {
                await api.undoAction(token);
                toastSuccess(t('common.toast.undone'));
              } catch (err) {
                toastApiError(err);
              }
            },
          });
        } else {
          toastSuccess(message);
        }
      }
      return result;
    } catch (err) {
      toastApiError(err);
      return undefined;
    } finally {
      if (mounted.current) setPendingCount((n) => Math.max(0, n - 1));
    }
  }, []);

  return { run, pending: pendingCount > 0 };
}
