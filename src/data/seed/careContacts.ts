// Care seed (SPEC-CARE §7) — extra client contacts of the six active accounts (no Client Hub login), so each
// relationship map has the people a director expects: the group chairman, the CFO, the IT head, the heads of the
// departments New Era could expand into. Phone format '0xxx xxx xxx', emails on the account's domain.

import type { Contact } from '@/domain/types';
import type { SeedCtx } from './helpers';
import { makeContact } from './helpers';

export function buildCareContacts(c: SeedCtx): Contact[] {
  return [
    // ── Cỏ Xanh Retail
    makeContact({ id: 'ct_coxanh_dat', account_id: 'acc_coxanh', full_name: 'Hồ Quang Đạt', salutation: 'anh', title: 'Chủ tịch Hội đồng quản trị', decision_role: 'approver', email: 'dat.ho@coxanh.vn', phone: '0903 880 112', last_interaction_at: c.at(-63, '15:30'), last_interaction_note: 'Dự buổi khởi động dự án, nhắc mục tiêu dùng chung dữ liệu khách hàng cho cả tập đoàn.' }),
    makeContact({ id: 'ct_coxanh_vinh', account_id: 'acc_coxanh', full_name: 'Đoàn Thế Vinh', salutation: 'anh', title: 'Giám đốc Marketing', decision_role: 'ops_contact', email: 'vinh.doan@coxanh.vn', phone: '0906 241 557', last_interaction_at: c.at(-30, '10:30'), last_interaction_note: 'Muốn giao phần khách hàng thân thiết cho agency quen; chưa tin app tự làm được.' }),
    makeContact({ id: 'ct_coxanh_nhung', account_id: 'acc_coxanh', full_name: 'Lê Hồng Nhung', salutation: 'chị', title: 'Trưởng phòng Kinh doanh miền Nam', decision_role: 'ops_contact', email: 'nhung.le@coxanh.vn', phone: '0938 552 019', last_interaction_at: c.at(-12, '15:00'), last_interaction_note: 'Cùng anh Minh chia sẻ kế hoạch thêm 20 nhân viên bán hàng miền Nam; chị muốn dùng app ngay khi đưa vào dùng chính thức.' }),
    // ── Ngân hàng Thịnh An
    makeContact({ id: 'ct_thinhan_phuc', account_id: 'acc_thinhan', full_name: 'Nguyễn Hữu Phúc', salutation: 'anh', title: 'Giám đốc khối Khách hàng doanh nghiệp', decision_role: 'approver', email: 'phuc.nguyen@thinhanbank.vn', phone: '0904 377 925', last_interaction_at: c.at(-6, '14:00'), last_interaction_note: 'Hỏi tiến độ phân quyền theo hạn mức; muốn mời 50 doanh nghiệp đầu tiên dùng thử cổng.' }),
    makeContact({ id: 'ct_thinhan_van', account_id: 'acc_thinhan', full_name: 'Tô Thanh Vân', salutation: 'chị', title: 'Giám đốc Tài chính', decision_role: 'approver', email: 'van.to@thinhanbank.vn', phone: '0912 664 038', last_interaction_at: c.at(-40, '09:30'), last_interaction_note: 'Hỏi chi phí bản quyền giai đoạn 2, muốn so sánh với nhà cung cấp khác.' }),
    makeContact({ id: 'ct_thinhan_kien', account_id: 'acc_thinhan', full_name: 'Cao Minh Kiên', salutation: 'anh', title: 'Trưởng phòng Vận hành thanh toán', decision_role: 'ops_contact', email: 'kien.cao@thinhanbank.vn', phone: '0983 507 216', last_interaction_at: c.at(-15, '10:00'), last_interaction_note: 'Cùng khảo sát quy trình đối soát giao dịch cuối ngày.' }),
    // ── Cơ điện Thiên Trường
    makeContact({ id: 'ct_thientruong_lam', account_id: 'acc_thientruong', full_name: 'Phùng Đức Lâm', salutation: 'anh', title: 'Trưởng phòng Kế hoạch – Vật tư', decision_role: 'ops_contact', email: 'lam.phung@thientruong.com.vn', phone: '0936 118 470', last_interaction_at: c.at(-8, '09:00'), last_interaction_note: 'Rất mong phân hệ xuất kho nguyên vật liệu, đang giục các xưởng gửi định mức.' }),
    makeContact({ id: 'ct_thientruong_nga', account_id: 'acc_thientruong', full_name: 'Trần Thị Nga', salutation: 'chị', title: 'Trưởng phòng Nhân sự', decision_role: 'ops_contact', email: 'nga.tran@thientruong.com.vn', phone: '0915 302 688', last_interaction_at: c.at(-50, '14:30'), last_interaction_note: 'Hỏi về chấm công công nhân theo ca và tính lương khoán.' }),
    makeContact({ id: 'ct_thientruong_hieu', account_id: 'acc_thientruong', full_name: 'Vương Văn Hiếu', salutation: 'anh', title: 'Trưởng phòng Kinh doanh', decision_role: 'ops_contact', email: 'hieu.vuong@thientruong.com.vn', phone: '0977 245 103' }),
    // ── Năng lượng Gió Ngàn
    makeContact({ id: 'ct_giongan_thuan', account_id: 'acc_giongan', full_name: 'Đinh Công Thuận', salutation: 'anh', title: 'Giám đốc Tài chính', decision_role: 'approver', email: 'thuan.dinh@giongan.vn', phone: '0918 406 271', last_interaction_at: c.at(-27, '15:30'), last_interaction_note: 'Ưu tiên chi phí thấp; là người đề xuất chọn ứng dụng hiện trường của hãng tua-bin.' }),
    makeContact({ id: 'ct_giongan_my', account_id: 'acc_giongan', full_name: 'Nguyễn Trà My', salutation: 'chị', title: 'Trưởng phòng Vật tư', decision_role: 'ops_contact', email: 'my.nguyen@giongan.vn', phone: '0965 730 184', last_interaction_at: c.at(-20, '10:30'), last_interaction_note: 'Kho vật tư thay thế cho 42 tua-bin đang theo dõi bằng bảng tính.' }),
    // ── Địa ốc Hải Đăng
    makeContact({ id: 'ct_haidang_luc', account_id: 'acc_haidang', full_name: 'Hứa Văn Lực', salutation: 'anh', title: 'Trưởng phòng Công nghệ thông tin', decision_role: 'ops_contact', email: 'luc.hua@haidangland.vn', phone: '0909 618 352', last_interaction_at: c.at(-18, '16:00'), last_interaction_note: 'Cùng xem phương án kết nối form đăng ký trên website dự án.' }),
    makeContact({ id: 'ct_haidang_thu', account_id: 'acc_haidang', full_name: 'Quách Minh Thư', salutation: 'chị', title: 'Giám đốc Chăm sóc khách hàng', decision_role: 'ops_contact', email: 'thu.quach@haidangland.vn', phone: '0938 207 649', last_interaction_at: c.at(-14, '15:00'), last_interaction_note: 'Muốn khách mua căn hộ tự xem tiến độ thanh toán và bàn giao trên điện thoại.' }),
    // ── Mây Trắng Logistics
    makeContact({ id: 'ct_maytrang_quoc', account_id: 'acc_maytrang', full_name: 'Lữ Hoàng Quốc', salutation: 'anh', title: 'Trưởng phòng Công nghệ thông tin', decision_role: 'ops_contact', email: 'quoc.lu@maytrang.vn', phone: '0903 572 846', last_interaction_at: c.at(-4, '10:00'), last_interaction_note: 'Theo dõi cùng New Era hiệu năng máy chủ trước mùa cao điểm.' }),
    makeContact({ id: 'ct_maytrang_dung', account_id: 'acc_maytrang', full_name: 'Phó Thị Dung', salutation: 'chị', title: 'Trưởng phòng Chăm sóc khách hàng', decision_role: 'ops_contact', email: 'dung.pho@maytrang.vn', phone: '0919 830 425', last_interaction_at: c.at(-9, '14:00'), last_interaction_note: 'Tổng đài nhận khoảng 300 cuộc gọi mỗi ngày hỏi trạng thái đơn.' }),
    makeContact({ id: 'ct_maytrang_triet', account_id: 'acc_maytrang', full_name: 'Kha Minh Triết', salutation: 'anh', title: 'Trưởng phòng Nhân sự', decision_role: 'ops_contact', email: 'triet.kha@maytrang.vn', phone: '0976 145 302' }),
  ];
}
