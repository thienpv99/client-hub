// Brand panel of /login (≥1024): calm headline, three value points and a product preview built from real UI pieces
// (stage stepper + client task card). The preview is decorative: hidden from assistive tech, nothing focusable.
import type { LucideIcon } from 'lucide-react';
import { Check, Clock, FileText, Flag, ListChecks } from 'lucide-react';
import { addDays } from '@/domain/dates';
import { todayISO } from '@/domain/clock';
import { dueInfo } from '@/domain/taskRules';
import { DueLabel } from '@/components/common/due-label';
import { NewEraLogo } from '@/components/common/new-era-logo';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { buttonVariants } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';

const BRAND_POINTS: { key: string; icon: LucideIcon }[] = [
  { key: 'auth.brand.points.tasks', icon: ListChecks },
  { key: 'auth.brand.points.progress', icon: Flag },
  { key: 'auth.brand.points.commercial', icon: FileText },
];

const STEPS: { key: string; state: 'done' | 'current' | 'todo' }[] = [
  { key: 'kickoff', state: 'done' },
  { key: 'design', state: 'current' },
  { key: 'build', state: 'todo' },
  { key: 'uat', state: 'todo' },
  { key: 'golive', state: 'todo' },
];

function MiniStepper() {
  return (
    <ol className="flex items-start">
      {STEPS.map((step, i) => (
        <li key={step.key} className="relative flex flex-1 flex-col items-center gap-1.5">
          {i > 0 ? (
            <span
              className={cn(
                'absolute right-1/2 top-[9px] h-0.5 w-full',
                step.state === 'todo' ? 'bg-border' : 'bg-primary',
              )}
            />
          ) : null}
          <span
            className={cn(
              'relative z-10 flex h-5 w-5 items-center justify-center rounded-full',
              step.state === 'done' && 'bg-primary text-primary-foreground',
              step.state === 'current' && 'bg-card ring-2 ring-primary',
              step.state === 'todo' && 'bg-card ring-1 ring-border-strong',
            )}
          >
            {step.state === 'done' ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            {step.state === 'current' ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
          </span>
          <span
            className={cn(
              'whitespace-nowrap text-micro',
              step.state === 'current' ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {t(`auth.preview.steps.${step.key}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ProductPreview() {
  const today = todayISO();
  const due = dueInfo(addDays(today, -6), false, today);
  return (
    <div aria-hidden className="pointer-events-none relative select-none">
      {/* back: project progress (tall windows only) */}
      <div className="hidden w-[90%] rounded-xl border border-border/70 bg-card p-4 shadow-card [@media(min-height:860px)]:block">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-table font-semibold text-ink">{t('auth.preview.project')}</span>
          <span className="text-micro font-medium text-muted-foreground">{t('auth.preview.progress')}</span>
        </div>
        <div className="mt-4">
          <MiniStepper />
        </div>
        <p className="mt-4 inline-flex items-center gap-1.5 text-micro font-medium text-warning">
          <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
          {t('auth.preview.forecast')}
        </p>
      </div>

      {/* front: the client task card */}
      <div className="relative rounded-xl border border-border/70 bg-card p-4 shadow-pop [@media(min-height:860px)]:-mt-5 [@media(min-height:860px)]:ml-auto [@media(min-height:860px)]:w-[90%]">
        <p className="text-micro font-medium text-muted-foreground">{t('auth.preview.waiting')}</p>
        <div className="mt-2 flex items-start gap-3">
          <TaskTypeIcon type="approval" boxed />
          <div className="min-w-0 flex-1">
            <p className="text-heading font-semibold tracking-tightish text-ink">{t('auth.preview.taskTitle')}</p>
            <DueLabel due={due} className="mt-1.5" />
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-subtle p-3">
          <p className="text-micro font-medium text-foreground">{t('auth.preview.impactLabel')}</p>
          <p className="mt-0.5 text-micro text-muted-foreground">{t('auth.preview.impact')}</p>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <span className={cn(buttonVariants({ size: 'sm' }), 'shadow-btn')}>{t('enums.taskAction.approve')}</span>
          <span className="text-caption font-medium text-primary">{t('auth.preview.requestChanges')}</span>
        </div>
      </div>
    </div>
  );
}

export function BrandPanel() {
  return (
    <aside className="relative hidden min-h-screen flex-col border-r border-primary-border/50 bg-primary-soft/60 px-12 py-10 lg:flex xl:px-16">
      <div className="flex items-center gap-3">
        <NewEraLogo size="sm" withText />
        <span className="h-4 w-px bg-border-strong" aria-hidden />
        <span className="text-caption font-medium">{t('auth.brand.eyebrow')}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="max-w-[520px]">
          {/* a tagline, not a heading: the page's first heading is the sign-in h1 */}
          <p className="text-kpi-lg font-semibold tracking-display text-ink [text-wrap:balance]">{t('auth.brand.headline')}</p>
          <p className="mt-4 text-body text-muted-foreground">{t('auth.brand.lead')}</p>
          <ul className="mt-8 space-y-3.5">
            {BRAND_POINTS.map(({ key, icon: Icon }) => (
              <li key={key} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-xs ring-1 ring-primary-border/60">
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <span className="text-table text-foreground">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* only when the window is tall enough to show it whole */}
        <div className="mt-10 hidden max-w-[460px] [@media(min-height:720px)]:block">
          <ProductPreview />
        </div>
      </div>

      <p className="text-caption">{t('auth.brand.footer')}</p>
    </aside>
  );
}
