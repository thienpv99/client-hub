// CRM seed — business groups ("hệ sinh thái"): invented conglomerates whose member companies (existing accounts AND
// leads) are linked on the client map — the cross-sell opportunity inside one group. Membership is stored on
// AccountProfile.ecosystem_id / Lead.ecosystem_id; crm.ts stamps it from ECOSYSTEM_SPECS (null for everyone else).
// Every group has >= 2 customer ACCOUNTS so hubs and links show on the default customers-only map (07/10/2026);
// Vạn Xuân stays standalone: a free-floating bubble.
// Members are split between the two AMs on purpose (AM scoping of the map):
//   · Cỏ Xanh  — Hà: Cỏ Xanh Retail + Hàng tiêu dùng Cỏ Xanh · Đức Anh: Cỏ Xanh Logistics · pool: Phố Xanh
//   · Thịnh An — Hà: the bank + Chứng khoán Thịnh An · pool: Bảo hiểm Nhân Hòa (Đức Anh sees one member → no hub)
//   · Gió Ngàn — Đức Anh: the wind farm + Ngàn Nắng (solar) + Ngàn Phong (EPC)
//   · Sao Bắc  — Hà: the supermarkets + Thực phẩm Sao Bắc + Địa ốc Sao Bắc

import type { ID } from '@/domain/types';
import type { Ecosystem } from '@/domain/crmTypes';
import type { SeedCtx } from './helpers';
import { PROSPECTS } from './crmAccounts';

export interface EcosystemSpec {
  id: ID;
  name: string;
  short_name: string;
  description: string;
  industry: string | null;
  accounts: ID[];
  leads: ID[];
  /** [day offset, hh:mm] created / last edited */
  created: [number, string];
  updated: [number, string];
}

/** new leads that exist only as members of a group (crmLeads.ts) */
export const ECOSYSTEM_LEAD_IDS = {
  coxanhFoods: 'lead_coxanh_foods',
  coxanhLogistics: 'lead_coxanh_logistics',
  thinhanSecurities: 'lead_thinhan_securities',
  ngannang: 'lead_ngannang',
  nganphong: 'lead_nganphong',
  saobacFoods: 'lead_saobac_foods',
  saobacLand: 'lead_saobac_land',
} as const;

const L = ECOSYSTEM_LEAD_IDS;

export const ECOSYSTEM_SPECS: EcosystemSpec[] = [
  {
    id: 'eco_coxanh',
    name: 'Tập đoàn Cỏ Xanh',
    short_name: 'Cỏ Xanh',
    description:
      'Chuỗi siêu thị Cỏ Xanh Retail cùng Mây Trắng Logistics (kho vận của tập đoàn), công ty hàng tiêu dùng, chuỗi cửa hàng tiện lợi Phố Xanh và Cỏ Xanh Logistics. Các công ty dùng chung dữ liệu khách hàng và đơn hàng, nên nền tảng đang triển khai cho Cỏ Xanh Retail mở rộng được cho cả nhóm.',
    industry: 'Bán lẻ',
    accounts: ['acc_coxanh', 'acc_maytrang'],
    leads: [L.coxanhFoods, 'lead_phoxanh', L.coxanhLogistics],
    created: [-40, '09:30'],
    updated: [-10, '10:15'],
  },
  {
    id: 'eco_thinhan',
    name: 'Tập đoàn Tài chính Thịnh An',
    short_name: 'Thịnh An',
    description:
      'Ngân hàng Thịnh An cùng Địa ốc Hải Đăng (mảng bất động sản), công ty chứng khoán và công ty bảo hiểm Nhân Hòa trong cùng tập đoàn. Nền tảng định danh của cổng ngân hàng số dùng chung được cho ứng dụng giao dịch và cổng bồi thường bảo hiểm.',
    industry: 'Tài chính – ngân hàng',
    accounts: ['acc_thinhan', 'acc_haidang'],
    leads: [L.thinhanSecurities, 'lead_nhanhoa'],
    created: [-35, '14:00'],
    updated: [-9, '11:20'],
  },
  {
    id: 'eco_giongan',
    name: 'Tập đoàn Năng lượng Gió Ngàn',
    short_name: 'Gió Ngàn',
    description:
      'Trang trại điện gió Gió Ngàn, nhà máy thiết bị Cơ điện Thiên Trường, công ty điện mặt trời Ngàn Nắng và tổng thầu EPC Ngàn Phong. Hệ thống giám sát sản lượng đang làm cho Gió Ngàn mở rộng được cho các trang trại điện mặt trời, còn đội thi công cần ứng dụng nghiệm thu.',
    industry: 'Năng lượng',
    accounts: ['acc_giongan', 'acc_thientruong'],
    leads: [L.ngannang, L.nganphong],
    created: [-30, '08:45'],
    updated: [-15, '09:00'],
  },
  {
    id: 'eco_saobac',
    name: 'Tập đoàn Sao Bắc',
    short_name: 'Sao Bắc',
    description:
      'Chuỗi Siêu thị Sao Bắc cùng Vận tải Hoàng Vũ (đội xe phân phối), nhà máy Thực phẩm Sao Bắc (hàng nhãn riêng cho chuỗi) và Địa ốc Sao Bắc (3 trung tâm thương mại). Chị Trang là đầu mối chung của tập đoàn.',
    industry: 'Bán lẻ',
    accounts: [PROSPECTS.saobac.account, PROSPECTS.hoangvu.account],
    leads: [L.saobacFoods, L.saobacLand],
    created: [-30, '16:00'],
    updated: [-6, '17:45'],
  },
];

/** accounts the demo keeps outside every group (free-floating on the map) */
export const STANDALONE_ACCOUNT_IDS: ID[] = [PROSPECTS.vanxuan.account];

const accountEco = new Map<ID, ID>();
const leadEco = new Map<ID, ID>();
for (const s of ECOSYSTEM_SPECS) {
  for (const id of s.accounts) accountEco.set(id, s.id);
  for (const id of s.leads) leadEco.set(id, s.id);
}

export function ecosystemOfAccount(accountId: ID): ID | null {
  return accountEco.get(accountId) ?? null;
}

export function ecosystemOfLead(leadId: ID): ID | null {
  return leadEco.get(leadId) ?? null;
}

export function buildEcosystems(c: SeedCtx): Ecosystem[] {
  return ECOSYSTEM_SPECS.map((s) => ({
    id: s.id,
    name: s.name,
    short_name: s.short_name,
    description: s.description,
    industry: s.industry,
    created_at: c.at(s.created[0], s.created[1]),
    updated_at: c.at(s.updated[0], s.updated[1]),
    deleted_at: null,
  }));
}
