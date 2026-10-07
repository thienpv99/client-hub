import * as React from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { Label } from '@/components/ui/label';

// DESIGN.md §4 field: label 14px medium above · control · helper in caption · error in danger with an icon.

type ControlA11yProps = Pick<React.AriaAttributes, 'aria-describedby' | 'aria-invalid' | 'aria-required'>;

export interface FormFieldProps {
  label: React.ReactNode;
  /** id of the control; hint/error get ids `${htmlFor}-hint` / `${htmlFor}-error`. */
  htmlFor: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** The control. A single element gets aria-describedby / aria-invalid / aria-required added. */
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
  /** Small element at the right of the label row (a link, a counter, "Không bắt buộc"). */
  labelAside?: React.ReactNode;
}

function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  className,
  labelClassName,
  labelAside,
}: FormFieldProps) {
  const hasHint = hint !== undefined && hint !== null && hint !== false && hint !== '';
  const hasError = error !== undefined && error !== null && error !== false && error !== '';
  const showHint = hasHint;
  const hintId = showHint ? `${htmlFor}-hint` : undefined;
  const errorId = hasError ? `${htmlFor}-error` : undefined;

  let control: React.ReactNode = children;
  if (React.isValidElement<ControlA11yProps>(children)) {
    const own = children.props;
    const describedBy = [own['aria-describedby'], hintId, errorId].filter(Boolean).join(' ');
    control = React.cloneElement(children, {
      'aria-describedby': describedBy || undefined,
      'aria-invalid': hasError ? true : own['aria-invalid'],
      'aria-required': required ? true : own['aria-required'],
    });
  }

  const labelEl = (
    <Label htmlFor={htmlFor} className={labelClassName}>
      {label}
      {required && (
        <span className="ml-0.5 text-danger" aria-hidden="true">
          *
        </span>
      )}
    </Label>
  );

  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      {labelAside ? (
        <div className="flex items-baseline justify-between gap-3">
          {labelEl}
          <span className="text-caption">{labelAside}</span>
        </div>
      ) : (
        labelEl
      )}
      {control}
      {showHint && (
        <p id={hintId} className="text-caption">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} aria-live="polite" className="flex items-start gap-1.5 text-[13px] leading-[18px] text-danger">
          <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
FormField.displayName = 'FormField';

export { FormField };
