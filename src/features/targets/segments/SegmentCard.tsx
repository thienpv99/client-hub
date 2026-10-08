// One saved segment as a clickable card: name, sharing, description, criteria line, four figures, owner footer.
// Opens its member list; the ⋯ menu edits / deletes (owner or director).
import type { MouseEvent } from 'react';
import { Lock, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import type { SegmentView } from '@/services/crmContract';
import type { RiseProps } from '@/hooks/useMotion';
import { UserAvatar } from '@/components/common/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { formatDate, formatDateShort, formatMoney, formatMoneyCompact, formatNumber, formatRelativeTime } from '@/lib/format';
import { shortPersonName } from '../targetLabels';
import { criteriaSummary } from './segmentModel';

export interface SegmentCardProps {
  segment: SegmentView;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** first-appearance stagger (SegmentsTab's useStagger) */
  rise?: RiseProps;
}

function ignoreClick(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target as HTMLElement | null;
  return Boolean(target?.closest('a,button,[role="menuitem"],[role="menu"]'));
}

function Stat({ label, value, title, align = 'left' }: { label: string; value: string | number; title?: string; align?: 'left' | 'right' }) {
  return (
    <div className={cn('min-w-0', align === 'right' && 'text-right')}>
      <dt className="truncate text-micro text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-title font-semibold tabular tracking-tightish text-ink" title={title}>
        {value}
      </dd>
    </div>
  );
}

export function SegmentCard({ segment: s, canEdit, onOpen, onEdit, onDelete, rise }: SegmentCardProps) {
  const summary = criteriaSummary(s.criteria);
  const viewer = useViewer();
  // "Chỉ mình tôi" only for my own private segment; the director also sees colleagues' private ones
  const mine = viewer?.user.id === s.owner.id;
  const sharing = s.shared
    ? t('targets.segments.shared')
    : mine
      ? t('targets.segments.private')
      : t('targets.segments.privateOf', { name: shortPersonName(s.owner.full_name) });
  // the footer is one line: an older date drops the current year ("23/09"), the full date is in its tooltip
  const relative = formatRelativeTime(s.updated_at);
  const updated = relative === formatDate(s.updated_at) ? formatDateShort(s.updated_at) : relative;
  return (
    <li className={cn('min-w-0', rise?.className)} style={rise?.style}>
      <Card
        interactive
        onClick={(e) => {
          if (!ignoreClick(e)) onOpen();
        }}
        className="relative flex h-full flex-col"
      >
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={onOpen}
                aria-label={t('targets.segments.open', { name: s.name })}
                // stretched over the card (one big touch target); the ⋯ menu sits above it
                className="rounded-sm text-left text-heading font-semibold tracking-tightish text-ink underline-offset-4 after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary"
              >
                {s.name}
              </button>
              <div className="mt-1.5">
                <Badge variant="default" size="sm">
                  {s.shared ? <Users aria-hidden="true" /> : <Lock aria-hidden="true" />}
                  {sharing}
                </Badge>
              </div>
            </div>
            {canEdit ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('targets.segments.actions', { name: s.name })}
                    className="relative z-10 -mr-1.5 -mt-1 shrink-0"
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onEdit}>
                    <Pencil aria-hidden="true" />
                    {t('targets.segments.edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    <Trash2 aria-hidden="true" />
                    {t('targets.segments.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className={cn('line-clamp-2 text-table', s.description ? 'text-foreground' : 'text-muted-foreground')}>
              {s.description || t('targets.segments.noDescription')}
            </p>
            {summary.length > 0 ? <p className="line-clamp-1 text-caption sm:line-clamp-2">{summary.join(t('common.separator'))}</p> : null}
          </div>

          {/* two figures (potential, average fit), the member counts as a caption line under them */}
          <div className="mt-auto">
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
              <Stat label={t('targets.segments.potential')} value={formatMoneyCompact(s.potential_value)} title={formatMoney(s.potential_value)} />
              <Stat label={t('targets.segments.avgFitShort')} value={formatNumber(Math.round(s.avg_fit))} align="right" />
            </dl>
            <p className="mt-1 text-caption tabular">
              {t('targets.segments.leads', { count: s.lead_count })}
              {t('common.separator')}
              {t('targets.segments.accounts', { count: s.account_count })}
            </p>
          </div>
        </div>

        {/* one line on every card (the name gives way, the date never wraps), so the footers of a row line up */}
        <div className="flex items-center justify-between gap-x-3 border-t border-border/60 px-4 py-3 text-micro text-muted-foreground sm:px-5">
          <span className="inline-flex min-w-0 items-center gap-1.5" title={s.owner.full_name}>
            <UserAvatar user={s.owner} size="xs" />
            <span className="truncate">{t('targets.segments.ownerBy', { name: shortPersonName(s.owner.full_name) })}</span>
          </span>
          <span className="shrink-0 whitespace-nowrap tabular" title={formatDate(s.updated_at)}>
            {t('targets.segments.updated', { when: updated })}
          </span>
        </div>
      </Card>
    </li>
  );
}
