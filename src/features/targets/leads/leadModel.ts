// Client-side part of the lead list: status / grade / due / search filters, status counts, sorting.
// (owner and segment go to the api — they change which leads exist for the counts.)
import type { LeadStatus } from '@/domain/crmTypes';
import type { ISODate } from '@/domain/types';
import type { LeadView } from '@/services/crmContract';
import { normalizeText } from '@/lib/utils';
import { isOpenLead, LEAD_STATUSES, leadSearchText } from '../targetLabels';
import type { LeadParams, LeadSort, StatusFilter } from './useLeadParams';

export function needsContact(l: LeadView, today: ISODate): boolean {
  return isOpenLead(l.status) && l.next_follow_up_date !== null && l.next_follow_up_date <= today;
}

function matchesStatus(l: LeadView, status: StatusFilter): boolean {
  if (status === 'all') return true;
  if (status === 'open') return isOpenLead(l.status);
  return l.status === status;
}

/** every filter except status (the status chips count over this set) */
export function filterExceptStatus(leads: LeadView[], p: Pick<LeadParams, 'grade' | 'due' | 'q'>, today: ISODate): LeadView[] {
  const needle = normalizeText(p.q);
  return leads.filter(
    (l) =>
      (p.grade === null || l.fit.grade === p.grade) &&
      (!p.due || needsContact(l, today)) &&
      (needle === '' || leadSearchText(l).includes(needle)),
  );
}

export function statusCounts(leads: LeadView[]): Record<StatusFilter, number> {
  const counts = { open: 0, all: leads.length } as Record<StatusFilter, number>;
  for (const s of LEAD_STATUSES) counts[s] = 0;
  for (const l of leads) {
    counts[l.status] += 1;
    if (isOpenLead(l.status)) counts.open += 1;
  }
  return counts;
}

export function filterByStatus(leads: LeadView[], status: StatusFilter): LeadView[] {
  return leads.filter((l) => matchesStatus(l, status));
}

const FAR = '9999-12-31';

export function sortLeads(leads: LeadView[], sort: LeadSort): LeadView[] {
  const byFit = (a: LeadView, b: LeadView) => b.fit.score - a.fit.score;
  const byName = (a: LeadView, b: LeadView) => a.company_name.localeCompare(b.company_name, 'vi');
  const followUp = (l: LeadView) => (isOpenLead(l.status) ? (l.next_follow_up_date ?? FAR) : FAR);
  const list = [...leads];
  if (sort === 'followup') {
    list.sort((a, b) => followUp(a).localeCompare(followUp(b)) || byFit(a, b) || byName(a, b));
  } else if (sort === 'newest') {
    list.sort((a, b) => b.created_at.localeCompare(a.created_at) || byName(a, b));
  } else {
    // closed leads (converted / disqualified) sink below open ones with the same score
    list.sort((a, b) => byFit(a, b) || Number(isOpenLead(b.status)) - Number(isOpenLead(a.status)) || byName(a, b));
  }
  return list;
}

/** status order for the chips */
export const STATUS_CHIPS: StatusFilter[] = ['open', 'new', 'contacted', 'interested', 'nurturing', 'converted', 'disqualified', 'all'];

export function isSelectable(status: LeadStatus): boolean {
  return status !== 'converted';
}
