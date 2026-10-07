// CRM enum labels, orders and icons shared by the Bán hàng / Khách hàng mục tiêu / Dự án screens (owner crm-ui).
// Labels live in i18n `crm.enums.<enumName>.<value>` (enumName = the crmTypes type name in camelCase).
import type { LucideIcon } from 'lucide-react';
import { Mail, MessageCircle, Phone, Presentation, StickyNote, Users } from 'lucide-react';
import type {
  CompanySize,
  InteractionKind,
  InteractionOutcome,
  LeadSource,
  LeadStatus,
  OpportunityStage,
  RevenueBand,
} from '@/domain/crmTypes';
import { hasKey, t } from '@/i18n';

/** pipeline order of the open stages (Kanban columns) */
export const OPEN_STAGES = ['qualified', 'discovery', 'proposal', 'negotiation'] as const;
export type OpenStage = (typeof OPEN_STAGES)[number];
export const CLOSED_STAGES = ['won', 'lost'] as const;
export type ClosedStage = (typeof CLOSED_STAGES)[number];
export const STAGE_ORDER: readonly OpportunityStage[] = [...OPEN_STAGES, ...CLOSED_STAGES];

/** default probability per stage (ARCHITECTURE §13) — moving a stage resets to this value */
export const DEFAULT_PROBABILITY: Record<OpportunityStage, number> = {
  qualified: 10,
  discovery: 25,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
};

export function isOpenStage(stage: OpportunityStage): stage is OpenStage {
  return (OPEN_STAGES as readonly string[]).includes(stage);
}

export const LEAD_STATUSES: readonly LeadStatus[] = ['new', 'contacted', 'interested', 'nurturing', 'disqualified', 'converted'];
export const LEAD_SOURCES: readonly LeadSource[] = ['referral', 'event', 'website', 'outbound', 'partner', 'existing_customer'];
export const COMPANY_SIZES: readonly CompanySize[] = ['lt50', '50_200', '200_1000', 'gt1000'];
export const REVENUE_BANDS: readonly RevenueBand[] = ['lt50b', '50_200b', '200b_1t', 'gt1t'];
export const INTERACTION_KINDS: readonly InteractionKind[] = ['call', 'meeting', 'email', 'demo', 'zalo', 'note'];
export const INTERACTION_OUTCOMES: readonly InteractionOutcome[] = ['positive', 'neutral', 'negative'];

export const INTERACTION_ICONS: Record<InteractionKind, LucideIcon> = {
  call: Phone,
  meeting: Users,
  email: Mail,
  demo: Presentation,
  zalo: MessageCircle,
  note: StickyNote,
};

/** `crm.enums.<group>.<value>`; an unknown value is shown as is (never a raw i18n key) */
export function crmEnumLabel(group: string, value: string): string {
  const key = `crm.enums.${group}.${value}`;
  return hasKey(key) ? t(key) : value;
}

export const stageLabel = (stage: OpportunityStage): string => crmEnumLabel('opportunityStage', stage);
export const leadStatusLabel = (status: LeadStatus): string => crmEnumLabel('leadStatus', status);
export const sourceLabel = (source: LeadSource): string => crmEnumLabel('leadSource', source);
export const sizeLabel = (size: CompanySize): string => crmEnumLabel('companySize', size);
export const revenueBandLabel = (band: RevenueBand): string => crmEnumLabel('revenueBand', band);
export const interactionKindLabel = (kind: InteractionKind): string => crmEnumLabel('interactionKind', kind);
export const outcomeLabel = (outcome: InteractionOutcome): string => crmEnumLabel('interactionOutcome', outcome);

/** in-app links of CRM objects */
export const crmPaths = {
  opportunity: (id: string): string => `/app/crm/opportunities/${encodeURIComponent(id)}`,
  lead: (id: string): string => `/app/targets/leads/${encodeURIComponent(id)}`,
  account: (id: string): string => `/app/accounts/${encodeURIComponent(id)}`,
  /** with a project id the roadmap opens on that project (RoadmapTab reads ?project=) */
  accountRoadmap: (id: string, projectId?: string | null): string =>
    `/app/accounts/${encodeURIComponent(id)}/roadmap${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`,
  quote: (id: string): string => `/app/commercial/quotes/${encodeURIComponent(id)}`,
  /**
   * with an opportunity id the quote editor can link the saved quote back to that deal (`?opportunity=`, read by
   * the commercial quote editor; without that the deal's edit dialog links it via its "Báo giá" field)
   */
  newQuote: (accountId: string, opportunityId?: string | null): string =>
    `/app/commercial/quotes/new?account=${encodeURIComponent(accountId)}${opportunityId ? `&opportunity=${encodeURIComponent(opportunityId)}` : ''}`,
};
