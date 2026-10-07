// ICP fit score: the number + grade chip (A/B/C). Grades are a ranking, not a status: the number carries the
// meaning; only grade A gets a soft blue chip (one quiet accent per row), B and C stay neutral.
// showBreakdown: the badge opens a small popover with the 5 components as bars and plain-language phrases.
import { ChevronDown } from 'lucide-react';
import type { FitBreakdown } from '@/services/crmContract';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { SMALL } from '@/components/common/cx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Grade = FitBreakdown['grade'];
type Component = 'industry' | 'size' | 'revenue' | 'province' | 'engagement';

const COMPONENTS: readonly Component[] = ['industry', 'size', 'revenue', 'province', 'engagement'];

const GRADE_LOOK: Record<Grade, string> = {
  A: 'bg-primary-soft text-primary ring-primary-border/70',
  B: 'bg-muted text-foreground ring-border',
  C: 'bg-muted text-muted-foreground ring-border',
};

function level(component: Component, value: number): 'none' | 'low' | 'mid' | 'high' {
  if (component === 'engagement') {
    if (value <= 0) return 'none';
    if (value >= 90) return 'high';
    return value >= 60 ? 'mid' : 'low';
  }
  if (value >= 90) return 'high';
  return value >= 50 ? 'mid' : 'low';
}

/** "Mức phù hợp 82/100, hạng A" */
export function fitLabel(fit: Pick<FitBreakdown, 'score' | 'grade'>): string {
  return t('crm.fit.aria', { score: Math.round(fit.score), grade: fit.grade });
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(v) ? v : 0)));
}

function BadgeBody({ fit, size }: { fit: FitBreakdown; size: 'sm' | 'md' }) {
  const small = size === 'sm';
  return (
    <>
      <span className={cn('font-semibold tabular text-ink', small ? 'text-table' : 'text-heading')}>{clamp(fit.score)}</span>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-md font-semibold ring-1 ring-inset',
          small ? 'h-5 min-w-5 px-1 text-micro' : `h-6 min-w-6 px-1.5 ${SMALL}`,
          GRADE_LOOK[fit.grade],
        )}
        aria-hidden="true"
      >
        {fit.grade}
      </span>
    </>
  );
}

export function FitBreakdownPanel({ fit }: { fit: FitBreakdown }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-table font-semibold text-ink">{t('crm.fit.title', { score: clamp(fit.score), grade: fit.grade })}</p>
        <p className="mt-0.5 text-caption">{t(`crm.fit.grade.${fit.grade}`)}</p>
      </div>
      <ul className="space-y-3">
        {COMPONENTS.map((c) => {
          const v = clamp(fit[c]);
          return (
            <li key={c}>
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn('font-medium text-foreground', SMALL)}>{t(`crm.fit.component.${c}`)}</span>
                <span className="text-micro font-medium tabular text-muted-foreground">{v}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-chart-1" style={{ width: `${v}%` }} />
              </div>
              <p className="mt-1 text-micro text-muted-foreground">{t(`crm.fit.phrase.${c}.${level(c, v)}`)}</p>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border/60 pt-3 text-micro text-muted-foreground">{t('crm.fit.note')}</p>
    </div>
  );
}

export interface FitScoreBadgeProps {
  fit: FitBreakdown;
  /** clickable badge that opens the 5-component breakdown */
  showBreakdown?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function FitScoreBadge({ fit, showBreakdown = false, size = 'sm', className }: FitScoreBadgeProps) {
  const label = fitLabel(fit);
  if (!showBreakdown) {
    return (
      <span role="img" aria-label={label} title={label} className={cn('inline-flex shrink-0 items-center gap-1.5', className)}>
        <BadgeBody fit={fit} size={size} />
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('crm.fit.open', { label })}
          title={label}
          className={cn(
            'touch-tap inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-1.5 transition-colors duration-150 hover:bg-muted data-[state=open]:bg-muted',
            className,
          )}
        >
          <BadgeBody fit={fit} size={size} />
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <FitBreakdownPanel fit={fit} />
      </PopoverContent>
    </Popover>
  );
}
