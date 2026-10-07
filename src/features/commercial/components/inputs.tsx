// Number inputs for prices and percentages. Vietnamese format: '4.300.000' (money), '12,5' (decimal).
// They forward every Input prop (inputSize, icon…) to the kit Input.
import { forwardRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { InputProps } from '@/components/ui/input';
import { cn } from '@/components/ui/cn';
import { groupDigits, parseMoney } from '../lib';

type BaseProps = Omit<InputProps, 'value' | 'onChange' | 'type' | 'inputMode'>;

export interface MoneyInputProps extends BaseProps {
  /** whole VND; 0 shows an empty field */
  value: number;
  onValueChange: (v: number) => void;
}

/** Digits only while typing; grouped with '.' when the field is not focused. */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, onFocus, onBlur, className, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const shown = value > 0 ? (focused ? String(Math.round(value)) : groupDigits(value)) : '';
    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        onChange={(e) => onValueChange(parseMoney(e.target.value))}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cn('text-right tabular', className)}
        {...props}
      />
    );
  },
);
MoneyInput.displayName = 'MoneyInput';

export interface DecimalInputProps extends BaseProps {
  /** raw text ('12,5'); the parent parses it with parseDecimal */
  value: string;
  onValueChange: (raw: string) => void;
}

export const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(({ value, onValueChange, className, ...props }, ref) => (
  <Input
    ref={ref}
    type="text"
    inputMode="decimal"
    autoComplete="off"
    value={value}
    onChange={(e) => onValueChange(e.target.value.replace(/[^\d.,]/g, ''))}
    className={cn('text-right tabular', className)}
    {...props}
  />
));
DecimalInput.displayName = 'DecimalInput';
