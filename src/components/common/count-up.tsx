import type { ReactNode } from 'react';
import { COUNT_UP_MS, useCountUp } from '@/hooks/useMotion';

/**
 * A formatted number that counts up from 0 on first mount (DESIGN.md §8.5) — KpiCard uses it for its value; use it
 * for any other hero number (`<CountUp value={formatMoneyCompact(x)} />`). The real text stays in the DOM the whole
 * time (transparent while counting, so screen readers and copy get the final value and the width never jumps); the
 * counting digits are an aria-hidden overlay. Not a string / number, reduced motion, or a refetch → plain value.
 * Give the parent `tabular` so the digits do not wobble.
 */
export function CountUp({ value, duration = COUNT_UP_MS }: { value: ReactNode; duration?: number }) {
  const frame = useCountUp(value, duration);
  if (frame === null) return <>{value}</>;
  return (
    <span className="relative inline-block max-w-full whitespace-nowrap">
      <span className="opacity-0">{value}</span>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 select-none">
        {frame}
      </span>
    </span>
  );
}
