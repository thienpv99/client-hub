// Single-value slider (Radix): keyboard arrows / Home / End / PageUp / PageDown, 44px touch target on the thumb.
import { Slider as SliderPrimitive } from 'radix-ui';
import { cn } from '@/components/ui/cn';

export interface TargetSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** accessible name of the thumb */
  label: string;
  /** spoken value, e.g. "Từ 60 điểm" */
  valueText?: string;
  disabled?: boolean;
  className?: string;
}

export function TargetSlider({ value, onChange, min = 0, max = 100, step = 1, label, valueText, disabled = false, className }: TargetSliderProps) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(v) => {
        const next = v[0];
        if (typeof next === 'number') onChange(next);
      }}
      className={cn(
        'relative flex h-11 w-full touch-none select-none items-center data-[disabled]:cursor-not-allowed md:h-8',
        className,
      )}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className={cn('absolute h-full rounded-full', disabled ? 'bg-caption' : 'bg-primary')} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className={cn(
          'relative block h-5 w-5 rounded-full border-2 bg-card shadow-card transition-colors',
          'after:absolute after:-inset-3 after:content-[""]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          disabled ? 'border-caption' : 'border-primary cursor-grab active:cursor-grabbing',
        )}
      />
    </SliderPrimitive.Root>
  );
}
