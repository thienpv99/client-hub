// Demo data for Client Hub, generated relative to `today` so every scenario (ARCHITECTURE §9, SPEC §9)
// is true on whatever day the demo runs. Deterministic: same `today` → same data.
// Verify with: (await import('/src/data/seedChecks')).checkSeed(buildSeed(today), today) → []

import type { ISODate } from '@/domain/types';
import type { DbData } from '@/services/db';
import { makeCtx, mergeBundles } from './seed/helpers';
import { buildInternalUsers } from './seed/people';
import { buildAccountPrices, buildPriceItems, buildSettings, buildTemplates } from './seed/catalog';
import { buildCoXanh } from './seed/coxanh';
import { buildThinhAn } from './seed/thinhan';
import { buildThienTruong } from './seed/thientruong';
import { buildGioNgan } from './seed/giongan';
import { buildHaiDang } from './seed/haidang';
import { buildMayTrang } from './seed/maytrang';
import { buildDealsCoXanh, buildDealsThienTruong, buildDealsThinhAn } from './seed/deals1';
import { buildDealsGioNgan, buildDealsHaiDang, buildDealsMayTrang } from './seed/deals2';
import { buildNotifications } from './seed/notifications';
import { buildCrm } from './seed/crm';
import { buildCare } from './seed/care';

/**
 * bump whenever stored demo data must be replaced
 * (2: internal notes no longer carry cost / margin figures · 3: CRM / targeting tables and prospect accounts ·
 *  4: ecosystems (business groups of the client map) + their member leads ·
 *  6: client care refocus — deployments, expansion maps, stakeholders, relation links, change requests, care plans
 *     and the extra contacts of the six active accounts ·
 *  7: care review fixes — plain words instead of Go-live / UAT / kickoff in the care data, the driver app's value
 *     inside the TMS contract, contacts' last touch no longer stamped with a client upload) ·
 *  8: the contact logs of Cỏ Xanh (chị Lan), Thịnh An (chị Mai), Mây Trắng (chị Hạnh, chị Ngân) and Thiên Trường (chị
 *     Thảo) record New Era's own calls / meetings, not the client's uploads or transfers (the care clock counts New
 *     Era's touches only))
 */
export const SEED_VERSION = 8;

export function buildSeed(today: ISODate): Omit<DbData, 'meta'> {
  const c = makeCtx(today);
  const all = mergeBundles([
    { users: buildInternalUsers(c) },
    buildCoXanh(c),
    buildThinhAn(c),
    buildThienTruong(c),
    buildGioNgan(c),
    buildHaiDang(c),
    buildMayTrang(c),
    buildDealsCoXanh(c),
    buildDealsThinhAn(c),
    buildDealsThienTruong(c),
    buildDealsGioNgan(c),
    buildDealsHaiDang(c),
    buildDealsMayTrang(c),
    { account_prices: buildAccountPrices(), notifications: buildNotifications(c) },
  ]);
  // CRM extension: prospect accounts (converted leads, no tasks → on track) + the CRM tables
  const crm = buildCrm(c, all);
  all.accounts.push(...crm.accounts);
  all.contacts.push(...crm.contacts);
  all.activities.push(...crm.activities);
  // client care refocus (SPEC-CARE §7): extra contacts, client-facing request lines, the AM's request bell items
  const care = buildCare(c, all);
  all.contacts.push(...care.contacts);
  all.activities.push(...care.activities);
  all.notifications.push(...care.notifications);
  all.activities.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  return {
    users: all.users,
    accounts: all.accounts,
    contacts: all.contacts,
    projects: all.projects,
    milestones: all.milestones,
    tasks: all.tasks,
    task_dependencies: all.task_dependencies,
    comments: all.comments,
    files: all.files,
    price_items: buildPriceItems(),
    account_prices: all.account_prices,
    quotes: all.quotes,
    quote_lines: all.quote_lines,
    contracts: all.contracts,
    payment_schedules: all.payment_schedules,
    activities: all.activities,
    notifications: all.notifications,
    emails: [],
    templates: buildTemplates(),
    leads: crm.leads,
    account_profiles: crm.account_profiles,
    opportunities: crm.opportunities,
    interactions: crm.interactions,
    segments: crm.segments,
    icp_profiles: crm.icp_profiles,
    ecosystems: crm.ecosystems,
    deployments: care.deployments,
    account_departments: care.account_departments,
    stakeholders: care.stakeholders,
    relation_links: care.relation_links,
    change_requests: care.change_requests,
    care_plans: care.care_plans,
    settings: buildSettings(),
  };
}
