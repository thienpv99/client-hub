// Ngân hàng Thịnh An — implementing phase 1 on plan (green) while phase 2 is negotiated:
// quote v1 came back with change requests, v2 (≈15 % effective discount) waits for director approval (see deals1.ts).

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

const ACC = 'acc_thinhan';
const AM = 'u_am_ha';
const LONG = 'u_client_long';
const MAI = 'u_client_mai';
const P = 'prj_thinhan_corp';

export function buildThinhAn(c: SeedCtx): Partial<Bundle> {
  const account = makeAccount({
    id: ACC,
    name: 'Ngân hàng Thịnh An',
    short_name: 'Thịnh An',
    brand_color: '#1E3A8A',
    industry: 'Ngân hàng',
    tier: 'strategic',
    stage: 'implementing',
    am_id: AM,
    email_domain: 'thinhanbank.vn',
    exec_summary: [
      'Giai đoạn 1 (Cổng ngân hàng số doanh nghiệp) đã xong khảo sát, đang thiết kế giải pháp.',
      'Báo giá giai đoạn 2 đã điều chỉnh theo góp ý của anh Long; New Era sẽ gửi bản 2 trong tuần.',
      `Mốc Thiết kế giải pháp dự kiến ${c.dm(10)}, đang đúng kế hoạch.`,
    ],
    exec_summary_updated_at: c.at(-2, '17:45'),
    internal_notes: 'Khối CNTT rất chặt về bảo mật: mọi tài liệu kỹ thuật gửi qua kênh mã hóa. Giai đoạn 2 đang cạnh tranh với một nhà cung cấp khác.',
    created_at: c.at(-62, '09:00'),
    updated_at: c.at(-1, '09:40'),
  });

  const client = (u: Parameters<typeof makeUser>[0]) =>
    makeUser({ account_id: ACC, invited_by: AM, status: 'active', notification_pref: 'all', ...u });
  const users = [
    client({ id: LONG, full_name: 'Vũ Thành Long', email: 'long.vu@thinhanbank.vn', phone: '0904 552 318', role: 'client_owner', title: 'Phó Tổng giám đốc', salutation: 'anh', notification_pref: 'digest_and_urgent', invited_at: c.at(-55, '10:00'), onboarded_at: c.at(-54, '07:50'), last_login_at: c.at(-2, '07:45') }),
    client({ id: MAI, full_name: 'Đinh Ngọc Mai', email: 'mai.dinh@thinhanbank.vn', phone: '0912 870 455', role: 'client_member', title: 'Giám đốc khối Công nghệ thông tin', salutation: 'chị', invited_at: c.at(-55, '10:05'), onboarded_at: c.at(-53, '09:15'), last_login_at: c.at(-2, '17:10') }),
  ];

  const contacts = [
    makeContact({ id: 'ct_thinhan_long', account_id: ACC, full_name: 'Vũ Thành Long', salutation: 'anh', title: 'Phó Tổng giám đốc', decision_role: 'decision_maker', email: 'long.vu@thinhanbank.vn', phone: '0904 552 318', user_id: LONG, last_interaction_at: c.at(-3, '15:00'), last_interaction_note: 'Trao đổi về báo giá giai đoạn 2; anh muốn bổ sung đào tạo cho chi nhánh.' }),
    makeContact({ id: 'ct_thinhan_mai', account_id: ACC, full_name: 'Đinh Ngọc Mai', salutation: 'chị', title: 'Giám đốc khối Công nghệ thông tin', decision_role: 'approver', email: 'mai.dinh@thinhanbank.vn', phone: '0912 870 455', user_id: MAI, last_interaction_at: c.at(-9, '14:00'), last_interaction_note: 'Họp với chị Mai thống nhất danh mục tài liệu API core banking cần cho giai đoạn tích hợp.' }),
    makeContact({ id: 'ct_thinhan_bao', account_id: ACC, full_name: 'Trịnh Quốc Bảo', salutation: 'anh', title: 'Trưởng phòng Pháp chế', decision_role: 'ops_contact', email: 'bao.trinh@thinhanbank.vn', phone: '0983 214 660', last_interaction_at: c.at(-49, '11:00'), last_interaction_note: 'Hoàn tất rà soát thỏa thuận bảo mật.' }),
  ];

  const projects = [makeProject(P, ACC, 'Cổng ngân hàng số doanh nghiệp', 'TA-CB', c.d(-50), c.d(110))];

  const milestones = makeMilestones(c, P, [
    { id: 'ms_thinhan_kickoff', name: 'Kickoff', planned: -48, done: -48, doneTime: '16:00' },
    { id: 'ms_thinhan_survey', name: 'Khảo sát', planned: -21, done: -21, doneTime: '16:00', description: 'Khảo sát 6 phòng nghiệp vụ khối khách hàng doanh nghiệp.' },
    { id: 'ms_thinhan_design', name: 'Thiết kế giải pháp', planned: 10, description: 'Kiến trúc, phân quyền theo hạn mức, luồng phê duyệt và đối soát.' },
    { id: 'ms_thinhan_dev', name: 'Phát triển', planned: 48 },
    { id: 'ms_thinhan_security', name: 'Kiểm thử bảo mật', planned: 70, description: 'Đơn vị độc lập kiểm thử xâm nhập theo quy định của ngân hàng.' },
    { id: 'ms_thinhan_uat', name: 'UAT', planned: 85 },
    { id: 'ms_thinhan_golive', name: 'Go-live', planned: 100 },
  ]);

  const t = taskMaker(c, AM);
  const tasks = [
    t({ id: 't_thinhan_nda', project_id: P, milestone_id: 'ms_thinhan_kickoff', title: 'Ký thỏa thuận bảo mật thông tin', side: 'client', type: 'sign', assignee_id: LONG, due_date: c.d(-47), status: 'done', completed_at: c.at(-48, '17:00'), created_at: c.at(-52, '10:00'), impact_text: `Nếu chưa ký trước ${c.dm(-47)}, New Era chưa thể nhận tài liệu nội bộ để khảo sát. Mốc Khảo sát ${c.dm(-21)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thinhan_kickoff_plan', project_id: P, milestone_id: 'ms_thinhan_kickoff', title: 'Lập kế hoạch triển khai chi tiết', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(-48), status: 'done', completed_at: c.at(-49, '17:00') }),
    t({ id: 't_thinhan_interviews', project_id: P, milestone_id: 'ms_thinhan_survey', title: 'Phỏng vấn 6 phòng nghiệp vụ khối doanh nghiệp', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(-30), status: 'done', completed_at: c.at(-31, '17:00') }),
    t({ id: 't_thinhan_survey_report', project_id: P, milestone_id: 'ms_thinhan_survey', title: 'Hoàn thiện báo cáo khảo sát hiện trạng', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(-25), status: 'done', completed_at: c.at(-26, '18:00'), impact_text: `Nếu chưa xong trước ${c.dm(-25)}, anh Long chưa có báo cáo để duyệt. Mốc Khảo sát ${c.dm(-21)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thinhan_survey_approval', project_id: P, milestone_id: 'ms_thinhan_survey', title: 'Duyệt báo cáo khảo sát hiện trạng', side: 'client', type: 'approval', assignee_id: LONG, due_date: c.d(-22), status: 'done', completed_at: c.at(-23, '10:30'), description: 'Báo cáo hiện trạng quy trình chuyển tiền, phê duyệt và đối soát của khối doanh nghiệp.', impact_text: `Nếu chưa duyệt trước ${c.dm(-22)}, team New Era chưa thể bắt đầu thiết kế giải pháp. Mốc Thiết kế giải pháp ${c.dm(10)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thinhan_quote_p2', project_id: P, title: 'Chấp thuận báo giá Giai đoạn 2 – Phân hệ tín dụng doanh nghiệp', side: 'client', type: 'approval', assignee_id: LONG, requires_owner: true, quote_id: 'q_thinhan_p2_v1', due_date: c.d(-7), status: 'done', completed_at: c.at(-10, '16:20'), created_at: c.at(-14, '09:30'), answer_text: 'Đề nghị điều chỉnh: giảm ngày công lập trình, tăng ưu đãi bản quyền, bổ sung đào tạo cho 11 chi nhánh.', description: 'Báo giá bản 1 cho giai đoạn 2. Anh Long đã gửi đề nghị điều chỉnh; New Era đang chuẩn bị bản 2.', impact_text: `Nếu chưa phản hồi trước ${c.dm(-7)}, New Era chưa thể giữ nguồn lực cho giai đoạn 2 ngay sau Go-live ${c.dm(100)}.` }),
    t({ id: 't_thinhan_security_policy', project_id: P, milestone_id: 'ms_thinhan_design', title: 'Cung cấp chính sách phân quyền và hạn mức phê duyệt', side: 'client', type: 'upload', assignee_id: MAI, due_date: c.d(6), created_at: c.at(-10, '10:00'), description: 'Bản hiện hành của quy định phân quyền giao dịch và hạn mức phê duyệt cho khách hàng doanh nghiệp.', impact_text: `Nếu chưa có chính sách trước ${c.dm(6)}, team New Era chưa thể thiết kế phân quyền người dùng theo quy định của ngân hàng. Mốc Thiết kế giải pháp ${c.dm(10)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thinhan_core_api', project_id: P, milestone_id: 'ms_thinhan_design', title: 'Cung cấp tài liệu kết nối core banking', side: 'client', type: 'upload', assignee_id: MAI, due_date: c.d(8), status: 'waiting', created_at: c.at(-12, '10:00'), updated_at: c.at(-2, '17:15'), description: 'Tài liệu API truy vấn số dư, lập lệnh chuyển tiền và đối soát cuối ngày.', impact_text: `Nếu chưa có tài liệu trước ${c.dm(8)}, team New Era chưa thể thiết kế luồng đối soát giao dịch. Mốc Thiết kế giải pháp ${c.dm(10)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thinhan_workshop', project_id: P, milestone_id: 'ms_thinhan_design', title: 'Xác nhận tham dự workshop luồng phê duyệt chuyển tiền', side: 'client', type: 'attend', assignee_id: LONG, due_date: c.d(5), created_at: c.at(-3, '14:00'), description: 'Workshop 2 giờ tại hội sở để chốt các bước phê duyệt theo hạn mức.', impact_text: `Nếu chưa xác nhận trước ${c.dm(5)}, New Era chưa thể chốt luồng phê duyệt chuyển tiền. Mốc Thiết kế giải pháp ${c.dm(10)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thinhan_payment2', project_id: P, title: 'Thanh toán đợt 2 – Hoàn thành khảo sát', side: 'client', type: 'payment', assignee_id: LONG, payment_schedule_id: 'ps_thinhan_2', due_date: c.d(9), created_at: c.at(-6, '10:00'), description: 'Hóa đơn đợt 2 đã gửi qua email. Sau khi chuyển khoản, anh bấm "Báo đã chuyển khoản" và đính kèm chứng từ.', impact_text: `Đợt 2 theo hợp đồng TA-CB đến hạn ${c.dm(9)}. Sau ngày này khoản thanh toán sẽ được ghi nhận là quá hạn.` }),
    t({ id: 't_thinhan_uat_people', project_id: P, milestone_id: 'ms_thinhan_uat', title: 'Xác nhận danh sách người tham gia UAT', side: 'client', type: 'confirm', assignee_id: MAI, due_date: c.d(30), created_at: c.at(-3, '14:10'), impact_text: `Nếu chưa xác nhận trước ${c.dm(30)}, New Era chưa thể cấp tài khoản và lên lịch UAT. Mốc UAT ${c.dm(85)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thinhan_architecture', project_id: P, milestone_id: 'ms_thinhan_design', title: 'Soạn tài liệu kiến trúc giải pháp', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(8), status: 'in_progress', created_at: c.at(-18, '09:00'), impact_text: `Nếu chưa xong trước ${c.dm(8)}, mốc Thiết kế giải pháp ${c.dm(10)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thinhan_permissions', project_id: P, milestone_id: 'ms_thinhan_design', title: 'Thiết kế phân quyền người dùng theo hạn mức', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(9), created_at: c.at(-10, '10:05'), impact_text: `Nếu chưa xong trước ${c.dm(9)}, mốc Thiết kế giải pháp ${c.dm(10)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thinhan_transfer_flow', project_id: P, milestone_id: 'ms_thinhan_design', title: 'Thiết kế luồng phê duyệt chuyển tiền', side: 'internal', type: 'work', assignee_id: 'u_member_linh', due_date: c.d(7), status: 'in_progress', created_at: c.at(-15, '09:00') }),
    t({ id: 't_thinhan_reconcile', project_id: P, milestone_id: 'ms_thinhan_design', title: 'Thiết kế luồng đối soát giao dịch', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(9), created_at: c.at(-12, '10:05'), impact_text: `Nếu chưa xong trước ${c.dm(9)}, mốc Thiết kế giải pháp ${c.dm(10)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thinhan_p2_prep', project_id: P, title: 'Chuẩn bị báo giá giai đoạn 2 bản điều chỉnh', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(-1), status: 'done', completed_at: c.at(-2, '16:00'), client_visible: false, created_at: c.at(-9, '09:00') }),
    t({ id: 't_thinhan_infra', project_id: P, milestone_id: 'ms_thinhan_dev', title: 'Chuẩn bị hạ tầng máy chủ tại trung tâm dữ liệu của ngân hàng', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(25), status: 'waiting', created_at: c.at(-7, '09:00'), description: 'Đã gửi yêu cầu cấu hình; chờ khối CNTT cấp quyền truy cập trung tâm dữ liệu.' }),
    t({ id: 't_thinhan_pentest', project_id: P, milestone_id: 'ms_thinhan_security', title: 'Đặt lịch đơn vị kiểm thử bảo mật độc lập', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(40), created_at: c.at(-5, '09:00') }),
  ];

  const dep = depMaker(c, AM);
  const task_dependencies = [
    dep('dep_thinhan_01', 't_thinhan_security_policy', { task: 't_thinhan_permissions' }, -10),
    dep('dep_thinhan_02', 't_thinhan_permissions', { milestone: 'ms_thinhan_design' }, -10),
    dep('dep_thinhan_03', 't_thinhan_core_api', { task: 't_thinhan_reconcile' }, -12),
    dep('dep_thinhan_04', 't_thinhan_reconcile', { milestone: 'ms_thinhan_design' }, -12),
    dep('dep_thinhan_05', 't_thinhan_architecture', { milestone: 'ms_thinhan_design' }, -18),
    dep('dep_thinhan_06', 't_thinhan_survey_report', { task: 't_thinhan_survey_approval' }, -35),
    dep('dep_thinhan_07', 't_thinhan_survey_approval', { milestone: 'ms_thinhan_survey' }, -35),
    dep('dep_thinhan_08', 't_thinhan_nda', { task: 't_thinhan_interviews' }, -50),
    dep('dep_thinhan_09', 't_thinhan_uat_people', { milestone: 'ms_thinhan_uat' }, -3),
  ];

  const comments = [
    makeComment('cm_thinhan_01', 't_thinhan_security_policy', AM, 'Chị Mai gửi giúp em bản quy định phân quyền và hạn mức hiện hành, file PDF là được ạ.', 'shared', c.at(-3, '10:00')),
    makeComment('cm_thinhan_02', 't_thinhan_core_api', MAI, 'Gửi New Era tài liệu API bản 3.2, phần đối soát cuối ngày ở mục 5.', 'shared', c.at(-2, '17:20')),
    makeComment('cm_thinhan_03', 't_thinhan_core_api', 'u_member_quang', 'Tài liệu chưa mô tả mã lỗi khi hết thời gian chờ; đã ghi lại để hỏi chị Mai trong buổi họp thứ Năm.', 'internal', c.at(-1, '10:00')),
    makeComment('cm_thinhan_04', 't_thinhan_p2_prep', AM, 'Anh Long đang so sánh với một nhà cung cấp khác. Đề xuất chiết khấu hiệu lực 15% để giữ giai đoạn 2. Cần anh Nam duyệt.', 'internal', c.at(-2, '16:10')),
    makeComment('cm_thinhan_05', 't_thinhan_architecture', 'u_member_tuan', 'Ngân hàng yêu cầu triển khai tại trung tâm dữ liệu riêng; cần xác nhận lại bản quyền hệ quản trị cơ sở dữ liệu trước khi chốt kiến trúc.', 'internal', c.at(-4, '11:00')),
    makeComment('cm_thinhan_06', 't_thinhan_transfer_flow', 'u_member_linh', 'Bản nháp luồng phê duyệt đã xong, team sẽ trình bày trong workshop tuần sau.', 'shared', c.at(-1, '15:00')),
  ];

  const files = [
    makeFile({ id: 'f_thinhan_proposal', account_id: ACC, project_id: P, name: 'Đề xuất giải pháp Cổng ngân hàng số doanh nghiệp.pdf', key: 'thinhan-proposal', visibility: 'shared', kind: 'document', uploaded_by: AM, uploaded_at: c.at(-60, '15:00') }),
    makeFile({ id: 'f_thinhan_contract', account_id: ACC, project_id: P, name: 'Hợp đồng TA-CB (bản ký).pdf', key: 'thinhan-contract', visibility: 'shared', kind: 'contract', uploaded_by: AM, uploaded_at: c.at(-50, '16:00') }),
    makeFile({ id: 'f_thinhan_survey', account_id: ACC, project_id: P, task_id: 't_thinhan_survey_approval', name: 'Báo cáo khảo sát hiện trạng.pdf', key: 'thinhan-survey', visibility: 'shared', kind: 'report', uploaded_by: 'u_member_quang', uploaded_at: c.at(-26, '18:00') }),
    makeFile({ id: 'f_thinhan_core_api', account_id: ACC, project_id: P, task_id: 't_thinhan_core_api', name: 'Tài liệu API core banking v3.2.pdf', key: 'thinhan-core-api', visibility: 'shared', kind: 'data', uploaded_by: MAI, uploaded_at: c.at(-2, '17:15') }),
    makeFile({ id: 'f_thinhan_flow', account_id: ACC, project_id: P, task_id: 't_thinhan_transfer_flow', name: 'Luồng phê duyệt chuyển tiền (bản nháp).svg', key: 'thinhan-flow', visibility: 'internal', kind: 'design', uploaded_by: 'u_member_linh', uploaded_at: c.at(-1, '14:30'), note: 'Bản nháp nội bộ, chưa gửi khách' }),
    makeFile({ id: 'f_thinhan_p2_analysis', account_id: ACC, task_id: 't_thinhan_p2_prep', name: 'Phân tích chiết khấu giai đoạn 2.pdf', key: 'thinhan-p2-analysis', visibility: 'internal', kind: 'document', uploaded_by: AM, uploaded_at: c.at(-2, '16:00') }),
  ];

  const A = activityMaker(ACC);
  const activities = [
    A('act_thinhan_01', LONG, 'task.signed_submitted', 'task', 't_thinhan_nda', { task: 'Ký thỏa thuận bảo mật thông tin' }, 'shared', c.at(-48, '15:00')),
    A('act_thinhan_02', AM, 'task.submission_accepted', 'task', 't_thinhan_nda', { task: 'Ký thỏa thuận bảo mật thông tin' }, 'shared', c.at(-48, '17:00')),
    A('act_thinhan_03', LONG, 'task.approved', 'task', 't_thinhan_survey_approval', { task: 'Duyệt báo cáo khảo sát hiện trạng' }, 'shared', c.at(-23, '10:30')),
    A('act_thinhan_04', AM, 'milestone.completed', 'milestone', 'ms_thinhan_survey', { milestone: 'Khảo sát', project: 'Cổng ngân hàng số doanh nghiệp' }, 'shared', c.at(-21, '16:00')),
    A('act_thinhan_05', AM, 'task.created', 'task', 't_thinhan_security_policy', { task: 'Cung cấp chính sách phân quyền và hạn mức phê duyệt' }, 'shared', c.at(-10, '10:00')),
    A('act_thinhan_06', MAI, 'task.files_submitted', 'task', 't_thinhan_core_api', { task: 'Cung cấp tài liệu kết nối core banking', file: 'Tài liệu API core banking v3.2.pdf' }, 'shared', c.at(-2, '17:15')),
    A('act_thinhan_07', 'u_member_linh', 'file.uploaded', 'file', 'f_thinhan_flow', { file: 'Luồng phê duyệt chuyển tiền (bản nháp).svg' }, 'internal', c.at(-1, '14:30')),
  ];

  return { accounts: [account], users, contacts, projects, milestones, tasks, task_dependencies, comments, files, activities };
}
