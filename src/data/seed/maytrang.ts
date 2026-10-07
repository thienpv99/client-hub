// Mây Trắng Logistics — operating and ON TRACK: nothing overdue on either side, nothing due within 3 days that
// holds a milestone, and no open task waiting on the client (one submission is with New Era for review).

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

const ACC = 'acc_maytrang';
const AM = 'u_am_ducanh';
const BINH = 'u_client_binh';
const HANH = 'u_client_hanh';
const TMS = 'prj_maytrang_tms';
const OPS = 'prj_maytrang_ops';

export function buildMayTrang(c: SeedCtx): Partial<Bundle> {
  const account = makeAccount({
    id: ACC,
    name: 'Mây Trắng Logistics',
    short_name: 'Mây Trắng',
    brand_color: '#0369A1',
    industry: 'Logistics',
    tier: 'standard',
    stage: 'operating',
    am_id: AM,
    email_domain: 'maytrang.vn',
    exec_summary: [
      `Hệ thống TMS vận hành ổn định từ ${c.dm(-105)}; 98% đơn giao đúng hẹn trong tháng qua.`,
      `Đang phát triển kết nối sàn thương mại điện tử, dự kiến bàn giao ${c.dm(25)}.`,
      'Hiện không có việc nào đang chờ phía Mây Trắng.',
    ],
    exec_summary_updated_at: c.at(-3, '16:30'),
    internal_notes: 'Khách hàng ổn định, thanh toán đúng hạn. Cơ hội: nâng cấp hạ tầng trước mùa cao điểm cuối năm, mở lại báo giá phân hệ kho.',
    created_at: c.at(-280, '09:00'),
    updated_at: c.at(-3, '16:30'),
  });

  const client = (u: Parameters<typeof makeUser>[0]) =>
    makeUser({ account_id: ACC, invited_by: AM, status: 'active', notification_pref: 'all', ...u });
  const users = [
    client({ id: BINH, full_name: 'Đoàn Quốc Bình', email: 'binh.doan@maytrang.vn', phone: '0907 318 552', role: 'client_owner', title: 'Tổng giám đốc', salutation: 'anh', notification_pref: 'digest_and_urgent', invited_at: c.at(-266, '10:00'), onboarded_at: c.at(-265, '21:00'), last_login_at: c.at(-3, '21:10') }),
    client({ id: HANH, full_name: 'Châu Mỹ Hạnh', email: 'hanh.chau@maytrang.vn', phone: '0919 604 273', role: 'client_member', title: 'Giám đốc vận hành', salutation: 'chị', invited_at: c.at(-266, '10:05'), onboarded_at: c.at(-264, '08:20'), last_login_at: c.at(-2, '09:45') }),
  ];

  const contacts = [
    makeContact({ id: 'ct_maytrang_binh', account_id: ACC, full_name: 'Đoàn Quốc Bình', salutation: 'anh', title: 'Tổng giám đốc', decision_role: 'decision_maker', email: 'binh.doan@maytrang.vn', phone: '0907 318 552', user_id: BINH, last_interaction_at: c.at(-10, '15:00'), last_interaction_note: 'Họp rà soát vận hành lần 1; anh hài lòng với tỷ lệ giao đúng hẹn.' }),
    makeContact({ id: 'ct_maytrang_hanh', account_id: ACC, full_name: 'Châu Mỹ Hạnh', salutation: 'chị', title: 'Giám đốc vận hành', decision_role: 'ops_contact', email: 'hanh.chau@maytrang.vn', phone: '0919 604 273', user_id: HANH, last_interaction_at: c.at(-2, '09:50'), last_interaction_note: 'Đã gửi danh sách cửa hàng đối tác trên sàn.' }),
    makeContact({ id: 'ct_maytrang_ngan', account_id: ACC, full_name: 'Kiều Thị Ngân', salutation: 'chị', title: 'Kế toán trưởng', decision_role: 'approver', email: 'ngan.kieu@maytrang.vn', phone: '0938 117 064', last_interaction_at: c.at(-3, '10:00'), last_interaction_note: 'Xác nhận đã chuyển khoản đợt 3 hợp đồng hỗ trợ.' }),
  ];

  const projects = [
    makeProject(TMS, ACC, 'Hệ thống quản lý vận tải (TMS)', 'MT-TMS', c.d(-265), c.d(-105), 'done'),
    makeProject(OPS, ACC, 'Vận hành và mở rộng TMS', 'MT-OPS', c.d(-104), c.d(120)),
  ];

  const milestones = [
    ...makeMilestones(c, TMS, [
      { id: 'ms_maytrang_tms_kickoff', name: 'Kickoff', planned: -262, done: -262, doneTime: '15:00' },
      { id: 'ms_maytrang_tms_survey', name: 'Khảo sát', planned: -240, done: -241 },
      { id: 'ms_maytrang_tms_design', name: 'Thiết kế', planned: -205, done: -206 },
      { id: 'ms_maytrang_tms_dev', name: 'Phát triển', planned: -150, done: -150 },
      { id: 'ms_maytrang_tms_uat', name: 'UAT', planned: -125, done: -126 },
      { id: 'ms_maytrang_tms_golive', name: 'Go-live', planned: -105, done: -105, doneTime: '22:00' },
    ]),
    ...makeMilestones(c, OPS, [
      { id: 'ms_maytrang_ops_handover', name: 'Bàn giao vận hành', planned: -100, done: -101 },
      { id: 'ms_maytrang_ops_routes', name: 'Tối ưu tuyến giao nội thành', planned: -40, done: -41 },
      { id: 'ms_maytrang_ops_review1', name: 'Rà soát vận hành lần 1', planned: -10, done: -10 },
      { id: 'ms_maytrang_ops_ecommerce', name: 'Kết nối sàn thương mại điện tử', planned: 25, description: 'Đồng bộ đơn từ 3 sàn vào TMS, tự động ghép chuyến.' },
      { id: 'ms_maytrang_ops_driver', name: 'Ứng dụng tài xế phiên bản 2', planned: 55 },
      { id: 'ms_maytrang_ops_review2', name: 'Rà soát vận hành lần 2', planned: 85 },
    ]),
  ];

  const t = taskMaker(c, AM);
  const tasks = [
    // ── TMS (đã go-live)
    t({ id: 't_maytrang_tms_design_approval', project_id: TMS, milestone_id: 'ms_maytrang_tms_design', title: 'Duyệt thiết kế màn hình điều phối xe', side: 'client', type: 'approval', assignee_id: BINH, due_date: c.d(-208), status: 'done', completed_at: c.at(-209, '21:00'), impact_text: `Nếu chưa duyệt trước ${c.dm(-208)}, team New Era chưa thể lập trình phân hệ điều phối. Mốc Thiết kế ${c.dm(-205)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_maytrang_tms_dev', project_id: TMS, milestone_id: 'ms_maytrang_tms_dev', title: 'Lập trình phân hệ điều phối xe', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(-152), status: 'done', completed_at: c.at(-153, '18:00') }),
    t({ id: 't_maytrang_tms_uat', project_id: TMS, milestone_id: 'ms_maytrang_tms_uat', title: 'Xác nhận kết quả UAT', side: 'client', type: 'confirm', assignee_id: HANH, due_date: c.d(-126), status: 'done', completed_at: c.at(-127, '16:00'), answer_text: 'Đạt 46/48 kịch bản; 2 lỗi nhỏ đã được sửa trong ngày.', impact_text: `Nếu chưa xác nhận trước ${c.dm(-126)}, New Era chưa thể chuẩn bị go-live. Mốc Go-live ${c.dm(-105)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_maytrang_tms_cutover', project_id: TMS, milestone_id: 'ms_maytrang_tms_golive', title: 'Chuyển dữ liệu và go-live TMS', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(-105), status: 'done', completed_at: c.at(-105, '21:30') }),
    t({ id: 't_maytrang_tms_signoff', project_id: TMS, milestone_id: 'ms_maytrang_tms_golive', title: 'Ký biên bản nghiệm thu go-live', side: 'client', type: 'sign', assignee_id: BINH, due_date: c.d(-104), status: 'done', completed_at: c.at(-105, '22:00'), impact_text: `Nếu chưa ký trước ${c.dm(-104)}, New Era chưa thể chuyển sang giai đoạn vận hành. Mốc Bàn giao vận hành ${c.dm(-100)} sẽ lùi theo số ngày trễ.` }),
    // ── Vận hành và mở rộng
    t({ id: 't_maytrang_handover_doc', project_id: OPS, milestone_id: 'ms_maytrang_ops_handover', title: 'Soạn tài liệu vận hành và bàn giao', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(-102), status: 'done', completed_at: c.at(-103, '17:00') }),
    t({ id: 't_maytrang_handover_sign', project_id: OPS, milestone_id: 'ms_maytrang_ops_handover', title: 'Ký biên bản bàn giao vận hành', side: 'client', type: 'sign', assignee_id: BINH, due_date: c.d(-101), status: 'done', completed_at: c.at(-101, '15:00'), impact_text: `Nếu chưa ký trước ${c.dm(-101)}, gói hỗ trợ vận hành chưa thể bắt đầu tính từ ${c.dm(-100)}.` }),
    t({ id: 't_maytrang_route_opt', project_id: OPS, milestone_id: 'ms_maytrang_ops_routes', title: 'Tối ưu thuật toán ghép tuyến nội thành', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(-45), status: 'done', completed_at: c.at(-46, '18:00') }),
    t({ id: 't_maytrang_route_confirm', project_id: OPS, milestone_id: 'ms_maytrang_ops_routes', title: 'Xác nhận kết quả tối ưu tuyến nội thành', side: 'client', type: 'confirm', assignee_id: HANH, due_date: c.d(-41), status: 'done', completed_at: c.at(-41, '10:00'), answer_text: 'Quãng đường trung bình giảm 11%, đồng ý áp dụng cho toàn bộ chi nhánh.', impact_text: `Nếu chưa xác nhận trước ${c.dm(-41)}, New Era chưa thể áp dụng tuyến mới cho toàn bộ chi nhánh.` }),
    t({ id: 't_maytrang_review_report', project_id: OPS, milestone_id: 'ms_maytrang_ops_review1', title: 'Lập báo cáo rà soát vận hành lần 1', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(-12), status: 'done', completed_at: c.at(-13, '17:00') }),
    t({ id: 't_maytrang_review_attend', project_id: OPS, milestone_id: 'ms_maytrang_ops_review1', title: 'Xác nhận tham dự buổi rà soát vận hành lần 1', side: 'client', type: 'attend', assignee_id: BINH, due_date: c.d(-12), status: 'done', completed_at: c.at(-13, '20:00'), impact_text: `Nếu chưa xác nhận trước ${c.dm(-12)}, New Era chưa thể chốt lịch rà soát ngày ${c.dm(-10)}.` }),
    t({ id: 't_maytrang_marketplace_accounts', project_id: OPS, milestone_id: 'ms_maytrang_ops_ecommerce', title: 'Cung cấp tài khoản kết nối của các sàn thương mại điện tử', side: 'client', type: 'upload', assignee_id: HANH, due_date: c.d(-10), status: 'done', completed_at: c.at(-12, '11:00'), impact_text: `Nếu chưa có tài khoản trước ${c.dm(-10)}, team New Era chưa thể lập trình đồng bộ đơn. Mốc Kết nối sàn ${c.dm(25)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_maytrang_shop_list', project_id: OPS, milestone_id: 'ms_maytrang_ops_ecommerce', title: 'Cung cấp danh sách cửa hàng đối tác trên sàn', side: 'client', type: 'upload', assignee_id: HANH, due_date: c.d(8), status: 'waiting', created_at: c.at(-9, '10:00'), updated_at: c.at(-2, '09:45'), description: 'Danh sách cửa hàng đang bán trên sàn kèm mã kho lấy hàng.', impact_text: `Nếu chưa có danh sách trước ${c.dm(8)}, team New Era chưa thể kiểm thử đồng bộ đơn với dữ liệu thật. Mốc Kết nối sàn thương mại điện tử ${c.dm(25)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_maytrang_sync_dev', project_id: OPS, milestone_id: 'ms_maytrang_ops_ecommerce', title: 'Lập trình đồng bộ đơn hàng từ sàn', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(18), status: 'in_progress', created_at: c.at(-12, '11:30'), impact_text: `Nếu chưa xong trước ${c.dm(18)}, mốc Kết nối sàn thương mại điện tử ${c.dm(25)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_maytrang_sync_test', project_id: OPS, milestone_id: 'ms_maytrang_ops_ecommerce', title: 'Kiểm thử đồng bộ đơn với dữ liệu thật', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(22), created_at: c.at(-12, '11:35'), impact_text: `Nếu chưa xong trước ${c.dm(22)}, mốc Kết nối sàn thương mại điện tử ${c.dm(25)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_maytrang_driver_design', project_id: OPS, milestone_id: 'ms_maytrang_ops_driver', title: 'Thiết kế ứng dụng tài xế phiên bản 2', side: 'internal', type: 'work', assignee_id: 'u_member_linh', due_date: c.d(30), status: 'in_progress', created_at: c.at(-6, '09:00') }),
    t({ id: 't_maytrang_capacity', project_id: OPS, title: 'Theo dõi hiệu năng máy chủ mùa cao điểm', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(10), status: 'in_progress', client_visible: false, created_at: c.at(-5, '09:00') }),
  ];

  const dep = depMaker(c, AM);
  const task_dependencies = [
    dep('dep_maytrang_01', 't_maytrang_sync_dev', { task: 't_maytrang_sync_test' }, -12),
    dep('dep_maytrang_02', 't_maytrang_sync_test', { milestone: 'ms_maytrang_ops_ecommerce' }, -12),
    dep('dep_maytrang_03', 't_maytrang_sync_dev', { milestone: 'ms_maytrang_ops_ecommerce' }, -12),
    dep('dep_maytrang_04', 't_maytrang_marketplace_accounts', { task: 't_maytrang_sync_dev' }, -20),
    dep('dep_maytrang_05', 't_maytrang_tms_uat', { milestone: 'ms_maytrang_tms_golive' }, -140),
    dep('dep_maytrang_06', 't_maytrang_tms_design_approval', { task: 't_maytrang_tms_dev' }, -215),
  ];

  const comments = [
    makeComment('cm_maytrang_01', 't_maytrang_shop_list', HANH, 'Gửi danh sách 86 cửa hàng đang bán trên sàn, cột mã kho đã cập nhật.', 'shared', c.at(-2, '09:45')),
    makeComment('cm_maytrang_02', 't_maytrang_shop_list', 'u_member_quang', 'Đã kiểm tra 60/86 dòng, dữ liệu khớp. Dự kiến xác nhận trong ngày mai.', 'internal', c.at(-1, '16:00')),
    makeComment('cm_maytrang_03', 't_maytrang_sync_dev', 'u_member_tuan', 'Đã đồng bộ được đơn từ 2/3 sàn, sàn thứ 3 đang kiểm thử.', 'shared', c.at(-2, '17:30')),
    makeComment('cm_maytrang_04', 't_maytrang_capacity', 'u_member_tuan', 'CPU máy chủ chạm 85% trong đợt khuyến mãi gần nhất. Đề xuất nâng gói hạ tầng trước cao điểm cuối năm — cơ hội bán thêm.', 'internal', c.at(-4, '10:00')),
    makeComment('cm_maytrang_05', 't_maytrang_driver_design', 'u_member_linh', 'Ưu tiên chế độ chữ to và nút lớn cho tài xế dùng một tay; bản phác thảo đầu tiên đã có.', 'internal', c.at(-1, '17:00')),
  ];

  const files = [
    makeFile({ id: 'f_maytrang_contract', account_id: ACC, project_id: TMS, name: 'Hợp đồng MT-TMS (bản ký).pdf', key: 'maytrang-contract', visibility: 'shared', kind: 'contract', uploaded_by: AM, uploaded_at: c.at(-265, '16:00') }),
    makeFile({ id: 'f_maytrang_support_contract', account_id: ACC, project_id: OPS, name: 'Hợp đồng hỗ trợ vận hành MT-OPS (bản ký).pdf', key: 'maytrang-support-contract', visibility: 'shared', kind: 'contract', uploaded_by: AM, uploaded_at: c.at(-104, '16:00') }),
    makeFile({ id: 'f_maytrang_handover', account_id: ACC, project_id: OPS, task_id: 't_maytrang_handover_doc', name: 'Tài liệu vận hành TMS.pdf', key: 'maytrang-handover', visibility: 'shared', kind: 'document', uploaded_by: 'u_member_quang', uploaded_at: c.at(-103, '17:00') }),
    makeFile({ id: 'f_maytrang_review', account_id: ACC, project_id: OPS, task_id: 't_maytrang_review_report', name: 'Báo cáo rà soát vận hành lần 1.pdf', key: 'maytrang-review', visibility: 'shared', kind: 'report', uploaded_by: 'u_member_quang', uploaded_at: c.at(-13, '17:00') }),
    makeFile({ id: 'f_maytrang_shop_list', account_id: ACC, project_id: OPS, task_id: 't_maytrang_shop_list', name: 'Danh sách cửa hàng đối tác trên sàn.pdf', key: 'maytrang-shop-list', visibility: 'shared', kind: 'data', uploaded_by: HANH, uploaded_at: c.at(-2, '09:45') }),
    makeFile({ id: 'f_maytrang_driver_app', account_id: ACC, project_id: OPS, task_id: 't_maytrang_driver_design', name: 'Ứng dụng tài xế v2 – bản phác thảo.svg', key: 'maytrang-driver-app', visibility: 'internal', kind: 'design', uploaded_by: 'u_member_linh', uploaded_at: c.at(-1, '17:00'), note: 'Bản phác thảo nội bộ' }),
  ];

  const A = activityMaker(ACC);
  const activities = [
    A('act_maytrang_01', BINH, 'task.signed_submitted', 'task', 't_maytrang_tms_signoff', { task: 'Ký biên bản nghiệm thu go-live' }, 'shared', c.at(-105, '22:00')),
    A('act_maytrang_02', AM, 'milestone.completed', 'milestone', 'ms_maytrang_tms_golive', { milestone: 'Go-live', project: 'Hệ thống quản lý vận tải (TMS)' }, 'shared', c.at(-105, '22:05')),
    A('act_maytrang_03', BINH, 'task.signed_submitted', 'task', 't_maytrang_handover_sign', { task: 'Ký biên bản bàn giao vận hành' }, 'shared', c.at(-101, '15:00')),
    A('act_maytrang_04', HANH, 'task.confirmed', 'task', 't_maytrang_route_confirm', { task: 'Xác nhận kết quả tối ưu tuyến nội thành' }, 'shared', c.at(-41, '10:00')),
    A('act_maytrang_05', BINH, 'task.attendance_confirmed', 'task', 't_maytrang_review_attend', { task: 'Xác nhận tham dự buổi rà soát vận hành lần 1' }, 'shared', c.at(-13, '20:00')),
    A('act_maytrang_06', AM, 'milestone.completed', 'milestone', 'ms_maytrang_ops_review1', { milestone: 'Rà soát vận hành lần 1', project: 'Vận hành và mở rộng TMS' }, 'shared', c.at(-10, '17:00')),
    A('act_maytrang_07', HANH, 'task.files_submitted', 'task', 't_maytrang_shop_list', { task: 'Cung cấp danh sách cửa hàng đối tác trên sàn', file: 'Danh sách cửa hàng đối tác trên sàn.pdf' }, 'shared', c.at(-2, '09:45')),
  ];

  return { accounts: [account], users, contacts, projects, milestones, tasks, task_dependencies, comments, files, activities };
}
