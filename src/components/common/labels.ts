// Small text helpers shared by the common components.
import { hasKey, t } from '@/i18n';
import type { TParams } from '@/i18n';
import type { TaskSide } from '@/services/contract';

/**
 * Enum label from `enums.<group>.<value>` (owner G1). Falls back to `components.enumFallback.<group>.<value>`
 * so a missing/renamed enum key never shows a raw key on screen.
 */
export function enumLabel(group: string, value: string, params?: TParams): string {
  const key = `enums.${group}.${value}`;
  if (hasKey(key)) return t(key, params);
  const fallback = `components.enumFallback.${group}.${value}`;
  return hasKey(fallback) ? t(fallback, params) : value;
}

/** "Khách hàng" / "New Era" (enums.taskSide.*) */
export function sideLabel(side: TaskSide): string {
  return enumLabel('taskSide', side);
}

/**
 * Lowercase the first letter for use mid-sentence: 'Duyệt thiết kế' → 'duyệt thiết kế'.
 * Leaves acronyms alone ('UAT vòng 1', 'API thanh toán').
 */
export function lowerFirst(s: string): string {
  const chars = Array.from(s);
  const first = chars[0];
  if (first === undefined) return s;
  const second = chars[1];
  if (second !== undefined && second !== second.toLowerCase() && second === second.toUpperCase()) return s;
  return first.toLowerCase() + chars.slice(1).join('');
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}
