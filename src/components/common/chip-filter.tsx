import { useRef } from 'react';
import type { ReactNode } from 'react';
import { SCROLL_FADE_CLASS, useScrollFade } from '@/components/ui/use-scroll-fade';
import { cx } from './cx';

export interface ChipOption<T extends string = string> {
  value: T;
  label: ReactNode;
  count?: number;
}

export interface ChipFilterProps<T extends string = string> {
  options: ChipOption<T>[];
  /** selected chip, null = none */
  value: T | null;
  onChange: (value: T | null) => void;
  /** clicking the active chip clears the filter (default true); set false for "Tất cả"-style radio chips */
  allowDeselect?: boolean;
  /** accessible name of the group ("Lọc nhanh") */
  ariaLabel?: string;
  className?: string;
}

/** Pill toggles (aria-pressed) with optional counts; scrolls sideways on phones, wraps from `sm`. */
export function ChipFilter<T extends string = string>({
  options,
  value,
  onChange,
  allowDeselect = true,
  ariaLabel,
  className,
}: ChipFilterProps<T>) {
  const rowRef = useRef<HTMLDivElement>(null);
  // phones: the row scrolls sideways and fades its cut edge (from `sm` it wraps, so nothing is cut)
  useScrollFade(rowRef);
  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={ariaLabel}
      // py/-my: room for the focus outline inside the horizontal scroller
      className={cx('no-scrollbar -my-1 flex max-w-full gap-2 overflow-x-auto py-1 sm:flex-wrap sm:overflow-visible', SCROLL_FADE_CLASS, className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!active) onChange(o.value);
              else if (allowDeselect) onChange(null);
            }}
            className={cx(
              'touch-tap inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium leading-[18px] ring-1 ring-inset transition-colors duration-150 sm:h-8 sm:px-3',
              active
                ? 'bg-primary-soft text-primary ring-primary-border'
                : 'bg-card text-muted-foreground shadow-xs ring-border-strong/80 hover:bg-subtle hover:text-foreground',
            )}
          >
            {o.label}
            {o.count !== undefined ? (
              <span
                className={cx(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-micro font-semibold tabular',
                  active ? 'bg-card text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
