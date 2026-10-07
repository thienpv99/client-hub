import * as React from 'react';
import { cn } from '@/components/ui/cn';

// DESIGN.md §4 Inputs: strong hairline, soft focus halo (border-primary + shadow-focus), 8px radius.
// 16px text below md avoids iOS zoom-on-focus; 15px (text-body) from md up. Errors: aria-invalid (FormField sets it).
const inputBase = cn(
  'flex w-full min-w-0 rounded-lg border border-border-strong bg-card px-3 text-base text-foreground shadow-xs md:text-body',
  'transition-[border-color,box-shadow] duration-150 ease-out-quart placeholder:text-muted-foreground',
  'hover:border-caption/40 focus:border-primary focus:shadow-focus focus:outline-none focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none',
  'read-only:bg-subtle read-only:focus:border-border-strong read-only:focus:shadow-none',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgb(var(--danger)/0.15)]',
);

/** Height per size (touch-tap keeps 44px on touch screens from md up, iPad included — index.css). */
const inputSizes = {
  sm: 'touch-tap h-11 md:h-8 md:px-2.5 md:text-table',
  default: 'touch-tap h-11 md:h-10',
  lg: 'h-12 text-body',
} as const;

export type InputSize = keyof typeof inputSizes;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Control height: sm 32px (dense toolbars) · default 40px · lg 48px. Always ≥ 44px on phones / touch screens. */
  inputSize?: InputSize;
  /** Decorative leading icon (e.g. <Search />). The input gets room for it; give the input an aria-label/label. */
  icon?: React.ReactNode;
  /** Classes of the wrapper that holds the icon (only rendered with `icon`). */
  wrapperClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', inputSize = 'default', icon, wrapperClassName, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        type={type}
        className={cn(
          inputBase,
          inputSizes[inputSize],
          // a placeholder (or value) wider than a phone toolbar ends in "…" instead of being cut mid-word (DESIGN §6)
          'text-ellipsis placeholder:text-ellipsis',
          icon ? 'pl-9 md:pl-9' : null,
          'file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-table file:font-medium file:text-foreground',
          className,
        )}
        {...props}
      />
    );
    if (!icon) return input;
    return (
      <div className={cn('relative min-w-0', wrapperClassName)}>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-muted-foreground [&_svg]:size-4"
        >
          {icon}
        </span>
        {input}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input, inputBase };
