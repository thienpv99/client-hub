// 3-step stepper of the new-account wizard. Steps already reached are buttons (going back keeps the data).
// Phones show the numbers only (names stay for screen readers; the step card's heading names the current step).
import { Check } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { STEP_KEYS } from './wizardModel';

export function WizardStepper({
  current,
  maxReachable,
  onStep,
}: {
  current: number;
  /** highest step index the user may jump to */
  maxReachable: number;
  onStep: (index: number) => void;
}) {
  const total = STEP_KEYS.length;
  return (
    <nav aria-label={t('wizard.stepper.label')}>
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEP_KEYS.map((key, i) => {
          const done = i < current;
          const active = i === current;
          const reachable = i <= maxReachable && !active;
          const state = done ? t('wizard.stepper.done') : active ? t('wizard.stepper.current') : t('wizard.stepper.upcoming');
          return (
            <li key={key} className={cn('flex min-w-0 items-center gap-2 sm:gap-3', i < total - 1 && 'flex-1')}>
              <button
                type="button"
                disabled={!reachable}
                aria-current={active ? 'step' : undefined}
                onClick={() => onStep(i)}
                className={cn(
                  'group flex min-h-tap min-w-tap items-center justify-center gap-0 rounded-lg text-left transition-colors duration-150 ease-out-quart sm:min-w-0 sm:justify-start sm:gap-2.5 sm:pr-1',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  reachable ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-semibold tabular transition-[color,background-color,box-shadow] duration-200 ease-out-quart',
                    active && 'bg-primary text-primary-foreground shadow-btn',
                    done && 'bg-primary-soft text-primary group-hover:bg-primary-border/60',
                    !active && !done && 'bg-card text-muted-foreground ring-1 ring-inset ring-border-strong',
                  )}
                >
                  {/* the check scales in when a step is completed (the kit's check-in, like a checkbox) */}
                  {done ? <Check className="h-3.5 w-3.5 animate-check-in" strokeWidth={2.5} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="sr-only">{t('wizard.stepper.srStep', { n: i + 1, total, state })}</span>
                  <span
                    className={cn(
                      // phones: numbers only, evenly spaced (the step card's heading names the current step)
                      'sr-only truncate text-table font-medium sm:not-sr-only sm:block',
                      active ? 'text-ink' : done ? 'text-foreground group-hover:text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {t(`wizard.steps.${key}`)}
                  </span>
                </span>
              </button>
              {/* connector: a full-width fill that grows from the left once the step is done (transform only,
                  DESIGN §8.5), and shrinks back when the reader returns to an earlier step */}
              {i < total - 1 ? (
                <span aria-hidden="true" className="relative h-px min-w-3 flex-1 overflow-hidden rounded-full bg-border-strong/70">
                  <span
                    className={cn(
                      'absolute inset-0 origin-left bg-primary-border transition-transform duration-250 ease-out-quart',
                      done ? 'scale-x-100' : 'scale-x-0',
                    )}
                  />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
