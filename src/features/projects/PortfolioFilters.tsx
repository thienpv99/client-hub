// Portfolio toolbar (DESIGN §5 list pages): search 280px · health chips with faceted counts · "Theo AM" menu ·
// status select (right) — one row from 1280px, two below — and the result line ("2/8 dự án · … · Bỏ lọc").
import { ChevronDown, Search, X } from 'lucide-react';
import type { ProjectStatus } from '@/domain/types';
import type { Health } from '@/services/contract';
import type { ProjectPortfolioRow } from '@/services/crmContract';
import { ChipFilter, type ChipOption } from '@/components/common/chip-filter';
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
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import {
  amOptions,
  applyCriteria,
  HEALTH_CHIPS,
  isHealthFilter,
  isProjectStatus,
  matchesFilter,
  PROJECT_STATUSES,
  shortPersonName,
  type ProjectFilter,
} from './projectsModel';

const ALL = '__all__';

/** same pill as ChipFilter (32px with the mouse, 44px on touch screens) */
const chipLook = (active: boolean) =>
  cn(
    'touch-tap inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium leading-[18px] ring-1 ring-inset transition-colors duration-150 sm:h-8 sm:px-3',
    active
      ? 'bg-primary-soft text-primary ring-primary-border'
      : 'bg-card text-muted-foreground shadow-xs ring-border-strong/80 hover:bg-subtle hover:text-foreground data-[state=open]:bg-subtle',
  );

export interface PortfolioToolbarProps {
  /** every project the viewer can see (before filtering) */
  rows: ProjectPortfolioRow[];
  query: string;
  onQueryChange(q: string): void;
  filter: ProjectFilter | null;
  onFilterChange(f: ProjectFilter | null): void;
  amId: string | null;
  onAmChange(amId: string | null): void;
  status: ProjectStatus | null;
  onStatusChange(s: ProjectStatus | null): void;
}

export function PortfolioToolbar({
  rows,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  amId,
  onAmChange,
  status,
  onStatusChange,
}: PortfolioToolbarProps) {
  // faceted counts: chips count within AM + status + search; AMs count within filter + status + search
  const forChips = applyCriteria(rows, { filter: null, amId, status, query });
  const forAms = applyCriteria(rows, { filter, amId: null, status, query });
  const chips: ChipOption<Health>[] = HEALTH_CHIPS.map((h) => ({
    value: h,
    label: t(`enums.health.${h}`),
    count: forChips.filter((p) => matchesFilter(p, h)).length,
  }));
  const ams = amOptions(rows, forAms);
  const selectedAm = ams.find((o) => o.user.id === amId) ?? null;
  // phones: the search shares its row with the status select → a placeholder that fits
  const roomy = useMediaQuery('(min-width: 640px)');

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
      {/* below 1280: search + status on the first row; from 1280 everything sits in one row (status last) */}
      <div className="flex items-center gap-2 xl:contents">
        <Input
          type="search"
          inputSize="sm"
          icon={<Search />}
          wrapperClassName="min-w-0 flex-1 sm:w-[280px] sm:flex-none"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.preventDefault();
              onQueryChange('');
            }
          }}
          placeholder={t(roomy ? 'projects.filters.searchPlaceholder' : 'projects.filters.searchPlaceholderShort')}
          aria-label={t('projects.filters.searchLabel')}
          autoComplete="off"
          enterKeyHint="search"
        />
        <NativeSelect
          size="sm"
          aria-label={t('projects.filters.statusLabel')}
          value={status ?? ALL}
          onChange={(e) => {
            const v = e.target.value;
            onStatusChange(isProjectStatus(v) ? v : null);
          }}
          wrapperClassName="ml-auto w-[10.75rem] shrink-0 sm:w-44 xl:order-last"
        >
          <option value={ALL}>{t('projects.filters.statusAll')}</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`enums.projectStatus.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      {/* phones: the health chips scroll (faded edge) and "Theo AM" stays pinned at the right — one row, not two */}
      <div className="flex min-w-0 items-center gap-2 sm:flex-wrap">
        <ChipFilter<Health>
          options={chips}
          value={isHealthFilter(filter) ? filter : null}
          onChange={(v) => onFilterChange(v)}
          ariaLabel={t('projects.filters.chipsLabel')}
          className="min-w-0 flex-1 sm:flex-none"
        />
        {ams.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={chipLook(selectedAm !== null)}>
                {selectedAm
                  ? t('projects.filters.amSelected', { name: shortPersonName(selectedAm.user.full_name) })
                  : t('projects.filters.amTrigger')}
                <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[14rem]">
              <DropdownMenuLabel>{t('projects.filters.amMenuLabel')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={amId ?? ALL} onValueChange={(v) => onAmChange(v === ALL ? null : v)}>
                <DropdownMenuRadioItem value={ALL}>{t('projects.filters.amAll')}</DropdownMenuRadioItem>
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
    </div>
  );
}

/** "8 dự án", or "2/8 dự án · Đang bị chặn · AM Thu Hà · “cổng”" + "Bỏ lọc" while a filter is on. */
export function ResultLine({
  shown,
  total,
  filter,
  status,
  amName,
  query,
  onClear,
}: {
  shown: number;
  total: number;
  filter: ProjectFilter | null;
  status: ProjectStatus | null;
  amName: string | null;
  query: string;
  onClear(): void;
}) {
  const q = query.trim();
  const filtering = Boolean(filter || status || amName || q);
  const parts = [filtering ? t('projects.filters.result', { shown, total }) : t('projects.filters.count', { total })];
  if (filter) parts.push(t(`projects.filters.labels.${filter}`));
  if (status) parts.push(t(`enums.projectStatus.${status}`));
  if (amName) parts.push(t('projects.filters.amSelected', { name: amName }));
  if (q) parts.push(`“${q}”`);
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
      <p className="text-caption" aria-live="polite">
        <span className="tabular">{parts.join(' · ')}</span>
      </p>
      {filtering ? (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-primary hover:text-primary-hover">
          <X aria-hidden="true" />
          {t('projects.filters.clear')}
        </Button>
      ) : null}
    </div>
  );
}
