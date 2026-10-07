// Cỏ Xanh Retail — BLOCKED by the client: the Đặt hàng design approval is 6 days overdue,
// it blocks "Lập trình phần Đặt hàng" → milestone UAT (and directly milestone Thiết kế), so UAT and Go-live
// forecast +6. Also: delegation Minh → Lan, a sent quote awaiting Minh, a due-soon confirm task,
// an answer task, a submission waiting for New Era, earlier approvals done on time.

import type { Bundle, SeedCtx } from './helpers';
import {
  activityMaker,
  depMaker,
  makeAccount,
  makeComment,
  makeContact,
  makeFile,
  makeMilestones,
  makeProject,
  makeUser,
  taskMaker,
} from './helpers';

const ACC = 'acc_coxanh';
const AM = 'u_am_ha';
const MINH = 'u_client_minh';
const LAN = 'u_client_lan';
const KHOA = 'u_client_khoa';
const APP = 'prj_coxanh_app';
const NCC = 'prj_coxanh_portal';

export function buildCoXanh(c: SeedCtx): Partial<Bundle> {
  const account = makeAccount({
    id: ACC,
    name: 'Cỏ Xanh Retail',
    short_name: 'Cỏ Xanh',
    brand_color: '#2F7D4F',
    industry: 'Bán lẻ',
    tier: 'strategic',
    stage: 'implementing',
    am_id: AM,
    email_domain: 'coxanh.vn',
    exec_summary: [
      'Khảo sát và thiết kế Trang chủ đã xong; team đang lập trình Trang chủ và danh mục sản phẩm.',
      'Màn hình Đặt hàng (bản 2) đang chờ anh Minh duyệt; mỗi ngày chờ, UAT và Go-live lùi thêm 1 ngày.',
      'Cổng nhà cung cấp đã kickoff, đang chốt lịch khảo sát với các nhà cung cấp chính.',
    ],
    exec_summary_updated_at: c.at(-2, '17:30'),
    internal_notes: 'Anh Minh hay phản hồi buổi tối và qua Zalo. Có kế hoạch mở thêm 2 chuỗi cửa hàng năm sau — cơ hội mở rộng bản quyền.',
    created_at: c.at(-88, '10:00'),
    updated_at: c.at(-2, '17:30'),
  });

  const client = (u: Parameters<typeof makeUser>[0]) =>
    makeUser({ account_id: ACC, invited_by: AM, status: 'active', notification_pref: 'all', ...u });
  const users = [
    client({ id: MINH, full_name: 'Trần Quang Minh', email: 'minh.tran@coxanh.vn', phone: '0903 123 456', role: 'client_owner', title: 'Tổng giám đốc', salutation: 'anh', invited_at: c.at(-78, '10:00'), onboarded_at: c.at(-77, '21:05'), last_login_at: c.at(-1, '21:40') }),
    client({ id: LAN, full_name: 'Phạm Thu Lan', email: 'lan.pham@coxanh.vn', phone: '0908 456 123', role: 'client_member', title: 'Giám đốc vận hành', salutation: 'chị', invited_at: c.at(-75, '10:00'), onboarded_at: c.at(-74, '08:30'), last_login_at: c.at(-1, '10:12') }),
    client({ id: KHOA, full_name: 'Đặng Văn Khoa', email: 'khoa.dang@coxanh.vn', phone: '0905 778 210', role: 'client_member', title: 'Trưởng phòng Công nghệ thông tin', salutation: 'anh', invited_at: c.at(-22, '14:00'), onboarded_at: c.at(-21, '08:10'), last_login_at: c.at(-3, '15:25') }),
  ];

  const contacts = [
    makeContact({ id: 'ct_coxanh_minh', account_id: ACC, full_name: 'Trần Quang Minh', salutation: 'anh', title: 'Tổng giám đốc', decision_role: 'decision_maker', email: 'minh.tran@coxanh.vn', phone: '0903 123 456', user_id: MINH, last_interaction_at: c.at(-2, '09:05'), last_interaction_note: 'Gọi nhắc duyệt thiết kế màn hình Đặt hàng; anh hẹn phản hồi sau họp ban điều hành.' }),
    makeContact({ id: 'ct_coxanh_lan', account_id: ACC, full_name: 'Phạm Thu Lan', salutation: 'chị', title: 'Giám đốc vận hành', decision_role: 'ops_contact', email: 'lan.pham@coxanh.vn', phone: '0908 456 123', user_id: LAN, last_interaction_at: c.at(-1, '16:45'), last_interaction_note: 'Đã gửi danh sách cửa hàng và kho, đang chuẩn bị danh mục sản phẩm.' }),
    makeContact({ id: 'ct_coxanh_khoa', account_id: ACC, full_name: 'Đặng Văn Khoa', salutation: 'anh', title: 'Trưởng phòng Công nghệ thông tin', decision_role: 'approver', email: 'khoa.dang@coxanh.vn', phone: '0905 778 210', user_id: KHOA, last_interaction_at: c.at(-19, '10:00'), last_interaction_note: 'Tham dự kickoff Cổng nhà cung cấp.' }),
    makeContact({ id: 'ct_coxanh_huong', account_id: ACC, full_name: 'Lý Thanh Hương', salutation: 'chị', title: 'Kế toán trưởng', decision_role: 'ops_contact', email: 'huong.ly@coxanh.vn', phone: '0913 602 884', last_interaction_at: c.at(-36, '14:00'), last_interaction_note: 'Xác nhận đã chuyển khoản đợt 2.' }),
  ];

  const projects = [
    makeProject(APP, ACC, 'App bán hàng đa kênh', 'CX-APP', c.d(-70), c.d(40)),
    makeProject(NCC, ACC, 'Cổng nhà cung cấp', 'CX-NCC', c.d(-20), c.d(95)),
  ];

  const milestones = [
    ...makeMilestones(c, APP, [
      { id: 'ms_coxanh_kickoff', name: 'Kickoff', planned: -63, done: -63, doneTime: '15:00', description: 'Họp khởi động, chốt phạm vi và kế hoạch.' },
      { id: 'ms_coxanh_survey', name: 'Khảo sát', planned: -42, done: -43, description: 'Khảo sát quy trình bán hàng tại 6 cửa hàng mẫu.' },
      { id: 'ms_coxanh_design', name: 'Thiết kế', planned: 2, description: 'Thiết kế giao diện app: Trang chủ, danh mục, Đặt hàng, tài khoản.' },
      { id: 'ms_coxanh_dev', name: 'Phát triển', planned: 15 },
      { id: 'ms_coxanh_uat', name: 'UAT', planned: 22, description: 'Đội cửa hàng chạy thử trên dữ liệu thật.' },
      { id: 'ms_coxanh_golive', name: 'Go-live', planned: 36 },
    ]),
    ...makeMilestones(c, NCC, [
      { id: 'ms_coxanh_portal_kickoff', name: 'Kickoff', planned: -18, done: -18, doneTime: '11:30' },
      { id: 'ms_coxanh_portal_survey', name: 'Khảo sát', planned: 8 },
      { id: 'ms_coxanh_portal_design', name: 'Thiết kế', planned: 30 },
      { id: 'ms_coxanh_portal_dev', name: 'Phát triển', planned: 62 },
      { id: 'ms_coxanh_portal_golive', name: 'Go-live', planned: 90 },
    ]),
  ];

  const t = taskMaker(c, AM);
  const tasks = [
    // ── App bán hàng đa kênh · phía khách
    t({ id: 't_coxanh_main_quote', project_id: APP, milestone_id: 'ms_coxanh_kickoff', title: 'Chấp thuận báo giá triển khai App bán hàng đa kênh', side: 'client', type: 'approval', assignee_id: MINH, requires_owner: true, quote_id: 'q_coxanh_main_v1', due_date: c.d(-72), status: 'done', completed_at: c.at(-73, '11:00'), created_at: c.at(-80, '15:00'), description: 'Báo giá gồm phân tích, thiết kế, lập trình, kiểm thử, 50 bản quyền và 12 tháng hạ tầng.', impact_text: `Nếu chưa chấp thuận trước ${c.dm(-72)}, New Era chưa thể ký hợp đồng và tổ chức kickoff ngày ${c.dm(-63)}.` }),
    t({ id: 't_coxanh_scope_confirm', project_id: APP, milestone_id: 'ms_coxanh_kickoff', title: 'Xác nhận phạm vi dự án App bán hàng đa kênh', side: 'client', type: 'confirm', assignee_id: MINH, due_date: c.d(-64), status: 'done', completed_at: c.at(-65, '10:20'), answer_text: 'Đồng ý phạm vi như biên bản kickoff, ưu tiên app trước, website sau.', description: 'Phạm vi gồm app bán hàng, trang quản trị đơn hàng và kết nối kho của 24 cửa hàng.', impact_text: `Nếu chưa xác nhận trước ${c.dm(-64)}, New Era chưa thể chốt kế hoạch khảo sát. Mốc Khảo sát ${c.dm(-42)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_survey_approval', project_id: APP, milestone_id: 'ms_coxanh_survey', title: 'Duyệt báo cáo khảo sát nghiệp vụ', side: 'client', type: 'approval', assignee_id: MINH, due_date: c.d(-44), status: 'done', completed_at: c.at(-45, '09:15'), description: 'Báo cáo tổng hợp quy trình bán hàng, giao hàng và đổi trả tại 6 cửa hàng mẫu.', impact_text: `Nếu chưa duyệt trước ${c.dm(-44)}, team New Era chưa thể bắt đầu thiết kế giao diện. Mốc Thiết kế ${c.dm(2)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_brand_approval', project_id: APP, milestone_id: 'ms_coxanh_design', title: 'Duyệt bộ nhận diện giao diện (logo, màu sắc)', side: 'client', type: 'approval', assignee_id: MINH, due_date: c.d(-20), status: 'done', completed_at: c.at(-21, '20:40'), description: 'Logo dùng trong app, bảng màu chính và kiểu chữ.', impact_text: `Nếu chưa duyệt trước ${c.dm(-20)}, team New Era chưa thể hoàn thiện thiết kế các màn hình. Mốc Thiết kế ${c.dm(2)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_home_approval', project_id: APP, milestone_id: 'ms_coxanh_design', title: 'Duyệt thiết kế màn hình Trang chủ', side: 'client', type: 'approval', assignee_id: MINH, due_date: c.d(-10), status: 'done', completed_at: c.at(-11, '21:05'), description: 'Trang chủ gồm ô tìm kiếm, banner khuyến mãi, nhóm sản phẩm và sản phẩm bán chạy.', impact_text: `Nếu chưa duyệt trước ${c.dm(-10)}, team New Era chưa thể lập trình Trang chủ. Mốc Phát triển ${c.dm(15)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_design_approval', project_id: APP, milestone_id: 'ms_coxanh_design', title: 'Duyệt thiết kế màn hình Đặt hàng', side: 'client', type: 'approval', assignee_id: MINH, due_date: c.d(-6), status: 'todo', revision: 2, reminder_count: 2, last_reminded_at: c.at(-2, '09:00'), created_at: c.at(-14, '16:05'), description: 'Bản 2 đã cập nhật theo góp ý của anh: tách nút Thanh toán khỏi giỏ hàng và thêm bước chọn kho giao hàng. Anh xem file đính kèm rồi duyệt, hoặc ghi rõ chỗ cần chỉnh.', impact_text: `Nếu chưa duyệt trước ${c.dm(-6)}, team New Era chưa thể lập trình phần Đặt hàng. Mốc UAT ${c.dm(22)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_catalog_upload', project_id: APP, milestone_id: 'ms_coxanh_dev', title: 'Cung cấp danh mục sản phẩm và giá bán', side: 'client', type: 'upload', assignee_id: LAN, delegated_by: MINH, delegated_at: c.at(-5, '21:10'), delegation_note: 'Chị Lan gửi giúp anh file danh mục mới nhất từ hệ thống kho, dùng mẫu New Era gửi nhé.', due_date: c.d(5), created_at: c.at(-8, '10:30'), description: 'Danh mục khoảng 1.800 mã sản phẩm, gồm mã, tên, nhóm hàng, đơn vị tính và giá bán lẻ. Dùng file mẫu đính kèm.', impact_text: `Nếu chưa có danh mục trước ${c.dm(5)}, team New Era chưa thể nhập dữ liệu sản phẩm để kiểm thử. Mốc UAT ${c.dm(22)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_store_list', project_id: APP, milestone_id: 'ms_coxanh_dev', title: 'Cung cấp danh sách cửa hàng và kho hàng', side: 'client', type: 'upload', assignee_id: LAN, due_date: c.d(4), status: 'waiting', created_at: c.at(-9, '10:00'), updated_at: c.at(-1, '16:40'), description: 'Danh sách 24 cửa hàng và 3 kho tổng, kèm địa chỉ và mã kho.', impact_text: `Nếu chưa có danh sách trước ${c.dm(4)}, team New Era chưa thể cấu hình tồn kho theo cửa hàng. Mốc Phát triển ${c.dm(15)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_quote_approval', project_id: APP, title: 'Chấp thuận báo giá Phụ lục mở rộng 20 người dùng', side: 'client', type: 'approval', assignee_id: MINH, requires_owner: true, quote_id: 'q_coxanh_ext_v1', due_date: c.d(4), created_at: c.at(-2, '15:30'), description: 'Thêm 20 tài khoản cho đội bán hàng miền Nam và 1 buổi đào tạo. Báo giá có hiệu lực 30 ngày.', impact_text: `Nếu chưa chấp thuận trước ${c.dm(4)}, New Era chưa thể cấp thêm 20 tài khoản cho đội bán hàng trước Go-live ${c.dm(36)}.` }),
    t({ id: 't_coxanh_warehouse_answer', project_id: APP, milestone_id: 'ms_coxanh_dev', title: 'Trả lời số kho xuất hàng cho đơn online', side: 'client', type: 'answer', assignee_id: LAN, due_date: c.d(6), created_at: c.at(-3, '11:00'), description: 'Đơn online sẽ xuất từ kho tổng hay từ cửa hàng gần nhất? Có bao nhiêu kho tham gia giao hàng online?', impact_text: `Nếu chưa có câu trả lời trước ${c.dm(6)}, team New Era chưa thể cấu hình phân bổ đơn theo kho. Mốc Phát triển ${c.dm(15)} sẽ lùi theo số ngày trễ.` }),
    // ── App bán hàng đa kênh · phía New Era
    t({ id: 't_coxanh_survey_report', project_id: APP, milestone_id: 'ms_coxanh_survey', title: 'Hoàn thiện báo cáo khảo sát nghiệp vụ', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(-48), status: 'done', completed_at: c.at(-49, '17:30'), impact_text: `Nếu chưa xong trước ${c.dm(-48)}, anh Minh chưa có báo cáo để duyệt. Mốc Khảo sát ${c.dm(-42)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_design_home', project_id: APP, milestone_id: 'ms_coxanh_design', title: 'Thiết kế màn hình Trang chủ và danh mục', side: 'internal', type: 'work', assignee_id: 'u_member_linh', due_date: c.d(-14), status: 'done', completed_at: c.at(-15, '18:00') }),
    t({ id: 't_coxanh_design_order_v2', project_id: APP, milestone_id: 'ms_coxanh_design', title: 'Cập nhật thiết kế màn hình Đặt hàng theo góp ý', side: 'internal', type: 'work', assignee_id: 'u_member_linh', due_date: c.d(-9), status: 'done', completed_at: c.at(-9, '11:30'), created_at: c.at(-12, '22:00') }),
    t({ id: 't_coxanh_home_dev', project_id: APP, milestone_id: 'ms_coxanh_dev', title: 'Lập trình màn hình Trang chủ và danh mục', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(9), status: 'in_progress', created_at: c.at(-10, '09:00'), impact_text: `Nếu chưa xong trước ${c.dm(9)}, mốc Phát triển ${c.dm(15)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_order_dev', project_id: APP, milestone_id: 'ms_coxanh_dev', title: 'Lập trình phần Đặt hàng', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(15), created_at: c.at(-12, '09:00'), description: 'Giỏ hàng, chọn kho giao, thanh toán và theo dõi đơn. Bắt đầu ngay khi thiết kế được duyệt.', impact_text: `Nếu chưa xong trước ${c.dm(15)}, mốc UAT ${c.dm(22)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_data_import', project_id: APP, milestone_id: 'ms_coxanh_uat', title: 'Nhập dữ liệu sản phẩm vào hệ thống', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(12), created_at: c.at(-8, '10:30'), impact_text: `Nếu chưa xong trước ${c.dm(12)}, đội cửa hàng chưa có dữ liệu để chạy thử. Mốc UAT ${c.dm(22)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_staging', project_id: APP, milestone_id: 'ms_coxanh_dev', title: 'Dựng môi trường kiểm thử (staging)', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(7), status: 'in_progress', client_visible: false, created_at: c.at(-6, '09:00') }),
    t({ id: 't_coxanh_uat_script', project_id: APP, milestone_id: 'ms_coxanh_uat', title: 'Soạn kịch bản UAT cho đội cửa hàng', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(18), created_at: c.at(-4, '09:30') }),
    t({ id: 't_coxanh_ext_costing', project_id: APP, title: 'Rà soát đơn giá bản quyền cho phụ lục 20 người dùng', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(-3), status: 'done', completed_at: c.at(-3, '10:00'), client_visible: false, created_at: c.at(-6, '14:00') }),
    // ── Cổng nhà cung cấp
    t({ id: 't_coxanh_portal_kickoff_deck', project_id: NCC, milestone_id: 'ms_coxanh_portal_kickoff', title: 'Chuẩn bị tài liệu kickoff Cổng nhà cung cấp', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(-19), status: 'done', completed_at: c.at(-20, '17:00') }),
    t({ id: 't_coxanh_portal_kickoff_attend', project_id: NCC, milestone_id: 'ms_coxanh_portal_kickoff', title: 'Xác nhận tham dự buổi kickoff Cổng nhà cung cấp', side: 'client', type: 'attend', assignee_id: KHOA, due_date: c.d(-19), status: 'done', completed_at: c.at(-20, '08:30'), impact_text: `Nếu chưa xác nhận trước ${c.dm(-19)}, New Era chưa thể chốt lịch kickoff ngày ${c.dm(-18)}.` }),
    t({ id: 't_coxanh_portal_meeting', project_id: NCC, milestone_id: 'ms_coxanh_portal_survey', title: 'Xác nhận lịch họp khảo sát với nhà cung cấp', side: 'client', type: 'confirm', assignee_id: MINH, due_date: c.d(2), created_at: c.at(-4, '10:00'), description: 'New Era đề xuất 2 buổi khảo sát với 5 nhà cung cấp lớn nhất vào tuần sau. Anh xác nhận để New Era gửi thư mời.', impact_text: `Nếu chưa xác nhận lịch trước ${c.dm(2)}, New Era chưa thể khảo sát quy trình nhập hàng với nhà cung cấp. Mốc Khảo sát ${c.dm(8)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_portal_vendors', project_id: NCC, milestone_id: 'ms_coxanh_portal_survey', title: 'Cung cấp danh sách 20 nhà cung cấp chính', side: 'client', type: 'upload', assignee_id: KHOA, due_date: c.d(7), created_at: c.at(-4, '10:05'), description: 'Tên nhà cung cấp, người liên hệ, nhóm hàng và số đơn nhập trung bình mỗi tháng.', impact_text: `Nếu chưa có danh sách trước ${c.dm(7)}, team New Era chưa thể mời nhà cung cấp tham gia khảo sát. Mốc Khảo sát ${c.dm(8)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_coxanh_portal_questions', project_id: NCC, milestone_id: 'ms_coxanh_portal_survey', title: 'Chuẩn bị bộ câu hỏi khảo sát nhà cung cấp', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(5), status: 'waiting', created_at: c.at(-10, '09:00'), description: 'Bản nháp đã xong, chờ anh Khoa góp ý phần quy trình đối soát công nợ.' }),
  ];

  const dep = depMaker(c, AM);
  const task_dependencies = [
    dep('dep_coxanh_01', 't_coxanh_design_approval', { task: 't_coxanh_order_dev' }, -14),
    dep('dep_coxanh_02', 't_coxanh_design_approval', { milestone: 'ms_coxanh_design' }, -14),
    dep('dep_coxanh_03', 't_coxanh_order_dev', { milestone: 'ms_coxanh_uat' }, -12),
    dep('dep_coxanh_04', 't_coxanh_catalog_upload', { task: 't_coxanh_data_import' }, -8),
    dep('dep_coxanh_05', 't_coxanh_data_import', { milestone: 'ms_coxanh_uat' }, -8),
    dep('dep_coxanh_06', 't_coxanh_warehouse_answer', { milestone: 'ms_coxanh_dev' }, -3),
    dep('dep_coxanh_07', 't_coxanh_home_dev', { milestone: 'ms_coxanh_dev' }, -10),
    dep('dep_coxanh_08', 't_coxanh_home_approval', { task: 't_coxanh_home_dev' }, -14),
    dep('dep_coxanh_09', 't_coxanh_survey_report', { task: 't_coxanh_survey_approval' }, -55),
    dep('dep_coxanh_10', 't_coxanh_survey_approval', { milestone: 'ms_coxanh_survey' }, -55),
    dep('dep_coxanh_11', 't_coxanh_brand_approval', { milestone: 'ms_coxanh_design' }, -30),
    dep('dep_coxanh_12', 't_coxanh_portal_meeting', { milestone: 'ms_coxanh_portal_survey' }, -4),
    dep('dep_coxanh_13', 't_coxanh_portal_vendors', { milestone: 'ms_coxanh_portal_survey' }, -4),
  ];

  const comments = [
    makeComment('cm_coxanh_01', 't_coxanh_design_approval', AM, `Em gửi anh bản 2 màn hình Đặt hàng: đã tách nút Thanh toán khỏi giỏ hàng và thêm bước chọn kho giao. Anh xem giúp em trước ngày ${c.dm(-6)} nhé.`, 'shared', c.at(-9, '14:20')),
    makeComment('cm_coxanh_02', 't_coxanh_design_approval', MINH, 'Anh đang xin thêm ý kiến đội kinh doanh miền Nam, cuối tuần anh phản hồi.', 'shared', c.at(-4, '22:15')),
    makeComment('cm_coxanh_03', 't_coxanh_design_approval', AM, 'Dạ, em cảm ơn anh. Team giữ sẵn lịch lập trình để bắt đầu ngay khi anh duyệt.', 'shared', c.at(-4, '22:40'), 'cm_coxanh_02'),
    makeComment('cm_coxanh_04', 't_coxanh_design_approval', AM, 'Đã gọi anh Minh, anh hẹn duyệt sau họp ban điều hành. Nếu qua thứ Sáu chưa có phản hồi, đề xuất anh Nam gọi trực tiếp.', 'internal', c.at(-2, '09:10')),
    makeComment('cm_coxanh_05', 't_coxanh_order_dev', 'u_member_tuan', 'API giỏ hàng đã sẵn sàng, chỉ chờ chốt thiết kế là làm ngay. Ước lượng 7 ngày công.', 'internal', c.at(-5, '17:20')),
    makeComment('cm_coxanh_06', 't_coxanh_catalog_upload', LAN, 'Chị đang lấy số liệu từ hệ thống kho, sẽ gửi trước hạn.', 'shared', c.at(-3, '10:05')),
    makeComment('cm_coxanh_07', 't_coxanh_store_list', AM, 'Danh sách thiếu mã kho của 3 cửa hàng Bình Dương, cần hỏi lại chị Lan trước khi chấp nhận.', 'internal', c.at(-1, '17:30')),
    makeComment('cm_coxanh_08', 't_coxanh_staging', 'u_member_tuan', 'Staging đang dùng tạm máy chủ dự phòng đến cuối tháng, chưa ảnh hưởng tiến độ nên chưa báo khách.', 'internal', c.at(-4, '18:10')),
    makeComment('cm_coxanh_09', 't_coxanh_ext_costing', AM, 'Đã rà soát: đơn giá thỏa thuận 3.240.000 ₫ cho phụ lục vẫn trong ngưỡng chiết khấu. Giữ giá, không cần xin duyệt.', 'internal', c.at(-3, '10:00')),
  ];

  const files = [
    makeFile({ id: 'f_coxanh_proposal', account_id: ACC, project_id: APP, name: 'Đề xuất giải pháp App bán hàng đa kênh.pdf', key: 'coxanh-proposal', visibility: 'shared', kind: 'document', uploaded_by: AM, uploaded_at: c.at(-84, '16:00') }),
    makeFile({ id: 'f_coxanh_contract', account_id: ACC, project_id: APP, name: 'Hợp đồng CX-APP (bản ký).pdf', key: 'coxanh-contract', visibility: 'shared', kind: 'contract', uploaded_by: AM, uploaded_at: c.at(-68, '10:30') }),
    makeFile({ id: 'f_coxanh_survey', account_id: ACC, project_id: APP, task_id: 't_coxanh_survey_approval', name: 'Báo cáo khảo sát nghiệp vụ.pdf', key: 'coxanh-survey', visibility: 'shared', kind: 'report', uploaded_by: 'u_member_quang', uploaded_at: c.at(-49, '17:30') }),
    makeFile({ id: 'f_coxanh_brand', account_id: ACC, project_id: APP, task_id: 't_coxanh_brand_approval', name: 'Bộ nhận diện giao diện.svg', key: 'coxanh-brand', visibility: 'shared', kind: 'design', uploaded_by: 'u_member_linh', uploaded_at: c.at(-24, '15:00') }),
    makeFile({ id: 'f_coxanh_home', account_id: ACC, project_id: APP, task_id: 't_coxanh_home_approval', name: 'Thiết kế màn hình Trang chủ.svg', key: 'coxanh-home', visibility: 'shared', kind: 'design', uploaded_by: 'u_member_linh', uploaded_at: c.at(-15, '18:00') }),
    makeFile({ id: 'f_coxanh_order_v1', account_id: ACC, project_id: APP, task_id: 't_coxanh_design_approval', name: 'Thiết kế màn hình Đặt hàng.svg', key: 'coxanh-order-v1', doc_key: 'coxanh-order-design', version: 1, visibility: 'shared', kind: 'design', uploaded_by: 'u_member_linh', uploaded_at: c.at(-14, '16:00'), note: 'Bản 1' }),
    makeFile({ id: 'f_coxanh_order_v2', account_id: ACC, project_id: APP, task_id: 't_coxanh_design_approval', name: 'Thiết kế màn hình Đặt hàng.svg', key: 'coxanh-order-v2', doc_key: 'coxanh-order-design', version: 2, visibility: 'shared', kind: 'design', uploaded_by: 'u_member_linh', uploaded_at: c.at(-9, '14:00'), note: 'Bản 2: tách nút Thanh toán, thêm chọn kho giao hàng' }),
    makeFile({ id: 'f_coxanh_catalog_tpl', account_id: ACC, project_id: APP, task_id: 't_coxanh_catalog_upload', name: 'Mẫu danh mục sản phẩm và giá bán.pdf', key: 'tpl-catalog', visibility: 'shared', kind: 'data', uploaded_by: AM, uploaded_at: c.at(-8, '10:30') }),
    makeFile({ id: 'f_coxanh_stores', account_id: ACC, project_id: APP, task_id: 't_coxanh_store_list', name: 'Danh sách cửa hàng và kho.pdf', key: 'coxanh-stores', visibility: 'shared', kind: 'data', uploaded_by: LAN, uploaded_at: c.at(-1, '16:40') }),
    makeFile({ id: 'f_coxanh_estimate', account_id: ACC, project_id: APP, task_id: 't_coxanh_ext_costing', name: 'Bảng giá đề xuất phụ lục 20 người dùng.pdf', key: 'coxanh-estimate', visibility: 'internal', kind: 'document', uploaded_by: AM, uploaded_at: c.at(-3, '10:00') }),
  ];

  const A = activityMaker(ACC);
  const activities = [
    A('act_coxanh_01', MINH, 'quote.accepted', 'quote', 'q_coxanh_main_v1', { quote: 'Triển khai App bán hàng đa kênh', version: 1 }, 'shared', c.at(-73, '11:00')),
    A('act_coxanh_02', MINH, 'task.confirmed', 'task', 't_coxanh_scope_confirm', { task: 'Xác nhận phạm vi dự án App bán hàng đa kênh' }, 'shared', c.at(-65, '10:20')),
    A('act_coxanh_03', MINH, 'task.approved', 'task', 't_coxanh_survey_approval', { task: 'Duyệt báo cáo khảo sát nghiệp vụ' }, 'shared', c.at(-45, '09:15')),
    A('act_coxanh_04', AM, 'milestone.completed', 'milestone', 'ms_coxanh_survey', { milestone: 'Khảo sát', project: 'App bán hàng đa kênh' }, 'shared', c.at(-43, '17:00')),
    A('act_coxanh_06', MINH, 'task.approved', 'task', 't_coxanh_brand_approval', { task: 'Duyệt bộ nhận diện giao diện (logo, màu sắc)' }, 'shared', c.at(-21, '20:40')),
    A('act_coxanh_07', MINH, 'task.changes_requested', 'task', 't_coxanh_design_approval', { task: 'Duyệt thiết kế màn hình Đặt hàng', reason: 'Tách nút Thanh toán khỏi giỏ hàng, thêm bước chọn kho giao hàng.' }, 'shared', c.at(-12, '21:30')),
    A('act_coxanh_08', MINH, 'task.approved', 'task', 't_coxanh_home_approval', { task: 'Duyệt thiết kế màn hình Trang chủ' }, 'shared', c.at(-11, '21:05')),
    A('act_coxanh_09', AM, 'task.returned_to_client', 'task', 't_coxanh_design_approval', { task: 'Duyệt thiết kế màn hình Đặt hàng', version: 2 }, 'shared', c.at(-9, '14:20')),
    A('act_coxanh_10', MINH, 'task.delegated', 'task', 't_coxanh_catalog_upload', { task: 'Cung cấp danh mục sản phẩm và giá bán', to: 'Phạm Thu Lan', note: 'Chị Lan gửi giúp anh file danh mục mới nhất từ hệ thống kho.' }, 'shared', c.at(-5, '21:10')),
    A('act_coxanh_11', AM, 'task.reminded', 'task', 't_coxanh_design_approval', { task: 'Duyệt thiết kế màn hình Đặt hàng', to: 'Trần Quang Minh' }, 'internal', c.at(-4, '09:00')),
    A('act_coxanh_13', AM, 'quote.sent', 'quote', 'q_coxanh_ext_v1', { quote: 'Phụ lục mở rộng 20 người dùng', version: 1 }, 'shared', c.at(-2, '15:30')),
    A('act_coxanh_14', AM, 'task.reminded', 'task', 't_coxanh_design_approval', { task: 'Duyệt thiết kế màn hình Đặt hàng', to: 'Trần Quang Minh' }, 'internal', c.at(-2, '09:00')),
    A('act_coxanh_15', LAN, 'task.files_submitted', 'task', 't_coxanh_store_list', { task: 'Cung cấp danh sách cửa hàng và kho hàng', file: 'Danh sách cửa hàng và kho.pdf' }, 'shared', c.at(-1, '16:40')),
  ];

  return { accounts: [account], users, contacts, projects, milestones, tasks, task_dependencies, comments, files, activities };
}
