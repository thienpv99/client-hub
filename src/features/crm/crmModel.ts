// URL model of /app/crm/:tab? and small pure helpers of the Bán hàng screens.
import type { OpportunityView } from '@/services/crmContract';
import type { Viewer } from '@/services/contract';
import { normalizeText } from '@/lib/utils';
import { addDays, diffDays } from '@/domain/dates';
import { dateOf } from '@/domain/clock';
import { OPEN_STAGES } from '@/components/crm/crmLabels';
import type { OpenStage } from '@/components/crm/crmLabels';

export const CRM_TABS = ['pipeline', 'list', 'forecast', 'followups'] as const;
export type CrmTab = (typeof CRM_TABS)[number];

export function isCrmTab(v: string | undefined): v is CrmTab {
  return v !== undefined && (CRM_TABS as readonly string[]).includes(v);
}

export function crmTabPath(tab: CrmTab, search = ''): string {
  return `${tab === 'pipeline' ? '/app/crm' : `/app/crm/${tab}`}${search}`;
}

/** `?owner=` value: 'all' or a user id. Default: director → everyone, AM → their own deals. */
export function resolveOwner(raw: string | null, viewer: Viewer | null): string {
  if (raw) return raw;
  if (!viewer) return 'all';
  return viewer.role === 'am' ? viewer.user.id : 'all';
}

export function ownerParams(owner: string): { ownerId: string } | undefined {
  return owner === 'all' ? undefined : { ownerId: owner };
}

/** open deals by stage, each column sorted by expected close then value */
export function groupByStage(items: OpportunityView[], stageOf: (o: OpportunityView) => OpportunityView['stage']): Record<OpenStage, OpportunityView[]> {
  const map: Record<OpenStage, OpportunityView[]> = { qualified: [], discovery: [], proposal: [], negotiation: [] };
  for (const o of items) {
    const s = stageOf(o);
    if ((OPEN_STAGES as readonly string[]).includes(s)) map[s as OpenStage].push(o);
  }
  for (const s of OPEN_STAGES) {
    map[s].sort((a, b) => a.expected_close_date.localeCompare(b.expected_close_date) || b.value - a.value);
  }
  return map;
}

export function sumValue(items: OpportunityView[]): number {
  return items.reduce((s, o) => s + o.value, 0);
}

export function sumWeighted(items: OpportunityView[]): number {
  return items.reduce((s, o) => s + o.weighted_value, 0);
}

/** closing date of a won / lost deal (falls back to the last update) */
export function closedAt(o: OpportunityView): string {
  return dateOf(o.won_at ?? o.lost_at ?? o.updated_at);
}

/** won / lost deals closed within the last `days` days, latest first */
export function recentlyClosed(items: OpportunityView[], stage: 'won' | 'lost', today: string, days = 180): OpportunityView[] {
  const from = addDays(today, -days);
  return items
    .filter((o) => o.stage === stage && closedAt(o) >= from)
    .sort((a, b) => closedAt(b).localeCompare(closedAt(a)));
}

export function matchesSearch(o: OpportunityView, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return [o.name, o.account.name, o.account.short_name, o.owner.full_name, o.next_step ?? ''].some((s) => normalizeText(s).includes(q));
}

export type SortKey = 'close' | 'value' | 'weighted' | 'updated' | 'account';
export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export const DEFAULT_DIR: Record<SortKey, SortDir> = { close: 'asc', value: 'desc', weighted: 'desc', updated: 'desc', account: 'asc' };

export function sortOpportunities(items: OpportunityView[], sort: SortState): OpportunityView[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  const cmp = (a: OpportunityView, b: OpportunityView): number => {
    switch (sort.key) {
      case 'close':
        return a.expected_close_date.localeCompare(b.expected_close_date);
      case 'value':
        return a.value - b.value;
      case 'weighted':
        return a.weighted_value - b.weighted_value;
      case 'updated':
        return a.updated_at.localeCompare(b.updated_at);
      case 'account':
        return a.account.name.localeCompare(b.account.name, 'vi');
    }
  };
  return [...items].sort((a, b) => sign * cmp(a, b) || a.name.localeCompare(b.name, 'vi'));
}

/** days until (negative: since) a date */
export function daysFrom(today: string, date: string): number {
  return diffDays(date, today);
}
