// "Ma trận" view of /app/map (SPEC-CARE §6.6) — the director's room-to-sell screen for business groups. Pick a group →
// one sentence on what is left to sell (the focal line) with four figures → the units × solution categories matrix
// (empty cells read as room to sell, not as a failure) → "Quan hệ trong tập đoàn". URL: ?view=matrix&eco=<id>.
import { useEffect, useMemo, useState } from 'react';
import { Building2, Info, Lightbulb, MapPin, Network } from 'lucide-react';
import { api } from '@/services/api';
import type { GroupMatrix } from '@/services/careContract';
import { ChipFilter } from '@/components/common/chip-filter';
import { MICRO_MUTED } from '@/components/common/cx';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/useMedia';
import { useStagger } from '@/hooks/useMotion';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { GroupRelations } from './GroupRelations';
import { MatrixCards, MatrixLegend, MatrixTable } from './MatrixGrid';
import { roomToSell, type GroupOption } from './matrixModel';

export interface GroupMatrixViewProps {
  groups: GroupOption[] | undefined;
  groupsLoading: boolean;
  groupsError: unknown;
  onRetryGroups(): void;
  /** ?eco= — falls back to the first group the viewer can open */
  selectedId: string | null;
  onSelect(id: string): void;
  onShowOnMap(id: string): void;
  /** an AM sees only her own companies of the group */
  isDirector: boolean;
  /** the unit cards rise in on first appearance (the page was opened on this view) */
  stagger?: boolean;
}

/**
 * `picker`: the group chips are not on screen yet (the groups are loading) — hold their row so nothing jumps. The
 * summary frame mirrors GroupSummary line by line (title + meta, a two-line description, the focal sentence, the four
 * figures, the sister-companies line) and the grid the table's 84px tiles, so the matrix does not drop when the data
 * arrives (review QV-11, DESIGN §8.2).
 */
function MatrixSkeleton({ picker = false }: { picker?: boolean }) {
  return (
    <div role="status" aria-busy="true" className="skeleton-reveal space-y-4">
      {picker ? (
        <div className="flex items-center gap-2" aria-hidden="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-24 rounded-full sm:h-8" />
          ))}
        </div>
      ) : null}
      <div className="space-y-4 md:space-y-6" aria-hidden="true">
        <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="flex h-12 min-w-0 flex-1 flex-col justify-center gap-2">
              <Skeleton className="h-6 w-56 max-w-full" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          </div>
          <div className="flex h-[60px] flex-col justify-center gap-2.5 md:h-10">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-2/3 md:hidden" />
          </div>
          <div className="flex items-start gap-2.5">
            <Skeleton className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
            <div className="flex h-[72px] min-w-0 flex-1 flex-col justify-center gap-3 md:h-6">
              <Skeleton className="h-4 w-full md:w-4/5" />
              <Skeleton className="h-4 w-full md:hidden" />
              <Skeleton className="h-4 w-1/2 md:hidden" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border/60 pt-4 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex h-[66px] flex-col justify-between py-0.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2.5 border-t border-border/60 pt-4">
            <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            <Skeleton className="mt-0.5 h-3.5 w-3/4" />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
          <Skeleton className="hidden h-11 rounded-none xl:block" />
          <div className="p-4 sm:p-5 xl:px-5 xl:py-0">
            {Array.from({ length: 2 }, (_, r) => (
              <div key={r} className="flex items-center gap-3 py-2 xl:border-b xl:border-border/60">
                <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                <Skeleton className="h-4 w-32 shrink-0" />
                <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 md:grid-cols-7">
                  {Array.from({ length: 7 }, (_, c) => (
                    <Skeleton key={c} className={cn('h-[52px] rounded-lg xl:h-[84px]', c > 2 && 'hidden md:block')} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">{t('components.loading')}</span>
    </div>
  );
}

/**
 * the focal sentence: what is left to sell in the whole group — department opportunities (the count that matches the
 * estimated value, also those inside a category already in use) and the empty cells, signed companies only
 */
function roomSentence(m: GroupMatrix): string {
  const r = roomToSell(m);
  if (m.units.length === 0) return t('carePm.matrix.summary.noUnits');
  if (r.unsigned === m.units.length) return t('carePm.matrix.summary.noSigned');
  const tail = r.unsigned > 0 ? ` ${t('carePm.matrix.summary.unsigned', { count: r.unsigned })}` : '';
  if (r.opportunities + r.none === 0) return t('carePm.matrix.summary.full') + tail;
  if (r.opportunities > 0 && r.none > 0) {
    return (
      (r.estValue > 0
        ? t('carePm.matrix.summary.both', { opportunity: r.opportunities, value: formatMoneyCompact(r.estValue), none: r.none })
        : t('carePm.matrix.summary.bothNoValue', { opportunity: r.opportunities, none: r.none })) + tail
    );
  }
  if (r.opportunities > 0) {
    return (
      (r.estValue > 0
        ? t('carePm.matrix.summary.opportunityOnly', { opportunity: r.opportunities, value: formatMoneyCompact(r.estValue) })
        : t('carePm.matrix.summary.opportunityOnlyNoValue', { opportunity: r.opportunities })) + tail
    );
  }
  return t('carePm.matrix.summary.noneOnly', { none: r.none }) + tail;
}

function Figure({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="truncate text-caption">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 flex-col">
        <span className="text-title font-semibold tracking-tightish tabular text-ink">{value}</span>
        {sub ? <span className={cn('text-pretty', MICRO_MUTED)}>{sub}</span> : null}
      </dd>
    </div>
  );
}

function GroupSummary({ matrix, isDirector, onShowOnMap }: { matrix: GroupMatrix; isDirector: boolean; onShowOnMap(): void }) {
  const eco = matrix.ecosystem;
  const r = roomToSell(matrix);
  const meta = [eco.industry, t('carePm.matrix.units', { count: matrix.units.length })].filter(Boolean).join(' · ');
  return (
    <section aria-labelledby="matrix-group-title" className="space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden="true">
          <Network className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="matrix-group-title" className="break-words text-title font-semibold tracking-tightish text-ink">
            {eco.name}
          </h2>
          <p className="text-caption">{meta}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onShowOnMap} className="shrink-0" aria-label={t('carePm.matrix.showOnMapLabel', { name: eco.name })}>
          <MapPin aria-hidden="true" />
          <span className="hidden sm:inline">{t('carePm.matrix.showOnMap')}</span>
        </Button>
      </div>
      {eco.description ? <p className="line-clamp-3 text-pretty text-table text-muted-foreground md:line-clamp-2">{eco.description}</p> : null}
      <p className="flex items-start gap-2.5 text-pretty text-body font-medium text-ink">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <span>{roomSentence(matrix)}</span>
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border/60 pt-4 md:grid-cols-4">
        <Figure label={t('carePm.matrix.cell.live')} value={String(r.live)} sub={t('carePm.matrix.figures.liveSub')} />
        <Figure label={t('carePm.matrix.cell.in_progress')} value={String(r.inProgress)} sub={t('carePm.matrix.figures.inProgressSub')} />
        <Figure
          label={t('carePm.matrix.figures.opportunity')}
          value={String(r.opportunities)}
          sub={r.estValue > 0 ? t('carePm.matrix.figures.opportunitySub', { value: formatMoneyCompact(r.estValue) }) : t('carePm.matrix.figures.opportunitySubNone')}
        />
        <Figure label={t('carePm.matrix.cell.none')} value={String(r.none)} sub={t('carePm.matrix.figures.noneSub')} />
      </dl>
      {/* the biggest room of a group: sister companies that use nothing from New Era yet (account expansion) */}
      {matrix.other_members.length > 0 ? (
        <p className="flex items-start gap-2.5 border-t border-border/60 pt-4 text-pretty text-table text-foreground">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            {t('carePm.matrix.otherMembers', { count: matrix.other_members.length, names: matrix.other_members.map((o) => o.name).join(', ') })}
          </span>
        </p>
      ) : null}
      {isDirector ? null : <p className={MICRO_MUTED}>{t('carePm.matrix.amScope')}</p>}
    </section>
  );
}

export function GroupMatrixView({
  groups,
  groupsLoading,
  groupsError,
  onRetryGroups,
  selectedId,
  onSelect,
  onShowOnMap,
  isDirector,
  stagger = false,
}: GroupMatrixViewProps) {
  const wide = useMediaQuery('(min-width: 1280px)');
  const activeId = useMemo(() => {
    if (!groups || groups.length === 0) return null;
    return groups.some((g) => g.eco.id === selectedId) ? (selectedId as string) : groups[0].eco.id;
  }, [groups, selectedId]);
  // a link to a group the viewer cannot open (an AM's shared link to a group without her companies): say so once and
  // put the group actually shown in the URL, so the address never names another group than the page
  const [outOfScope, setOutOfScope] = useState(false);
  useEffect(() => {
    if (!groups || !activeId || !selectedId || selectedId === activeId) return;
    setOutOfScope(true);
    onSelect(activeId);
  }, [groups, activeId, selectedId, onSelect]);
  const query = useQuery(() => api.getGroupMatrix(activeId as string), [activeId], { enabled: activeId !== null, keepPreviousData: true });
  // switching groups keeps the previous matrix (dimmed) until the next one is in
  const matrix = query.data;
  const rise = useStagger(stagger && matrix !== undefined);

  if (!groups) {
    if (groupsLoading) return <MatrixSkeleton picker />;
    return (
      <Card>
        <ErrorState error={groupsError} onRetry={onRetryGroups} />
      </Card>
    );
  }
  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Network}
          title={t('carePm.matrix.empty.title')}
          description={isDirector ? t('carePm.matrix.empty.description') : t('carePm.matrix.empty.descriptionAm')}
        />
      </Card>
    );
  }

  const picker = (
    <div className="flex min-w-0 items-center gap-3">
      <span className="hidden shrink-0 text-table text-muted-foreground sm:inline" aria-hidden="true">
        {t('carePm.matrix.picker')}
      </span>
      <ChipFilter<string>
        options={groups.map((g) => ({ value: g.eco.id, label: g.eco.short_name || g.eco.name, count: g.units }))}
        value={activeId}
        onChange={(v) => {
          if (!v) return;
          setOutOfScope(false);
          onSelect(v);
        }}
        allowDeselect={false}
        ariaLabel={t('carePm.matrix.pickerLabel')}
        className="min-w-0 flex-1"
      />
    </div>
  );

  let body;
  if (!matrix) {
    body = query.loading ? (
      <MatrixSkeleton />
    ) : (
      <Card>
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Card>
    );
  } else {
    body = (
      <div className={cn('space-y-4 transition-opacity duration-150 md:space-y-6', query.refreshing && 'opacity-70')} aria-busy={query.refreshing || undefined}>
        <GroupSummary matrix={matrix} isDirector={isDirector} onShowOnMap={() => onShowOnMap(matrix.ecosystem.id)} />
        {matrix.units.length === 0 ? null : wide ? (
          <section aria-label={t('carePm.matrix.title')} className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
            <MatrixTable matrix={matrix} />
            <MatrixLegend />
          </section>
        ) : (
          <section aria-label={t('carePm.matrix.title')} className="space-y-3">
            <MatrixCards matrix={matrix} rise={rise} />
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-card">
              <MatrixLegend bordered={false} />
            </div>
          </section>
        )}
        <GroupRelations relations={matrix.relations} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {picker}
      {outOfScope ? (
        <p role="status" className="flex items-start gap-2 text-pretty text-table text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('carePm.matrix.notInScope')}
        </p>
      ) : null}
      {body}
    </div>
  );
}
