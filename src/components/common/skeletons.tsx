import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { cx } from './cx';

const LINE_WIDTHS = ['w-11/12', 'w-3/4', 'w-5/6', 'w-2/3', 'w-1/2'];

function lineWidth(i: number): string {
  return LINE_WIDTHS[i % LINE_WIDTHS.length] ?? 'w-3/4';
}

function Loading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{t('components.loading')}</span>
      {children}
    </div>
  );
}

/** Same frame as SectionCard / KpiCard (radius, hairline border, card shadow, paddings). */
function SkeletonCardFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5', className)}>{children}</div>;
}

/** A section card: title bar (≈40%) + caption, then a few text lines. */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Loading className={className}>
      <SkeletonCardFrame>
        <Skeleton className="h-[18px] w-2/5 max-w-[14rem]" />
        <Skeleton className="mt-2 h-3 w-1/4 max-w-[9rem]" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} className={cx('h-3.5', lineWidth(i))} />
          ))}
        </div>
      </SkeletonCardFrame>
    </Loading>
  );
}

/** Rows like task cards / activity items inside one card: avatar + two lines + a trailing pill. */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <Loading className={className}>
      <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card shadow-card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={cx('h-3.5', lineWidth(i + 1))} />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Table with a tinted header on ≥xl; stacked cards below xl (internal tables become cards, DESIGN §4). */
export function TableSkeleton({ rows = 5, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  const columns = Math.max(1, cols);
  const grid = { gridTemplateColumns: `minmax(0, 2fr) repeat(${Math.max(0, columns - 1)}, minmax(0, 1fr))` };
  return (
    <Loading className={className}>
      <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card shadow-card xl:block">
        <div className="grid h-10 items-center gap-4 border-b border-border/70 bg-subtle px-5" style={grid}>
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cx('h-2.5', c === 0 ? 'w-1/3' : 'w-1/2')} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="grid h-14 items-center gap-4 border-b border-border/60 px-5 last:border-b-0" style={grid}>
            {Array.from({ length: columns }, (_, c) =>
              c === 0 ? (
                <div key={c} className="flex items-center gap-3">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className={cx('h-3.5', lineWidth(r))} />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ) : (
                <Skeleton key={c} className={cx('h-3', lineWidth(r + c))} />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="space-y-3 xl:hidden">
        {Array.from({ length: Math.min(rows, 4) }, (_, r) => (
          <SkeletonCardFrame key={r}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className={cx('h-3.5', lineWidth(r))} />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </SkeletonCardFrame>
        ))}
      </div>
    </Loading>
  );
}

export interface KpiSkeletonProps {
  count?: number;
  /** grid classes (same as the real KPI row) */
  className?: string;
  /** per-tile classes, e.g. `(i) => (i === 0 ? 'col-span-2 xl:col-span-1' : undefined)` for a 3-KPI row */
  itemClassName?: string | ((index: number) => string | undefined);
  /** same as KpiCard `labelLines` */
  labelLines?: 1 | 2;
}

/** Row of KPI tiles: label row (16px icon + caption), big number block, context line. */
export function KpiSkeleton({ count = 4, className, itemClassName, labelLines = 2 }: KpiSkeletonProps) {
  return (
    <Loading className={cx('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCardFrame
          key={i}
          className={cx('[container-type:inline-size]', typeof itemClassName === 'function' ? itemClassName(i) : itemClassName)}
        >
          {/* same label-row height as KpiCard (two lines on narrow cards) so nothing jumps when data arrives */}
          <div className={cx('flex items-start gap-2', labelLines === 2 && '[@container_(max-width:200px)]:min-h-9')}>
            <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
            <Skeleton className="mt-1 h-3 w-24 max-w-full" />
          </div>
          <Skeleton className="mt-2.5 h-8 w-28 max-w-full" />
          <Skeleton className="mt-2.5 h-3 w-36 max-w-full" />
        </SkeletonCardFrame>
      ))}
    </Loading>
  );
}

/** Whole page: header, focal status block, then a 2/3 + 1/3 layout of cards. */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <Loading className={cx('space-y-6', className)}>
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-40 max-w-full" />
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="hidden h-10 w-44 shrink-0 rounded-lg sm:block" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCardFrame key={i}>
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className={cx('h-[18px]', lineWidth(i))} />
                  <Skeleton className="h-6 w-36 rounded-md" />
                </div>
              </div>
              <Skeleton className="mt-4 h-16 w-full rounded-lg" />
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-10 w-32 rounded-lg" />
                <Skeleton className="h-10 w-28 rounded-lg" />
              </div>
            </SkeletonCardFrame>
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 2 }, (_, i) => (
            <SkeletonCardFrame key={i}>
              <Skeleton className="h-[18px] w-2/5" />
              <div className="mt-5 space-y-3">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-5/6" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </SkeletonCardFrame>
          ))}
        </div>
      </div>
    </Loading>
  );
}
