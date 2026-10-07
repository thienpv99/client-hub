// CRM / targeting seed (ARCHITECTURE §13): prospect accounts + contacts, account profiles, ICP, leads,
// opportunities, interactions, segments and ecosystems (business groups of the client map). Derived fields (lead.last_contacted_at, prospect contacts'
// last_interaction_*, updated_at stamps) are computed from the interactions so they always agree.
// Never touches the six original accounts' rows (their health / forecast scenarios stay exactly as they are).

import type { Account, Activity, Contact, ISODateTime, Project } from '@/domain/types';
import type { AccountProfile, Ecosystem, IcpProfile, Interaction, Lead, Opportunity, Segment } from '@/domain/crmTypes';
import type { SeedCtx } from './helpers';
import { buildAccountProfiles, buildIcpProfiles, buildProspectAccounts, buildProspectContacts } from './crmAccounts';
import { buildLeads } from './crmLeads';
import { buildOpportunities, buildSegments, type DealBase } from './crmDeals';
import { buildInteractions } from './crmInteractions';
import { buildCrmActivities } from './crmActivities';
import { buildEcosystems, ecosystemOfAccount, ecosystemOfLead } from './ecosystems';

export interface CrmBase extends DealBase {
  projects: Project[];
}

export interface CrmSeed {
  /** new prospect accounts (append to accounts) */
  accounts: Account[];
  /** their contacts (append to contacts) */
  contacts: Contact[];
  /** CRM activity lines, visibility internal (append to activities) */
  activities: Activity[];
  leads: Lead[];
  account_profiles: AccountProfile[];
  opportunities: Opportunity[];
  interactions: Interaction[];
  segments: Segment[];
  icp_profiles: IcpProfile[];
  /** business groups; membership is on account_profiles / leads (ecosystem_id, null when standalone) */
  ecosystems: Ecosystem[];
}

function latest(items: Interaction[]): Interaction | undefined {
  let best: Interaction | undefined;
  for (const x of items) if (!best || x.occurred_at > best.occurred_at) best = x;
  return best;
}

function later(a: ISODateTime, b: ISODateTime | null | undefined): ISODateTime {
  return b && b > a ? b : a;
}

export function buildCrm(c: SeedCtx, base: CrmBase): CrmSeed {
  const interactions = buildInteractions(c);
  const accounts = buildProspectAccounts(c);

  const leads = buildLeads(c).map((raw) => {
    const lead: Lead = { ...raw, ecosystem_id: ecosystemOfLead(raw.id) };
    const last = latest(interactions.filter((x) => x.lead_id === lead.id));
    if (!last) return lead;
    return { ...lead, last_contacted_at: last.occurred_at, updated_at: later(lead.updated_at, last.occurred_at) };
  });

  // A converted lead's contact became the prospect's decision maker: its touchpoints count for that contact too.
  const contacts = buildProspectContacts().map((ct) => {
    const lead = leads.find((l) => l.status === 'converted' && l.converted_account_id === ct.account_id && l.contact_email === ct.email);
    const mine = interactions.filter((x) => x.contact_id === ct.id || (lead !== undefined && x.lead_id === lead.id));
    const last = latest(mine);
    return last ? { ...ct, last_interaction_at: last.occurred_at, last_interaction_note: last.summary } : ct;
  });

  const opportunities = buildOpportunities(c, base).map((o) => {
    const last = latest(interactions.filter((x) => x.opportunity_id === o.id));
    return last ? { ...o, updated_at: later(o.updated_at, last.occurred_at) } : o;
  });

  return {
    accounts,
    contacts,
    activities: buildCrmActivities(c, { opportunities, leads, accounts, projects: base.projects }),
    leads,
    account_profiles: buildAccountProfiles().map((p) => ({ ...p, ecosystem_id: ecosystemOfAccount(p.account_id) })),
    opportunities,
    interactions,
    segments: buildSegments(c),
    icp_profiles: buildIcpProfiles(c),
    ecosystems: buildEcosystems(c),
  };
}
