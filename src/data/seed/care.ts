// Care seed (SPEC-CARE §7) entry point: deployments, expansion maps, stakeholders, relation links, change requests,
// care plans, plus the extra contacts, activity lines and bell items they bring. Deterministic and relative to today.
// Care plans: cadence by tier (strategic 14 · key 21 · standard 30 days); two accounts are overdue for care through a
// next action whose date has passed (Thiên Trường, Hải Đăng), Sao Bắc is due soon (negotiation cadence of 10 days).

import type { Activity, AppNotification, Contact, Contract, ID } from '@/domain/types';
import type { AccountDepartment, CarePlan, ChangeRequest, Deployment, RelationLink, Stakeholder } from '@/domain/careTypes';
import type { SeedCtx } from './helpers';
import { buildCareContacts } from './careContacts';
import { buildAccountDepartments, buildDeployments } from './careDeployments';
import { buildRelationLinks, buildStakeholders } from './carePeople';
import { buildChangeRequests, buildRequestActivities, buildRequestNotifications } from './careRequests';

export interface CareSeed {
  /** append to contacts */
  contacts: Contact[];
  /** append to activities (client-facing change-request lines) */
  activities: Activity[];
  /** append to notifications */
  notifications: AppNotification[];
  deployments: Deployment[];
  account_departments: AccountDepartment[];
  stakeholders: Stakeholder[];
  relation_links: RelationLink[];
  change_requests: ChangeRequest[];
  care_plans: CarePlan[];
}

/** [account, cadence days, next action, due offset, owner, updated offset] */
type PlanTuple = [ID, number, string, number, ID, number];

const PLANS: PlanTuple[] = [
  ['acc_coxanh', 14, 'Anh Nam gọi anh Minh: chốt ngày duyệt màn hình Đặt hàng và lịch xử lý 3 yêu cầu đang nợ', 2, 'u_director', -2],
  ['acc_thinhan', 14, 'Tiếp nhận 2 yêu cầu chị Mai và anh Long gửi từ tuần trước, báo lại hướng xử lý', 1, 'u_am_ha', -3],
  ['acc_thientruong', 21, 'Gặp anh Hùng: chốt lịch thanh toán đợt 2 và kế hoạch kết nối máy CNC', -3, 'u_am_ducanh', -12],
  ['acc_giongan', 21, 'Gửi chị Phương báo cáo tiến độ tích hợp SCADA cuối tuần', 3, 'u_am_ducanh', -1],
  ['acc_haidang', 30, 'Gặp chị Vy lần đầu, hướng dẫn duyệt việc trên Client Hub', -2, 'u_am_ha', -9],
  ['acc_maytrang', 30, 'Demo bảng điều hành chi phí – sản lượng cho anh Bình', 7, 'u_am_ducanh', -5],
  ['acc_saobac', 10, 'Gửi chị Trang phương án thanh toán 4 đợt', 2, 'u_am_ha', -8],
  ['acc_hoangvu', 30, 'Chốt ngày khảo sát bãi xe với anh Lộc', 4, 'u_am_ducanh', -6],
  ['acc_vanxuan', 21, 'Gửi tài liệu giới thiệu và đề xuất lịch khảo sát 5 nhà thuốc', 2, 'u_am_ha', -3],
];

export function buildCarePlans(c: SeedCtx): CarePlan[] {
  return PLANS.map(([account, cadence, action, due, owner, updated]) => ({
    id: `care_${account}`,
    account_id: account,
    cadence_days: cadence,
    next_action: action,
    next_action_due: c.d(due),
    next_action_owner_id: owner,
    updated_at: c.at(updated, '17:30'),
  }));
}

export function buildCare(c: SeedCtx, base: { contracts: Contract[] }): CareSeed {
  const change_requests = buildChangeRequests(c);
  return {
    contacts: buildCareContacts(c),
    activities: buildRequestActivities(c, change_requests),
    notifications: buildRequestNotifications(c),
    deployments: buildDeployments(c, base.contracts),
    account_departments: buildAccountDepartments(c),
    stakeholders: buildStakeholders(c),
    relation_links: buildRelationLinks(c),
    change_requests,
    care_plans: buildCarePlans(c),
  };
}
