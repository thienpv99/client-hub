// Labels and small pure helpers shared by the targeting screens.
import type { CompanySize, LeadSource, LeadStatus, RevenueBand } from '@/domain/crmTypes';
import type { Health, ISODate, Stage, Tier } from '@/domain/types';
import type { FitBreakdown, LeadInput, LeadView } from '@/services/crmContract';
import type { UserRef } from '@/services/contract';
import { diffDays } from '@/domain/dates';
import { hasKey, t } from '@/i18n';
import { formatDate, formatRelativeDays } from '@/lib/format';
import { normalizeText } from '@/lib/utils';

export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'interested', 'nurturing', 'converted', 'disqualified'];
export const OPEN_LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'interested', 'nurturing'];
/** statuses a person can set by hand (converted only through convertLead) */
export const SETTABLE_LEAD_STATUSES: Exclude<LeadStatus, 'converted'>[] = [
  'new',
  'contacted',
  'interested',
  'nurturing',
  'disqualified',
];
export const COMPANY_SIZES: CompanySize[] = ['lt50', '50_200', '200_1000', 'gt1000'];
export const REVENUE_BANDS: RevenueBand[] = ['lt50b', '50_200b', '200b_1t', 'gt1t'];
export const LEAD_SOURCES: LeadSource[] = ['referral', 'event', 'website', 'outbound', 'partner', 'existing_customer'];
export const TIERS: Tier[] = ['strategic', 'key', 'standard'];
export const STAGES: Stage[] = ['prospecting', 'negotiating', 'implementing', 'operating', 'paused'];
export const HEALTHS: Health[] = ['blocked', 'attention', 'on_track'];
export const GRADES: FitBreakdown['grade'][] = ['A', 'B', 'C'];

export type CrmEnumGroup = 'leadStatus' | 'leadSource' | 'companySize' | 'revenueBand';

/** crm.enums.<group>.<value> (owner crm-ui), falling back to this namespace's copy */
export function crmLabel(group: CrmEnumGroup, value: string): string {
  const key = `crm.enums.${group}.${value}`;
  if (hasKey(key)) return t(key);
  const fallback = `targets.enumFallback.${group}.${value}`;
  return hasKey(fallback) ? t(fallback) : value;
}

export const leadStatusLabel = (s: LeadStatus): string => crmLabel('leadStatus', s);
export const leadSourceLabel = (s: LeadSource): string => crmLabel('leadSource', s);
export const sizeLabel = (s: CompanySize): string => crmLabel('companySize', s);
export const revenueLabel = (s: RevenueBand): string => crmLabel('revenueBand', s);
export const tierLabel = (s: Tier): string => t(`enums.tier.${s}`);
export const stageLabel = (s: Stage): string => t(`enums.stage.${s}`);
export const healthLabel = (s: Health): string => t(`enums.health.${s}`);

export function isOpenLead(status: LeadStatus): boolean {
  return OPEN_LEAD_STATUSES.includes(status);
}

/** 'Nguyễn Thu Hà' → 'Thu Hà' (short enough for a table cell, still unambiguous in a small team) */
export function shortPersonName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length <= 2 ? full.trim() : parts.slice(-2).join(' ');
}

/** directors and AMs can own leads */
export function salesPeople(users: UserRef[]): UserRef[] {
  return users
    .filter((u) => u.org_type === 'internal' && (u.role === 'am' || u.role === 'director'))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
}

export interface FollowUpInfo {
  kind: 'none' | 'overdue' | 'today' | 'future';
  text: string;
  /** dd/mm/yyyy, empty when none */
  date: string;
}

export function followUpInfo(date: ISODate | null, today: ISODate): FollowUpInfo {
  if (!date) return { kind: 'none', text: t('targets.followUp.none'), date: '' };
  const days = diffDays(date, today);
  const formatted = formatDate(date);
  if (days < 0) return { kind: 'overdue', text: t('targets.followUp.overdue', { days: -days }), date: formatted };
  if (days === 0) return { kind: 'today', text: t('targets.followUp.today'), date: formatted };
  return { kind: 'future', text: t('targets.followUp.future', { date: formatted, relative: formatRelativeDays(days) }), date: formatted };
}

/** text used by the client-side search box */
export function leadSearchText(l: LeadView): string {
  return normalizeText(
    [l.company_name, l.industry, l.province, l.contact_name, l.contact_email, l.contact_title, l.tags.join(' '), l.owner?.full_name ?? '']
      .join(' '),
  );
}

export function toLeadInput(l: LeadView, patch?: Partial<LeadInput>): LeadInput {
  return {
    id: l.id,
    company_name: l.company_name,
    industry: l.industry,
    province: l.province,
    size: l.size,
    revenue_band: l.revenue_band,
    website: l.website,
    contact_name: l.contact_name,
    contact_title: l.contact_title,
    contact_salutation: l.contact_salutation,
    contact_email: l.contact_email,
    contact_phone: l.contact_phone,
    source: l.source,
    owner_id: l.owner?.id ?? null,
    tags: l.tags,
    need_summary: l.need_summary,
    budget_estimate: l.budget_estimate,
    notes: l.notes,
    next_follow_up_date: l.next_follow_up_date,
    ...patch,
  };
}

/** digits only → number, '' → null, anything else → NaN */
export function parseAmount(raw: string): number | null {
  const digits = raw.replace(/[.\s₫,]/g, '');
  if (!digits) return null;
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

export function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}
