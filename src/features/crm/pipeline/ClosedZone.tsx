// Compact "Thắng" / "Thua" summary under the pipeline (last 180 days): a card with a divided list of the latest
// deals. While a card is dragged it becomes a drop target that opens the win / lose dialog.
import type { DragEventHandler } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleCheck, CircleX } from 'lucide-react';
import type { OpportunityView } from '@/services/crmContract';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { SMALL } from '@/components/common/cx';
import { AccountLogo } from '@/components/common/account-logo';
import { crmPaths, stageLabel } from '@/components/crm/crmLabels';
import { sumValue } from '../crmModel';

export interface ClosedZoneProps {
  stage: 'won' | 'lost';
  items: OpportunityView[];
  /** a card is being dragged */
  dropping: boolean;
  isOver: boolean;
  onDragOver: DragEventHandler<HTMLElement>;
  onDragLeave: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
  /** "Xem thêm N" link (list tab filtered on this stage) */
  moreHref?: string;
}

const SHOWN = 3;

export function ClosedZone({ stage, items, dropping, isOver, onDragOver, onDragLeave, onDrop, moreHref }: ClosedZoneProps) {
  const won = stage === 'won';
  const Icon = won ? CircleCheck : CircleX;
  const headingId = `crm-closed-${stage}`;
  const more = items.length - SHOWN;
  return (
    <section
      aria-labelledby={headingId}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex min-w-0 flex-col rounded-xl border bg-card shadow-card transition-[background-color,border-color] duration-150',
        dropping ? 'border-dashed border-primary-border' : 'border-border/70',
        isOver && 'border-primary bg-primary-soft/60',
      )}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pb-3 pt-4 sm:px-5">
        <Icon className={cn('h-4 w-4 shrink-0', won ? 'text-success' : 'text-muted-foreground')} aria-hidden="true" />
        <h3 id={headingId} className="text-table font-semibold text-ink">
          {stageLabel(stage)}
        </h3>
        <span className="text-caption">{t('crm.pipeline.closedWindow')}</span>
        <span className="ml-auto text-table tabular text-muted-foreground">
          {t('crm.pipeline.closedCount', { count: items.length })}
          <span className="ml-1.5 font-semibold text-ink">{formatMoneyCompact(sumValue(items))}</span>
        </span>
      </header>
      {dropping ? (
        <p className={cn('mx-4 mb-4 rounded-lg bg-subtle px-3 py-4 text-center ring-1 ring-inset ring-border/60 sm:mx-5', SMALL, isOver ? 'text-primary' : 'text-muted-foreground')}>
          {won ? t('crm.pipeline.dropWin') : t('crm.pipeline.dropLose')}
        </p>
      ) : items.length === 0 ? (
        <p className="px-4 pb-4 text-caption sm:px-5">{won ? t('crm.pipeline.noneWon') : t('crm.pipeline.noneLost')}</p>
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {items.slice(0, SHOWN).map((o) => (
            <li key={o.id} className="relative flex min-h-tap min-w-0 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-subtle sm:px-5">
              <AccountLogo account={o.account} size="xs" />
              <Link
                to={crmPaths.opportunity(o.id)}
                className="min-w-0 flex-1 truncate text-table text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
              >
                {o.name}
                <span className={cn('text-muted-foreground', SMALL)}> · {o.account.short_name || o.account.name}</span>
              </Link>
              <span className="shrink-0 text-table tabular text-muted-foreground">{formatMoneyCompact(o.value)}</span>
            </li>
          ))}
        </ul>
      )}
      {!dropping && more > 0 ? (
        <div className="mt-auto border-t border-border/60 px-4 py-2 sm:px-5">
          {moreHref ? (
            <Link
              to={moreHref}
              className="touch-tap inline-flex min-h-8 items-center gap-1 rounded text-table font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('crm.pipeline.closedMore', { count: more })}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <span className="text-caption">{t('crm.pipeline.closedMore', { count: more })}</span>
          )}
        </div>
      ) : null}
    </section>
  );
}
