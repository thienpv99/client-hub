// Care seed (SPEC-CARE §7) — one stakeholder row per contact (influence, stance, how close New Era is, who holds the
// relationship, reporting line) and the relation links, mostly ACROSS the units of a business group:
//   Cỏ Xanh: anh Bình (Mây Trắng) introduced anh Minh; Mây Trắng reports to Chủ tịch Đạt; chị Hạnh ↔ chị Lan weekly
//   Thịnh An: anh Long introduced chị Vy (Hải Đăng); chị Mai and anh Lực are former colleagues
//   Gió Ngàn: chị Phương works with anh Hùng (Thiên Trường supplies the switchboards); anh Tài ↔ anh Sơn former colleagues
//   Sao Bắc: chị Trang introduced anh Lộc (Hoàng Vũ trucks the goods of the 40 supermarkets)
// At least one champion and one skeptic per active account where it is true to the story.

import type { ID } from '@/domain/types';
import type { DepartmentKey, Influence, RelationKind, RelationLink, Stakeholder, Stance, Strength } from '@/domain/careTypes';
import type { SeedCtx } from './helpers';

const HA = 'u_am_ha';
const DUCANH = 'u_am_ducanh';
const DIRECTOR = 'u_director';
const TUAN = 'u_member_tuan';
const QUANG = 'u_member_quang';

/** [contact id, account id, department, influence, stance, strength, NE owner, reports to, notes, updated offset] */
type StakeTuple = [ID, ID, DepartmentKey | null, Influence, Stance, Strength, ID | null, ID | null, string | null, number];

const ROWS: StakeTuple[] = [
  // ── Cỏ Xanh Retail
  ['ct_coxanh_dat', 'acc_coxanh', 'executive', 'decision_maker', 'supporter', 'cold', DIRECTOR, null, 'Chủ tịch tập đoàn, quyết các khoản đầu tư dùng chung. Anh Nam mới gặp một lần ở buổi khởi động dự án.', -63],
  ['ct_coxanh_minh', 'acc_coxanh', 'executive', 'decision_maker', 'supporter', 'warm', HA, 'ct_coxanh_dat', 'Quyết nhanh nhưng hay bận, phản hồi buổi tối qua Zalo.', -2],
  ['ct_coxanh_lan', 'acc_coxanh', 'operations', 'influencer', 'champion', 'strong', HA, 'ct_coxanh_minh', 'Đầu mối hằng ngày, luôn gửi dữ liệu trước hạn.', -1],
  ['ct_coxanh_khoa', 'acc_coxanh', 'it', 'influencer', 'neutral', 'warm', TUAN, 'ct_coxanh_minh', 'Kỹ tính về bảo mật, cần tài liệu kỹ thuật đầy đủ.', -19],
  ['ct_coxanh_huong', 'acc_coxanh', 'finance', 'gatekeeper', 'neutral', 'cold', HA, 'ct_coxanh_minh', null, -36],
  ['ct_coxanh_vinh', 'acc_coxanh', 'marketing', 'influencer', 'skeptic', 'cold', HA, 'ct_coxanh_minh', 'Muốn giao khách hàng thân thiết cho agency; cần cho anh xem kết quả thật.', -30],
  ['ct_coxanh_nhung', 'acc_coxanh', 'sales', 'user', 'champion', 'strong', HA, 'ct_coxanh_minh', 'Đội bán hàng miền Nam của chị là nơi dùng app nhiều nhất.', -12],
  // ── Ngân hàng Thịnh An
  ['ct_thinhan_long', 'acc_thinhan', 'executive', 'decision_maker', 'supporter', 'warm', DIRECTOR, null, 'Đang so sánh New Era với một nhà cung cấp khác cho giai đoạn 2.', -3],
  ['ct_thinhan_mai', 'acc_thinhan', 'it', 'influencer', 'supporter', 'strong', HA, 'ct_thinhan_long', 'Rất chặt về bảo mật; gửi tài liệu đúng hẹn.', -2],
  ['ct_thinhan_bao', 'acc_thinhan', null, 'gatekeeper', 'neutral', 'cold', HA, 'ct_thinhan_long', 'Rà soát mọi hợp đồng và phụ lục.', -49],
  ['ct_thinhan_phuc', 'acc_thinhan', 'sales', 'influencer', 'champion', 'strong', HA, 'ct_thinhan_long', 'Muốn đưa cổng cho 50 doanh nghiệp đầu tiên càng sớm càng tốt.', -6],
  ['ct_thinhan_van', 'acc_thinhan', 'finance', 'influencer', 'skeptic', 'cold', DIRECTOR, 'ct_thinhan_long', 'Nghi ngại chi phí bản quyền giai đoạn 2; nên để anh Nam gặp trực tiếp.', -40],
  ['ct_thinhan_kien', 'acc_thinhan', 'operations', 'user', 'supporter', 'warm', QUANG, 'ct_thinhan_phuc', null, -15],
  // ── Cơ điện Thiên Trường
  ['ct_thientruong_hung', 'acc_thientruong', 'executive', 'decision_maker', 'supporter', 'warm', DUCANH, null, 'Quan tâm kết nối máy CNC; muốn mở rộng sang nhà máy thứ 2.', -6],
  ['ct_thientruong_thao', 'acc_thientruong', 'finance', 'gatekeeper', 'neutral', 'warm', DUCANH, 'ct_thientruong_hung', 'Đang chờ dòng tiền xuất khẩu để thanh toán đợt 2.', -4],
  ['ct_thientruong_son', 'acc_thientruong', 'production', 'user', 'champion', 'strong', TUAN, 'ct_thientruong_hung', 'Xem bảng sản lượng mỗi sáng, góp ý rất cụ thể.', -1],
  ['ct_thientruong_lam', 'acc_thientruong', 'supply_chain', 'user', 'supporter', 'warm', QUANG, 'ct_thientruong_hung', null, -8],
  ['ct_thientruong_nga', 'acc_thientruong', 'hr', 'user', 'neutral', 'cold', DUCANH, 'ct_thientruong_hung', null, -50],
  ['ct_thientruong_hieu', 'acc_thientruong', 'sales', 'influencer', 'neutral', 'cold', null, 'ct_thientruong_hung', 'Chưa gặp; đại lý của anh đặt hàng qua Zalo.', -90],
  // ── Năng lượng Gió Ngàn
  ['ct_giongan_phuong', 'acc_giongan', 'executive', 'decision_maker', 'supporter', 'strong', DUCANH, null, 'Đánh giá cao việc báo trễ sớm và minh bạch.', -1],
  ['ct_giongan_tai', 'acc_giongan', 'operations', 'influencer', 'champion', 'strong', TUAN, 'ct_giongan_phuong', 'Người dùng chính của bảng điều khiển vận hành.', -2],
  ['ct_giongan_dinh', 'acc_giongan', 'operations', 'user', 'supporter', 'warm', TUAN, 'ct_giongan_tai', null, -30],
  ['ct_giongan_thuan', 'acc_giongan', 'finance', 'gatekeeper', 'skeptic', 'cold', DUCANH, 'ct_giongan_phuong', 'Ưu tiên chi phí thấp; từng chọn ứng dụng của hãng tua-bin thay vì New Era.', -27],
  ['ct_giongan_my', 'acc_giongan', 'supply_chain', 'user', 'supporter', 'warm', DUCANH, 'ct_giongan_phuong', null, -20],
  // ── Địa ốc Hải Đăng
  ['ct_haidang_vy', 'acc_haidang', 'executive', 'decision_maker', 'neutral', 'cold', HA, null, 'Chưa đăng nhập Client Hub lần nào; quyết định cuối cùng ở chị.', -4],
  ['ct_haidang_khang', 'acc_haidang', 'sales', 'influencer', 'champion', 'strong', HA, 'ct_haidang_vy', 'Đầu mối hằng ngày, kéo cả 2 sàn tham gia khảo sát.', -1],
  ['ct_haidang_chau', 'acc_haidang', 'marketing', 'user', 'supporter', 'warm', QUANG, 'ct_haidang_khang', null, -25],
  ['ct_haidang_luc', 'acc_haidang', 'it', 'gatekeeper', 'supporter', 'warm', TUAN, 'ct_haidang_vy', null, -18],
  ['ct_haidang_thu', 'acc_haidang', 'customer_service', 'influencer', 'champion', 'warm', HA, 'ct_haidang_vy', 'Người đề xuất app cho khách mua căn hộ.', -14],
  // ── Mây Trắng Logistics
  ['ct_maytrang_binh', 'acc_maytrang', 'executive', 'decision_maker', 'champion', 'strong', DUCANH, null, 'Hài lòng với TMS, đã giới thiệu New Era cho Cỏ Xanh và đối tác.', -10],
  ['ct_maytrang_hanh', 'acc_maytrang', 'operations', 'influencer', 'champion', 'strong', DUCANH, 'ct_maytrang_binh', null, -2],
  ['ct_maytrang_ngan', 'acc_maytrang', 'finance', 'gatekeeper', 'supporter', 'warm', DUCANH, 'ct_maytrang_binh', 'Thanh toán luôn đúng hạn.', -3],
  ['ct_maytrang_quoc', 'acc_maytrang', 'it', 'influencer', 'supporter', 'strong', TUAN, 'ct_maytrang_binh', null, -4],
  ['ct_maytrang_dung', 'acc_maytrang', 'customer_service', 'user', 'supporter', 'warm', DUCANH, 'ct_maytrang_hanh', null, -9],
  ['ct_maytrang_triet', 'acc_maytrang', 'hr', 'user', 'neutral', 'cold', null, 'ct_maytrang_binh', null, -60],
  // ── prospects
  ['ct_saobac_trang', 'acc_saobac', 'executive', 'decision_maker', 'supporter', 'warm', DIRECTOR, null, 'Quyết nhanh nhưng rất kỹ điều khoản thanh toán; đầu mối chung của Tập đoàn Sao Bắc.', -8],
  ['ct_saobac_huy', 'acc_saobac', 'it', 'influencer', 'skeptic', 'cold', HA, 'ct_saobac_trang', 'Lo việc kết nối với phần mềm kế toán hiện tại.', -25],
  ['ct_hoangvu_loc', 'acc_hoangvu', 'executive', 'decision_maker', 'neutral', 'warm', DUCANH, null, 'Từng bỏ một phần mềm điều phối vì tài xế không quen.', -15],
  ['ct_hoangvu_han', 'acc_hoangvu', 'operations', 'user', 'supporter', 'warm', DUCANH, 'ct_hoangvu_loc', null, -6],
  ['ct_vanxuan_ngoc', 'acc_vanxuan', 'executive', 'decision_maker', 'supporter', 'warm', HA, null, 'Muốn chạy thử ở 5 nhà thuốc trước khi mở rộng.', -3],
];

export function buildStakeholders(c: SeedCtx): Stakeholder[] {
  return ROWS.map(([contact, account, department, influence, stance, strength, owner, reportsTo, notes, updated]) => ({
    id: `stk_${contact}`,
    contact_id: contact,
    account_id: account,
    department,
    influence,
    stance,
    strength,
    ne_owner_id: owner,
    reports_to_contact_id: reportsTo,
    notes,
    updated_at: c.at(updated, '18:00'),
  }));
}

/** [id, from contact, to contact, kind, note, created offset] — "from <kind> to" */
type RelationTuple = [ID, ID, ID, RelationKind, string, number];

const LINKS: RelationTuple[] = [
  ['rel_cx_intro', 'ct_maytrang_binh', 'ct_coxanh_minh', 'introduced', 'Anh Bình giới thiệu New Era cho anh Minh sau khi TMS của Mây Trắng chạy ổn định.', -95],
  ['rel_cx_board', 'ct_maytrang_binh', 'ct_coxanh_dat', 'reports_to', 'Mây Trắng là công ty kho vận của tập đoàn; anh Bình báo cáo trực tiếp Chủ tịch Đạt.', -95],
  ['rel_cx_ops', 'ct_maytrang_hanh', 'ct_coxanh_lan', 'works_with', 'Giao ban kho vận hằng tuần — đầu mối nối App bán hàng của Cỏ Xanh với TMS.', -52],
  ['rel_ta_intro', 'ct_thinhan_long', 'ct_haidang_vy', 'introduced', 'Anh Long giới thiệu New Era cho chị Vy khi Hải Đăng cần CRM bán hàng dự án.', -68],
  ['rel_ta_it', 'ct_thinhan_mai', 'ct_haidang_luc', 'former_colleague', 'Từng cùng làm ở khối CNTT của Ngân hàng Thịnh An trước khi anh Lực sang Hải Đăng.', -40],
  ['rel_gn_supply', 'ct_giongan_phuong', 'ct_thientruong_hung', 'works_with', 'Thiên Trường cung cấp tủ điện cho trang trại; hai bên họp kỹ thuật hằng quý.', -150],
  ['rel_gn_eng', 'ct_giongan_tai', 'ct_thientruong_son', 'former_colleague', 'Cùng làm kỹ sư bảo trì ở nhà máy cũ, vẫn hay trao đổi kỹ thuật.', -120],
  ['rel_sb_intro', 'ct_saobac_trang', 'ct_hoangvu_loc', 'introduced', 'Chị Trang giới thiệu New Era cho anh Lộc — Hoàng Vũ chở hàng cho 40 siêu thị Sao Bắc.', -40],
];

export function buildRelationLinks(c: SeedCtx): RelationLink[] {
  return LINKS.map(([id, from, to, kind, note, created]) => ({ id, from_contact_id: from, to_contact_id: to, kind, note, created_at: c.at(created, '11:00') }));
}
