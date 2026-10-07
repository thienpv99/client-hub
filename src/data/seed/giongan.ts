// Năng lượng Gió Ngàn — BLOCKED by New Era: the internal, client-visible task "Hoàn thiện tích hợp dữ liệu SCADA"
// is 4 days overdue and directly holds milestone UAT (forecast +4, Go-live cascades +4). No client task is late.
// Milestone Thiết kế completed 3 days ago → installment 3 is 'invoice_due' (see deals2.ts).

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

const ACC = 'acc_giongan';
const AM = 'u_am_ducanh';
const PHUONG = 'u_client_phuong';
const TAI = 'u_client_tai';
const P = 'prj_giongan_ops';

export function buildGioNgan(c: SeedCtx): Partial<Bundle> {
  const account = makeAccount({
    id: ACC,
    name: 'Năng lượng Gió Ngàn',
    short_name: 'Gió Ngàn',
    brand_color: '#0E7490',
    industry: 'Năng lượng',
    tier: 'key',
    stage: 'implementing',
    am_id: AM,
    email_domain: 'giongan.vn',
    exec_summary: [
      `Thiết kế bảng điều khiển vận hành đã hoàn thành ngày ${c.dm(-3)}; team đang lập trình.`,
      `Tích hợp dữ liệu SCADA chậm so với kế hoạch ${c.dm(-4)} do trang trại đổi giao thức; New Era đã bổ sung kỹ sư.`,
      `Mốc UAT dự báo lùi từ ${c.dm(16)} sang ${c.dm(20)}; New Era sẽ cập nhật ngay khi tích hợp xong.`,
    ],
    exec_summary_updated_at: c.at(-1, '09:00'),
    internal_notes: 'Chị Phương đánh giá cao tính minh bạch, cần báo trễ sớm. Chi phí kỹ sư bổ sung New Era chịu, không tính vào hợp đồng.',
    created_at: c.at(-150, '09:00'),
    updated_at: c.at(-1, '09:00'),
  });

  const client = (u: Parameters<typeof makeUser>[0]) =>
    makeUser({ account_id: ACC, invited_by: AM, status: 'active', notification_pref: 'all', ...u });
  const users = [
    client({ id: PHUONG, full_name: 'Mai Thanh Phương', email: 'phuong.mai@giongan.vn', phone: '0918 662 734', role: 'client_owner', title: 'Giám đốc điều hành', salutation: 'chị', invited_at: c.at(-136, '10:00'), onboarded_at: c.at(-135, '20:15'), last_login_at: c.at(-1, '20:30') }),
    client({ id: TAI, full_name: 'Trương Đức Tài', email: 'tai.truong@giongan.vn', phone: '0975 140 328', role: 'client_member', title: 'Trưởng phòng Kỹ thuật vận hành', salutation: 'anh', invited_at: c.at(-136, '10:05'), onboarded_at: c.at(-134, '08:00'), last_login_at: c.at(-2, '14:00') }),
  ];

  const contacts = [
    makeContact({ id: 'ct_giongan_phuong', account_id: ACC, full_name: 'Mai Thanh Phương', salutation: 'chị', title: 'Giám đốc điều hành', decision_role: 'decision_maker', email: 'phuong.mai@giongan.vn', phone: '0918 662 734', user_id: PHUONG, last_interaction_at: c.at(-1, '10:00'), last_interaction_note: 'Báo trước việc tích hợp SCADA chậm và kế hoạch bù; chị đồng ý theo dõi đến cuối tuần.' }),
    makeContact({ id: 'ct_giongan_tai', account_id: ACC, full_name: 'Trương Đức Tài', salutation: 'anh', title: 'Trưởng phòng Kỹ thuật vận hành', decision_role: 'approver', email: 'tai.truong@giongan.vn', phone: '0975 140 328', user_id: TAI, last_interaction_at: c.at(-2, '14:05'), last_interaction_note: 'Đã trả lời về thời gian lưu dữ liệu lịch sử.' }),
    makeContact({ id: 'ct_giongan_dinh', account_id: ACC, full_name: 'Lương Văn Định', salutation: 'anh', title: 'Trưởng ca vận hành', decision_role: 'ops_contact', email: 'dinh.luong@giongan.vn', phone: '0961 375 902', last_interaction_at: c.at(-30, '09:00'), last_interaction_note: 'Hỗ trợ team khảo sát tại trung tâm điều hành.' }),
  ];

  const projects = [makeProject(P, ACC, 'Nền tảng giám sát vận hành trang trại gió', 'GN-OPS', c.d(-135), c.d(60))];

  const milestones = makeMilestones(c, P, [
    { id: 'ms_giongan_kickoff', name: 'Kickoff', planned: -130, done: -130, doneTime: '15:00' },
    { id: 'ms_giongan_survey', name: 'Khảo sát', planned: -100, done: -100, description: 'Khảo sát hệ thống SCADA và quy trình vận hành 42 tua-bin.' },
    { id: 'ms_giongan_design', name: 'Thiết kế', planned: -4, done: -3 },
    { id: 'ms_giongan_dev', name: 'Phát triển', planned: 6 },
    { id: 'ms_giongan_uat', name: 'UAT', planned: 16, description: 'Chạy thử song song với hệ thống hiện tại trong 5 ngày.' },
    { id: 'ms_giongan_golive', name: 'Go-live', planned: 30 },
  ]);

  const t = taskMaker(c, AM);
  const tasks = [
    t({ id: 't_giongan_kickoff', project_id: P, milestone_id: 'ms_giongan_kickoff', title: 'Tổ chức kickoff tại trang trại gió', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(-130), status: 'done', completed_at: c.at(-130, '11:00') }),
    t({ id: 't_giongan_scope', project_id: P, milestone_id: 'ms_giongan_kickoff', title: 'Xác nhận phạm vi giám sát 42 tua-bin', side: 'client', type: 'confirm', assignee_id: PHUONG, due_date: c.d(-130), status: 'done', completed_at: c.at(-131, '20:00'), answer_text: 'Đồng ý, gồm cả trạm biến áp 110 kV.', impact_text: `Nếu chưa xác nhận trước ${c.dm(-130)}, New Era chưa thể chốt kế hoạch khảo sát. Mốc Khảo sát ${c.dm(-100)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_scada_docs', project_id: P, milestone_id: 'ms_giongan_survey', title: 'Cung cấp sơ đồ đấu nối và tài liệu giao thức SCADA', side: 'client', type: 'upload', assignee_id: TAI, due_date: c.d(-104), status: 'done', completed_at: c.at(-105, '15:00'), impact_text: `Nếu chưa có tài liệu trước ${c.dm(-104)}, team New Era chưa thể khảo sát hệ thống SCADA. Mốc Khảo sát ${c.dm(-100)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_survey', project_id: P, milestone_id: 'ms_giongan_survey', title: 'Khảo sát hệ thống SCADA hiện hữu', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(-101), status: 'done', completed_at: c.at(-102, '17:00') }),
    t({ id: 't_giongan_design', project_id: P, milestone_id: 'ms_giongan_design', title: 'Thiết kế bảng điều khiển vận hành', side: 'internal', type: 'work', assignee_id: 'u_member_linh', due_date: c.d(-9), status: 'done', completed_at: c.at(-10, '18:00') }),
    t({ id: 't_giongan_design_approval', project_id: P, milestone_id: 'ms_giongan_design', title: 'Duyệt thiết kế bảng điều khiển vận hành', side: 'client', type: 'approval', assignee_id: PHUONG, due_date: c.d(-6), status: 'done', completed_at: c.at(-7, '16:00'), impact_text: `Nếu chưa duyệt trước ${c.dm(-6)}, team New Era chưa thể lập trình bảng điều khiển. Mốc Thiết kế ${c.dm(-4)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_vpn', project_id: P, milestone_id: 'ms_giongan_dev', title: 'Cấp tài khoản VPN cho kỹ sư New Era', side: 'client', type: 'confirm', assignee_id: TAI, due_date: c.d(-18), status: 'done', completed_at: c.at(-20, '11:00'), answer_text: 'Đã cấp 3 tài khoản VPN, hiệu lực đến hết dự án.', impact_text: `Nếu chưa có VPN trước ${c.dm(-18)}, kỹ sư New Era chưa thể kết nối dữ liệu từ trang trại. Mốc Phát triển ${c.dm(6)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_scada', project_id: P, milestone_id: 'ms_giongan_dev', title: 'Hoàn thiện tích hợp dữ liệu SCADA', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(-4), status: 'in_progress', created_at: c.at(-25, '09:00'), description: 'Đọc dữ liệu công suất, tốc độ gió, rung và nhiệt độ của 42 tua-bin theo giao thức mới của trang trại.', impact_text: `Nếu chưa xong trước ${c.dm(-4)}, mốc UAT ${c.dm(16)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_dashboard_dev', project_id: P, milestone_id: 'ms_giongan_dev', title: 'Lập trình bảng điều khiển vận hành', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(5), status: 'in_progress', created_at: c.at(-8, '09:00'), impact_text: `Nếu chưa xong trước ${c.dm(5)}, mốc Phát triển ${c.dm(6)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_history_answer', project_id: P, milestone_id: 'ms_giongan_dev', title: 'Trả lời thời gian lưu dữ liệu lịch sử', side: 'client', type: 'answer', assignee_id: TAI, due_date: c.d(5), status: 'done', completed_at: c.at(-2, '14:00'), created_at: c.at(-6, '10:00'), answer_text: 'Lưu dữ liệu chi tiết từng phút trong 2 năm, dữ liệu tổng hợp theo giờ trong 10 năm.', impact_text: `Nếu chưa có câu trả lời trước ${c.dm(5)}, team New Era chưa thể thiết kế kho dữ liệu lịch sử. Mốc Phát triển ${c.dm(6)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_report_dev', project_id: P, milestone_id: 'ms_giongan_dev', title: 'Lập trình báo cáo sản lượng điện theo ngày', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(6), status: 'in_progress', created_at: c.at(-6, '10:05'), impact_text: `Nếu chưa xong trước ${c.dm(6)}, mốc Phát triển ${c.dm(6)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_alert_rules', project_id: P, milestone_id: 'ms_giongan_uat', title: 'Xác nhận ngưỡng cảnh báo rung và nhiệt độ', side: 'client', type: 'confirm', assignee_id: TAI, due_date: c.d(9), created_at: c.at(-3, '10:00'), description: 'Bảng ngưỡng đề xuất theo khuyến nghị của hãng tua-bin, anh xác nhận hoặc ghi ngưỡng muốn dùng.', impact_text: `Nếu chưa xác nhận trước ${c.dm(9)}, team New Era chưa thể cấu hình cảnh báo tự động. Mốc UAT ${c.dm(16)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_alert_config', project_id: P, milestone_id: 'ms_giongan_uat', title: 'Cấu hình cảnh báo tự động theo ngưỡng', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(13), created_at: c.at(-3, '10:05'), impact_text: `Nếu chưa xong trước ${c.dm(13)}, mốc UAT ${c.dm(16)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_uat_script', project_id: P, milestone_id: 'ms_giongan_uat', title: 'Soạn kịch bản UAT cho ca vận hành', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(10), created_at: c.at(-5, '09:00') }),
    t({ id: 't_giongan_uat_env', project_id: P, milestone_id: 'ms_giongan_uat', title: 'Chuẩn bị môi trường UAT', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(12), client_visible: false, created_at: c.at(-5, '09:05') }),
    t({ id: 't_giongan_uat_attend', project_id: P, milestone_id: 'ms_giongan_uat', title: 'Xác nhận tham dự UAT tại trung tâm điều hành', side: 'client', type: 'attend', assignee_id: PHUONG, due_date: c.d(12), created_at: c.at(-3, '10:10'), impact_text: `Nếu chưa xác nhận trước ${c.dm(12)}, New Era chưa thể chốt lịch UAT. Mốc UAT ${c.dm(16)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_giongan_extra_engineer', project_id: P, title: 'Bổ sung kỹ sư tích hợp cho giai đoạn phát triển', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(-1), status: 'done', completed_at: c.at(-2, '11:00'), client_visible: false, created_at: c.at(-3, '08:30') }),
    t({ id: 't_giongan_training', project_id: P, milestone_id: 'ms_giongan_golive', title: 'Đào tạo kỹ sư vận hành sử dụng hệ thống', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(26), created_at: c.at(-3, '09:00') }),
  ];

  const dep = depMaker(c, AM);
  const task_dependencies = [
    dep('dep_giongan_01', 't_giongan_scada', { milestone: 'ms_giongan_uat' }, -25),
    dep('dep_giongan_02', 't_giongan_alert_rules', { task: 't_giongan_alert_config' }, -3),
    dep('dep_giongan_03', 't_giongan_alert_config', { milestone: 'ms_giongan_uat' }, -3),
    dep('dep_giongan_04', 't_giongan_dashboard_dev', { milestone: 'ms_giongan_dev' }, -8),
    dep('dep_giongan_05', 't_giongan_report_dev', { milestone: 'ms_giongan_dev' }, -6),
    dep('dep_giongan_06', 't_giongan_design_approval', { task: 't_giongan_dashboard_dev' }, -12),
    dep('dep_giongan_07', 't_giongan_history_answer', { task: 't_giongan_report_dev' }, -6),
    dep('dep_giongan_08', 't_giongan_scada_docs', { task: 't_giongan_survey' }, -110),
    dep('dep_giongan_09', 't_giongan_vpn', { task: 't_giongan_scada' }, -25),
  ];

  const comments = [
    makeComment('cm_giongan_01', 't_giongan_scada', 'u_member_tuan', 'Trang trại vừa nâng cấp SCADA lên giao thức mới, team đang viết lại bộ chuyển đổi dữ liệu. Dự kiến xong trong tuần này.', 'shared', c.at(-2, '18:00')),
    makeComment('cm_giongan_02', 't_giongan_scada', AM, 'Đã điều thêm 1 kỹ sư hỗ trợ. Nếu thứ Sáu chưa xong cần báo chị Phương lùi UAT chính thức.', 'internal', c.at(-1, '08:30')),
    makeComment('cm_giongan_03', 't_giongan_alert_rules', AM, 'Anh Tài xem giúp em bảng ngưỡng đề xuất trong file đính kèm ạ.', 'shared', c.at(-3, '10:20')),
    makeComment('cm_giongan_04', 't_giongan_uat_env', 'u_member_tuan', 'Máy chủ UAT đang dùng chung với môi trường demo, cần tách trước khi khách vào chạy thử.', 'internal', c.at(-4, '17:00')),
    makeComment('cm_giongan_05', 't_giongan_extra_engineer', AM, 'Chi phí phát sinh khoảng 30 ngày công, New Era chịu. Không đưa vào báo giá hay hợp đồng.', 'internal', c.at(-2, '11:00')),
  ];

  const files = [
    makeFile({ id: 'f_giongan_contract', account_id: ACC, project_id: P, name: 'Hợp đồng GN-OPS (bản ký).pdf', key: 'giongan-contract', visibility: 'shared', kind: 'contract', uploaded_by: AM, uploaded_at: c.at(-135, '16:00') }),
    makeFile({ id: 'f_giongan_survey', account_id: ACC, project_id: P, name: 'Báo cáo khảo sát hệ thống SCADA.pdf', key: 'giongan-survey', visibility: 'shared', kind: 'report', uploaded_by: 'u_member_tuan', uploaded_at: c.at(-102, '17:00') }),
    makeFile({ id: 'f_giongan_dashboard', account_id: ACC, project_id: P, task_id: 't_giongan_design_approval', name: 'Thiết kế bảng điều khiển vận hành.svg', key: 'giongan-dashboard', visibility: 'shared', kind: 'design', uploaded_by: 'u_member_linh', uploaded_at: c.at(-10, '18:00') }),
    makeFile({ id: 'f_giongan_thresholds', account_id: ACC, project_id: P, task_id: 't_giongan_alert_rules', name: 'Bảng ngưỡng cảnh báo đề xuất.pdf', key: 'giongan-thresholds', visibility: 'shared', kind: 'document', uploaded_by: 'u_member_quang', uploaded_at: c.at(-3, '10:00') }),
    makeFile({ id: 'f_giongan_scada_notes', account_id: ACC, project_id: P, task_id: 't_giongan_scada', name: 'Ghi chú kỹ thuật giao thức SCADA mới.pdf', key: 'giongan-scada-notes', visibility: 'internal', kind: 'document', uploaded_by: 'u_member_tuan', uploaded_at: c.at(-2, '17:30') }),
  ];

  const A = activityMaker(ACC);
  const activities = [
    A('act_giongan_01', PHUONG, 'task.confirmed', 'task', 't_giongan_scope', { task: 'Xác nhận phạm vi giám sát 42 tua-bin' }, 'shared', c.at(-131, '20:00')),
    A('act_giongan_02', TAI, 'task.files_submitted', 'task', 't_giongan_scada_docs', { task: 'Cung cấp sơ đồ đấu nối và tài liệu giao thức SCADA' }, 'shared', c.at(-105, '15:00')),
    A('act_giongan_03', PHUONG, 'task.approved', 'task', 't_giongan_design_approval', { task: 'Duyệt thiết kế bảng điều khiển vận hành' }, 'shared', c.at(-7, '16:00')),
    A('act_giongan_04', AM, 'milestone.completed', 'milestone', 'ms_giongan_design', { milestone: 'Thiết kế', project: 'Nền tảng giám sát vận hành trang trại gió' }, 'shared', c.at(-3, '17:00')),
    A('act_giongan_05', TAI, 'task.answered', 'task', 't_giongan_history_answer', { task: 'Trả lời thời gian lưu dữ liệu lịch sử' }, 'shared', c.at(-2, '14:00')),
    A('act_giongan_06', AM, 'task.updated', 'task', 't_giongan_scada', { task: 'Hoàn thiện tích hợp dữ liệu SCADA', note: 'Bổ sung 1 kỹ sư tích hợp' }, 'internal', c.at(-1, '08:35')),
  ];

  return { accounts: [account], users, contacts, projects, milestones, tasks, task_dependencies, comments, files, activities };
}
