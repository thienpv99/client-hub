// "Chân dung lý tưởng" tab: the ICP (api.getIcp) as label / chips rows on hairlines (the focal card, 3/5 on xl) and
// the five weights 0–50 with each weight's share (2/5), "Cách chấm" folded under them. The director edits (sticky
// save bar, api.updateIcp); an AM reads (chosen values as quiet chips, weights as plain bars).
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, CircleAlert, Lock } from 'lucide-react';
import type { CompanySize, IcpProfile, RevenueBand } from '@/domain/crmTypes';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { SMALL } from '@/components/common/cx';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton } from '@/components/common/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { formatPercent, formatRelativeTime } from '@/lib/format';
import { COMPANY_SIZES, REVENUE_BANDS, revenueLabel, sameSet, sizeLabel } from '../targetLabels';
import { ToggleChips } from '../TargetBits';
import type { ToggleChipOption } from '../TargetBits';
import { TargetSlider } from '../TargetSlider';

type Weights = IcpProfile['weights'];
type WeightKey = keyof Weights;
const WEIGHT_KEYS: WeightKey[] = ['industry', 'size', 'revenue', 'province', 'engagement'];
const WEIGHT_MAX = 50;
const RULE_KEYS = ['industry', 'sizeRevenue', 'province', 'engagement', 'grades'] as const;

interface Draft {
  target_industries: string[];
  target_provinces: string[];
  target_sizes: CompanySize[];
  target_revenue_bands: RevenueBand[];
  weights: Weights;
}

function toDraft(icp: IcpProfile): Draft {
  return {
    target_industries: [...icp.target_industries],
    target_provinces: [...icp.target_provinces],
    target_sizes: [...icp.target_sizes],
    target_revenue_bands: [...icp.target_revenue_bands],
    weights: { ...icp.weights },
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    sameSet(a.target_industries, b.target_industries) &&
    sameSet(a.target_provinces, b.target_provinces) &&
    sameSet(a.target_sizes, b.target_sizes) &&
    sameSet(a.target_revenue_bands, b.target_revenue_bands) &&
    WEIGHT_KEYS.every((k) => a.weights[k] === b.weights[k])
  );
}

function union(a: string[], b: string[]): string[] {
  return [...a, ...b.filter((x) => !a.includes(x))];
}

/** one criterion: label left (md+) / above (phones), chips right */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-4">
      <p className="text-table font-medium text-foreground md:pt-1.5">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** read-only weight: the slider's track without a thumb */
function WeightBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / WEIGHT_MAX) * 100));
  return (
    <div className="flex h-8 items-center" aria-hidden="true">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-chart-2" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ScoringRules() {
  return (
    <details className="group w-full">
      <summary className="touch-tap -mx-1 flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-md px-1 font-medium text-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
        {t('targets.icp.rules.title')}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="mt-2 list-disc space-y-1.5 pb-1 pl-5 text-table text-muted-foreground marker:text-caption">
        {RULE_KEYS.map((k) => (
          <li key={k}>{t(`targets.icp.rules.${k}`)}</li>
        ))}
      </ul>
    </details>
  );
}

export function IcpTab({ isDirector }: { isDirector: boolean }) {
  const icpQ = useQuery(() => api.getIcp(), []);
  const optionsQ = useQuery(() => api.getTargetingOptions(), [], { enabled: isDirector });
  const { run, pending } = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);

  if (!icpQ.data) {
    return icpQ.loading ? (
      <div className="grid gap-6 xl:grid-cols-5">
        <CardSkeleton lines={6} className="xl:col-span-3" />
        <CardSkeleton lines={5} className="xl:col-span-2" />
      </div>
    ) : (
      <Card>
        <ErrorState error={icpQ.error} onRetry={icpQ.refetch} />
      </Card>
    );
  }

  const icp = icpQ.data;
  const saved = toDraft(icp);
  const current = draft ?? saved;
  const dirty = draft !== null && !sameDraft(draft, saved);
  const total = WEIGHT_KEYS.reduce((s, k) => s + Math.max(0, current.weights[k]), 0);
  const readOnly = !isDirector;
  const opts = optionsQ.data;

  function edit(patch: Partial<Draft>) {
    setDraft((d) => ({ ...(d ?? toDraft(icp)), ...patch }));
  }

  async function save() {
    if (!draft || total <= 0) return;
    const r = await run(() => api.updateIcp(draft), { success: t('targets.icp.saved') });
    if (r) setDraft(null);
  }

  const industryOptions: ToggleChipOption<string>[] = union(opts?.industries ?? [], current.target_industries).map((v) => ({ value: v, label: v }));
  const provinceOptions: ToggleChipOption<string>[] = union(opts?.provinces ?? [], current.target_provinces).map((v) => ({ value: v, label: v }));
  const sizeOptions: ToggleChipOption<CompanySize>[] = COMPANY_SIZES.map((v) => ({ value: v, label: sizeLabel(v) }));
  const revenueOptions: ToggleChipOption<RevenueBand>[] = REVENUE_BANDS.map((v) => ({ value: v, label: revenueLabel(v) }));
  const updated = t('targets.icp.updated', { when: formatRelativeTime(icp.updated_at) });

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid min-w-0 gap-6 xl:grid-cols-5">
        <SectionCard
          className="xl:col-span-3"
          title={t('targets.icp.title')}
          description={t('targets.icp.intro')}
          actions={
            readOnly ? (
              <Badge title={t('targets.icp.readOnly')}>
                <Lock aria-hidden="true" />
                {t('targets.icp.readOnlyShort')}
              </Badge>
            ) : null
          }
          divided
          footer={<span className="text-caption">{readOnly ? updated : `${updated}${t('common.separator')}${t('targets.icp.pickHint')}`}</span>}
        >
          <Row label={t('targets.icp.industries')}>
            <ToggleChips
              ariaLabel={t('targets.icp.industries')}
              readOnly={readOnly}
              options={industryOptions}
              value={current.target_industries}
              onChange={(v) => edit({ target_industries: v })}
            />
          </Row>
          <Row label={t('targets.icp.provinces')}>
            <ToggleChips
              ariaLabel={t('targets.icp.provinces')}
              readOnly={readOnly}
              options={provinceOptions}
              value={current.target_provinces}
              onChange={(v) => edit({ target_provinces: v })}
            />
          </Row>
          <Row label={t('targets.icp.sizes')}>
            <ToggleChips
              ariaLabel={t('targets.icp.sizes')}
              readOnly={readOnly}
              options={sizeOptions}
              value={current.target_sizes}
              onChange={(v) => edit({ target_sizes: v })}
            />
          </Row>
          <Row label={t('targets.icp.revenue_bands')}>
            <ToggleChips
              ariaLabel={t('targets.icp.revenue_bands')}
              readOnly={readOnly}
              options={revenueOptions}
              value={current.target_revenue_bands}
              onChange={(v) => edit({ target_revenue_bands: v })}
            />
          </Row>
        </SectionCard>

        <SectionCard
          className="xl:col-span-2"
          title={t('targets.icp.weights')}
          description={t('targets.icp.weightsIntro')}
          footer={<ScoringRules />}
        >
          <ul className="space-y-3">
            {WEIGHT_KEYS.map((k) => {
              const w = current.weights[k];
              const name = t(`targets.fit.components.${k}`);
              const share = total > 0 ? (Math.max(0, w) / total) * 100 : 0;
              return (
                <li key={k}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-table font-medium text-foreground">{name}</span>
                    <span className="shrink-0 text-table tabular">
                      <span className="font-semibold text-ink">{w}</span>
                      {/* weights summing to 100 are their own share */}
                      {total !== 100 ? <span className={cn('ml-2 text-muted-foreground', SMALL)}>{formatPercent(share)}</span> : null}
                    </span>
                  </div>
                  {readOnly ? (
                    <WeightBar value={w} />
                  ) : (
                    <TargetSlider
                      value={w}
                      min={0}
                      max={WEIGHT_MAX}
                      step={1}
                      onChange={(v) => edit({ weights: { ...current.weights, [k]: v } })}
                      label={t('targets.icp.weightLabel', { name: name.toLowerCase() })}
                      valueText={`${w} · ${t('targets.icp.weightShare', { pct: formatPercent(share) })}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {total <= 0 ? (
            <p className={cn('mt-3 flex items-center gap-1.5 font-medium text-danger', SMALL)}>
              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('targets.icp.weightsZero')}
            </p>
          ) : null}
        </SectionCard>
      </div>

      {isDirector && dirty ? (
        <div
          role="region"
          aria-label={t('targets.icp.save')}
          className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border border-border/70 bg-card/95 p-3 shadow-pop backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:flex-row sm:items-center sm:pl-5"
        >
          <p className={cn('flex-1 text-table', total > 0 ? 'text-foreground' : 'text-danger')} aria-live="polite">
            {total > 0 ? t('targets.icp.dirty') : t('targets.icp.weightsZero')}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="secondary" onClick={() => setDraft(null)} disabled={pending}>
              {t('targets.icp.discard')}
            </Button>
            <Button type="button" onClick={() => void save()} loading={pending} disabled={total <= 0}>
              {t('targets.icp.save')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
