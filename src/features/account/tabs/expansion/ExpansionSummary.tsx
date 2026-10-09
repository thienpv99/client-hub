// The top of "Mở rộng" (SPEC-CARE §6.4): the answer to "còn bán được gì" in one glance —
//   · Bức tranh mở rộng: coverage x/y with one segment per department (in use · talking · not reached), the total
//     estimated value still to sell, and whether expanding to a new department is allowed (the delivery-debt gate);
//   · Cơ hội bán thêm: the priced opportunities, biggest first;
//   · Nhóm giải pháp khách chưa có: solution categories with no deployment yet.
import type { ReactNode } from 'react';
import { ArrowRight, CircleCheck, Lightbulb, OctagonX, Sparkles } from 'lucide-react';
import type { DepartmentView, ExpansionInfo } from '@/services/careContract';
import { t } from '@/i18n';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CategoryLabel } from '@/components/care/badges';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { CareDue, CategoryTile } from '../../care/careParts';

/** the same tones as DepartmentStatusChip: has a solution = success, talking = neutral grey, not reached = empty */
const SEGMENT: Record<'using' | 'engaged' | 'untouched', string> = {
  using: 'bg-success',
  engaged: 'bg-caption',
  untouched: 'bg-card ring-1 ring-inset ring-border-strong',
};

function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 px-4 py-4 sm:px-5', className)}>
      <p className="text-caption">{label}</p>
      {children}
    </div>
  );
}

/**
 * `onViewDebt` / `canOverride`: while the gate is closed its cell carries the whole gate message (the requests owed,
 * the way to them, the director's exception) — the tab shows no second banner
 */
export function ExpansionPicture({
  expansion,
  departments,
  onViewDebt,
  canOverride = false,
}: {
  expansion: ExpansionInfo;
  departments: DepartmentView[];
  onViewDebt?: () => void;
  canOverride?: boolean;
}) {
  const onMap = departments.filter((d) => d.effective !== 'not_fit');
  const count = (s: 'using' | 'engaged' | 'untouched') => onMap.filter((d) => d.effective === s).length;
  const withValue = departments.filter((d) => d.has_opportunity);
  return (
    <SectionCard title={t('careAccount.expansion.summary.title')} flush className="overflow-hidden">
      <div className="mt-1 grid border-t border-border/60 md:grid-cols-3 md:divide-x md:divide-border/60">
        <Cell label={t('careAccount.expansion.summary.coverage')}>
          <p className="mt-1 text-kpi font-semibold tracking-display tabular text-ink">
            {expansion.covered}/{expansion.total}
          </p>
          {onMap.length > 0 ? (
            <div className="mt-3 flex gap-1" role="img" aria-label={t('careAccount.overview.expansion.coverageAria', { covered: expansion.covered, total: expansion.total })}>
              {onMap.map((d) => (
                <span
                  key={d.id}
                  className={cn('h-2.5 min-w-0 flex-1 rounded-sm', SEGMENT[d.effective as 'using' | 'engaged' | 'untouched'])}
                  title={t('careAccount.expansion.summary.segment', { department: d.label, status: d.effective_label })}
                />
              ))}
            </div>
          ) : null}
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-micro text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-success" />
              {t('careAccount.expansion.summary.legendUsing', { count: count('using') })}
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-caption" />
              {t('careAccount.expansion.summary.legendEngaged', { count: count('engaged') })}
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-card ring-1 ring-inset ring-border-strong" />
              {t('careAccount.expansion.summary.legendUntouched', { count: count('untouched') })}
            </span>
          </p>
        </Cell>
        <Cell label={t('careAccount.expansion.summary.room')} className="border-t border-border/60 md:border-t-0">
          <p className="mt-1 truncate text-kpi font-semibold tracking-display tabular text-ink" title={formatMoney(expansion.est_value_total)}>
            {expansion.est_value_total > 0 ? formatMoneyCompact(expansion.est_value_total) : '—'}
          </p>
          <p className="mt-2 text-pretty text-caption">
            {expansion.opportunity_count > 0
              ? t('careAccount.expansion.summary.roomSub', { count: expansion.opportunity_count, departments: withValue.length })
              : t('careAccount.expansion.summary.roomNone')}
          </p>
        </Cell>
        <Cell label={t('careAccount.expansion.summary.gate')} className="border-t border-border/60 md:border-t-0">
          {expansion.blocked ? (
            <>
              <p className="mt-1 flex items-center gap-2 text-title font-semibold tracking-tightish text-danger">
                <OctagonX className="h-5 w-5 shrink-0" aria-hidden="true" />
                {t('careAccount.expansion.summary.gateBlocked')}
              </p>
              <p className="mt-2 text-pretty text-caption">{t('careAccount.expansion.summary.gateBlockedHint', { count: expansion.debt_count })}</p>
              {canOverride ? <p className="mt-1 text-pretty text-caption">{t('care.kit.gateOverrideHint')}</p> : null}
              {onViewDebt ? (
                <Button type="button" variant="secondary" size="sm" onClick={onViewDebt} className="mt-3">
                  {t('care.kit.viewDebt')}
                  <ArrowRight aria-hidden="true" />
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <p className="mt-1 flex items-center gap-2 text-title font-semibold tracking-tightish text-success">
                <CircleCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
                {t('careAccount.expansion.summary.gateOpen')}
              </p>
              <p className="mt-2 text-pretty text-caption">{t('careAccount.expansion.summary.gateOpenHint')}</p>
            </>
          )}
        </Cell>
      </div>
    </SectionCard>
  );
}

/** priced opportunities first (biggest value), then the unpriced ones */
export function rankOpportunities(departments: DepartmentView[]): DepartmentView[] {
  return departments
    .filter((d) => d.has_opportunity)
    .sort((a, b) => (b.est_value ?? -1) - (a.est_value ?? -1) || a.label.localeCompare(b.label, 'vi'));
}

export function OpportunityList({ departments, onOpen, className }: { departments: DepartmentView[]; onOpen: (d: DepartmentView) => void; className?: string }) {
  const ranked = rankOpportunities(departments);
  return (
    <SectionCard
      className={cn('overflow-hidden', className)}
      title={t('careAccount.expansion.opportunities.title')}
      description={ranked.length > 0 ? t('careAccount.expansion.opportunities.description') : undefined}
      flush
    >
      {ranked.length === 0 ? (
        <EmptyState
          compact
          icon={Sparkles}
          title={t('careAccount.expansion.opportunities.empty')}
          description={t('careAccount.expansion.opportunities.emptyHint')}
        />
      ) : (
        <ul className="mt-1 divide-y divide-border/60 border-t border-border/60">
          {ranked.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onOpen(d)}
                aria-label={t('careAccount.expansion.opportunities.open', { department: d.label })}
                className="flex w-full min-w-0 items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-subtle/80 focus-visible:bg-subtle sm:px-5"
              >
                {d.opportunity_category ? (
                  <CategoryTile category={d.opportunity_category} size="sm" />
                ) : (
                  <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted-foreground ring-1 ring-inset ring-border/70">
                    <Sparkles className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-pretty text-table font-medium text-ink">{d.opportunity_note ?? d.need_note ?? d.label}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-micro text-muted-foreground">
                    <span className="whitespace-nowrap font-medium text-foreground">{d.label}</span>
                    {d.opportunity_category_label ? (
                      <span className="whitespace-nowrap">
                        <span aria-hidden="true" className="mr-1.5">
                          ·
                        </span>
                        {d.opportunity_category_label}
                      </span>
                    ) : null}
                  </span>
                  {d.next_step ? (
                    <span className="mt-0.5 block text-pretty text-micro text-muted-foreground">
                      {t('careAccount.expansion.opportunities.next', { step: d.next_step })}
                      {d.next_step_due ? (
                        <>
                          {' · '}
                          <CareDue date={d.next_step_due} />
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right">
                  {d.est_value ? (
                    <span className="text-table font-semibold tabular text-ink" title={formatMoney(d.est_value)}>
                      {formatMoneyCompact(d.est_value)}
                    </span>
                  ) : (
                    <span className="text-micro text-muted-foreground">{t('careAccount.expansion.opportunities.noValue')}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function WhitespaceCard({ expansion, departments, className }: { expansion: ExpansionInfo; departments: DepartmentView[]; className?: string }) {
  const withOpportunity = new Set(departments.filter((d) => d.has_opportunity && d.opportunity_category).map((d) => d.opportunity_category));
  const list = expansion.whitespace_categories;
  return (
    <SectionCard
      className={cn('overflow-hidden', className)}
      title={t('careAccount.expansion.whitespace.title')}
      description={list.length > 0 ? t('careAccount.expansion.whitespace.description') : undefined}
      flush
    >
      {list.length === 0 ? (
        <p className="px-4 pb-4 text-table text-muted-foreground sm:px-5 sm:pb-5">{t('careAccount.expansion.whitespace.empty')}</p>
      ) : (
        <ul className="mt-1 divide-y divide-border/60 border-t border-border/60">
          {list.map((c) => (
            <li key={c.category} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
              <CategoryLabel category={c.category} className="text-foreground" />
              {/* a state, not an action: neutral (blue is for action and selection only, DESIGN §1.6) */}
              {withOpportunity.has(c.category) ? (
                <Badge variant="default" size="sm">
                  <Lightbulb aria-hidden="true" />
                  {t('careAccount.expansion.whitespace.opportunity')}
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
