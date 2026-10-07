// One ecosystem: name, description, value figures, member chips and the cross-sell sentence. Used by the
// ecosystem sheet and by the panel that opens on the map when a hub bubble is selected (EcosystemPanel).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, Network, Pencil, X } from 'lucide-react';
import type { EcosystemView } from '@/services/crmContract';
import { SMALL } from '@/components/common/cx';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';

export function memberHref(m: EcosystemView['members'][number]): string {
  return m.kind === 'lead' ? `/app/targets/leads/${m.id}` : `/app/accounts/${m.id}`;
}

export interface EcosystemSummaryProps {
  eco: EcosystemView;
  /** map panel: shorter description and fewer chips */
  compact?: boolean;
  /** phone panel docked under the bubbles: no description (the figures come first; the sheet has it all) */
  brief?: boolean;
  /** buttons in the title row */
  actions?: ReactNode;
  titleId?: string;
  className?: string;
}

export function EcosystemSummary({ eco, compact = false, brief = false, actions, titleId, className }: EcosystemSummaryProps) {
  const limit = brief ? 4 : compact ? 6 : 24;
  const members = [...eco.members].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'vi') : a.kind === 'account' ? -1 : 1));
  const shown = members.slice(0, limit);
  const more = members.length - shown.length;

  return (
    <div className={cn('min-w-0 space-y-4', className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden="true">
          <Network className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="break-words text-heading font-semibold tracking-tightish text-ink">
            {eco.name}
          </h3>
          <p className="text-caption">
            {[eco.short_name, eco.industry, t('clientmap.map.companies', { count: eco.account_count + eco.lead_count })]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>

      {eco.description && !brief ? (
        <p className={cn('text-table text-muted-foreground', compact && 'line-clamp-2')}>{eco.description}</p>
      ) : null}

      {/* two figures side by side, a hairline between them (no boxes inside the card) */}
      <dl className="grid grid-cols-2 divide-x divide-border/60">
        <div className="min-w-0 pr-4">
          <dt className="text-caption">{t('clientmap.eco.contract')}</dt>
          <dd className="mt-0.5 text-title font-semibold tracking-tightish tabular text-ink">{formatMoneyCompact(eco.contract_value)}</dd>
        </div>
        <div className="min-w-0 pl-4">
          <dt className="text-caption">{t('clientmap.eco.potential')}</dt>
          <dd className="mt-0.5 text-title font-semibold tracking-tightish tabular text-ink">{formatMoneyCompact(eco.potential_value)}</dd>
        </div>
      </dl>

      <div>
        <p className="sr-only">{t('clientmap.eco.members')}</p>
        {shown.length === 0 ? (
          <p className="text-caption">{t('clientmap.eco.noMembers')}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {shown.map((m) => (
              <li key={`${m.kind}:${m.id}`}>
                <Link
                  to={memberHref(m)}
                  className={cn(
                    'touch-tap inline-flex h-7 max-w-[14rem] items-center gap-1.5 rounded-md px-2 font-medium transition-colors',
                    SMALL,
                    m.kind === 'lead'
                      ? 'border border-dashed border-border-strong bg-card text-muted-foreground hover:text-foreground'
                      : 'bg-muted text-foreground hover:bg-primary-soft hover:text-primary',
                  )}
                >
                  <span className="truncate">{m.name}</span>
                  {m.kind === 'lead' ? <span className="shrink-0 text-micro text-muted-foreground">{t('clientmap.eco.leadTag')}</span> : null}
                </Link>
              </li>
            ))}
            {more > 0 ? (
              <li className={cn('inline-flex h-7 items-center px-1 text-muted-foreground', SMALL)}>+{more}</li>
            ) : null}
          </ul>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-subtle p-3 text-table text-foreground ring-1 ring-inset ring-border/60">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          {eco.lead_count > 0 ? t('clientmap.eco.crossSell', { count: eco.lead_count }) : t('clientmap.eco.crossSellNone')}
        </span>
      </p>
    </div>
  );
}

export interface EcosystemPanelProps {
  eco: EcosystemView;
  /** phones: docked to the bottom of the map; wider: floating top-right */
  docked: boolean;
  titleId: string;
  onEdit(): void;
  onClose(): void;
  className?: string;
}

/** the panel that opens on the map when a hub bubble is selected */
export function EcosystemPanel({ eco, docked, titleId, onEdit, onClose, className }: EcosystemPanelProps) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'absolute z-10 animate-pop-in overflow-y-auto rounded-xl border border-border/70 bg-card p-4 shadow-pop',
        docked ? 'inset-x-2 bottom-2 max-h-[70%]' : 'right-4 top-4 max-h-[calc(100%-2rem)]',
        className,
      )}
    >
      <EcosystemSummary
        eco={eco}
        compact
        brief={docked}
        titleId={titleId}
        actions={
          <>
            <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t('clientmap.eco.editLabel', { name: eco.name })} title={t('clientmap.eco.edit')}>
              <Pencil aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('clientmap.eco.closePanel')} title={t('clientmap.eco.closePanel')}>
              <X aria-hidden="true" />
            </Button>
          </>
        }
      />
    </section>
  );
}
