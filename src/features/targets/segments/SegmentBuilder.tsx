// Segment builder (create / edit) in a sheet: name, sharing, scope, multi-select criteria, minimum fit, with a live
// preview (debounced api.previewSegment). From 1280px the sheet widens and the preview sits in a sticky column next
// to the criteria; below that it closes the form and its totals stay in the sticky footer.
import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Users } from 'lucide-react';
import type { SegmentCriteria } from '@/domain/crmTypes';
import type { SegmentMembers, SegmentView } from '@/services/crmContract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { useDelayedFlag } from '@/hooks/useMotion';
import { useQuery } from '@/hooks/useQuery';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n';
import { formatMoneyCompact, formatNumber } from '@/lib/format';
import {
  COMPANY_SIZES,
  HEALTHS,
  healthLabel,
  LEAD_SOURCES,
  LEAD_STATUSES,
  leadSourceLabel,
  leadStatusLabel,
  REVENUE_BANDS,
  revenueLabel,
  sizeLabel,
  STAGES,
  stageLabel,
  TIERS,
  tierLabel,
} from '../targetLabels';
import { Block, ToggleChips } from '../TargetBits';
import type { ToggleChipOption } from '../TargetBits';
import { TargetSlider } from '../TargetSlider';
import { cleanCriteria, emptyCriteria, topMembers, useDebounced } from './segmentModel';
import type { ListKey } from './segmentModel';

const SCOPES: SegmentCriteria['scope'][] = ['all', 'leads', 'accounts'];
const PREVIEW_DEBOUNCE_MS = 300;

export interface SegmentBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** edit this segment; null = create */
  segment: SegmentView | null;
}

export function SegmentBuilder({ open, onOpenChange, segment }: SegmentBuilderProps) {
  // a fresh form on every opening; kept mounted while the sheet slides out
  // (derived during render, so the previous form never shows for a frame)
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" mobileFullScreen className="xl:max-w-5xl">
        {session > 0 ? (
          <BuilderForm key={session} segment={segment} onClose={() => onOpenChange(false)} />
        ) : (
          <SheetTitle className="sr-only">{t('targets.builder.createTitle')}</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}

function withSelected(values: string[], selected: string[] | undefined): string[] {
  const extra = (selected ?? []).filter((v) => !values.includes(v));
  return [...values, ...extra];
}

function plain(values: string[]): ToggleChipOption<string>[] {
  return values.map((v) => ({ value: v, label: v }));
}

function labelled<T extends string>(values: T[], label: (v: T) => string): ToggleChipOption<T>[] {
  return values.map((v) => ({ value: v, label: label(v) }));
}

function Field({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-baseline gap-x-2 text-table font-medium text-foreground">
        {label}
        {count > 0 ? <span className="text-micro font-medium text-primary">{t('targets.builder.selectedCount', { count })}</span> : null}
      </p>
      {children}
    </div>
  );
}

/** the live result: two big counts, potential and average fit, then the best-fitting members */
function PreviewPanel({ data, updating, error }: { data: SegmentMembers | undefined; updating: boolean; error: boolean }) {
  const top = data ? topMembers(data) : [];
  // the "Đang cập nhật…" label and the dimmed figures wait 150 ms: a quick recount never flickers (DESIGN §8.2)
  const busy = useDelayedFlag(updating);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-table font-semibold text-ink">{t('targets.builder.preview')}</h3>
        {busy ? <span className="text-micro text-muted-foreground">{t('targets.builder.previewUpdating')}</span> : null}
      </div>
      {data ? (
        <>
          <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3 transition-opacity duration-150', busy && 'opacity-60')}>
            <div>
              <dt className="text-micro text-muted-foreground">{t('targets.builder.scopeOptions.leads')}</dt>
              <dd className="text-kpi font-semibold tabular tracking-display text-ink">{data.lead_count}</dd>
            </div>
            <div>
              <dt className="text-micro text-muted-foreground">{t('targets.builder.scopeOptions.accounts')}</dt>
              <dd className="text-kpi font-semibold tabular tracking-display text-ink">{data.account_count}</dd>
            </div>
            <div>
              <dt className="text-micro text-muted-foreground">{t('targets.segments.potential')}</dt>
              <dd className="text-table font-semibold tabular text-ink">{formatMoneyCompact(data.potential_value)}</dd>
            </div>
            <div>
              <dt className="text-micro text-muted-foreground">{t('targets.segments.avgFitShort')}</dt>
              <dd className="text-table font-semibold tabular text-ink">{formatNumber(Math.round(data.avg_fit))}</dd>
            </div>
          </dl>
          {top.length > 0 ? (
            <div className="space-y-2">
              <p className="text-micro font-medium text-muted-foreground">{t('targets.builder.previewTop')}</p>
              <ul className={cn('divide-y divide-border/60 rounded-lg bg-card ring-1 ring-inset ring-border/70 transition-opacity duration-150', busy && 'opacity-60')}>
                {top.map((m) => (
                  <li key={`${m.kind}-${m.id}`} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-table font-medium text-foreground">{m.name}</span>
                      <span className="block truncate text-micro text-muted-foreground">
                        {m.kind === 'lead' ? t('targets.builder.memberLead') : t('targets.builder.memberAccount')}
                        {t('common.separator')}
                        {m.sub}
                      </span>
                    </span>
                    <span className="w-8 text-right text-table font-semibold tabular text-ink">{m.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-lg bg-card p-3 text-table text-muted-foreground ring-1 ring-inset ring-border/70">
              <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t('targets.builder.previewEmpty')}
            </p>
          )}
        </>
      ) : error ? (
        <p className="text-table text-muted-foreground">{t('common.error.description')}</p>
      ) : (
        <div className="space-y-3" aria-hidden="true">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-16" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      )}
    </div>
  );
}

function BuilderForm({ segment, onClose }: { segment: SegmentView | null; onClose: () => void }) {
  const uid = useId();
  const { run, pending, pendingVisible } = useAction();
  const [name, setName] = useState(segment?.name ?? '');
  const [description, setDescription] = useState(segment?.description ?? '');
  const [shared, setShared] = useState(segment?.shared ?? true);
  const [criteria, setCriteria] = useState<SegmentCriteria>(() => (segment ? { ...segment.criteria } : emptyCriteria()));
  const [nameError, setNameError] = useState<string | null>(null);
  const options = useQuery(() => api.getTargetingOptions(), []);

  const cleaned = useMemo(() => cleanCriteria(criteria), [criteria]);
  const key = JSON.stringify(cleaned);
  const debouncedKey = useDebounced(key, PREVIEW_DEBOUNCE_MS);
  const preview = useQuery(() => api.previewSegment(JSON.parse(debouncedKey) as SegmentCriteria), [debouncedKey], {
    keepPreviousData: true,
  });
  const updating = preview.refreshing || debouncedKey !== key;

  function setList<K extends ListKey>(k: K, values: NonNullable<SegmentCriteria[K]>) {
    setCriteria((c) => ({ ...c, [k]: values }));
  }

  async function save() {
    if (!name.trim()) {
      setNameError(t('targets.builder.nameRequired'));
      document.getElementById(`${uid}-name`)?.focus();
      return;
    }
    const saved = await run(
      () => api.saveSegment({ id: segment?.id, name: name.trim(), description: description.trim(), criteria: cleaned, shared }),
      { success: t('targets.builder.saved', { name: name.trim() }) },
    );
    if (saved) onClose();
  }

  const scope = criteria.scope;
  const opts = options.data;
  const minFit = criteria.min_fit_score ?? 0;

  return (
    <>
      <SheetHeader className="border-b border-border/70">
        <SheetTitle>{segment ? t('targets.builder.editTitle') : t('targets.builder.createTitle')}</SheetTitle>
        <SheetDescription>{t('targets.builder.description')}</SheetDescription>
      </SheetHeader>

      <SheetBody className="pt-0 md:pt-0 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
        <div className="min-w-0 divide-y divide-border/60 [&>*]:py-6 [&>*:first-child]:pt-5 md:[&>*:first-child]:pt-6">
          <div className="space-y-4">
            <FormField label={t('targets.builder.name')} htmlFor={`${uid}-name`} required error={nameError}>
              <Input
                id={`${uid}-name`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                placeholder={t('targets.builder.namePlaceholder')}
                autoComplete="off"
              />
            </FormField>
            <FormField label={t('targets.builder.descriptionLabel')} htmlFor={`${uid}-desc`}>
              <Textarea
                id={`${uid}-desc`}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('targets.builder.descriptionPlaceholder')}
                className="min-h-[64px]"
              />
            </FormField>
            <label htmlFor={`${uid}-shared`} className="flex min-h-tap cursor-pointer items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-table font-medium text-foreground">{t('targets.builder.shared')}</span>
                <span className="block text-caption">{t('targets.builder.sharedHint')}</span>
              </span>
              <Switch id={`${uid}-shared`} checked={shared} onCheckedChange={setShared} />
            </label>
          </div>

          <Block title={t('targets.builder.scope')}>
            <ToggleGroup
              type="single"
              variant="segmented"
              value={scope}
              onValueChange={(v) => {
                if (v === 'all' || v === 'leads' || v === 'accounts') setCriteria((c) => ({ ...c, scope: v }));
              }}
              aria-label={t('targets.builder.scope')}
              className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto"
            >
              {SCOPES.map((s) => (
                <ToggleGroupItem key={s} value={s}>
                  {t(`targets.builder.scopeOptions.${s}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Block>

          <Block title={t('targets.builder.groups.profile')} description={t('targets.builder.anyValue')}>
            <div className="space-y-5">
              <Field label={t('targets.builder.criteria.industries')} count={criteria.industries?.length ?? 0}>
                {opts ? (
                  <ToggleChips
                    ariaLabel={t('targets.builder.criteria.industries')}
                    options={plain(withSelected(opts.industries, criteria.industries))}
                    value={criteria.industries ?? []}
                    onChange={(v) => setList('industries', v)}
                  />
                ) : (
                  <ChipsSkeleton />
                )}
              </Field>
              <Field label={t('targets.builder.criteria.provinces')} count={criteria.provinces?.length ?? 0}>
                {opts ? (
                  <ToggleChips
                    ariaLabel={t('targets.builder.criteria.provinces')}
                    options={plain(withSelected(opts.provinces, criteria.provinces))}
                    value={criteria.provinces ?? []}
                    onChange={(v) => setList('provinces', v)}
                  />
                ) : (
                  <ChipsSkeleton />
                )}
              </Field>
              <Field label={t('targets.builder.criteria.sizes')} count={criteria.sizes?.length ?? 0}>
                <ToggleChips
                  ariaLabel={t('targets.builder.criteria.sizes')}
                  options={labelled(COMPANY_SIZES, sizeLabel)}
                  value={criteria.sizes ?? []}
                  onChange={(v) => setList('sizes', v)}
                />
              </Field>
              <Field label={t('targets.builder.criteria.revenue_bands')} count={criteria.revenue_bands?.length ?? 0}>
                <ToggleChips
                  ariaLabel={t('targets.builder.criteria.revenue_bands')}
                  options={labelled(REVENUE_BANDS, revenueLabel)}
                  value={criteria.revenue_bands ?? []}
                  onChange={(v) => setList('revenue_bands', v)}
                />
              </Field>
              <Field label={t('targets.builder.criteria.sources')} count={criteria.sources?.length ?? 0}>
                <ToggleChips
                  ariaLabel={t('targets.builder.criteria.sources')}
                  options={labelled(LEAD_SOURCES, leadSourceLabel)}
                  value={criteria.sources ?? []}
                  onChange={(v) => setList('sources', v)}
                />
              </Field>
              <Field label={t('targets.builder.criteria.tags')} count={criteria.tags?.length ?? 0}>
                {opts ? (
                  <ToggleChips
                    ariaLabel={t('targets.builder.criteria.tags')}
                    options={plain(withSelected(opts.tags, criteria.tags))}
                    value={criteria.tags ?? []}
                    onChange={(v) => setList('tags', v)}
                  />
                ) : (
                  <ChipsSkeleton />
                )}
              </Field>
              <div className="space-y-1">
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-table font-medium text-foreground">
                  {t('targets.builder.criteria.min_fit_score')}
                  <span className="text-table font-normal tabular text-muted-foreground">
                    {minFit > 0 ? t('targets.builder.minFitValue', { value: minFit }) : t('targets.builder.minFitAny')}
                  </span>
                </p>
                <TargetSlider
                  value={minFit}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) => setCriteria((c) => ({ ...c, min_fit_score: v }))}
                  label={t('targets.builder.criteria.min_fit_score')}
                  valueText={minFit > 0 ? t('targets.builder.minFitValue', { value: minFit }) : t('targets.builder.minFitAny')}
                />
              </div>
            </div>
          </Block>

          {scope !== 'accounts' ? (
            <Block title={t('targets.builder.groups.leads')} description={scope === 'all' ? t('targets.builder.leadsOnlyHint') : undefined}>
              <Field label={t('targets.builder.criteria.lead_statuses')} count={criteria.lead_statuses?.length ?? 0}>
                <ToggleChips
                  ariaLabel={t('targets.builder.criteria.lead_statuses')}
                  options={labelled(LEAD_STATUSES, leadStatusLabel)}
                  value={criteria.lead_statuses ?? []}
                  onChange={(v) => setList('lead_statuses', v)}
                />
              </Field>
            </Block>
          ) : null}

          {scope !== 'leads' ? (
            <Block title={t('targets.builder.groups.accounts')} description={scope === 'all' ? t('targets.builder.accountsOnlyHint') : undefined}>
              <div className="space-y-5">
                <Field label={t('targets.builder.criteria.tiers')} count={criteria.tiers?.length ?? 0}>
                  <ToggleChips
                    ariaLabel={t('targets.builder.criteria.tiers')}
                    options={labelled(TIERS, tierLabel)}
                    value={criteria.tiers ?? []}
                    onChange={(v) => setList('tiers', v)}
                  />
                </Field>
                <Field label={t('targets.builder.criteria.stages')} count={criteria.stages?.length ?? 0}>
                  <ToggleChips
                    ariaLabel={t('targets.builder.criteria.stages')}
                    options={labelled(STAGES, stageLabel)}
                    value={criteria.stages ?? []}
                    onChange={(v) => setList('stages', v)}
                  />
                </Field>
                <Field label={t('targets.builder.criteria.health')} count={criteria.health?.length ?? 0}>
                  <ToggleChips
                    ariaLabel={t('targets.builder.criteria.health')}
                    options={labelled(HEALTHS, healthLabel)}
                    value={criteria.health ?? []}
                    onChange={(v) => setList('health', v)}
                  />
                </Field>
              </div>
            </Block>
          ) : null}
        </div>

        {/* below 1280 the preview closes the form; from 1280 it is a sticky column next to the criteria */}
        <aside
          aria-label={t('targets.builder.preview')}
          aria-live="polite"
          className="border-t border-border/60 py-6 xl:sticky xl:top-0 xl:mt-6 xl:self-start xl:rounded-xl xl:border-t-0 xl:bg-subtle xl:p-5 xl:ring-1 xl:ring-inset xl:ring-border/60"
        >
          <PreviewPanel data={preview.data} updating={updating} error={Boolean(preview.error)} />
        </aside>
      </SheetBody>

      <SheetFooter className="flex-col items-stretch sm:flex-row sm:items-center sm:justify-between">
        <p className={cn('min-w-0 self-center text-table tabular xl:invisible', updating ? 'text-muted-foreground' : 'text-foreground')} aria-hidden="true">
          {preview.data ? (
            <>
              <span className="font-semibold">{t('targets.builder.previewCount', { leads: preview.data.lead_count, accounts: preview.data.account_count })}</span>
              <span className="hidden text-muted-foreground sm:inline">
                {t('common.separator')}
                {t('targets.builder.previewPotential', { value: formatMoneyCompact(preview.data.potential_value) })}
              </span>
            </>
          ) : null}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button type="button" variant="secondary" onClick={() => !pending && onClose()} disabled={pendingVisible}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => void save()} loading={pending}>
            {t('targets.builder.save')}
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

function ChipsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden="true">
      <Skeleton className="h-8 w-24 rounded-full" />
      <Skeleton className="h-8 w-20 rounded-full" />
      <Skeleton className="h-8 w-28 rounded-full" />
    </div>
  );
}
