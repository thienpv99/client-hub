import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/components/ui/cn';

// Styled native <select>: best on phones (OS picker), also fine for simple filters on desktop. Same look as Input.

export interface NativeSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** sm 32px · default 40px · lg 48px with the mouse; always 44px+ on phones and touch screens. */
  size?: 'default' | 'sm' | 'lg';
  /** Adds a first option with value "" showing this text. */
  placeholder?: string;
  wrapperClassName?: string;
}

const sizeClasses = {
  // phones: 44px tap target and 16px text (no iOS zoom on focus) for every size
  sm: 'h-11 pl-3 pr-9 text-base md:h-8 md:pl-2.5 md:pr-8 md:text-table',
  default: 'h-11 pl-3 pr-9 text-base md:h-10 md:text-body',
  lg: 'h-12 pl-3.5 pr-10 text-base md:text-body',
} as const;

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, wrapperClassName, size = 'default', placeholder, children, ...props }, ref) => (
    <div className={cn('relative min-w-0', wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          'w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border border-border-strong bg-card text-foreground shadow-xs',
          'transition-[border-color,box-shadow] duration-150 ease-out-quart hover:border-caption/40',
          'focus:border-primary focus:shadow-focus focus:outline-none focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none',
          'aria-[invalid=true]:border-danger',
          sizeClasses[size],
          // touch screens from md up (iPad) keep the 44px target (index.css)
          'touch-tap',
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
          size === 'sm' ? 'right-3 md:right-2.5' : 'right-3',
        )}
        aria-hidden="true"
      />
    </div>
  ),
);
NativeSelect.displayName = 'NativeSelect';

const NativeSelectOption = React.forwardRef<HTMLOptionElement, React.OptionHTMLAttributes<HTMLOptionElement>>(
  (props, ref) => <option ref={ref} {...props} />,
);
NativeSelectOption.displayName = 'NativeSelectOption';

const NativeSelectOptGroup = React.forwardRef<HTMLOptGroupElement, React.OptgroupHTMLAttributes<HTMLOptGroupElement>>(
  (props, ref) => <optgroup ref={ref} {...props} />,
);
NativeSelectOptGroup.displayName = 'NativeSelectOptGroup';

export { NativeSelect, NativeSelectOption, NativeSelectOptGroup };
