// The units × solution categories grid of a business group (SPEC-CARE §6.6). From 1280px a table — pinned company
// column, then "Phòng ban" (coverage x/y), "Nợ triển khai" and "Chăm sóc", then one column per category, and a footer
// that counts, per category, the companies that could still buy it. Below 1280 one card per company with the
// categories as tiles. A cell = icon + word (Đang dùng / Đang triển khai / Cơ hội / Còn trống) + the solution name or
// the estimated value; it opens the company's Triển khai (in use) or Mở rộng (room to sell) tab. An empty cell reads
// as room to sell — a dashed "+" tile, never a warning.
import { useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, Clock, Lightbulb, Plus, Rocket } from 'lucide-react';
import type { SolutionCategory } from '@/domain/careTypes';
import type { GroupMatrix, GroupMatrixUnit, MatrixCellState, MatrixCellView } from '@/services/careContract';
import { CareStatusBadge, CATEGORY_ICONS } from '@/components/care/badges';
import { AccountLogo } from '@/components/common/account-logo';
import { Badge } from '@/components/ui/badge';
import { MICRO_MUTED, SMALL } from '@/components/common/cx';
import { HealthBadge } from '@/components/common/health-badge';
import { cn } from '@/components/ui/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SCROLL_FADE_END_CLASS, useScrollFade } from '@/components/ui/use-scroll-fade';
import type { RiseProps } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { accountHref, categoryRoom, cellHref, cellTarget, cellValue, hasExtraOpportunity } from './matrixModel';

// ───────────────────────────── one cell ─────────────────────────────

const CELL_ICONS: Record<MatrixCellState, LucideIcon> = {
  live: CircleCheck,
  in_progress: Rocket,
  opportunity: Lightbulb,
  none: Plus,
};

/** literal class sets per state (the standalone build precompiles literal classes only) */
const CELL_TONES: Record<MatrixCellState, { box: string; word: string }> = {
  live: { box: 'bg-success-soft ring-1 ring-inset ring-success/15 hover:ring-success/40', word: 'text-success' },
  in_progress: { box: 'bg-muted ring-1 ring-inset ring-border/70 hover:ring-border-strong', word: 'text-foreground' },
  opportunity: { box: 'bg-primary-soft ring-1 ring-inset ring-primary-border hover:ring-primary/50', word: 'text-primary' },
  none: { box: 'border border-dashed border-border-strong bg-card hover:border-primary-border hover:bg-primary-soft/40', word: 'text-muted-foreground' },
};

function cellWord(state: MatrixCellState): string {
  return t(`carePm.matrix.cell.${state}`);
}

/** second line: the solution in use, the estimated value of the opportunity, or the invitation of an empty cell */
function cellDetail(cell: MatrixCellView): string {
  if (cell.state === 'live' || cell.state === 'in_progress') {
    const first = cell.deployments[0]?.name ?? '';
    return cell.deployments.length > 1 ? t('carePm.matrix.cell.more', { name: first, count: cell.deployments.length - 1 }) : first;
  }
  if (cell.state === 'opportunity') {
    const value = cellValue(cell);
    return value > 0 ? formatMoneyCompact(value) : t('carePm.matrix.cell.opportunityNoValue', { count: cell.opportunities.length });
  }
  return t('carePm.matrix.cell.noneHint');
}

/** the full sentence (screen readers, tooltip title) */
function cellSentence(unit: string, category: string, cell: MatrixCellView): string {
  const names = cell.deployments.map((d) => d.name).join(', ');
  const opp = cell.opportunities.length;
  const value = cellValue(cell);
  switch (cell.state) {
    case 'live':
    case 'in_progress':
      return [
        t(`carePm.matrix.a11y.${cell.state}`, { unit, category, names }),
        opp > 0 ? t('carePm.matrix.a11y.alsoOpportunity', { count: opp }) : '',
        cellTarget(cell) === 'delivery' ? t('carePm.matrix.a11y.openDelivery') : t('carePm.matrix.a11y.openExpansion'),
      ]
        .filter(Boolean)
        .join(' ');
    case 'opportunity':
      return value > 0
        ? t('carePm.matrix.a11y.opportunity', { unit, category, count: opp, value: formatMoneyCompact(value) })
        : t('carePm.matrix.a11y.opportunityNoValue', { unit, category, count: opp });
    case 'none':
      return t('carePm.matrix.a11y.none', { unit, category });
  }
}

/** "+ Cơ hội 380 tr ₫" — a cell in use where another department still wants something of that category */
function extraLine(cell: MatrixCellView): string {
  const value = cellValue(cell);
  return value > 0 ? t('carePm.matrix.cell.extra', { value: formatMoneyCompact(value) }) : t('carePm.matrix.cell.extraNoValue', { count: cell.opportunities.length });
}

function CellTooltipBody({ cell, category }: { cell: MatrixCellView; category: string }) {
  return (
    <span className="block max-w-[18rem] space-y-1.5 text-left">
      <span className="block font-semibold">{category}</span>
      {cell.deployments.map((d) => (
        <span key={d.id} className="block font-normal">
          {d.name} · {t(`care.deploymentStatus.${d.status}`)}
        </span>
      ))}
      {cell.opportunities.map((o) => (
        <span key={o.department} className="block font-normal">
          {t('carePm.matrix.tooltip.opportunity', { department: o.department_label })}
          {o.note ? `: ${o.note}` : ''}
          {o.est_value ? ` · ${formatMoneyCompact(o.est_value)}` : ''}
        </span>
      ))}
      {cell.state === 'none' ? <span className="block font-normal">{t('carePm.matrix.tooltip.none')}</span> : null}
      <span className="block font-normal opacity-80">
        {cellTarget(cell) === 'delivery' ? t('carePm.matrix.tooltip.openDelivery') : t('carePm.matrix.tooltip.openExpansion')}
      </span>
    </span>
  );
}

export function MatrixCell({
  unit,
  cell,
  showCategory = false,
  className,
}: {
  unit: GroupMatrixUnit;
  cell: MatrixCellView;
  /** tiles of the phone / iPad cards name their category on top */
  showCategory?: boolean;
  className?: string;
}) {
  const Icon = CELL_ICONS[cell.state];
  const tone = CELL_TONES[cell.state];
  const CategoryIcon = CATEGORY_ICONS[cell.category];
  const category = t(`care.category.${cell.category}`);
  const unitName = unit.account.short_name || unit.account.name;
  const extraOpportunity = hasExtraOpportunity(cell);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={cellHref(unit.account.id, cell)}
          aria-label={cellSentence(unitName, category, cell)}
          className={cn(
            'touch-tap relative flex w-full min-w-0 flex-col justify-center gap-0.5 rounded-lg py-2 text-left transition-[box-shadow,background-color,border-color] duration-150 ease-out-quart',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            // table tiles: room for the word, a two-line solution name and the "+ cơ hội" line (review QV-03)
            showCategory ? 'h-full min-h-[88px] px-2' : 'h-[84px] px-1.5',
            tone.box,
            className,
          )}
        >
          {showCategory ? (
            <span className="flex min-w-0 items-center gap-1.5 text-micro font-medium text-foreground">
              <CategoryIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{t(`care.categoryShort.${cell.category}`)}</span>
            </span>
          ) : null}
          <span className={cn('flex min-w-0 items-center gap-1 text-micro font-semibold', tone.word)}>
            <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            {/* the table's ~95px tiles take the short word ("Triển khai"); the cards and the legend the full one */}
            <span className="truncate">{showCategory ? cellWord(cell.state) : t(`carePm.matrix.cellShort.${cell.state}`)}</span>
          </span>
          <span
            className={cn(
              'line-clamp-2 break-words text-micro',
              cell.state === 'opportunity' ? 'font-medium tabular text-primary' : 'text-muted-foreground',
            )}
          >
            {cellDetail(cell)}
          </span>
          {/* in use, and another department still wants more of it: room to sell, said in words (not a lone icon) */}
          {extraOpportunity ? (
            <span className="flex min-w-0 items-center gap-1 text-micro font-medium tabular text-primary">
              <Lightbulb className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              <span className="truncate">{extraLine(cell)}</span>
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top">
        <CellTooltipBody cell={cell} category={category} />
      </TooltipContent>
    </Tooltip>
  );
}

// ───────────────────────────── unit facts ─────────────────────────────

function Coverage({ unit, className }: { unit: GroupMatrixUnit; className?: string }) {
  const { covered, total } = unit.coverage;
  return (
    <span className={cn('tabular', className)} title={t('care.coverage', { covered, total })}>
      <span className="font-semibold text-ink">{covered}</span>
      <span className="text-muted-foreground">/{total}</span>
      <span className="sr-only"> {t('carePm.matrix.columns.coverageSr')}</span>
    </span>
  );
}

/**
 * Delivery debt (danger, blocks expansion) · requests waiting more than 7 days (warning) · nothing pending.
 * `compact` (the narrow "Nợ triển khai" column at ≥1440px): icon + number chips, the words in the tooltip and for
 * screen readers; otherwise words ("3 nợ triển khai" / "2 chờ quá 7 ngày").
 */
function DebtFacts({ unit, compact = false, words = false }: { unit: GroupMatrixUnit; compact?: boolean; words?: boolean }) {
  if (unit.debt === 0 && unit.untriaged === 0) {
    if (words) return null;
    return compact ? (
      <span className={cn('text-muted-foreground', SMALL)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t('carePm.matrix.debtNone')}</span>
      </span>
    ) : (
      <span className={cn('text-muted-foreground', SMALL)}>{t('carePm.matrix.debtNone')}</span>
    );
  }
  const debtText = words ? t('carePm.matrix.debtWords', { count: unit.debt }) : t('carePm.matrix.debtCount', { count: unit.debt });
  const waitText = t('carePm.matrix.waitingCount', { count: unit.untriaged });
  return (
    <Link
      to={`${accountHref(unit.account.id)}/delivery`}
      className="touch-tap relative z-10 inline-flex flex-wrap items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {unit.debt > 0 ? (
        <span
          className="inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full bg-danger-soft px-1.5 text-micro font-medium tabular text-danger"
          title={t('carePm.board.debtCount', { count: unit.debt })}
        >
          <CircleAlert className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
          {compact ? (
            <>
              <span aria-hidden="true">{unit.debt}</span>
              <span className="sr-only">{t('carePm.board.debtCount', { count: unit.debt })}</span>
            </>
          ) : (
            debtText
          )}
        </span>
      ) : null}
      {unit.untriaged > 0 ? (
        <span
          className="inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full bg-warning-soft px-1.5 text-micro font-medium tabular text-warning"
          title={t('carePm.board.waitingCount', { count: unit.untriaged })}
        >
          <Clock className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
          {compact ? (
            <>
              <span aria-hidden="true">{unit.untriaged}</span>
              <span className="sr-only">{t('carePm.board.waitingCount', { count: unit.untriaged })}</span>
            </>
          ) : (
            waitText
          )}
        </span>
      ) : null}
    </Link>
  );
}

function UnitName({ unit, size = 'sm' }: { unit: GroupMatrixUnit; size?: 'sm' | 'md' }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AccountLogo account={unit.account} size={size} />
      <div className="min-w-0">
        {/* two lines at most: "Ngân hàng Thịnh An" stays whole in the narrow pinned column */}
        {/* touch-tap: 44px on touch screens (the phone cards) */}
        <Link
          to={accountHref(unit.account.id)}
          className="touch-tap line-clamp-2 break-words text-table font-semibold leading-5 text-ink underline-offset-4 hover:text-primary hover:underline"
          title={unit.account.name}
        >
          {unit.account.name}
        </Link>
        {/* the 200px company column at 1280: the owner's name wraps rather than being cut */}
        <span className={cn('line-clamp-2 break-words', MICRO_MUTED)}>{t('carePm.matrix.amLine', { name: unit.account.am.full_name })}</span>
        {unit.signed ? null : (
          <Badge variant="outline" size="sm" className="mt-1">
            {t('carePm.matrix.unsignedBadge')}
          </Badge>
        )}
      </div>
    </div>
  );
}

/** 1280–1599px: coverage, debt and care move under the company name (DESIGN §7.5: a column into the subline before width) */
function UnitStatusLine({ unit, className }: { unit: GroupMatrixUnit; className?: string }) {
  return (
    <div className={cn('mt-2 flex flex-wrap items-center gap-1.5 pl-10', className)}>
      <span className={cn('whitespace-nowrap text-muted-foreground', SMALL)}>
        {t('carePm.matrix.columns.coverage')} <Coverage unit={unit} />
      </span>
      <DebtFacts unit={unit} words />
      <CareStatusBadge status={unit.care_status} short={false} />
    </div>
  );
}

// ───────────────────────────── table (≥ 1280px) ─────────────────────────────

const TH = 'h-11 border-b border-border/60 bg-subtle px-2 text-left align-bottom text-micro font-medium text-muted-foreground';
/** the three status columns exist from 1600px; below, UnitStatusLine carries them (the 7 category cells keep ~120px at 1440) */
const WIDE_ONLY = 'hidden min-[1600px]:table-cell';

export function MatrixTable({ matrix }: { matrix: GroupMatrix }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useScrollFade(scrollRef);
  const room = categoryRoom(matrix);
  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={t('carePm.matrix.tableLabel', { group: matrix.ecosystem.name })}
      tabIndex={0}
      className={cn('scrollbar-thin relative overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', SCROLL_FADE_END_CLASS)}
    >
      {/* fits 1280 (≈956px: a 200px company column, ~108px tiles that keep "Đang dùng" whole) and 1440 (≈1126px)
          without sideways scroll; narrower windows scroll inside the card */}
      <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-0 text-table min-[1600px]:min-w-[1100px]">
        <caption className="sr-only">{t('carePm.matrix.caption', { group: matrix.ecosystem.name })}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(TH, 'sticky left-0 z-20 w-[200px] pl-5 shadow-[1px_0_0_0_rgb(var(--border))] min-[1440px]:w-[244px] min-[1600px]:w-[184px]')}>
              {t('carePm.matrix.columns.unit')}
            </th>
            <th scope="col" className={cn(TH, WIDE_ONLY, 'w-[52px]')}>
              {t('carePm.matrix.columns.coverage')}
            </th>
            <th scope="col" className={cn(TH, WIDE_ONLY, 'w-[64px] px-1.5')}>
              {t('carePm.matrix.columns.debt')}
            </th>
            <th scope="col" className={cn(TH, WIDE_ONLY, 'w-[112px] pr-3')}>
              {t('carePm.matrix.columns.care')}
            </th>
            {matrix.categories.map((c) => {
              const Icon = CATEGORY_ICONS[c.category];
              return (
                <th key={c.category} scope="col" className={cn(TH, 'px-1')} title={c.label}>
                  <span className="flex flex-col gap-1 pb-0.5">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="truncate text-foreground">{t(`care.categoryShort.${c.category}`)}</span>
                  </span>
                  <span className="sr-only">{c.label}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {matrix.units.map((u) => (
            <tr key={u.account.id}>
              <th scope="row" className="sticky left-0 z-10 border-b border-border/60 bg-card py-2.5 pl-5 pr-3 text-left font-normal shadow-[1px_0_0_0_rgb(var(--border))]">
                <UnitName unit={u} />
                <UnitStatusLine unit={u} className="min-[1600px]:hidden" />
              </th>
              <td className={cn('border-b border-border/60 px-2 py-2', WIDE_ONLY)}>
                <Coverage unit={u} />
              </td>
              <td className={cn('border-b border-border/60 px-1.5 py-2', WIDE_ONLY)}>
                <DebtFacts unit={u} compact />
              </td>
              <td className={cn('border-b border-border/60 py-2 pl-2 pr-3', WIDE_ONLY)}>
                <CareStatusBadge status={u.care_status} />
              </td>
              {u.cells.map((cell) => (
                <td key={cell.category} className="border-b border-border/60 px-1 py-2">
                  <MatrixCell unit={u} cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="sticky left-0 z-10 bg-subtle py-3 pl-5 pr-3 text-left text-micro font-medium text-muted-foreground">
              {t('carePm.matrix.footer')}
            </th>
            <td className={cn('bg-subtle', WIDE_ONLY)} />
            <td className={cn('bg-subtle', WIDE_ONLY)} />
            <td className={cn('bg-subtle', WIDE_ONLY)} />
            {matrix.categories.map((c) => (
              <FooterCell key={c.category} category={c.category} count={room[c.category] ?? 0} />
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
function FooterCell({ category, count }: { category: SolutionCategory; count: number }) {
  return (
    <td className="bg-subtle px-2 py-3 text-micro">
      {count > 0 ? (
        <span className="font-medium tabular text-foreground">{t('carePm.matrix.footerCount', { count })}</span>
      ) : (
        <span className="text-muted-foreground">{t('carePm.matrix.footerFull')}</span>
      )}
      <span className="sr-only"> · {t(`care.category.${category}`)}</span>
    </td>
  );
}

// ───────────────────────────── cards (< 1280px) ─────────────────────────────

export function MatrixCards({ matrix, rise }: { matrix: GroupMatrix; rise?: (i: number) => RiseProps }) {
  return (
    <ul className="space-y-3 sm:space-y-4">
      {matrix.units.map((u, i) => {
        const p = rise?.(i);
        return (
          <li key={u.account.id} className={cn('rounded-xl border border-border/70 bg-card p-4 shadow-card sm:p-5', p?.className)} style={p?.style}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <UnitName unit={u} size="md" />
              </div>
              <HealthBadge health={u.account.health} size="sm" />
            </div>
            <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-1.5">
                <dt className={MICRO_MUTED}>{t('carePm.matrix.columns.coverage')}</dt>
                <dd className={SMALL}>
                  <Coverage unit={u} />
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className={MICRO_MUTED}>{t('carePm.matrix.columns.debt')}</dt>
                <dd>
                  <DebtFacts unit={u} />
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className={MICRO_MUTED}>{t('carePm.matrix.columns.care')}</dt>
                <dd>
                  <CareStatusBadge status={u.care_status} />
                </dd>
              </div>
            </dl>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label={t('carePm.matrix.cardCells', { unit: u.account.name })}>
              {u.cells.map((cell) => (
                <li key={cell.category} className="min-w-0">
                  <MatrixCell unit={u} cell={cell} showCategory />
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

// ───────────────────────────── legend ─────────────────────────────

export function MatrixLegend({ bordered = true }: { bordered?: boolean }) {
  const states: MatrixCellState[] = ['live', 'in_progress', 'opportunity', 'none'];
  return (
    <ul className={cn('flex flex-wrap items-start gap-x-6 gap-y-2 px-4 py-3 sm:px-5', bordered && 'border-t border-border/60')} aria-label={t('carePm.matrix.legend.label')}>
      {states.map((s) => {
        const Icon = CELL_ICONS[s];
        const tone = CELL_TONES[s];
        return (
          <li key={s} className={cn('flex items-center gap-2', MICRO_MUTED)}>
            <span className={cn('inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-md', tone.box, tone.word)} aria-hidden="true">
              <Icon className="h-3 w-3" strokeWidth={2.25} />
            </span>
            <span>
              <span className="font-medium text-foreground">{cellWord(s)}</span> — {t(`carePm.matrix.legend.${s}`)}
            </span>
          </li>
        );
      })}
      <li className={cn('flex items-center gap-2', MICRO_MUTED)}>
        <span className="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-md bg-success-soft text-primary ring-1 ring-inset ring-success/15" aria-hidden="true">
          <Lightbulb className="h-3 w-3" strokeWidth={2.25} />
        </span>
        <span>
          <span className="font-medium text-foreground">{t('carePm.matrix.legend.extraWord')}</span> — {t('carePm.matrix.legend.extra')}
        </span>
      </li>
    </ul>
  );
}
