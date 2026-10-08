// Lead list toolbar pieces (DESIGN §6: search + the 2–3 most useful filters visible, the rest in "Bộ lọc"):
// status chips with counts, owner switch (Của tôi / Chưa giao / Tất cả), the "Bộ lọc" panel (grade, segment,
// director: per person, due today; phones: sort too) as a popover from md and a bottom sheet on phones, and the
// "x / y mục tiêu" line with removable chips of the active panel filters.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ListFilter, X } from 'lucide-react';
import type { SegmentView } from '@/services/crmContract';
import type { UserRef } from '@/services/contract';
import { useMediaQuery } from '@/hooks/useMedia';
import { ChipFilter } from '@/components/common/chip-filter';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n';
import { GRADES, leadStatusLabel, shortPersonName } from '../targetLabels';
import { STATUS_CHIPS } from './leadModel';
import { LEAD_SORTS } from './useLeadParams';
import type { LeadParams, LeadSort, StatusFilter } from './useLeadParams';

const OWNER_MODES = ['me', 'none', 'all'] as const;

function statusChipLabel(s: StatusFilter): string {
  if (s === 'open') return t('targets.leads.statusOpen');
  if (s === 'all') return t('targets.leads.statusAll');
  return leadStatusLabel(s);
}

function isOwnerMode(v: string): boolean {
  return (OWNER_MODES as readonly string[]).includes(v);
}

export function StatusChips({ params, counts }: { params: LeadParams; counts: Record<StatusFilter, number> }) {
  return (
    <ChipFilter<StatusFilter>
      ariaLabel={t('targets.leads.statusFilter')}
      // one row from xl (the 8 chips are ~40px wider than the 1280 column): it scrolls with a faded edge, as on phones,
      // instead of leaving one chip alone on a second row
      className="xl:flex-nowrap xl:overflow-x-auto"
      allowDeselect={false}
      value={params.status}
      onChange={(v) => params.update({ status: v ?? 'open' })}
      options={STATUS_CHIPS.filter((s) => s === 'open' || s === 'all' || counts[s] > 0 || params.status === s).map((s) => ({
        value: s,
        label: statusChipLabel(s),
        count: counts[s],
      }))}
    />
  );
}

export function OwnerSwitch({ params, className }: { params: LeadParams; className?: string }) {
  const ownerMode = isOwnerMode(params.owner) ? params.owner : '';
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      value={ownerMode}
      onValueChange={(v) => {
        if (v) params.update({ owner: v });
      }}
      aria-label={t('targets.leads.ownerLabel')}
      className={className}
    >
      {OWNER_MODES.map((m) => (
        <ToggleGroupItem key={m} value={m} className="flex-1 sm:flex-none">
          {t(`targets.leads.owner.${m}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** number of active filters that live in the panel (the badge on the "Bộ lọc" button) */
export function panelFilterCount(params: LeadParams): number {
  return (params.grade ? 1 : 0) + (params.segmentId ? 1 : 0) + (isOwnerMode(params.owner) ? 0 : 1) + (params.due ? 1 : 0);
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      {htmlFor ? (
        <Label htmlFor={htmlFor}>{label}</Label>
      ) : (
        <p className="text-table font-medium text-foreground">{label}</p>
      )}
      {children}
    </div>
  );
}

interface PanelProps {
  params: LeadParams;
  people: UserRef[];
  segments: SegmentView[];
  isDirector: boolean;
  /** phones: sort lives in the panel (the toolbar has no room) */
  withSort: boolean;
}

function FilterFields({ params, people, segments, isDirector, withSort }: PanelProps) {
  const personId = isOwnerMode(params.owner) ? '' : params.owner;
  return (
    <div className="space-y-5">
      <Field label={t('targets.grade.label')}>
        <ToggleGroup
          type="single"
          variant="segmented"
          value={params.grade ?? 'any'}
          onValueChange={(v) => {
            if (!v) return;
            params.update({ grade: v === 'A' || v === 'B' || v === 'C' ? v : null });
          }}
          aria-label={t('targets.grade.label')}
          className="grid w-full grid-cols-4"
        >
          <ToggleGroupItem value="any">{t('targets.grade.any')}</ToggleGroupItem>
          {GRADES.map((g) => (
            <ToggleGroupItem key={g} value={g} aria-label={t(`targets.grade.${g}`)}>
              {g}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <Field label={t('targets.leads.segmentLabel')} htmlFor="lead-filter-segment">
        <NativeSelect
          id="lead-filter-segment"
          size="sm"
          value={params.segmentId ?? ''}
          onChange={(e) => params.update({ segmentId: e.target.value || null })}
        >
          <option value="">{t('targets.leads.segmentAll')}</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {isDirector && people.length > 0 ? (
        <Field label={t('targets.leads.ownerByPerson')} htmlFor="lead-filter-person">
          <NativeSelect
            id="lead-filter-person"
            size="sm"
            value={personId}
            onChange={(e) => params.update({ owner: e.target.value || 'all' })}
          >
            <option value="">{t('targets.leads.ownerAnyone')}</option>
            {people.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      <label htmlFor="lead-filter-due" className="flex min-h-tap cursor-pointer items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-table font-medium text-foreground">{t('targets.leads.dueChip')}</span>
          <span className="block text-caption">{t('targets.leads.dueHint')}</span>
        </span>
        <Switch id="lead-filter-due" checked={params.due} onCheckedChange={(v) => params.update({ due: v })} />
      </label>
      {withSort ? (
        <Field label={t('targets.leads.sortLabel')} htmlFor="lead-filter-sort">
          <NativeSelect
            id="lead-filter-sort"
            size="sm"
            value={params.sort}
            onChange={(e) => {
              const v = e.target.value;
              if ((LEAD_SORTS as string[]).includes(v)) params.update({ sort: v as LeadSort });
            }}
          >
            {LEAD_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`targets.leads.sort.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
    </div>
  );
}

/** "Bộ lọc (n)": a popover from md, a bottom sheet on phones */
export function LeadFilterButton(props: Omit<PanelProps, 'withSort'>) {
  const wide = useMediaQuery('(min-width: 768px)');
  const [open, setOpen] = useState(false);
  const count = panelFilterCount(props.params);
  const trigger = (
    <Button type="button" variant="secondary" size="sm" className="shrink-0" aria-label={count > 0 ? t('targets.leads.filtersActive', { count }) : undefined}>
      <ListFilter aria-hidden="true" />
      {t('targets.leads.filters')}
      {count > 0 ? (
        <span aria-hidden="true" className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-soft px-1.5 text-micro font-medium tabular text-primary">
          {count}
        </span>
      ) : null}
    </Button>
  );
  const clear =
    count > 0 ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => props.params.update({ grade: null, segmentId: null, due: false, owner: isOwnerMode(props.params.owner) ? props.params.owner : 'all' })}
      >
        {t('targets.leads.clearPanel')}
      </Button>
    ) : null;

  if (wide) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-5">
          <FilterFields {...props} withSort={false} />
          {clear ? <div className="-mb-1 mt-4 flex justify-end border-t border-border/60 pt-3">{clear}</div> : null}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" aria-describedby={undefined}>
        <SheetHeader className="pb-2">
          <SheetTitle>{t('targets.leads.filters')}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <FilterFields {...props} withSort />
        </SheetBody>
        <SheetFooter>
          {clear}
          <Button type="button" onClick={() => setOpen(false)}>
            {t('targets.leads.filtersDone')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** "Đang hiện 4/12 mục tiêu" + removable chips of the panel filters + "Bỏ lọc" */
export function LeadFilterSummary({
  shown,
  total,
  params,
  people,
  segments,
  onClear,
}: {
  shown: number;
  total: number;
  params: LeadParams;
  people: UserRef[];
  segments: SegmentView[];
  onClear: () => void;
}) {
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (params.grade) chips.push({ key: 'grade', label: t(`targets.grade.${params.grade}`), remove: () => params.update({ grade: null }) });
  if (params.segmentId) {
    const seg = segments.find((s) => s.id === params.segmentId);
    chips.push({ key: 'segment', label: seg?.name ?? t('targets.leads.segmentLabel'), remove: () => params.update({ segmentId: null }) });
  }
  if (!isOwnerMode(params.owner)) {
    const person = people.find((p) => p.id === params.owner);
    chips.push({ key: 'person', label: person ? shortPersonName(person.full_name) : t('targets.leads.ownerByPerson'), remove: () => params.update({ owner: 'all' }) });
  }
  if (params.due) chips.push({ key: 'due', label: t('targets.leads.dueChip'), remove: () => params.update({ due: false }) });

  if (!params.filtered && shown === total) {
    return (
      <p className="text-caption tabular" aria-live="polite">
        {t('targets.leads.count', { count: total })}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-live="polite">
      <span className="text-caption tabular">{t('targets.leads.summary', { shown, total })}</span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.remove}
          aria-label={t('targets.leads.removeFilter', { name: c.label })}
          className="touch-tap inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-primary-soft pl-2.5 pr-1.5 text-micro font-medium text-primary transition-colors hover:bg-primary-border/50"
        >
          <span className="truncate">{c.label}</span>
          <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      ))}
      {params.filtered ? (
        <Button type="button" variant="link" size="sm" onClick={onClear}>
          {t('targets.leads.clear')}
        </Button>
      ) : null}
    </div>
  );
}
