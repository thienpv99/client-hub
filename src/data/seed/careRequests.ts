// Care seed (SPEC-CARE §7) — change requests ("yêu cầu") of the six active accounts, with the activity lines the
// client sees and the AM's bell items for the newest portal requests. Stories:
//   · Cỏ Xanh: 3 requests are delivery debt (a broken date, a date with no plan, a date with no owner) → expansion
//     into a new department is blocked; two fresh portal requests are still within 7 days
//   · Thịnh An: two requests heard 9 and 11 days ago are still 'new' → "chưa xử lý quá 7 ngày"
//   · Mây Trắng: healthy — four done, one in progress on plan, one planned, one fresh from the portal
//   · Thiên Trường / Gió Ngàn / Hải Đăng: ordinary flow, nothing late

import type { Activity, AppNotification, ID } from '@/domain/types';
import type { ChangeRequest, CrPriority, CrSource, CrStatus } from '@/domain/careTypes';
import type { SeedCtx } from './helpers';
import { makeActivity, makeNotification } from './helpers';

const HA = 'u_am_ha';
const DUCANH = 'u_am_ducanh';
const TUAN = 'u_member_tuan';
const LINH = 'u_member_linh';
const QUANG = 'u_member_quang';

interface CrSpec {
  id: ID;
  account: ID;
  n: number;
  project?: ID | null;
  deployment?: ID | null;
  title: string;
  description: string;
  source: CrSource;
  contact?: ID | null;
  user?: ID | null;
  /** [day offset, hh:mm] */
  received: [number, string];
  status: CrStatus;
  priority?: CrPriority;
  /** day offset of the triage (defaults to received + 1 for every status but 'new') */
  triaged?: number;
  owner?: ID | null;
  promised?: number | null;
  plan?: string | null;
  task?: ID | null;
  clientNote?: string | null;
  internalNote?: string | null;
  declineReason?: string | null;
  done?: number | null;
}

const SPECS: CrSpec[] = [
  // ── Cỏ Xanh Retail (AM Hà) — delivery debt
  { id: 'cr_coxanh_01', account: 'acc_coxanh', n: 1, deployment: 'dpl_coxanh_replenish', title: 'Thêm mã kho vào phiếu bổ sung hàng gửi sang Mây Trắng', description: 'Phiếu gửi sang hệ thống vận tải cần mã kho để tài xế lấy đúng kho tổng.', source: 'email', contact: 'ct_coxanh_lan', received: [-44, '09:20'], status: 'done', triaged: -43, owner: TUAN, promised: -30, plan: 'Kết nối kho – bản 2', clientNote: 'Đã thêm mã kho, phiếu cũ vẫn đọc được.', done: -31 },
  { id: 'cr_coxanh_02', account: 'acc_coxanh', n: 2, project: 'prj_coxanh_app', deployment: 'dpl_coxanh_app', title: 'Đổi tên nhóm hàng “Đồ khô” thành “Thực phẩm khô”', description: 'Cho thống nhất với bảng giá mới của chuỗi.', source: 'meeting', contact: 'ct_coxanh_minh', received: [-21, '15:00'], status: 'done', triaged: -20, owner: LINH, promised: -12, plan: 'Thiết kế – bản sửa', clientNote: 'Đã đổi trên toàn bộ màn hình thiết kế.', done: -14 },
  { id: 'cr_coxanh_03', account: 'acc_coxanh', n: 3, project: 'prj_coxanh_app', deployment: 'dpl_coxanh_app', title: 'Hiện tồn kho của cửa hàng gần nhất trên màn hình sản phẩm', description: 'Nhân viên bán hàng cần biết cửa hàng gần nhất còn hàng không để chỉ khách sang lấy.', source: 'meeting', contact: 'ct_coxanh_nhung', received: [-26, '10:00'], status: 'in_progress', priority: 'high', triaged: -25, owner: TUAN, promised: -4, plan: 'Đợt phát triển 3', internalNote: 'Chờ API tồn kho theo cửa hàng của hệ thống kho; đã trễ hẹn, cần báo lại chị Nhung ngày mới.' },
  { id: 'cr_coxanh_04', account: 'acc_coxanh', n: 4, project: 'prj_coxanh_app', deployment: 'dpl_coxanh_app', title: 'Cho khách đổi giờ giao hàng sau khi đã đặt', description: 'Khách online hay đổi giờ nhận; hiện cửa hàng phải gọi lại từng khách.', source: 'chat', contact: 'ct_coxanh_lan', received: [-15, '20:40'], status: 'triaged', triaged: -14, owner: QUANG, promised: 5, internalNote: 'Đã hứa với chị Lan trước khi app đưa vào dùng nhưng chưa xếp vào đợt nào.' },
  { id: 'cr_coxanh_05', account: 'acc_coxanh', n: 5, project: 'prj_coxanh_app', deployment: 'dpl_coxanh_app', title: 'Báo cáo đơn online theo ca bán hàng', description: 'Quản lý cửa hàng muốn biết mỗi ca bán được bao nhiêu đơn online.', source: 'email', contact: 'ct_coxanh_minh', received: [-12, '08:15'], status: 'planned', triaged: -11, owner: null, promised: 12, plan: 'Đợt phát triển 4', internalNote: 'Anh Tuấn đang kín việc phần Đặt hàng; cần người nhận.' },
  { id: 'cr_coxanh_06', account: 'acc_coxanh', n: 6, project: 'prj_coxanh_app', deployment: 'dpl_coxanh_app', title: 'Thêm mã giảm giá riêng cho từng cửa hàng', description: 'Mỗi cửa hàng chạy khuyến mãi riêng vào cuối tuần.', source: 'meeting', contact: 'ct_coxanh_minh', received: [-18, '14:00'], status: 'planned', triaged: -17, owner: TUAN, promised: 20, plan: 'Đợt phát triển 4', clientNote: 'Làm cùng đợt với phần khuyến mãi, xong trước khi app đưa vào dùng chính thức.' },
  { id: 'cr_coxanh_07', account: 'acc_coxanh', n: 7, project: 'prj_coxanh_app', title: 'Gắn ví điện tử riêng của Cỏ Xanh vào bước thanh toán', description: 'Cỏ Xanh đang thử ví nội bộ cho khách thân thiết.', source: 'client_portal', contact: 'ct_coxanh_minh', user: 'u_client_minh', received: [-33, '21:15'], status: 'declined', triaged: -31, owner: HA, declineReason: 'Ví nội bộ chưa có tài liệu kết nối. New Era đề xuất làm sau khi app đưa vào dùng chính thức, khi Cỏ Xanh có tài liệu kỹ thuật.' },
  { id: 'cr_coxanh_08', account: 'acc_coxanh', n: 8, project: 'prj_coxanh_app', title: 'Gửi thông báo cho cửa hàng khi có đơn online mới', description: 'Để nhân viên chuẩn bị hàng ngay, không phải mở app kiểm tra.', source: 'client_portal', contact: 'ct_coxanh_lan', user: 'u_client_lan', received: [-5, '09:40'], status: 'new', priority: 'high' },
  { id: 'cr_coxanh_09', account: 'acc_coxanh', n: 9, project: 'prj_coxanh_app', title: 'Thêm nút gọi điện cho cửa hàng trong màn hình theo dõi đơn', description: 'Khách muốn gọi thẳng cửa hàng khi đơn giao trễ.', source: 'client_portal', contact: 'ct_coxanh_minh', user: 'u_client_minh', received: [-2, '22:05'], status: 'new' },
  // ── Ngân hàng Thịnh An (AM Hà) — untriaged > 7 days
  { id: 'cr_thinhan_01', account: 'acc_thinhan', n: 1, project: 'prj_thinhan_corp', deployment: 'dpl_thinhan_cb', title: 'Thêm bước phê duyệt thứ 3 cho lệnh chuyển tiền trên 5 tỷ', description: 'Theo quy định mới của khối doanh nghiệp, lệnh lớn cần thêm Kế toán trưởng duyệt.', source: 'email', contact: 'ct_thinhan_mai', received: [-11, '16:30'], status: 'new', priority: 'high' },
  { id: 'cr_thinhan_02', account: 'acc_thinhan', n: 2, project: 'prj_thinhan_corp', deployment: 'dpl_thinhan_cb', title: 'Cho kế toán doanh nghiệp tải sao kê nhiều tài khoản một lần', description: 'Doanh nghiệp có 5–10 tài khoản cần sao kê gộp cuối tháng.', source: 'meeting', contact: 'ct_thinhan_long', received: [-9, '10:00'], status: 'new' },
  { id: 'cr_thinhan_03', account: 'acc_thinhan', n: 3, project: 'prj_thinhan_corp', deployment: 'dpl_thinhan_cb', title: 'Thêm nhật ký đăng nhập cho quản trị viên doanh nghiệp', description: 'Quản trị viên phía doanh nghiệp cần xem ai đăng nhập lúc nào.', source: 'client_portal', contact: 'ct_thinhan_mai', user: 'u_client_mai', received: [-3, '11:20'], status: 'new' },
  { id: 'cr_thinhan_04', account: 'acc_thinhan', n: 4, project: 'prj_thinhan_corp', deployment: 'dpl_thinhan_cb', title: 'Hạn mức phê duyệt riêng cho từng nhóm người dùng', description: 'Mỗi doanh nghiệp tự đặt hạn mức cho nhóm lập lệnh và nhóm duyệt.', source: 'meeting', contact: 'ct_thinhan_phuc', received: [-20, '09:00'], status: 'planned', triaged: -19, owner: QUANG, promised: 10, task: 't_thinhan_permissions', clientNote: 'Nằm trong thiết kế phân quyền, xong cùng mốc Thiết kế giải pháp.' },
  { id: 'cr_thinhan_05', account: 'acc_thinhan', n: 5, project: 'prj_thinhan_corp', deployment: 'dpl_thinhan_cb', title: 'Đối soát tự động với core banking lúc 23 giờ', description: 'Đối soát cuối ngày chạy tự động, sáng ra có kết quả.', source: 'email', contact: 'ct_thinhan_kien', received: [-14, '15:00'], status: 'triaged', triaged: -12, owner: TUAN, internalNote: 'Chờ tài liệu mã lỗi của core banking rồi mới hẹn ngày.' },
  // ── Cơ điện Thiên Trường (AM Đức Anh)
  { id: 'cr_thientruong_01', account: 'acc_thientruong', n: 1, project: 'prj_thientruong_mes', deployment: 'dpl_thientruong_mes', title: 'Thêm cột hao hụt cho phép vào màn hình định mức', description: 'Mỗi mã nguyên vật liệu có tỷ lệ hao hụt khác nhau.', source: 'meeting', contact: 'ct_thientruong_son', received: [-60, '09:00'], status: 'done', triaged: -59, owner: LINH, promised: -45, plan: 'Thiết kế – bản sửa', done: -46 },
  { id: 'cr_thientruong_02', account: 'acc_thientruong', n: 2, project: 'prj_thientruong_mes', deployment: 'dpl_thientruong_mes', title: 'Kết nối dữ liệu máy CNC xưởng cơ khí trước buổi kiểm thử', description: 'Anh Hùng muốn thấy số giờ chạy máy thật trong buổi khách kiểm thử.', source: 'meeting', contact: 'ct_thientruong_hung', received: [-6, '10:30'], status: 'in_progress', priority: 'high', triaged: -5, owner: TUAN, promised: 12, task: 't_thientruong_iot', clientNote: 'Đang kết nối qua cổng IoT, xong trước buổi chạy thử.' },
  { id: 'cr_thientruong_03', account: 'acc_thientruong', n: 3, project: 'prj_thientruong_mes', deployment: 'dpl_thientruong_mes', title: 'In phiếu lệnh sản xuất khổ A5', description: 'Tổ trưởng ca cần phiếu nhỏ dán lên xe đẩy.', source: 'email', contact: 'ct_thientruong_lam', received: [-10, '14:00'], status: 'planned', triaged: -9, owner: QUANG, promised: 30, plan: 'Đợt phát triển 6' },
  { id: 'cr_thientruong_04', account: 'acc_thientruong', n: 4, project: 'prj_thientruong_mes', title: 'Cảnh báo khi nguyên vật liệu dưới mức tồn tối thiểu', description: 'Phòng vật tư muốn biết sớm để đặt hàng.', source: 'client_portal', contact: 'ct_thientruong_son', user: 'u_client_son', received: [-4, '07:45'], status: 'new' },
  { id: 'cr_thientruong_05', account: 'acc_thientruong', n: 5, project: 'prj_thientruong_mes', title: 'Chấm công công nhân bằng vân tay trong MES', description: 'Phòng nhân sự muốn chấm công ngay trên hệ thống sản xuất.', source: 'meeting', contact: 'ct_thientruong_nga', received: [-52, '14:30'], status: 'declined', triaged: -50, owner: DUCANH, declineReason: 'Chấm công nằm ngoài phạm vi hệ thống sản xuất. New Era có thể đề xuất riêng phần chấm công và lương khoán.' },
  // ── Năng lượng Gió Ngàn (AM Đức Anh)
  { id: 'cr_giongan_01', account: 'acc_giongan', n: 1, project: 'prj_giongan_ops', deployment: 'dpl_giongan_ops', title: 'Hiển thị công suất theo MW thay vì kW', description: 'Cho khớp với báo cáo gửi đơn vị mua điện.', source: 'meeting', contact: 'ct_giongan_phuong', received: [-30, '09:30'], status: 'done', triaged: -29, owner: LINH, promised: -20, plan: 'Thiết kế – bản sửa', done: -22 },
  { id: 'cr_giongan_02', account: 'acc_giongan', n: 2, project: 'prj_giongan_ops', deployment: 'dpl_giongan_ops', title: 'Đọc thêm nhiệt độ ổ trục chính của tua-bin', description: 'Kỹ sư vận hành dùng nhiệt độ ổ trục để phát hiện sớm hỏng hóc.', source: 'email', contact: 'ct_giongan_tai', received: [-16, '08:30'], status: 'in_progress', triaged: -15, owner: TUAN, promised: 3, task: 't_giongan_scada', clientNote: 'Làm cùng phần tích hợp dữ liệu SCADA.' },
  { id: 'cr_giongan_03', account: 'acc_giongan', n: 3, project: 'prj_giongan_ops', deployment: 'dpl_giongan_ops', title: 'Xuất báo cáo sản lượng theo từng tua-bin ra Excel', description: 'Gửi hằng tháng cho ban giám đốc.', source: 'meeting', contact: 'ct_giongan_phuong', received: [-9, '15:00'], status: 'planned', triaged: -8, owner: QUANG, promised: 14, plan: 'Đợt phát triển 3' },
  { id: 'cr_giongan_04', account: 'acc_giongan', n: 4, project: 'prj_giongan_ops', title: 'Thêm bản đồ vị trí 42 tua-bin', description: 'Ca trực muốn bấm vào tua-bin trên bản đồ để xem số liệu.', source: 'client_portal', contact: 'ct_giongan_tai', user: 'u_client_tai', received: [-1, '14:10'], status: 'new' },
  // ── Địa ốc Hải Đăng (AM Hà)
  { id: 'cr_haidang_01', account: 'acc_haidang', n: 1, project: 'prj_haidang_crm', deployment: 'dpl_haidang_crm', title: 'Theo dõi tiến độ thanh toán theo đợt của khách mua', description: 'Bổ sung từ buổi xác nhận phạm vi.', source: 'meeting', contact: 'ct_haidang_khang', received: [-55, '10:00'], status: 'triaged', triaged: -54, owner: QUANG, internalNote: 'Đưa vào phân hệ đặt cọc ở mốc Phát triển.' },
  { id: 'cr_haidang_02', account: 'acc_haidang', n: 2, project: 'prj_haidang_crm', deployment: 'dpl_haidang_crm', title: 'Cho sàn này xem giỏ hàng của sàn kia ở chế độ chỉ xem', description: 'Tránh hai sàn chào cùng một căn.', source: 'meeting', contact: 'ct_haidang_khang', received: [-6, '16:00'], status: 'new' },
  { id: 'cr_haidang_03', account: 'acc_haidang', n: 3, project: 'prj_haidang_crm', deployment: 'dpl_haidang_crm', title: 'Thêm trạng thái “giữ chỗ 24 giờ” cho căn hộ', description: 'Nhân viên giữ căn cho khách trong lúc chờ đặt cọc.', source: 'email', contact: 'ct_haidang_khang', received: [-12, '09:00'], status: 'planned', triaged: -11, owner: LINH, promised: 5, task: 't_haidang_ui', clientNote: 'Có trong thiết kế giỏ hàng căn hộ.' },
  // ── Mây Trắng Logistics (AM Đức Anh) — healthy
  { id: 'cr_maytrang_01', account: 'acc_maytrang', n: 1, project: 'prj_maytrang_tms', deployment: 'dpl_maytrang_driver', title: 'Chụp ảnh xác nhận giao hàng trong app tài xế', description: 'Chủ hàng yêu cầu bằng chứng giao hàng.', source: 'meeting', contact: 'ct_maytrang_hanh', received: [-170, '10:00'], status: 'done', triaged: -169, owner: TUAN, promised: -150, plan: 'Phát triển TMS', done: -152 },
  { id: 'cr_maytrang_02', account: 'acc_maytrang', n: 2, project: 'prj_maytrang_ops', deployment: 'dpl_maytrang_tms', title: 'Tự gửi tin nhắn cho người nhận trước khi giao 30 phút', description: 'Giảm số lần giao thất bại vì người nhận vắng nhà.', source: 'email', contact: 'ct_maytrang_hanh', received: [-95, '09:00'], status: 'done', triaged: -94, owner: TUAN, promised: -80, plan: 'Vận hành – tháng 1', done: -82 },
  { id: 'cr_maytrang_03', account: 'acc_maytrang', n: 3, project: 'prj_maytrang_ops', deployment: 'dpl_maytrang_tms', title: 'Tối ưu ghép tuyến giao nội thành', description: 'Giảm quãng đường chạy rỗng trong nội thành.', source: 'meeting', contact: 'ct_maytrang_binh', received: [-70, '15:00'], status: 'done', triaged: -69, owner: TUAN, promised: -40, plan: 'Tối ưu tuyến nội thành', clientNote: 'Quãng đường trung bình giảm 11%.', done: -41 },
  { id: 'cr_maytrang_04', account: 'acc_maytrang', n: 4, project: 'prj_maytrang_ops', deployment: 'dpl_maytrang_tms', title: 'Báo cáo tỷ lệ giao đúng hẹn theo chi nhánh', description: 'Dùng cho buổi rà soát vận hành.', source: 'client_portal', contact: 'ct_maytrang_hanh', user: 'u_client_hanh', received: [-25, '08:50'], status: 'done', triaged: -24, owner: QUANG, promised: -12, plan: 'Rà soát vận hành lần 1', clientNote: 'Đã có trong báo cáo rà soát vận hành lần 1.', done: -13 },
  { id: 'cr_maytrang_05', account: 'acc_maytrang', n: 5, project: 'prj_maytrang_ops', deployment: 'dpl_maytrang_marketplace', title: 'Đồng bộ đơn từ sàn thương mại điện tử thứ 3', description: 'Sàn thứ 3 chiếm 20% đơn mùa cao điểm.', source: 'meeting', contact: 'ct_maytrang_hanh', received: [-14, '10:00'], status: 'in_progress', triaged: -13, owner: TUAN, promised: 25, task: 't_maytrang_sync_dev', clientNote: 'Đang kiểm thử, xong cùng mốc Kết nối sàn.' },
  { id: 'cr_maytrang_06', account: 'acc_maytrang', n: 6, project: 'prj_maytrang_ops', deployment: 'dpl_maytrang_driver', title: 'Chế độ chữ to cho app tài xế', description: 'Tài xế lớn tuổi khó đọc chữ nhỏ khi đang lái.', source: 'meeting', contact: 'ct_maytrang_binh', received: [-10, '15:30'], status: 'planned', triaged: -9, owner: LINH, promised: 55, task: 't_maytrang_driver_design', clientNote: 'Có trong ứng dụng tài xế phiên bản 2.' },
  { id: 'cr_maytrang_07', account: 'acc_maytrang', n: 7, project: 'prj_maytrang_ops', title: 'Cho chủ hàng tự tra cứu trạng thái đơn', description: 'Tổng đài đang nhận rất nhiều cuộc gọi hỏi đơn đang ở đâu.', source: 'client_portal', contact: 'ct_maytrang_hanh', user: 'u_client_hanh', received: [-1, '10:15'], status: 'new' },
];

const AM_OF: Record<ID, ID> = {
  acc_coxanh: HA,
  acc_thinhan: HA,
  acc_haidang: HA,
  acc_thientruong: DUCANH,
  acc_giongan: DUCANH,
  acc_maytrang: DUCANH,
};

export function buildChangeRequests(c: SeedCtx): ChangeRequest[] {
  return SPECS.map((s) => {
    const received = c.at(s.received[0], s.received[1]);
    const triagedDay = s.status === 'new' ? null : s.triaged ?? s.received[0] + 1;
    const triaged = triagedDay === null ? null : c.at(triagedDay, '09:30');
    const done = s.status === 'done' && s.done !== undefined && s.done !== null ? c.at(s.done, '17:00') : null;
    const updated = done ?? triaged ?? received;
    return {
      id: s.id,
      code: `YC-${String(s.n).padStart(2, '0')}`,
      account_id: s.account,
      project_id: s.project ?? null,
      deployment_id: s.deployment ?? null,
      title: s.title,
      description: s.description,
      source: s.source,
      requested_by_contact_id: s.contact ?? null,
      requested_by_user_id: s.user ?? null,
      received_at: received,
      status: s.status,
      priority: s.priority ?? 'normal',
      triaged_at: triaged,
      owner_id: s.owner ?? null,
      promised_date: s.promised === undefined || s.promised === null ? null : c.d(s.promised),
      plan_ref: s.plan ?? null,
      task_id: s.task ?? null,
      client_note: s.clientNote ?? null,
      internal_note: s.internalNote ?? null,
      decline_reason: s.declineReason ?? null,
      done_at: done,
      created_at: received,
      updated_at: updated,
      deleted_at: null,
    };
  });
}

/** client-facing lines of the last 45 days (portal submissions, triage, done / declined) — what "Cập nhật mới" shows */
export function buildRequestActivities(c: SeedCtx, crs: ChangeRequest[]): Activity[] {
  const out: Activity[] = [];
  const recent = c.at(-45, '00:00');
  const statusLabel: Record<CrStatus, string> = {
    new: 'Đã gửi, chờ New Era tiếp nhận',
    triaged: 'New Era đã tiếp nhận',
    planned: 'Đã lên kế hoạch',
    in_progress: 'Đang thực hiện',
    done: 'Đã hoàn thành',
    declined: 'Chưa thực hiện được',
  };
  for (const cr of crs) {
    if (cr.received_at < recent) continue;
    const params: Record<string, string> = { code: cr.code, request: cr.title };
    if (cr.project_id) params.project_id = cr.project_id;
    if (cr.source === 'client_portal' && cr.requested_by_user_id) {
      out.push(makeActivity({ id: `act_${cr.id}_sent`, account_id: cr.account_id, actor_id: cr.requested_by_user_id, action: 'change_request.submitted', target_type: 'change_request', target_id: cr.id, params, visibility: 'shared', at: cr.received_at }));
    }
    if (cr.triaged_at) {
      // the account's AM takes requests in
      out.push(makeActivity({ id: `act_${cr.id}_triaged`, account_id: cr.account_id, actor_id: AM_OF[cr.account_id] ?? null, action: 'change_request.triaged', target_type: 'change_request', target_id: cr.id, params, visibility: 'shared', at: cr.triaged_at }));
    }
    if ((cr.status === 'done' && cr.done_at) || cr.status === 'declined') {
      out.push(
        makeActivity({
          id: `act_${cr.id}_closed`,
          account_id: cr.account_id,
          actor_id: cr.owner_id,
          action: 'change_request.status_changed',
          target_type: 'change_request',
          target_id: cr.id,
          params: { ...params, status_label: statusLabel[cr.status] },
          visibility: 'shared',
          at: cr.done_at ?? cr.triaged_at ?? cr.received_at,
        }),
      );
    }
  }
  return out;
}

/** the AM's bell item for the newest portal request of an account (unread) */
export function buildRequestNotifications(c: SeedCtx): AppNotification[] {
  return [
    makeNotification({
      id: 'ntf_cr_coxanh_09',
      user_id: HA,
      kind: 'request',
      title: 'Cỏ Xanh Retail gửi yêu cầu mới YC-09',
      body: 'Trần Quang Minh gửi yêu cầu “Thêm nút gọi điện cho cửa hàng trong màn hình theo dõi đơn” qua Client Hub. New Era cần tiếp nhận trong 7 ngày.',
      link: '/app/accounts/acc_coxanh/delivery?cr=cr_coxanh_09',
      account_id: 'acc_coxanh',
      at: c.at(-2, '22:06'),
    }),
    makeNotification({
      id: 'ntf_cr_maytrang_07',
      user_id: DUCANH,
      kind: 'request',
      title: 'Mây Trắng Logistics gửi yêu cầu mới YC-07',
      body: 'Châu Mỹ Hạnh gửi yêu cầu “Cho chủ hàng tự tra cứu trạng thái đơn” qua Client Hub. New Era cần tiếp nhận trong 7 ngày.',
      link: '/app/accounts/acc_maytrang/delivery?cr=cr_maytrang_07',
      account_id: 'acc_maytrang',
      at: c.at(-1, '10:16'),
    }),
    makeNotification({
      id: 'ntf_cr_coxanh_06_client',
      user_id: 'u_client_minh',
      kind: 'request',
      title: 'Yêu cầu YC-06 đã lên kế hoạch',
      body: `New Era đã lên kế hoạch cho yêu cầu “Thêm mã giảm giá riêng cho từng cửa hàng”, dự kiến xong ngày ${c.d(20).slice(8, 10)}/${c.d(20).slice(5, 7)}/${c.d(20).slice(0, 4)}. Lời nhắn của New Era: “Làm cùng đợt với phần khuyến mãi, xong trước khi app đưa vào dùng chính thức.”`,
      link: '/portal/progress?cr=cr_coxanh_06',
      account_id: 'acc_coxanh',
      read_at: c.at(-16, '21:00'),
      at: c.at(-17, '09:31'),
    }),
  ];
}
