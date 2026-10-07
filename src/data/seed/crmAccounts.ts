// CRM seed — prospect accounts (converted leads, no login users / projects / tasks → always on track),
// targeting profiles for EVERY account (1:1, id 'prof_<accountId>') and the default ICP.

import type { Account, Contact, ID } from '@/domain/types';
import type { AccountProfile, CompanySize, IcpProfile, LeadSource, RevenueBand } from '@/domain/crmTypes';
import type { SeedCtx } from './helpers';
import { makeAccount, makeContact } from './helpers';

export const AM_HA = 'u_am_ha';
export const AM_DUCANH = 'u_am_ducanh';
export const DIRECTOR = 'u_director';

/** The six original demo accounts (their scenarios must never change). */
export const ORIGINAL_ACCOUNT_IDS: ID[] = ['acc_coxanh', 'acc_thinhan', 'acc_thientruong', 'acc_giongan', 'acc_haidang', 'acc_maytrang'];

/** Prospects created by converting a lead: [account id, lead id, opportunity id, conversion day offset, hh:mm]. */
export const PROSPECTS = {
  saobac: { account: 'acc_saobac', lead: 'lead_saobac', opportunity: 'opp_saobac_omni', converted: -45, time: '10:00' },
  hoangvu: { account: 'acc_hoangvu', lead: 'lead_hoangvu', opportunity: 'opp_hoangvu_dispatch', converted: -24, time: '15:00' },
  vanxuan: { account: 'acc_vanxuan', lead: 'lead_vanxuan', opportunity: 'opp_vanxuan_chain', converted: -4, time: '10:00' },
} as const;

export const PROSPECT_ACCOUNT_IDS: ID[] = Object.values(PROSPECTS).map((p) => p.account);

export function buildProspectAccounts(c: SeedCtx): Account[] {
  const P = PROSPECTS;
  return [
    makeAccount({
      id: P.saobac.account,
      name: 'Siêu thị Sao Bắc',
      short_name: 'Sao Bắc',
      brand_color: '#B45309',
      industry: 'Bán lẻ',
      tier: 'key',
      stage: 'negotiating',
      am_id: AM_HA,
      email_domain: 'saobac.vn',
      exec_summary: [
        'New Era đã khảo sát quy trình bán hàng tại 3 siêu thị mẫu của Sao Bắc.',
        'Đề xuất nền tảng bán hàng đa kênh cho 40 siêu thị đang ở bước đàm phán điều khoản.',
        'Bước tiếp theo: chốt điều khoản thanh toán và lịch triển khai.',
      ],
      exec_summary_updated_at: c.at(-8, '17:00'),
      internal_notes: 'Chị Trang quyết nhanh nhưng rất kỹ về điều khoản thanh toán. Một đối thủ đang chào giá thấp hơn, cần nhấn mạnh kinh nghiệm triển khai bán lẻ.',
      created_at: c.at(P.saobac.converted, P.saobac.time),
      updated_at: c.at(-8, '17:00'),
    }),
    makeAccount({
      id: P.hoangvu.account,
      name: 'Vận tải Hoàng Vũ',
      short_name: 'Hoàng Vũ',
      brand_color: '#0F766E',
      industry: 'Logistics',
      tier: 'standard',
      stage: 'prospecting',
      am_id: AM_DUCANH,
      email_domain: 'hoangvulogistics.vn',
      exec_summary: [
        'Hoàng Vũ vận hành khoảng 300 xe tải tại Bình Dương và Đồng Nai.',
        'New Era đang khảo sát nhu cầu điều phối xe và ứng dụng cho tài xế.',
        'Lịch khảo sát bãi xe đã gửi, chờ anh Lộc xác nhận.',
      ],
      exec_summary_updated_at: c.at(-15, '17:00'),
      internal_notes: 'Anh Lộc từng dùng thử một phần mềm điều phối nhưng bỏ vì tài xế không quen. Cần demo ứng dụng tài xế thật đơn giản.',
      created_at: c.at(P.hoangvu.converted, P.hoangvu.time),
      updated_at: c.at(-15, '17:00'),
    }),
    makeAccount({
      id: P.vanxuan.account,
      name: 'Dược phẩm Vạn Xuân',
      short_name: 'Vạn Xuân',
      brand_color: '#BE123C',
      industry: 'Dược phẩm',
      tier: 'key',
      stage: 'prospecting',
      am_id: AM_HA,
      email_domain: 'vanxuanpharma.vn',
      exec_summary: [
        'Vạn Xuân có 65 nhà thuốc và 2 kho dược tại TP. Hồ Chí Minh.',
        'Nhu cầu: quản lý tồn kho theo lô, hạn dùng và đơn thuốc tập trung.',
        'New Era sẽ gửi tài liệu giới thiệu và hẹn buổi khảo sát đầu tiên.',
      ],
      exec_summary_updated_at: c.at(P.vanxuan.converted, P.vanxuan.time),
      internal_notes: 'Khách tự tìm đến qua website. Chị Ngọc muốn chạy thử ở 5 nhà thuốc trước khi mở rộng.',
      created_at: c.at(P.vanxuan.converted, P.vanxuan.time),
      updated_at: c.at(P.vanxuan.converted, P.vanxuan.time),
    }),
  ];
}

/** Contacts of the prospects (no login users). last_interaction_* are filled from interactions by crm.ts. */
export function buildProspectContacts(): Contact[] {
  return [
    makeContact({ id: 'ct_saobac_trang', account_id: PROSPECTS.saobac.account, full_name: 'Đặng Thu Trang', salutation: 'chị', title: 'Tổng giám đốc', decision_role: 'decision_maker', email: 'trang.dang@saobac.vn', phone: '0904 216 738' }),
    makeContact({ id: 'ct_saobac_huy', account_id: PROSPECTS.saobac.account, full_name: 'Lại Quốc Huy', salutation: 'anh', title: 'Giám đốc Công nghệ thông tin', decision_role: 'approver', email: 'huy.lai@saobac.vn', phone: '0983 551 204' }),
    makeContact({ id: 'ct_hoangvu_loc', account_id: PROSPECTS.hoangvu.account, full_name: 'Trịnh Văn Lộc', salutation: 'anh', title: 'Giám đốc điều hành', decision_role: 'decision_maker', email: 'loc.trinh@hoangvulogistics.vn', phone: '0918 403 627' }),
    makeContact({ id: 'ct_hoangvu_han', account_id: PROSPECTS.hoangvu.account, full_name: 'Vương Ngọc Hân', salutation: 'chị', title: 'Trưởng phòng Điều phối', decision_role: 'ops_contact', email: 'han.vuong@hoangvulogistics.vn', phone: '0937 260 814' }),
    makeContact({ id: 'ct_vanxuan_ngoc', account_id: PROSPECTS.vanxuan.account, full_name: 'Lư Bảo Ngọc', salutation: 'chị', title: 'Tổng giám đốc', decision_role: 'decision_maker', email: 'ngoc.lu@vanxuanpharma.vn', phone: '0909 712 485' }),
  ];
}

/** [account id, province, size, revenue band, website, source, tags] */
type ProfileTuple = [ID, string, CompanySize, RevenueBand, string | null, LeadSource, string[]];

export function buildAccountProfiles(): AccountProfile[] {
  const rows: ProfileTuple[] = [
    ['acc_coxanh', 'TP. Hồ Chí Minh', '200_1000', '200b_1t', 'coxanh.vn', 'referral', ['Omnichannel', 'Mobile app', 'Upsell']],
    ['acc_thinhan', 'Hà Nội', 'gt1000', 'gt1t', 'thinhanbank.vn', 'event', ['Chuyển đổi số', 'Data', 'Upsell']],
    ['acc_thientruong', 'Bắc Ninh', '200_1000', '200b_1t', 'thientruong.com.vn', 'outbound', ['ERP', 'IoT', 'Upsell']],
    ['acc_giongan', 'Ninh Thuận', '200_1000', '200b_1t', 'giongan.vn', 'partner', ['Data', 'IoT']],
    ['acc_haidang', 'Đà Nẵng', '200_1000', '200b_1t', 'haidangland.vn', 'website', ['CRM', 'Mobile app']],
    ['acc_maytrang', 'TP. Hồ Chí Minh', '200_1000', '200b_1t', 'maytrang.vn', 'referral', ['Data', 'Mobile app', 'Upsell']],
    ['acc_saobac', 'Hà Nội', 'gt1000', 'gt1t', 'saobac.vn', 'event', ['Omnichannel', 'ERP']],
    ['acc_hoangvu', 'Bình Dương', '200_1000', '200b_1t', 'hoangvulogistics.vn', 'outbound', ['Mobile app', 'Data']],
    ['acc_vanxuan', 'TP. Hồ Chí Minh', '200_1000', '200b_1t', 'vanxuanpharma.vn', 'website', ['ERP', 'Chuyển đổi số']],
  ];
  return rows.map(([account_id, province, size, revenue_band, website, source, tags]) => ({
    id: `prof_${account_id}`,
    account_id,
    province,
    size,
    revenue_band,
    website,
    source,
    tags,
  }));
}

export function buildIcpProfiles(c: SeedCtx): IcpProfile[] {
  return [
    {
      id: 'icp_default',
      name: 'Khách hàng lý tưởng của New Era',
      target_industries: ['Bán lẻ', 'Ngân hàng', 'Sản xuất', 'Logistics'],
      target_provinces: ['Hà Nội', 'TP. Hồ Chí Minh', 'Bình Dương', 'Đà Nẵng'],
      target_sizes: ['200_1000', 'gt1000'],
      target_revenue_bands: ['200b_1t', 'gt1t'],
      weights: { industry: 30, size: 20, revenue: 20, province: 10, engagement: 20 },
      updated_at: c.at(-30, '10:00'),
    },
  ];
}
