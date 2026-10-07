// Segment criteria helpers: defaults, cleaning per scope, a readable one-line summary, debounce hook.
import { useEffect, useState } from 'react';
import type { SegmentCriteria } from '@/domain/crmTypes';
import type { SegmentMembers } from '@/services/crmContract';
import { t } from '@/i18n';
import { healthLabel, leadSourceLabel, leadStatusLabel, revenueLabel, sizeLabel, stageLabel, tierLabel } from '../targetLabels';

export type ListKey = Exclude<keyof SegmentCriteria, 'scope' | 'min_fit_score'>;

export function emptyCriteria(): SegmentCriteria {
  return { scope: 'all' };
}

/** drop empty lists, criteria that do not apply to the scope, and a 0 minimum score */
export function cleanCriteria(c: SegmentCriteria): SegmentCriteria {
  const out: SegmentCriteria = { scope: c.scope };
  const keep = <K extends ListKey>(key: K) => {
    const v = c[key];
    if (Array.isArray(v) && v.length > 0) out[key] = [...v] as SegmentCriteria[K];
  };
  keep('industries');
  keep('provinces');
  keep('tags');
  keep('sizes');
  keep('revenue_bands');
  keep('sources');
  keep('owner_ids');
  if (c.scope !== 'accounts') keep('lead_statuses');
  if (c.scope !== 'leads') {
    keep('tiers');
    keep('stages');
    keep('health');
  }
  if (c.min_fit_score && c.min_fit_score > 0) out.min_fit_score = c.min_fit_score;
  return out;
}

function joined<T extends string>(values: T[] | undefined, label: (v: T) => string = (v) => v): string | null {
  return values && values.length > 0 ? values.map(label).join(', ') : null;
}

/** "Mục tiêu mới · Bán lẻ, Logistics · TP. Hồ Chí Minh · Từ 60 điểm" */
export function criteriaSummary(c: SegmentCriteria): string[] {
  const parts: (string | null)[] = [
    c.scope === 'all' ? null : t(`targets.builder.scopeOptions.${c.scope}`),
    joined(c.industries),
    joined(c.provinces),
    joined(c.sizes, sizeLabel),
    joined(c.revenue_bands, revenueLabel),
    joined(c.sources, leadSourceLabel),
    c.scope === 'accounts' ? null : joined(c.lead_statuses, leadStatusLabel),
    c.scope === 'leads' ? null : joined(c.tiers, tierLabel),
    c.scope === 'leads' ? null : joined(c.stages, stageLabel),
    c.scope === 'leads' ? null : joined(c.health, healthLabel),
    joined(c.tags, (v) => `#${v}`),
    c.min_fit_score ? t('targets.builder.minFitValue', { value: c.min_fit_score }) : null,
  ];
  return parts.filter((p): p is string => p !== null);
}

export interface PreviewMember {
  kind: 'lead' | 'account';
  id: string;
  name: string;
  sub: string;
  score: number;
}

/** best-fitting members of a preview, leads and accounts together */
export function topMembers(m: SegmentMembers, n = 5): PreviewMember[] {
  const all: PreviewMember[] = [
    ...m.leads.map((l) => ({ kind: 'lead' as const, id: l.id, name: l.company_name, sub: `${l.industry} · ${l.province}`, score: l.fit.score })),
    ...m.accounts.map((a) => ({ kind: 'account' as const, id: a.id, name: a.name, sub: `${a.industry} · ${a.province}`, score: a.fit.score })),
  ];
  return all.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'vi')).slice(0, n);
}

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
