// CRM seed — opportunities (pipeline, 3 won matching the signed contracts, 2 lost) and the shared segments.
// Values of quote-linked deals = the quote's grand total; won deals = the contract value (same as the commercial seed).

import type { Contract, ID, ISODateTime, Quote, QuoteLine } from '@/domain/types';
import type { LeadSource, Opportunity, OpportunityStage, Segment } from '@/domain/crmTypes';
import type { SeedCtx } from './helpers';
import { quoteGrandTotal } from './catalog';
import { AM_DUCANH, AM_HA, DIRECTOR, PROSPECTS } from './crmAccounts';

/** Default probability per stage (ARCHITECTURE §13). */
export const STAGE_PROBABILITY: Record<OpportunityStage, number> = { qualified: 10, discovery: 25, proposal: 50, negotiation: 75, won: 100, lost: 0 };

export interface DealBase {
  quotes: Quote[];
  quote_lines: QuoteLine[];
  contracts: Contract[];
}

type At = [number, string];

interface OppSpec {
  id: ID;
  account: ID;
  name: string;
  owner: ID;
  source: LeadSource;
  stage: OpportunityStage;
  /** explicit value (VND incl. VAT); quote / contract linked deals take theirs */
  value?: number;
  /** probability edited by the AM (else the stage default) */
  probability?: number;
  /** expected close, day offset (won / lost: the closing day) */
  close: number;
  products?: ID[];
  next?: [string, number];
  quote?: ID;
  /** won deals: the signed contract (value + project) */
  contract?: ID;
  project?: ID;
  lostReason?: string;
  created: At;
  /** last stage change (won / lost: the closing instant) */
  stageAt: At;
}

const SPECS: OppSpec[] = [
  // ── open pipeline on existing customers
  { id: 'opp_thinhan_p2', account: 'acc_thinhan', name: 'Giai đoạn 2 – Phân hệ tín dụng doanh nghiệp', owner: AM_HA, source: 'existing_customer', stage: 'negotiation', close: 20, quote: 'q_thinhan_p2_v2', next: ['Gửi báo giá bản 2 cho anh Long ngay khi Giám đốc duyệt chiết khấu', 0], created: [-30, '09:00'], stageAt: [-10, '16:30'] },
  { id: 'opp_coxanh_ext', account: 'acc_coxanh', name: 'Phụ lục mở rộng 20 người dùng', owner: AM_HA, source: 'existing_customer', stage: 'proposal', close: 14, quote: 'q_coxanh_ext_v1', next: ['Hỏi anh Minh ý kiến về phụ lục mở rộng', 3], created: [-13, '16:00'], stageAt: [-3, '11:00'] },
  { id: 'opp_maytrang_infra', account: 'acc_maytrang', name: 'Nâng cấp hạ tầng và hỗ trợ 24/7 mùa cao điểm', owner: AM_DUCANH, source: 'existing_customer', stage: 'discovery', value: 620_000_000, close: 35, products: ['pi_cld_mth', 'pi_sup_247'], next: ['Gửi đề xuất cấu hình hạ tầng mùa cao điểm cho chị Hạnh', 2], created: [-10, '16:30'], stageAt: [-10, '16:30'] },
  { id: 'opp_haidang_app', account: 'acc_haidang', name: 'Ứng dụng di động cho khách mua căn hộ', owner: AM_HA, source: 'existing_customer', stage: 'qualified', value: 1_250_000_000, close: 120, products: ['pi_svc_ux', 'pi_svc_dev', 'pi_svc_qa'], next: ['Khảo sát nhu cầu app khách hàng sau mốc Thiết kế', 9], created: [-14, '09:00'], stageAt: [-14, '09:00'] },
  { id: 'opp_haidang_training', account: 'acc_haidang', name: 'Gói đào tạo bổ sung cho sàn giao dịch', owner: AM_HA, source: 'existing_customer', stage: 'proposal', close: 10, quote: 'q_haidang_training_v1', next: ['Chốt lịch đào tạo theo ca với anh Khang', 1], created: [-5, '09:00'], stageAt: [-2, '10:00'] },
  { id: 'opp_thientruong_support', account: 'acc_thientruong', name: 'Gói hỗ trợ vận hành sau go-live 12 tháng', owner: AM_DUCANH, source: 'existing_customer', stage: 'proposal', probability: 70, close: -5, quote: 'q_thientruong_support_v1', next: ['Gửi báo giá hỗ trợ sau go-live khi thu xong đợt 2', -3], created: [-20, '10:00'], stageAt: [-4, '15:00'] },

  // ── prospects (converted leads)
  { id: PROSPECTS.saobac.opportunity, account: PROSPECTS.saobac.account, name: 'Nền tảng bán hàng đa kênh cho 40 siêu thị', owner: AM_HA, source: 'event', stage: 'negotiation', probability: 60, value: 2_400_000_000, close: -2, products: ['pi_lic_ent', 'pi_svc_ba', 'pi_svc_dev', 'pi_cld_mth', 'pi_trn_pkg'], next: ['Gửi phương án thanh toán 4 đợt cho chị Trang', -1], created: [PROSPECTS.saobac.converted, PROSPECTS.saobac.time], stageAt: [-8, '17:00'] },
  { id: PROSPECTS.hoangvu.opportunity, account: PROSPECTS.hoangvu.account, name: 'Điều phối xe và ứng dụng tài xế', owner: AM_DUCANH, source: 'outbound', stage: 'discovery', value: 1_350_000_000, close: 75, products: ['pi_svc_ba', 'pi_svc_dev', 'pi_lic_usr', 'pi_cld_mth'], next: ['Khảo sát bãi xe Bình Dương cùng chị Hân', 4], created: [PROSPECTS.hoangvu.converted, PROSPECTS.hoangvu.time], stageAt: [-15, '17:00'] },
  { id: PROSPECTS.vanxuan.opportunity, account: PROSPECTS.vanxuan.account, name: 'Quản lý chuỗi nhà thuốc và kho dược', owner: AM_HA, source: 'website', stage: 'qualified', value: 1_800_000_000, close: 150, products: ['pi_svc_ba', 'pi_lic_usr', 'pi_mig_pkg'], next: ['Gửi tài liệu giới thiệu và hẹn buổi khảo sát', 1], created: [PROSPECTS.vanxuan.converted, PROSPECTS.vanxuan.time], stageAt: [PROSPECTS.vanxuan.converted, PROSPECTS.vanxuan.time] },

  // ── won this year — match the signed contracts (deals1.ts / deals2.ts). A first deal predates its Client Hub
  //    account record (Cỏ Xanh / Thịnh An were set up when the quote was prepared), giving a 1.5–2.5-month cycle.
  { id: 'opp_coxanh_app', account: 'acc_coxanh', name: 'Triển khai App bán hàng đa kênh', owner: AM_HA, source: 'referral', stage: 'won', close: -70, quote: 'q_coxanh_main_v1', contract: 'c_coxanh_app', project: 'prj_coxanh_app', created: [-130, '10:00'], stageAt: [-70, '16:00'] },
  { id: 'opp_thinhan_p1', account: 'acc_thinhan', name: 'Giai đoạn 1 – Cổng ngân hàng số doanh nghiệp', owner: AM_HA, source: 'event', stage: 'won', close: -50, quote: 'q_thinhan_p1_v1', contract: 'c_thinhan_cb', project: 'prj_thinhan_corp', created: [-120, '10:00'], stageAt: [-50, '16:00'] },
  { id: 'opp_maytrang_ops', account: 'acc_maytrang', name: 'Hỗ trợ vận hành và mở rộng TMS', owner: AM_DUCANH, source: 'existing_customer', stage: 'won', close: -104, quote: 'q_maytrang_ops_v1', contract: 'c_maytrang_ops', project: 'prj_maytrang_ops', created: [-150, '10:00'], stageAt: [-104, '16:00'] },

  // ── lost
  { id: 'opp_maytrang_wh', account: 'acc_maytrang', name: 'Phân hệ quản lý kho', owner: AM_DUCANH, source: 'existing_customer', stage: 'lost', close: -40, quote: 'q_maytrang_wh_v1', lostReason: 'Khách hoãn đầu tư phân hệ kho sang năm sau để tập trung cho mùa cao điểm.', created: [-76, '10:00'], stageAt: [-40, '10:00'] },
  { id: 'opp_giongan_mobile', account: 'acc_giongan', name: 'Ứng dụng cho kỹ sư hiện trường', owner: AM_DUCANH, source: 'existing_customer', stage: 'lost', value: 780_000_000, close: -20, products: ['pi_svc_dev', 'pi_svc_ux', 'pi_lic_usr'], lostReason: 'Khách chọn ứng dụng có sẵn của hãng tua-bin vì chi phí thấp hơn và đã kèm bảo hành.', created: [-60, '10:00'], stageAt: [-20, '10:00'] },
];

/** Opportunities with updated_at = max(created, stage change); crm.ts bumps it with the latest linked interaction. */
export function buildOpportunities(c: SeedCtx, base: DealBase): Opportunity[] {
  const quoteTotal = (id: ID): number => {
    const q = base.quotes.find((x) => x.id === id);
    if (!q) throw new Error(`[seed/crm] quote ${id} not found`);
    return quoteGrandTotal(
      base.quote_lines.filter((l) => l.quote_id === id),
      q.discount_pct_total,
    );
  };
  const quoteProducts = (id: ID): ID[] => [...new Set(base.quote_lines.filter((l) => l.quote_id === id).map((l) => l.price_item_id))];
  const contractValue = (id: ID): number => {
    const k = base.contracts.find((x) => x.id === id);
    if (!k) throw new Error(`[seed/crm] contract ${id} not found`);
    return k.value;
  };

  return SPECS.map((s) => {
    const created_at: ISODateTime = c.at(s.created[0], s.created[1]);
    const stage_changed_at: ISODateTime = c.at(s.stageAt[0], s.stageAt[1]);
    const value = s.contract ? contractValue(s.contract) : s.quote && s.value === undefined ? quoteTotal(s.quote) : s.value ?? 0;
    const open = s.stage !== 'won' && s.stage !== 'lost';
    return {
      id: s.id,
      account_id: s.account,
      name: s.name,
      value,
      probability: s.probability ?? STAGE_PROBABILITY[s.stage],
      stage: s.stage,
      expected_close_date: c.d(s.close),
      owner_id: s.owner,
      source: s.source,
      price_item_ids: s.products ?? (s.quote ? quoteProducts(s.quote) : []),
      next_step: open && s.next ? s.next[0] : null,
      next_step_date: open && s.next ? c.d(s.next[1]) : null,
      quote_id: s.quote ?? null,
      project_id: s.project ?? null,
      lost_reason: s.stage === 'lost' ? s.lostReason ?? null : null,
      won_at: s.stage === 'won' ? stage_changed_at : null,
      lost_at: s.stage === 'lost' ? stage_changed_at : null,
      stage_changed_at,
      created_at,
      updated_at: stage_changed_at > created_at ? stage_changed_at : created_at,
      deleted_at: null,
    };
  });
}

export function buildSegments(c: SeedCtx): Segment[] {
  const seg = (id: ID, name: string, description: string, criteria: Segment['criteria'], owner: ID, created: At, updated: At): Segment => ({
    id,
    name,
    description,
    criteria,
    owner_id: owner,
    shared: true,
    created_at: c.at(created[0], created[1]),
    updated_at: c.at(updated[0], updated[1]),
    deleted_at: null,
  });
  return [
    seg(
      'seg_retail_south',
      'Bán lẻ & phân phối phía Nam quy mô lớn',
      'Chuỗi bán lẻ và nhà phân phối từ 200 nhân viên ở TP. Hồ Chí Minh, Bình Dương, Đồng Nai và Cần Thơ.',
      { scope: 'all', industries: ['Bán lẻ', 'Phân phối'], provinces: ['TP. Hồ Chí Minh', 'Bình Dương', 'Đồng Nai', 'Cần Thơ'], sizes: ['200_1000', 'gt1000'] },
      AM_DUCANH,
      [-20, '10:00'],
      [-20, '10:00'],
    ),
    seg(
      'seg_banking',
      'Ngân hàng – tài chính',
      'Ngân hàng và công ty bảo hiểm: nhóm có ngân sách chuyển đổi số lớn, chu kỳ bán dài.',
      { scope: 'all', industries: ['Ngân hàng', 'Bảo hiểm'] },
      AM_HA,
      [-35, '14:00'],
      [-12, '11:30'],
    ),
    seg(
      'seg_upsell',
      'Khách hiện hữu có thể bán thêm',
      'Khách đang triển khai hoặc vận hành không bị chặn, có nhu cầu mua thêm.',
      { scope: 'accounts', health: ['on_track', 'attention'], tags: ['Upsell'] },
      DIRECTOR,
      [-15, '08:30'],
      [-15, '08:30'],
    ),
    seg(
      'seg_manufacturing_north',
      'Sản xuất miền Bắc doanh thu > 200 tỷ',
      'Nhà máy ở Hà Nội, Hải Phòng và Bắc Ninh có doanh thu năm trên 200 tỷ.',
      { scope: 'all', industries: ['Sản xuất'], provinces: ['Hà Nội', 'Hải Phòng', 'Bắc Ninh'], revenue_bands: ['200b_1t', 'gt1t'] },
      DIRECTOR,
      [-28, '09:00'],
      [-28, '09:00'],
    ),
  ];
}
