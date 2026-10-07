// Milestone chain of a project template: a vertical timeline on phones, a wrapping row of plain steps (name + date
// caption, chevrons between) from md up.
// With `startDate` each step shows its real planned date (wizard), otherwise its offset from the start (Settings).
import { ChevronRight, Lock } from 'lucide-react';
import type { ISODate, TemplateMilestone } from '@/domain/types';
import { addDays } from '@/domain/dates';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';

export function offsetLabel(days: number): string {
  return days === 0 ? t('settings.templates.offsetStart') : t('settings.templates.offsetDays', { days });
}

/** total length of a template in days (offset of its last milestone) */
export function templateSpanDays(milestones: TemplateMilestone[]): number {
  return milestones.reduce((max, m) => Math.max(max, m.offset_days), 0);
}

export function TemplateChain({
  milestones,
  startDate,
  label,
  className,
}: {
  milestones: TemplateMilestone[];
  startDate?: ISODate | null;
  /** accessible name of the list */
  label: string;
  className?: string;
}) {
  const sorted = [...milestones].sort((a, b) => a.offset_days - b.offset_days);
  return (
    <ol aria-label={label} className={cn('flex flex-col md:flex-row md:flex-wrap md:items-center md:gap-x-2 md:gap-y-3', className)}>
      {sorted.map((m, i) => {
        const last = i === sorted.length - 1;
        const when = startDate ? formatDate(addDays(startDate, m.offset_days)) : offsetLabel(m.offset_days);
        return (
          <li key={`${m.name}-${i}`} className="flex min-w-0 items-stretch gap-3 md:items-center md:gap-2">
            {/* phone: timeline rail */}
            <span aria-hidden="true" className="relative flex w-3 shrink-0 justify-center md:hidden">
              <span className="mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-border-strong bg-card" />
              {!last ? <span className="absolute bottom-0 top-5 w-px bg-border" /> : null}
            </span>
            {/* md+: plain steps joined by chevrons (no chip boxes inside the card) */}
            <div className="min-w-0 flex-1 pb-3 md:flex-none md:pb-0">
              <p className="flex items-center gap-1.5 text-table font-medium text-foreground">
                <span className="break-words">{m.name}</span>
                {!m.client_visible ? (
                  <Lock
                    role="img"
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-label={t('settings.templates.internalMilestone')}
                  />
                ) : null}
              </p>
              <p className="text-micro tabular text-muted-foreground">{when}</p>
            </div>
            {!last ? <ChevronRight className="hidden h-4 w-4 shrink-0 text-border-strong md:block" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
