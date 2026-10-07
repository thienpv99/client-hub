// Địa ốc Hải Đăng — ATTENTION (yellow) through exactly one client task due in 2 days that holds milestone
// Thiết kế. Nothing is overdue. The decision maker (chị Vy) has never logged in → first-login intro via OTP.

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

const ACC = 'acc_haidang';
const AM = 'u_am_ha';
const VY = 'u_client_vy';
const KHANG = 'u_client_khang';
const P = 'prj_haidang_crm';

export function buildHaiDang(c: SeedCtx): Partial<Bundle> {
  const account = makeAccount({
    id: ACC,
    name: 'Địa ốc Hải Đăng',
    short_name: 'Hải Đăng',
    brand_color: '#6D28D9',
    industry: 'Bất động sản',
    tier: 'standard',
    stage: 'implementing',
    am_id: AM,
    email_domain: 'haidangland.vn',
    exec_summary: [
      'Khảo sát quy trình bán hàng dự án đã xong; team đang thiết kế CRM cho 2 sàn giao dịch.',
      `Quy trình phân bổ khách hàng tiềm năng cần chị Vy duyệt trước ${c.dm(2)} để giữ mốc Thiết kế.`,
      'Báo giá gói đào tạo bổ sung cho đội kinh doanh đang chờ chị Vy xem.',
    ],
    exec_summary_updated_at: c.at(-2, '16:00'),
    internal_notes: 'Chị Vy mới nhận lời mời vào Client Hub, chưa đăng nhập lần nào. Anh Khang là đầu mối hằng ngày nhưng quyết định cuối cùng ở chị Vy.',
    created_at: c.at(-66, '09:00'),
    updated_at: c.at(-2, '16:00'),
  });

  const client = (u: Parameters<typeof makeUser>[0]) =>
    makeUser({ account_id: ACC, invited_by: AM, status: 'active', notification_pref: 'all', ...u });
  const users = [
    // never logged in: onboarded_at null → the 3-screen intro shows on first OTP login
    client({ id: VY, full_name: 'Lâm Tường Vy', email: 'vy.lam@haidangland.vn', phone: '0902 715 386', role: 'client_owner', title: 'Tổng giám đốc', salutation: 'chị', invited_at: c.at(-4, '10:00'), onboarded_at: null, last_login_at: null }),
    client({ id: KHANG, full_name: 'Phan Gia Khang', email: 'khang.phan@haidangland.vn', phone: '0937 482 615', role: 'client_member', title: 'Giám đốc kinh doanh', salutation: 'anh', invited_at: c.at(-58, '10:00'), onboarded_at: c.at(-57, '09:40'), last_login_at: c.at(-1, '11:20') }),
  ];

  const contacts = [
    makeContact({ id: 'ct_haidang_vy', account_id: ACC, full_name: 'Lâm Tường Vy', salutation: 'chị', title: 'Tổng giám đốc', decision_role: 'decision_maker', email: 'vy.lam@haidangland.vn', phone: '0902 715 386', user_id: VY, last_interaction_at: c.at(-4, '10:00'), last_interaction_note: 'Đã gửi lời mời vào Client Hub; chị sẽ trực tiếp duyệt quy trình phân bổ khách.' }),
    makeContact({ id: 'ct_haidang_khang', account_id: ACC, full_name: 'Phan Gia Khang', salutation: 'anh', title: 'Giám đốc kinh doanh', decision_role: 'approver', email: 'khang.phan@haidangland.vn', phone: '0937 482 615', user_id: KHANG, last_interaction_at: c.at(-1, '11:30'), last_interaction_note: 'Đã gửi danh sách dự án và bảng giá.' }),
    makeContact({ id: 'ct_haidang_chau', account_id: ACC, full_name: 'Tạ Minh Châu', salutation: 'chị', title: 'Trưởng phòng Marketing', decision_role: 'ops_contact', email: 'chau.ta@haidangland.vn', phone: '0909 236 471', last_interaction_at: c.at(-25, '14:00'), last_interaction_note: 'Cung cấp danh sách nguồn khách hàng tiềm năng.' }),
  ];

  const projects = [makeProject(P, ACC, 'CRM bán hàng dự án', 'HD-CRM', c.d(-60), c.d(75))];

  const milestones = makeMilestones(c, P, [
    { id: 'ms_haidang_kickoff', name: 'Kickoff', planned: -56, done: -56, doneTime: '15:30' },
    { id: 'ms_haidang_survey', name: 'Khảo sát', planned: -28, done: -28, description: 'Khảo sát quy trình bán hàng tại 2 sàn giao dịch.' },
    { id: 'ms_haidang_design', name: 'Thiết kế', planned: 5, description: 'Giỏ hàng căn hộ, phân bổ khách hàng tiềm năng, theo dõi đặt cọc.' },
    { id: 'ms_haidang_dev', name: 'Phát triển', planned: 32 },
    { id: 'ms_haidang_uat', name: 'UAT', planned: 50 },
    { id: 'ms_haidang_golive', name: 'Go-live', planned: 62 },
  ]);

  const t = taskMaker(c, AM);
  const tasks = [
    t({ id: 't_haidang_kickoff', project_id: P, milestone_id: 'ms_haidang_kickoff', title: 'Tổ chức kickoff dự án CRM', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(-56), status: 'done', completed_at: c.at(-56, '11:30') }),
    t({ id: 't_haidang_scope', project_id: P, milestone_id: 'ms_haidang_kickoff', title: 'Xác nhận phạm vi CRM cho 2 sàn giao dịch', side: 'client', type: 'confirm', assignee_id: KHANG, due_date: c.d(-55), status: 'done', completed_at: c.at(-55, '10:00'), answer_text: 'Đồng ý phạm vi, bổ sung theo dõi tiến độ thanh toán theo đợt của khách mua.', impact_text: `Nếu chưa xác nhận trước ${c.dm(-55)}, New Era chưa thể chốt kế hoạch khảo sát. Mốc Khảo sát ${c.dm(-28)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_haidang_survey', project_id: P, milestone_id: 'ms_haidang_survey', title: 'Khảo sát quy trình bán hàng tại 2 sàn giao dịch', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(-34), status: 'done', completed_at: c.at(-35, '17:00'), impact_text: `Nếu chưa xong trước ${c.dm(-34)}, anh Khang chưa có báo cáo để duyệt. Mốc Khảo sát ${c.dm(-28)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_haidang_survey_approval', project_id: P, milestone_id: 'ms_haidang_survey', title: 'Duyệt báo cáo khảo sát quy trình bán hàng', side: 'client', type: 'approval', assignee_id: KHANG, due_date: c.d(-29), status: 'done', completed_at: c.at(-30, '14:00'), impact_text: `Nếu chưa duyệt trước ${c.dm(-29)}, team New Era chưa thể bắt đầu thiết kế. Mốc Thiết kế ${c.dm(5)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_haidang_lead_draft', project_id: P, milestone_id: 'ms_haidang_design', title: 'Soạn quy trình phân bổ khách hàng tiềm năng', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(-3), status: 'done', completed_at: c.at(-4, '17:00'), impact_text: `Nếu chưa xong trước ${c.dm(-3)}, chị Vy chưa có quy trình để duyệt. Mốc Thiết kế ${c.dm(5)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_haidang_lead_flow', project_id: P, milestone_id: 'ms_haidang_design', title: 'Duyệt quy trình phân bổ khách hàng tiềm năng', side: 'client', type: 'approval', assignee_id: VY, due_date: c.d(2), created_at: c.at(-3, '09:00'), description: 'Khách hàng tiềm năng từ website, sàn giao dịch và người giới thiệu được chia cho nhân viên kinh doanh theo quy tắc ở trang 2. Chị xem và duyệt, hoặc ghi rõ chỗ cần chỉnh.', impact_text: `Nếu chưa duyệt trước ${c.dm(2)}, team New Era chưa thể hoàn thiện thiết kế màn hình phân bổ khách. Mốc Thiết kế ${c.dm(5)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_haidang_ui', project_id: P, milestone_id: 'ms_haidang_design', title: 'Thiết kế giao diện giỏ hàng căn hộ', side: 'internal', type: 'work', assignee_id: 'u_member_linh', due_date: c.d(5), status: 'in_progress', created_at: c.at(-12, '09:00') }),
    t({ id: 't_haidang_lead_screen', project_id: P, milestone_id: 'ms_haidang_design', title: 'Thiết kế màn hình phân bổ khách hàng', side: 'internal', type: 'work', assignee_id: 'u_member_linh', due_date: c.d(5), created_at: c.at(-3, '09:05'), impact_text: `Nếu chưa xong trước ${c.dm(5)}, mốc Thiết kế ${c.dm(5)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_haidang_projects_data', project_id: P, milestone_id: 'ms_haidang_dev', title: 'Cung cấp danh sách dự án và bảng giá căn hộ', side: 'client', type: 'upload', assignee_id: KHANG, due_date: c.d(12), status: 'waiting', created_at: c.at(-10, '10:00'), updated_at: c.at(-1, '11:20'), description: 'Danh sách dự án đang mở bán, sơ đồ tầng và bảng giá từng căn.', impact_text: `Nếu chưa có dữ liệu trước ${c.dm(12)}, team New Era chưa thể xây dựng công cụ nhập dữ liệu dự án. Mốc Phát triển ${c.dm(32)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_haidang_quote', project_id: P, title: 'Chấp thuận báo giá gói đào tạo bổ sung cho sàn giao dịch', side: 'client', type: 'approval', assignee_id: VY, requires_owner: true, quote_id: 'q_haidang_training_v1', due_date: c.d(9), created_at: c.at(-2, '10:00'), description: '4 gói đào tạo cho 60 nhân viên kinh doanh tại 2 sàn, kèm 2 ngày quản lý dự án.', impact_text: `Nếu chưa chấp thuận trước ${c.dm(9)}, New Era chưa thể xếp lịch đào tạo 60 nhân viên kinh doanh trước Go-live ${c.dm(62)}.` }),
    t({ id: 't_haidang_sales_team', project_id: P, milestone_id: 'ms_haidang_dev', title: 'Cung cấp danh sách nhân viên kinh doanh và phân quyền', side: 'client', type: 'upload', assignee_id: KHANG, due_date: c.d(20), created_at: c.at(-2, '10:10'), impact_text: `Nếu chưa có danh sách trước ${c.dm(20)}, New Era chưa thể tạo tài khoản cho đội kinh doanh. Mốc UAT ${c.dm(50)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_haidang_import_tool', project_id: P, milestone_id: 'ms_haidang_dev', title: 'Xây dựng công cụ nhập dữ liệu dự án', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(25), created_at: c.at(-10, '10:05'), impact_text: `Nếu chưa xong trước ${c.dm(25)}, mốc Phát triển ${c.dm(32)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_haidang_web_form', project_id: P, milestone_id: 'ms_haidang_dev', title: 'Kết nối form đăng ký trên website dự án', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(28), created_at: c.at(-5, '09:00') }),
    t({ id: 't_haidang_pricing_review', project_id: P, title: 'Rà soát chi phí gói đào tạo bổ sung', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(-3), status: 'done', completed_at: c.at(-6, '15:00'), client_visible: false, created_at: c.at(-8, '09:00') }),
    t({ id: 't_haidang_uat_plan', project_id: P, milestone_id: 'ms_haidang_uat', title: 'Lập kế hoạch UAT cho 2 sàn giao dịch', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(40), created_at: c.at(-5, '09:10') }),
    t({ id: 't_haidang_uat_attend', project_id: P, milestone_id: 'ms_haidang_uat', title: 'Xác nhận tham dự UAT tại sàn giao dịch', side: 'client', type: 'attend', assignee_id: KHANG, due_date: c.d(45), created_at: c.at(-5, '09:15'), impact_text: `Nếu chưa xác nhận trước ${c.dm(45)}, New Era chưa thể chốt lịch UAT. Mốc UAT ${c.dm(50)} sẽ lùi theo số ngày trễ.` }),
  ];

  const dep = depMaker(c, AM);
  const task_dependencies = [
    dep('dep_haidang_01', 't_haidang_lead_flow', { task: 't_haidang_lead_screen' }, -3),
    dep('dep_haidang_02', 't_haidang_lead_flow', { milestone: 'ms_haidang_design' }, -3),
    dep('dep_haidang_03', 't_haidang_lead_screen', { milestone: 'ms_haidang_design' }, -3),
    dep('dep_haidang_04', 't_haidang_lead_draft', { task: 't_haidang_lead_flow' }, -12),
    dep('dep_haidang_05', 't_haidang_projects_data', { task: 't_haidang_import_tool' }, -10),
    dep('dep_haidang_06', 't_haidang_import_tool', { milestone: 'ms_haidang_dev' }, -10),
    dep('dep_haidang_07', 't_haidang_sales_team', { milestone: 'ms_haidang_uat' }, -2),
    dep('dep_haidang_08', 't_haidang_survey', { task: 't_haidang_survey_approval' }, -40),
  ];

  const comments = [
    makeComment('cm_haidang_01', 't_haidang_lead_flow', AM, 'Em gửi chị Vy quy trình phân bổ khách theo 3 nguồn: website, sàn và người giới thiệu. Chị xem giúp em phần quy tắc chia đều cho nhân viên ở trang 2 ạ.', 'shared', c.at(-3, '09:10')),
    makeComment('cm_haidang_02', 't_haidang_lead_flow', 'u_member_quang', 'Anh Khang muốn ưu tiên nhân viên có doanh số cao, chưa thống nhất với chị Vy. Cần chốt trước khi thiết kế màn hình.', 'internal', c.at(-2, '15:00')),
    makeComment('cm_haidang_03', 't_haidang_projects_data', KHANG, 'Gửi bảng giá 3 dự án đang mở bán, dự án thứ 4 sẽ bổ sung sau.', 'shared', c.at(-1, '11:20')),
    makeComment('cm_haidang_04', 't_haidang_pricing_review', AM, 'Đơn giá đào tạo giữ theo niêm yết, chiết khấu 0% nên không cần Giám đốc duyệt.', 'internal', c.at(-6, '15:00')),
  ];

  const files = [
    makeFile({ id: 'f_haidang_contract', account_id: ACC, project_id: P, name: 'Hợp đồng HD-CRM (bản ký).pdf', key: 'haidang-contract', visibility: 'shared', kind: 'contract', uploaded_by: AM, uploaded_at: c.at(-57, '16:00') }),
    makeFile({ id: 'f_haidang_survey', account_id: ACC, project_id: P, task_id: 't_haidang_survey_approval', name: 'Báo cáo khảo sát quy trình bán hàng.pdf', key: 'haidang-survey', visibility: 'shared', kind: 'report', uploaded_by: 'u_member_quang', uploaded_at: c.at(-35, '17:00') }),
    makeFile({ id: 'f_haidang_lead_flow', account_id: ACC, project_id: P, task_id: 't_haidang_lead_flow', name: 'Quy trình phân bổ khách hàng tiềm năng.pdf', key: 'haidang-lead-flow', visibility: 'shared', kind: 'document', uploaded_by: 'u_member_quang', uploaded_at: c.at(-3, '09:00') }),
    makeFile({ id: 'f_haidang_pipeline', account_id: ACC, project_id: P, task_id: 't_haidang_ui', name: 'Thiết kế giỏ hàng căn hộ (bản nháp).svg', key: 'haidang-pipeline', visibility: 'internal', kind: 'design', uploaded_by: 'u_member_linh', uploaded_at: c.at(-2, '17:00'), note: 'Bản nháp nội bộ' }),
    makeFile({ id: 'f_haidang_projects', account_id: ACC, project_id: P, task_id: 't_haidang_projects_data', name: 'Danh sách dự án và bảng giá.pdf', key: 'haidang-projects', visibility: 'shared', kind: 'data', uploaded_by: KHANG, uploaded_at: c.at(-1, '11:20') }),
  ];

  const A = activityMaker(ACC);
  const activities = [
    A('act_haidang_01', KHANG, 'task.confirmed', 'task', 't_haidang_scope', { task: 'Xác nhận phạm vi CRM cho 2 sàn giao dịch' }, 'shared', c.at(-55, '10:00')),
    A('act_haidang_02', KHANG, 'task.approved', 'task', 't_haidang_survey_approval', { task: 'Duyệt báo cáo khảo sát quy trình bán hàng' }, 'shared', c.at(-30, '14:00')),
    A('act_haidang_03', AM, 'milestone.completed', 'milestone', 'ms_haidang_survey', { milestone: 'Khảo sát', project: 'CRM bán hàng dự án' }, 'shared', c.at(-28, '17:00')),
    A('act_haidang_04', AM, 'user.invited', 'user', VY, { to: 'Lâm Tường Vy' }, 'internal', c.at(-4, '10:00')),
    A('act_haidang_05', 'u_member_quang', 'file.uploaded', 'file', 'f_haidang_lead_flow', { file: 'Quy trình phân bổ khách hàng tiềm năng.pdf' }, 'shared', c.at(-3, '09:00')),
    A('act_haidang_06', KHANG, 'task.files_submitted', 'task', 't_haidang_projects_data', { task: 'Cung cấp danh sách dự án và bảng giá căn hộ', file: 'Danh sách dự án và bảng giá.pdf' }, 'shared', c.at(-1, '11:20')),
  ];

  return { accounts: [account], users, contacts, projects, milestones, tasks, task_dependencies, comments, files, activities };
}
