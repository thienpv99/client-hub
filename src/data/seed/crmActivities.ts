// CRM seed — activity lines (visibility 'internal'), written the way services/api/crm.ts logs them so the
// opportunity stage history (read from 'opportunity.*' activities) and the account feeds look lived-in.
// Params follow i18n/vi/activityCrm.ts: opportunity.* { opportunity, stage, stage_label } (+ stage_changed: from) · won { project } ·
// lost { reason } · lead.* { lead } · status_changed { status, status_label } · lead.converted { lead, account, opportunity }.

import type { Account, Activity, ActivityAction, ActivityTargetType, ID, Project } from '@/domain/types';
import type { Lead, Opportunity, OpportunityStage } from '@/domain/crmTypes';
import type { SeedCtx } from './helpers';
import { makeActivity } from './helpers';
import { PROSPECTS } from './crmAccounts';

/** readable stage words, same as activity.opportunity.stage_label.* */
const STAGE_LABEL: Record<OpportunityStage, string> = {
  qualified: 'Đủ điều kiện',
  discovery: 'Khảo sát nhu cầu',
  proposal: 'Đề xuất & báo giá',
  negotiation: 'Đàm phán',
  won: 'Thắng',
  lost: 'Không thành công',
};

/** stage path of each deal after its creation: [stage, day offset, hh:mm]; the last step is the current stage. */
const PATHS: Record<ID, [OpportunityStage, number, string][]> = {
  opp_thinhan_p2: [['discovery', -28, '11:30'], ['proposal', -16, '14:00'], ['negotiation', -10, '16:30']],
  opp_coxanh_ext: [['proposal', -3, '11:00']],
  opp_haidang_training: [['proposal', -2, '10:00']],
  opp_thientruong_support: [['proposal', -4, '15:00']],
  [PROSPECTS.saobac.opportunity]: [['discovery', -38, '12:00'], ['proposal', -25, '16:00'], ['negotiation', -8, '17:00']],
  [PROSPECTS.hoangvu.opportunity]: [['discovery', -15, '17:00']],
  opp_coxanh_app: [['discovery', -112, '15:00'], ['proposal', -82, '10:00'], ['negotiation', -76, '16:00'], ['won', -70, '16:00']],
  opp_thinhan_p1: [['discovery', -98, '10:00'], ['proposal', -58, '14:00'], ['negotiation', -54, '11:00'], ['won', -50, '16:00']],
  opp_maytrang_ops: [['discovery', -135, '10:00'], ['proposal', -110, '14:00'], ['won', -104, '16:00']],
  opp_maytrang_wh: [['proposal', -72, '14:00'], ['lost', -40, '10:00']],
  opp_giongan_mobile: [['discovery', -45, '15:00'], ['lost', -20, '10:00']],
};

/** stage a deal was created in (default 'qualified') */
const CREATED_IN: Record<ID, OpportunityStage> = { opp_maytrang_infra: 'discovery' };

export function buildCrmActivities(
  c: SeedCtx,
  input: { opportunities: Opportunity[]; leads: Lead[]; accounts: Account[]; projects: Project[] },
): Activity[] {
  const out: Activity[] = [];
  let n = 0;
  const add = (accountId: ID | null, actor: ID | null, action: ActivityAction, targetType: ActivityTargetType, targetId: ID, params: Record<string, string | number>, at: string): void => {
    n += 1;
    out.push(makeActivity({ id: `act_crm_${String(n).padStart(3, '0')}`, account_id: accountId, actor_id: actor, action, target_type: targetType, target_id: targetId, params, visibility: 'internal', at }));
  };

  // prospects: account created by converting the lead, then the deal opened with it
  for (const p of Object.values(PROSPECTS)) {
    const lead = input.leads.find((l) => l.id === p.lead);
    const account = input.accounts.find((a) => a.id === p.account);
    const opp = input.opportunities.find((o) => o.id === p.opportunity);
    if (!lead || !account || !opp) continue;
    add(account.id, lead.owner_id, 'account.created', 'account', account.id, { account: account.name }, account.created_at);
    add(account.id, lead.owner_id, 'lead.converted', 'lead', lead.id, { lead: lead.company_name, account: account.name, opportunity: opp.name }, account.created_at);
  }

  // every deal: created → stage changes → won / lost
  for (const o of input.opportunities) {
    const first = CREATED_IN[o.id] ?? 'qualified';
    add(o.account_id, o.owner_id, 'opportunity.created', 'opportunity', o.id, { opportunity: o.name, stage: first, stage_label: STAGE_LABEL[first] }, o.created_at);
    let from: OpportunityStage = first;
    for (const [stage, day, hhmm] of PATHS[o.id] ?? []) {
      const at = c.at(day, hhmm);
      if (stage === 'won') {
        const project = input.projects.find((x) => x.id === o.project_id);
        add(o.account_id, o.owner_id, 'opportunity.won', 'opportunity', o.id, { opportunity: o.name, project: project ? project.name : '' }, at);
      } else if (stage === 'lost') {
        add(o.account_id, o.owner_id, 'opportunity.lost', 'opportunity', o.id, { opportunity: o.name, reason: o.lost_reason ?? '' }, at);
      } else {
        add(o.account_id, o.owner_id, 'opportunity.stage_changed', 'opportunity', o.id, { opportunity: o.name, from, stage, stage_label: STAGE_LABEL[stage] }, at);
      }
      from = stage;
    }
  }

  // leads closed as not a fit
  for (const l of input.leads.filter((x) => x.status === 'disqualified')) {
    add(null, l.owner_id, 'lead.status_changed', 'lead', l.id, { lead: l.company_name, status: 'disqualified', status_label: 'Không phù hợp' }, l.updated_at);
  }
  return out;
}
