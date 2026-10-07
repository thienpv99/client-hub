// Cơ điện Thiên Trường — ATTENTION (yellow): installment 2 is invoiced and 12 days overdue, with its client
// payment task (overdue, holding no milestone). Delivery itself is on plan.

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

const ACC = 'acc_thientruong';
const AM = 'u_am_ducanh';
const HUNG = 'u_client_hung';
const THAO = 'u_client_thao';
const SON = 'u_client_son';
const P = 'prj_thientruong_mes';

export const THIENTRUONG_INVOICE_2 = '0000528';

export function buildThienTruong(c: SeedCtx): Partial<Bundle> {
  const account = makeAccount({
    id: ACC,
    name: 'Cơ điện Thiên Trường',
    short_name: 'Thiên Trường',
    brand_color: '#9A3412',
    industry: 'Sản xuất',
    tier: 'key',
    stage: 'implementing',
    am_id: AM,
    email_domain: 'thientruong.com.vn',
    exec_summary: [
      'Thiết kế hệ thống MES đã được duyệt; team đang lập trình phân hệ kế hoạch sản xuất.',
      `Đợt thanh toán 2 (hoàn thành thiết kế) đến hạn ${c.dm(-12)}, đang chờ phòng Kế toán xác nhận.`,
      `Mốc UAT dự kiến ${c.dm(45)}, đúng kế hoạch.`,
    ],
    exec_summary_updated_at: c.at(-5, '11:00'),
    internal_notes: 'Kế toán báo dòng tiền đang chờ thu từ đơn hàng xuất khẩu. Anh Hùng rất quan tâm kết nối máy CNC — có thể mở rộng sang nhà máy thứ 2.',
    created_at: c.at(-190, '09:00'),
    updated_at: c.at(-5, '11:00'),
  });

  const client = (u: Parameters<typeof makeUser>[0]) =>
    makeUser({ account_id: ACC, invited_by: AM, status: 'active', notification_pref: 'all', ...u });
  const users = [
    client({ id: HUNG, full_name: 'Ngô Văn Hùng', email: 'hung.ngo@thientruong.com.vn', phone: '0913 247 680', role: 'client_owner', title: 'Tổng giám đốc', salutation: 'anh', notification_pref: 'digest_and_urgent', invited_at: c.at(-176, '10:00'), onboarded_at: c.at(-175, '06:40'), last_login_at: c.at(-6, '06:55') }),
    client({ id: THAO, full_name: 'Lê Phương Thảo', email: 'thao.le@thientruong.com.vn', phone: '0989 316 520', role: 'client_member', title: 'Kế toán trưởng', salutation: 'chị', invited_at: c.at(-176, '10:05'), onboarded_at: c.at(-170, '14:00'), last_login_at: c.at(-4, '15:20') }),
    client({ id: SON, full_name: 'Bùi Trường Sơn', email: 'son.bui@thientruong.com.vn', phone: '0936 508 271', role: 'client_member', title: 'Giám đốc nhà máy', salutation: 'anh', invited_at: c.at(-170, '09:00'), onboarded_at: c.at(-169, '07:30'), last_login_at: c.at(-1, '07:35') }),
  ];

  const contacts = [
    makeContact({ id: 'ct_thientruong_hung', account_id: ACC, full_name: 'Ngô Văn Hùng', salutation: 'anh', title: 'Tổng giám đốc', decision_role: 'decision_maker', email: 'hung.ngo@thientruong.com.vn', phone: '0913 247 680', user_id: HUNG, last_interaction_at: c.at(-6, '10:00'), last_interaction_note: 'Báo cáo tiến độ lập trình; anh đề nghị ưu tiên kết nối máy CNC.' }),
    makeContact({ id: 'ct_thientruong_thao', account_id: ACC, full_name: 'Lê Phương Thảo', salutation: 'chị', title: 'Kế toán trưởng', decision_role: 'approver', email: 'thao.le@thientruong.com.vn', phone: '0989 316 520', user_id: THAO, last_interaction_at: c.at(-4, '15:30'), last_interaction_note: 'Chị báo đã trình Tổng giám đốc ký ủy nhiệm chi đợt 2.' }),
    makeContact({ id: 'ct_thientruong_son', account_id: ACC, full_name: 'Bùi Trường Sơn', salutation: 'anh', title: 'Giám đốc nhà máy', decision_role: 'ops_contact', email: 'son.bui@thientruong.com.vn', phone: '0936 508 271', user_id: SON, last_interaction_at: c.at(-1, '16:00'), last_interaction_note: 'Đã gửi định mức nguyên vật liệu.' }),
  ];

  const projects = [makeProject(P, ACC, 'Hệ thống quản lý sản xuất (MES)', 'TT-MES', c.d(-175), c.d(95))];

  const milestones = makeMilestones(c, P, [
    { id: 'ms_thientruong_kickoff', name: 'Kickoff', planned: -170, done: -170, doneTime: '15:00' },
    { id: 'ms_thientruong_survey', name: 'Khảo sát', planned: -130, done: -131, description: 'Khảo sát quy trình sản xuất tại 3 xưởng.' },
    { id: 'ms_thientruong_design', name: 'Thiết kế', planned: -42, done: -42 },
    { id: 'ms_thientruong_dev', name: 'Phát triển', planned: 20, description: 'Kế hoạch sản xuất, điều phối lệnh, xuất kho nguyên vật liệu, kết nối máy CNC.' },
    { id: 'ms_thientruong_uat', name: 'UAT', planned: 45 },
    { id: 'ms_thientruong_golive', name: 'Go-live', planned: 60 },
    { id: 'ms_thientruong_support', name: 'Hỗ trợ sau go-live', planned: 90 },
  ]);

  const t = taskMaker(c, AM);
  const tasks = [
    t({ id: 't_thientruong_kickoff', project_id: P, milestone_id: 'ms_thientruong_kickoff', title: 'Tổ chức kickoff tại nhà máy', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(-170), status: 'done', completed_at: c.at(-170, '12:00') }),
    t({ id: 't_thientruong_scope', project_id: P, milestone_id: 'ms_thientruong_kickoff', title: 'Xác nhận phạm vi triển khai cho 3 xưởng', side: 'client', type: 'confirm', assignee_id: HUNG, due_date: c.d(-171), status: 'done', completed_at: c.at(-172, '09:30'), answer_text: 'Đồng ý triển khai trước cho xưởng cơ khí, xưởng sơn và xưởng lắp ráp.', impact_text: `Nếu chưa xác nhận trước ${c.dm(-171)}, New Era chưa thể chốt kế hoạch khảo sát. Mốc Khảo sát ${c.dm(-130)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thientruong_process', project_id: P, milestone_id: 'ms_thientruong_survey', title: 'Cung cấp quy trình sản xuất hiện tại của 3 xưởng', side: 'client', type: 'upload', assignee_id: SON, due_date: c.d(-140), status: 'done', completed_at: c.at(-141, '16:00'), impact_text: `Nếu chưa có quy trình trước ${c.dm(-140)}, team New Era chưa thể khảo sát chi tiết. Mốc Khảo sát ${c.dm(-130)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thientruong_survey', project_id: P, milestone_id: 'ms_thientruong_survey', title: 'Khảo sát quy trình tại 3 xưởng', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(-132), status: 'done', completed_at: c.at(-133, '17:00') }),
    t({ id: 't_thientruong_design', project_id: P, milestone_id: 'ms_thientruong_design', title: 'Thiết kế màn hình điều phối lệnh sản xuất', side: 'internal', type: 'work', assignee_id: 'u_member_linh', due_date: c.d(-50), status: 'done', completed_at: c.at(-51, '18:00') }),
    t({ id: 't_thientruong_design_approval', project_id: P, milestone_id: 'ms_thientruong_design', title: 'Duyệt thiết kế màn hình điều phối lệnh sản xuất', side: 'client', type: 'approval', assignee_id: HUNG, due_date: c.d(-44), status: 'done', completed_at: c.at(-45, '07:10'), impact_text: `Nếu chưa duyệt trước ${c.dm(-44)}, team New Era chưa thể lập trình phân hệ kế hoạch sản xuất. Mốc Thiết kế ${c.dm(-42)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thientruong_payment2', project_id: P, title: 'Thanh toán đợt 2 – Hoàn thành thiết kế', side: 'client', type: 'payment', assignee_id: THAO, payment_schedule_id: 'ps_thientruong_2', due_date: c.d(-12), reminder_count: 1, last_reminded_at: c.at(-5, '10:00'), created_at: c.at(-27, '10:05'), description: `Hóa đơn số ${THIENTRUONG_INVOICE_2} đã gửi ngày ${c.dm(-27)}. Sau khi chuyển khoản, chị bấm "Báo đã chuyển khoản" và đính kèm ủy nhiệm chi.`, impact_text: `Đợt 2 theo hợp đồng TT-MES đến hạn ${c.dm(-12)}. Khi nhận được chứng từ, New Era xác nhận trong 1 ngày làm việc để hồ sơ nghiệm thu UAT ${c.dm(45)} không còn công nợ treo.` }),
    t({ id: 't_thientruong_planning_dev', project_id: P, milestone_id: 'ms_thientruong_dev', title: 'Lập trình phân hệ kế hoạch sản xuất', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(14), status: 'in_progress', created_at: c.at(-40, '09:00'), impact_text: `Nếu chưa xong trước ${c.dm(14)}, mốc Phát triển ${c.dm(20)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thientruong_bom', project_id: P, milestone_id: 'ms_thientruong_dev', title: 'Cung cấp định mức nguyên vật liệu cho 120 mã sản phẩm', side: 'client', type: 'upload', assignee_id: SON, due_date: c.d(10), status: 'waiting', created_at: c.at(-20, '09:00'), updated_at: c.at(-1, '16:00'), description: 'Định mức theo mẫu đính kèm: mã sản phẩm, mã nguyên vật liệu, số lượng và hao hụt cho phép.', impact_text: `Nếu chưa có định mức trước ${c.dm(10)}, team New Era chưa thể lập trình và kiểm thử phân hệ xuất kho nguyên vật liệu. Mốc UAT ${c.dm(45)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thientruong_inventory_dev', project_id: P, milestone_id: 'ms_thientruong_dev', title: 'Lập trình phân hệ xuất kho nguyên vật liệu', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(18), created_at: c.at(-20, '09:05'), impact_text: `Nếu chưa xong trước ${c.dm(18)}, mốc UAT ${c.dm(45)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thientruong_shift_answer', project_id: P, milestone_id: 'ms_thientruong_dev', title: 'Trả lời số ca làm việc áp dụng cho xưởng lắp ráp', side: 'client', type: 'answer', assignee_id: SON, due_date: c.d(8), created_at: c.at(-2, '10:00'), description: 'Xưởng lắp ráp chạy 2 ca hay 3 ca từ quý tới? Giờ bắt đầu mỗi ca?', impact_text: `Nếu chưa có câu trả lời trước ${c.dm(8)}, team New Era chưa thể cấu hình lịch ca cho xưởng lắp ráp. Mốc Phát triển ${c.dm(20)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thientruong_shift_config', project_id: P, milestone_id: 'ms_thientruong_dev', title: 'Cấu hình lịch ca làm việc cho 3 xưởng', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(16), created_at: c.at(-2, '10:05'), impact_text: `Nếu chưa xong trước ${c.dm(16)}, mốc Phát triển ${c.dm(20)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thientruong_iot', project_id: P, milestone_id: 'ms_thientruong_dev', title: 'Kết nối dữ liệu máy CNC qua cổng IoT', side: 'internal', type: 'work', assignee_id: 'u_member_tuan', due_date: c.d(19), status: 'in_progress', created_at: c.at(-25, '09:00'), impact_text: `Nếu chưa xong trước ${c.dm(19)}, mốc UAT ${c.dm(45)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thientruong_trial_attend', project_id: P, milestone_id: 'ms_thientruong_dev', title: 'Xác nhận tham dự buổi chạy thử tại xưởng cơ khí', side: 'client', type: 'attend', assignee_id: SON, due_date: c.d(15), created_at: c.at(-2, '11:00'), impact_text: `Nếu chưa xác nhận trước ${c.dm(15)}, New Era chưa thể chốt lịch chạy thử. Mốc Phát triển ${c.dm(20)} sẽ lùi theo số ngày trễ.` }),
    t({ id: 't_thientruong_collection', project_id: P, title: 'Theo dõi công nợ đợt 2 với phòng Kế toán', side: 'internal', type: 'work', assignee_id: AM, due_date: c.d(3), status: 'in_progress', client_visible: false, created_at: c.at(-11, '09:00') }),
    t({ id: 't_thientruong_uat_plan', project_id: P, milestone_id: 'ms_thientruong_uat', title: 'Soạn kịch bản UAT cho 3 xưởng', side: 'internal', type: 'work', assignee_id: 'u_member_quang', due_date: c.d(35), created_at: c.at(-3, '09:00') }),
    t({ id: 't_thientruong_training', project_id: P, milestone_id: 'ms_thientruong_golive', title: 'Chuẩn bị tài liệu đào tạo tổ trưởng ca', side: 'internal', type: 'work', assignee_id: 'u_member_linh', due_date: c.d(50), created_at: c.at(-3, '09:10') }),
  ];

  const dep = depMaker(c, AM);
  const task_dependencies = [
    dep('dep_thientruong_01', 't_thientruong_design_approval', { task: 't_thientruong_planning_dev' }, -50),
    dep('dep_thientruong_02', 't_thientruong_planning_dev', { milestone: 'ms_thientruong_dev' }, -40),
    dep('dep_thientruong_03', 't_thientruong_bom', { task: 't_thientruong_inventory_dev' }, -20),
    dep('dep_thientruong_04', 't_thientruong_inventory_dev', { milestone: 'ms_thientruong_uat' }, -20),
    dep('dep_thientruong_05', 't_thientruong_shift_answer', { task: 't_thientruong_shift_config' }, -2),
    dep('dep_thientruong_06', 't_thientruong_shift_config', { milestone: 'ms_thientruong_dev' }, -2),
    dep('dep_thientruong_07', 't_thientruong_iot', { milestone: 'ms_thientruong_uat' }, -25),
    dep('dep_thientruong_08', 't_thientruong_process', { task: 't_thientruong_survey' }, -150),
  ];

  const comments = [
    makeComment('cm_thientruong_01', 't_thientruong_payment2', AM, `Chị Thảo giúp em kiểm tra khoản đợt 2 (hóa đơn ${THIENTRUONG_INVOICE_2}). Khi chuyển khoản xong chị bấm "Báo đã chuyển khoản" và đính kèm ủy nhiệm chi là được ạ.`, 'shared', c.at(-5, '10:00')),
    makeComment('cm_thientruong_02', 't_thientruong_payment2', THAO, 'Chị đã trình anh Hùng ký, dự kiến chuyển trong tuần sau.', 'shared', c.at(-4, '15:30')),
    makeComment('cm_thientruong_03', 't_thientruong_collection', AM, 'Kế toán đang chờ thu từ đơn hàng xuất khẩu, có thể trễ thêm 1 tuần. Chưa cần leo thang, theo dõi đến thứ Sáu.', 'internal', c.at(-4, '16:00')),
    makeComment('cm_thientruong_04', 't_thientruong_bom', 'u_member_quang', 'File định mức thiếu 14 mã bán thành phẩm, cần đối chiếu với anh Sơn trước khi chấp nhận.', 'internal', c.at(-1, '17:10')),
    makeComment('cm_thientruong_05', 't_thientruong_iot', 'u_member_tuan', 'Đã kết nối thử 4/12 máy CNC tại xưởng cơ khí, dữ liệu cập nhật mỗi 30 giây.', 'shared', c.at(-3, '17:40')),
    makeComment('cm_thientruong_06', 't_thientruong_iot', 'u_member_tuan', 'Cổng IoT của 3 máy đời cũ không hỗ trợ giao thức chuẩn, có thể cần thêm bộ chuyển đổi (khoảng 9 triệu/máy).', 'internal', c.at(-2, '09:30')),
  ];

  const files = [
    makeFile({ id: 'f_thientruong_contract', account_id: ACC, project_id: P, name: 'Hợp đồng TT-MES (bản ký).pdf', key: 'thientruong-contract', visibility: 'shared', kind: 'contract', uploaded_by: AM, uploaded_at: c.at(-175, '16:00') }),
    makeFile({ id: 'f_thientruong_survey', account_id: ACC, project_id: P, name: 'Báo cáo khảo sát 3 xưởng.pdf', key: 'thientruong-survey', visibility: 'shared', kind: 'report', uploaded_by: 'u_member_quang', uploaded_at: c.at(-133, '17:00') }),
    makeFile({ id: 'f_thientruong_design', account_id: ACC, project_id: P, task_id: 't_thientruong_design_approval', name: 'Thiết kế màn hình điều phối lệnh sản xuất.svg', key: 'thientruong-dashboard', visibility: 'shared', kind: 'design', uploaded_by: 'u_member_linh', uploaded_at: c.at(-51, '18:00') }),
    makeFile({ id: 'f_thientruong_invoice2', account_id: ACC, project_id: P, task_id: 't_thientruong_payment2', name: `Hóa đơn đợt 2 – số ${THIENTRUONG_INVOICE_2}.pdf`, key: 'thientruong-invoice-2', visibility: 'shared', kind: 'document', uploaded_by: AM, uploaded_at: c.at(-27, '10:00') }),
    makeFile({ id: 'f_thientruong_bom_tpl', account_id: ACC, project_id: P, task_id: 't_thientruong_bom', name: 'Mẫu khai báo định mức nguyên vật liệu.pdf', key: 'tpl-bom', visibility: 'shared', kind: 'data', uploaded_by: 'u_member_quang', uploaded_at: c.at(-20, '09:00') }),
    makeFile({ id: 'f_thientruong_bom', account_id: ACC, project_id: P, task_id: 't_thientruong_bom', name: 'Định mức nguyên vật liệu – 120 mã.pdf', key: 'thientruong-bom', visibility: 'shared', kind: 'data', uploaded_by: SON, uploaded_at: c.at(-1, '16:00') }),
  ];

  const A = activityMaker(ACC);
  const activities = [
    A('act_thientruong_01', HUNG, 'task.confirmed', 'task', 't_thientruong_scope', { task: 'Xác nhận phạm vi triển khai cho 3 xưởng' }, 'shared', c.at(-172, '09:30')),
    A('act_thientruong_02', SON, 'task.files_submitted', 'task', 't_thientruong_process', { task: 'Cung cấp quy trình sản xuất hiện tại của 3 xưởng' }, 'shared', c.at(-141, '16:00')),
    A('act_thientruong_03', HUNG, 'task.approved', 'task', 't_thientruong_design_approval', { task: 'Duyệt thiết kế màn hình điều phối lệnh sản xuất' }, 'shared', c.at(-45, '07:10')),
    A('act_thientruong_04', AM, 'milestone.completed', 'milestone', 'ms_thientruong_design', { milestone: 'Thiết kế', project: 'Hệ thống quản lý sản xuất (MES)' }, 'shared', c.at(-42, '17:00')),
    A('act_thientruong_05', AM, 'task.reminded', 'task', 't_thientruong_payment2', { task: 'Thanh toán đợt 2 – Hoàn thành thiết kế', to: 'Lê Phương Thảo' }, 'internal', c.at(-5, '10:00')),
    A('act_thientruong_06', SON, 'task.files_submitted', 'task', 't_thientruong_bom', { task: 'Cung cấp định mức nguyên vật liệu cho 120 mã sản phẩm', file: 'Định mức nguyên vật liệu – 120 mã.pdf' }, 'shared', c.at(-1, '16:00')),
  ];

  return { accounts: [account], users, contacts, projects, milestones, tasks, task_dependencies, comments, files, activities };
}
