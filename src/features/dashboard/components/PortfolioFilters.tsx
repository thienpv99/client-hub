// Quick chips (Nợ triển khai · Quá hạn chăm sóc · Đang bị chặn · Chờ khách · Quá hạn thu) with counts + "Theo AM"
// menu, the result line ("6 khách hàng" / "2/6 khách hàng · Có việc quá hạn" + "Bỏ lọc") and the view switch
// Chăm sóc · Tiến độ. Care chips need the care rows (director / AM), money chips the commercial figures.
import { ChevronDown, Flag, HeartHandshake, X } from 'lucide-react';
import { ChipFilter, type ChipOption } from '@/components/common/chip-filter';
import { SMALL } from '@/components/common/cx';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n';
import {
  amOptions,
  applyCriteria,
  CHIP_FILTERS,
  chipLabel,
  filterLabel,
  isChipFilter,
  matchesStatus,
  needsCare,
  needsMoney,
  shortPersonName,
  type ChipFilterValue,
  type PortfolioAccount,
  type PortfolioCaps,
  type PortfolioView,
  type StatusFilter,
} from '../portfolioModel';

const ALL_AMS = '__all__';

/** the same pill as ChipFilter's (32px, 44px on touch screens), for the "Theo AM" menu trigger */
const chipLook = (active: boolean) =>
  cn(
    'touch-tap inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 font-medium ring-1 ring-inset transition-colors duration-150 sm:h-8 sm:px-3',
    SMALL,
    active
      ? 'bg-primary-soft text-primary ring-primary-border'
      : 'bg-card text-muted-foreground shadow-xs ring-border-strong/80 hover:bg-subtle hover:text-foreground data-[state=open]:bg-subtle',
  );

export interface PortfolioFiltersProps {
  /** every account the viewer can see (before filtering) */
  accounts: PortfolioAccount[];
  status: StatusFilter | null;
  amId: string | null;
  /** search text, only for the counts */
  query?: string;
  caps: PortfolioCaps;
  onStatusChange(status: StatusFilter | null): void;
  onAmChange(amId: string | null): void;
  className?: string;
}

export function PortfolioFilters({
  accounts,
  status,
  amId,
  query = '',
  caps,
  onStatusChange,
  onAmChange,
  className,
}: PortfolioFiltersProps) {
  // faceted counts: chips count within the chosen AM (+ search); AMs count within the chosen status (+ search)
  const inAm = applyCriteria(accounts, { status: null, amId, query });
  const inStatus = applyCriteria(accounts, { status, amId: null, query });
  const chips: ChipOption<ChipFilterValue>[] = CHIP_FILTERS.filter((f) => (caps.money || !needsMoney(f)) && (caps.care || !needsCare(f))).map((f) => ({
    value: f,
    label: chipLabel(f),
    count: inAm.filter((a) => matchesStatus(a, f)).length,
  }));
  const ams = amOptions(accounts, inStatus);
  const selectedAm = ams.find((o) => o.user.id === amId) ?? null;

  return (
    // phones: the chips scroll sideways and the AM menu stays at the right end; from sm everything wraps
    <div className={cn('flex min-w-0 items-center gap-2 sm:flex-wrap', className)}>
      <ChipFilter<ChipFilterValue>
        options={chips}
        value={isChipFilter(status) ? status : null}
        onChange={(v) => onStatusChange(v)}
        ariaLabel={t('dashboard.portfolio.chipsLabel')}
        className="min-w-0"
      />
      {ams.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={chipLook(selectedAm !== null)}>
              {selectedAm
                ? t('dashboard.portfolio.am.selected', { name: shortPersonName(selectedAm.user.full_name) })
                : t('dashboard.portfolio.am.trigger')}
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[14rem]">
            <DropdownMenuLabel>{t('dashboard.portfolio.am.menuLabel')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={amId ?? ALL_AMS} onValueChange={(v) => onAmChange(v === ALL_AMS ? null : v)}>
              <DropdownMenuRadioItem value={ALL_AMS}>{t('dashboard.portfolio.am.all')}</DropdownMenuRadioItem>
              {ams.map((o) => (
                <DropdownMenuRadioItem key={o.user.id} value={o.user.id}>
                  <span className="flex-1 truncate">{o.user.full_name}</span>
                  <span className="tabular text-muted-foreground">{o.count}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

/**
 * "6 khách hàng", or while filtering "2/6 khách hàng" + the filter that has no chip of its own (the dashboard's
 * KPI shortcuts: "Có việc quá hạn"…) + "Bỏ lọc". Chips, the AM menu and the search box already show their own state.
 */
export function ResultLine({
  shown,
  total,
  status,
  filtered,
  onClear,
  className,
}: {
  shown: number;
  total: number;
  status: StatusFilter | null;
  /** any filter or search in force */
  filtered: boolean;
  onClear(): void;
  className?: string;
}) {
  const parts = [
    filtered ? t('dashboard.portfolio.result', { shown, total }) : t('dashboard.portfolio.count', { count: total }),
  ];
  if (status && !isChipFilter(status)) parts.push(filterLabel(status));
  return (
    <div className={cn('flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <p className="text-caption" aria-live="polite">
        <span className="tabular">{parts.join(' · ')}</span>
      </p>
      {filtered ? (
        <Button variant="ghost" size="sm" onClick={onClear} className="-my-1 text-primary hover:text-primary">
          <X aria-hidden="true" />
          {t('dashboard.portfolio.clear')}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * "Chăm sóc" · "Tiến độ" — a segmented switch (the indicator glides, DESIGN §8.3). `compactOnPhone`: icons only below
 * sm (the words stay for screen readers and in the tooltip), so it fits beside the sort on a phone row.
 */
export function PortfolioViewSwitch({
  view,
  onView,
  compactOnPhone = false,
  className,
}: {
  view: PortfolioView;
  onView(view: PortfolioView): void;
  compactOnPhone?: boolean;
  className?: string;
}) {
  const word = compactOnPhone ? 'sr-only sm:not-sr-only' : undefined;
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      value={view}
      onValueChange={(v) => {
        if (v === 'care' || v === 'progress') onView(v);
      }}
      aria-label={t('carePortfolio.portfolio.views.label')}
      className={className}
    >
      <ToggleGroupItem value="care" className={cn('min-w-0', compactOnPhone ? 'px-3 max-sm:min-w-11 max-sm:px-2.5' : 'px-3')} title={t('carePortfolio.portfolio.views.care')}>
        <HeartHandshake aria-hidden="true" />
        <span className={word}>{t('carePortfolio.portfolio.views.care')}</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="progress" className={cn('min-w-0', compactOnPhone ? 'px-3 max-sm:min-w-11 max-sm:px-2.5' : 'px-3')} title={t('carePortfolio.portfolio.views.progress')}>
        <Flag aria-hidden="true" />
        <span className={word}>{t('carePortfolio.portfolio.views.progress')}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
