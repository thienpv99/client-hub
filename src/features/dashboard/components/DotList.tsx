// "A · B · C" that wraps between items and never starts a line with the separator: every item carries its dot in
// the gap on its left, and the dot of an item that begins a line falls into the clipped left margin.
import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

export function DotList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <span className={cn('block overflow-hidden', className)}>
      <span className="-ml-3 flex flex-wrap">
        {items.map((item, i) => (
          <span key={i} className="relative ml-3 min-w-0">
            <span aria-hidden="true" className="absolute right-full mr-1">
              ·
            </span>
            {i > 0 ? <span className="sr-only">, </span> : null}
            {item}
          </span>
        ))}
      </span>
    </span>
  );
}
