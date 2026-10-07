// Quotes, contracts, installments and commercial activities — Gió Ngàn, Hải Đăng, Mây Trắng.

import type { Bundle, SeedCtx } from './helpers';
import { activityMaker } from './helpers';
import { makeContract, makeInstallments, makeLines, makeQuote, quoteGrandTotal, vnd } from './catalog';

export function buildDealsGioNgan(c: SeedCtx): Partial<Bundle> {
  const ACC = 'acc_giongan';
  const AM = 'u_am_ducanh';
  const PHUONG = 'u_client_phuong';
  // effective discount ≈ 10,4 % (> 10 %) → approved by the director before sending
  const mainLines = makeLines('q_giongan_main_v1', [
    ['pi_svc_ba', 25, 4_500_000, 0, 10],
    ['pi_svc_ux', 18, 4_200_000, 0, 10],
    ['pi_svc_dev', 150, 4_000_000, 0, 10],
    ['pi_svc_qa', 30, 3_200_000, 0, 10],
    ['pi_svc_pm', 20, 4_800_000, 0, 10],
    ['pi_lic_ent', 1, 480_000_000, 20, 0],
    ['pi_cld_mth', 12, 18_000_000, 0, 10],
  ]);
  const quotes = [
    makeQuote({ id: 'q_giongan_main_v1', account_id: ACC, project_id: 'prj_giongan_ops', code: `BG-GN-${c.y(-146)}-01`, title: 'Nền tảng giám sát vận hành trang trại gió', status: 'accepted', valid_until: c.d(-115), discount_pct_total: 5, approval_requested_at: c.at(-144, '10:00'), approval_requested_by: AM, director_approved_by: 'u_director', director_approved_at: c.at(-143, '08:30'), approval_note: 'Đồng ý, khách hàng trọng điểm ngành năng lượng.', sent_at: c.at(-142, '09:00'), sent_by: AM, client_decision: 'accepted', client_decided_by: PHUONG, client_decided_at: c.at(-138, '20:00'), notes: 'Bản quyền doanh nghiệp, không giới hạn người dùng. Gồm 12 tháng hạ tầng đám mây.', internal_note: 'Ưu đãi 20% bản quyền để vào ngành năng lượng.', created_by: AM, created_at: c.at(-146, '14:00') }),
  ];
  const value = quoteGrandTotal(mainLines, 5);
  const contracts = [
    makeContract({ id: 'c_giongan_ops', account_id: ACC, quote_id: 'q_giongan_main_v1', code: `HĐ-GN-${c.y(-135)}-01`, title: 'Hợp đồng triển khai nền tảng giám sát vận hành', value, signed_date: c.d(-135), start_date: c.d(-135), end_date: c.d(60), status: 'active', file_id: 'f_giongan_contract' }),
  ];
  const payment_schedules = makeInstallments('c_giongan_ops', value, [
    { id: 'ps_giongan_1', name: 'Đợt 1 – Ký hợp đồng', percent: 30, milestone_id: 'ms_giongan_kickoff', due_date: c.d(-128), status: 'paid', invoice_no: '0000150', invoiced_at: c.at(-132, '10:00'), paid_at: c.at(-126, '15:00') },
    { id: 'ps_giongan_2', name: 'Đợt 2 – Hoàn thành khảo sát', percent: 20, milestone_id: 'ms_giongan_survey', due_date: c.d(-85), status: 'paid', invoice_no: '0000231', invoiced_at: c.at(-98, '10:00'), paid_at: c.at(-86, '14:30') },
    // milestone Thiết kế completed 3 days ago → due for invoicing
    { id: 'ps_giongan_3', name: 'Đợt 3 – Hoàn thành thiết kế', percent: 20, milestone_id: 'ms_giongan_design', due_date: c.d(12), status: 'invoice_due' },
    { id: 'ps_giongan_4', name: 'Đợt 4 – Go-live', percent: 30, milestone_id: 'ms_giongan_golive', due_date: c.d(40), status: 'not_due' },
  ]);
  const A = activityMaker(ACC);
  const q = 'Nền tảng giám sát vận hành trang trại gió';
  const activities = [
    A('act_giongan_p1', AM, 'quote.approval_requested', 'quote', 'q_giongan_main_v1', { quote: q, version: 1 }, 'internal', c.at(-144, '10:00')),
    A('act_giongan_p2', 'u_director', 'quote.approved', 'quote', 'q_giongan_main_v1', { quote: q, version: 1, note: 'Đồng ý, khách hàng trọng điểm ngành năng lượng.' }, 'internal', c.at(-143, '08:30')),
    A('act_giongan_p3', AM, 'quote.sent', 'quote', 'q_giongan_main_v1', { quote: q, version: 1 }, 'shared', c.at(-142, '09:00')),
    A('act_giongan_p4', PHUONG, 'quote.accepted', 'quote', 'q_giongan_main_v1', { quote: q, version: 1 }, 'shared', c.at(-138, '20:00')),
    A('act_giongan_p5', AM, 'payment.paid', 'payment', 'ps_giongan_1', { note: 'Đợt 1 – Ký hợp đồng', amount: vnd(payment_schedules[0].amount) }, 'shared', c.at(-126, '15:05')),
    A('act_giongan_p6', AM, 'payment.paid', 'payment', 'ps_giongan_2', { note: 'Đợt 2 – Hoàn thành khảo sát', amount: vnd(payment_schedules[1].amount) }, 'shared', c.at(-86, '14:35')),
    A('act_giongan_p7', null, 'payment.invoice_due', 'payment', 'ps_giongan_3', { note: 'Đợt 3 – Hoàn thành thiết kế', amount: vnd(payment_schedules[2].amount), milestone: 'Thiết kế' }, 'internal', c.at(-3, '17:01')),
  ];
  return { quotes, quote_lines: mainLines, contracts, payment_schedules, activities };
}

export function buildDealsHaiDang(c: SeedCtx): Partial<Bundle> {
  const ACC = 'acc_haidang';
  const AM = 'u_am_ha';
  const mainLines = makeLines('q_haidang_main_v1', [
    ['pi_svc_ba', 20, 4_500_000, 0, 10],
    ['pi_svc_ux', 15, 4_200_000, 0, 10],
    ['pi_svc_dev', 90, 4_000_000, 0, 10],
    ['pi_svc_qa', 20, 3_200_000, 0, 10],
    ['pi_svc_pm', 15, 4_800_000, 0, 10],
    ['pi_lic_usr', 60, 3_600_000, 0, 0],
    ['pi_trn_pkg', 2, 24_000_000, 0, 10],
  ]);
  const trainingLines = makeLines('q_haidang_training_v1', [
    ['pi_trn_pkg', 4, 24_000_000, 0, 10, 'Đào tạo 60 nhân viên kinh doanh tại 2 sàn'],
    ['pi_svc_pm', 2, 4_800_000, 0, 10],
  ]);
  const quotes = [
    // signed on paper at Hải Đăng's office before the decision maker had a Client Hub login
    makeQuote({ id: 'q_haidang_main_v1', account_id: ACC, project_id: 'prj_haidang_crm', code: `BG-HD-${c.y(-65)}-01`, title: 'Triển khai CRM bán hàng dự án', status: 'accepted', valid_until: c.d(-34), sent_at: c.at(-63, '10:00'), sent_by: AM, client_decision: 'accepted', client_decided_at: c.at(-58, '15:00'), client_note: 'Ký hợp đồng trực tiếp tại văn phòng Hải Đăng.', notes: 'Triển khai cho 2 sàn giao dịch, 60 người dùng.', created_by: AM, created_at: c.at(-65, '14:00') }),
    makeQuote({ id: 'q_haidang_training_v1', account_id: ACC, project_id: 'prj_haidang_crm', code: `BG-HD-${c.y(-3)}-02`, title: 'Gói đào tạo bổ sung cho sàn giao dịch', status: 'sent', valid_until: c.d(28), sent_at: c.at(-2, '10:00'), sent_by: AM, notes: 'Lịch đào tạo linh hoạt theo ca làm việc của từng sàn.', created_by: AM, created_at: c.at(-3, '16:00') }),
  ];
  const value = quoteGrandTotal(mainLines, 0);
  const contracts = [
    makeContract({ id: 'c_haidang_crm', account_id: ACC, quote_id: 'q_haidang_main_v1', code: `HĐ-HD-${c.y(-57)}-01`, title: 'Hợp đồng triển khai CRM bán hàng dự án', value, signed_date: c.d(-57), start_date: c.d(-60), end_date: c.d(75), status: 'active', file_id: 'f_haidang_contract' }),
  ];
  const payment_schedules = makeInstallments('c_haidang_crm', value, [
    { id: 'ps_haidang_1', name: 'Đợt 1 – Ký hợp đồng', percent: 40, milestone_id: 'ms_haidang_kickoff', due_date: c.d(-50), status: 'paid', invoice_no: '0000391', invoiced_at: c.at(-56, '10:00'), paid_at: c.at(-53, '14:00') },
    { id: 'ps_haidang_2', name: 'Đợt 2 – Hoàn thành thiết kế', percent: 30, milestone_id: 'ms_haidang_design', due_date: c.d(15), status: 'not_due' },
    { id: 'ps_haidang_3', name: 'Đợt 3 – Go-live', percent: 30, milestone_id: 'ms_haidang_golive', due_date: c.d(70), status: 'not_due' },
  ]);
  const A = activityMaker(ACC);
  const activities = [
    A('act_haidang_p1', AM, 'contract.created', 'contract', 'c_haidang_crm', { quote: 'Triển khai CRM bán hàng dự án', amount: vnd(value) }, 'shared', c.at(-57, '16:00')),
    A('act_haidang_p2', AM, 'payment.paid', 'payment', 'ps_haidang_1', { note: 'Đợt 1 – Ký hợp đồng', amount: vnd(payment_schedules[0].amount) }, 'shared', c.at(-53, '14:05')),
    A('act_haidang_p3', AM, 'quote.sent', 'quote', 'q_haidang_training_v1', { quote: 'Gói đào tạo bổ sung cho sàn giao dịch', version: 1 }, 'shared', c.at(-2, '10:00')),
  ];
  return { quotes, quote_lines: [...mainLines, ...trainingLines], contracts, payment_schedules, activities };
}

export function buildDealsMayTrang(c: SeedCtx): Partial<Bundle> {
  const ACC = 'acc_maytrang';
  const AM = 'u_am_ducanh';
  const BINH = 'u_client_binh';
  const tmsLines = makeLines('q_maytrang_tms_v1', [
    ['pi_svc_ba', 25, 4_500_000, 0, 10],
    ['pi_svc_ux', 20, 4_200_000, 0, 10],
    ['pi_svc_dev', 140, 4_000_000, 0, 10],
    ['pi_svc_qa', 30, 3_200_000, 0, 10],
    ['pi_svc_pm', 20, 4_800_000, 0, 10],
    ['pi_lic_usr', 40, 3_600_000, 0, 0],
    ['pi_mig_pkg', 1, 60_000_000, 0, 10],
  ]);
  const opsLines = makeLines('q_maytrang_ops_v1', [
    ['pi_sup_mth', 12, 22_000_000, 0, 10],
    ['pi_cld_mth', 12, 18_000_000, 0, 10],
    ['pi_svc_dev', 60, 4_000_000, 0, 10, 'Phát triển mở rộng theo yêu cầu'],
  ]);
  const whLines = makeLines('q_maytrang_wh_v1', [
    ['pi_svc_dev', 90, 4_000_000, 0, 10],
    ['pi_svc_ux', 10, 4_200_000, 0, 10],
    ['pi_lic_usr', 15, 3_600_000, 0, 0],
  ]);
  const quotes = [
    makeQuote({ id: 'q_maytrang_tms_v1', account_id: ACC, project_id: 'prj_maytrang_tms', code: `BG-MT-${c.y(-272)}-01`, title: 'Triển khai hệ thống quản lý vận tải (TMS)', status: 'accepted', valid_until: c.d(-240), sent_at: c.at(-270, '10:00'), sent_by: AM, client_decision: 'accepted', client_decided_by: BINH, client_decided_at: c.at(-266, '21:00'), created_by: AM, created_at: c.at(-272, '14:00') }),
    makeQuote({ id: 'q_maytrang_ops_v1', account_id: ACC, project_id: 'prj_maytrang_ops', code: `BG-MT-${c.y(-110)}-02`, title: 'Hỗ trợ vận hành và mở rộng TMS', status: 'accepted', valid_until: c.d(-78), sent_at: c.at(-108, '10:00'), sent_by: AM, client_decision: 'accepted', client_decided_by: BINH, client_decided_at: c.at(-106, '20:30'), notes: 'Hỗ trợ 12 tháng kể từ ngày bàn giao vận hành.', created_by: AM, created_at: c.at(-110, '14:00') }),
    makeQuote({ id: 'q_maytrang_wh_v1', account_id: ACC, code: `BG-MT-${c.y(-72)}-03`, title: 'Phân hệ quản lý kho', status: 'expired', valid_until: c.d(-40), sent_at: c.at(-70, '10:00'), sent_by: AM, internal_note: 'Khách hoãn sang năm sau, liên hệ lại sau mùa cao điểm.', created_by: AM, created_at: c.at(-72, '14:00') }),
  ];
  const tmsValue = quoteGrandTotal(tmsLines, 0);
  const opsValue = quoteGrandTotal(opsLines, 0);
  const contracts = [
    makeContract({ id: 'c_maytrang_tms', account_id: ACC, quote_id: 'q_maytrang_tms_v1', code: `HĐ-MT-${c.y(-265)}-01`, title: 'Hợp đồng triển khai hệ thống quản lý vận tải', value: tmsValue, signed_date: c.d(-265), start_date: c.d(-265), end_date: c.d(-105), status: 'completed', file_id: 'f_maytrang_contract' }),
    makeContract({ id: 'c_maytrang_ops', account_id: ACC, quote_id: 'q_maytrang_ops_v1', code: `HĐ-MT-${c.y(-104)}-02`, title: 'Hợp đồng hỗ trợ vận hành và mở rộng TMS', value: opsValue, signed_date: c.d(-104), start_date: c.d(-104), end_date: c.d(120), status: 'active', file_id: 'f_maytrang_support_contract' }),
  ];
  const payment_schedules = [
    ...makeInstallments('c_maytrang_tms', tmsValue, [
      { id: 'ps_maytrang_tms_1', name: 'Đợt 1 – Ký hợp đồng', percent: 30, milestone_id: 'ms_maytrang_tms_kickoff', due_date: c.d(-258), status: 'paid', invoice_no: '0000021', invoiced_at: c.at(-262, '10:00'), paid_at: c.at(-255, '10:00') },
      { id: 'ps_maytrang_tms_2', name: 'Đợt 2 – Nghiệm thu UAT', percent: 40, milestone_id: 'ms_maytrang_tms_uat', due_date: c.d(-118), status: 'paid', invoice_no: '0000203', invoiced_at: c.at(-124, '10:00'), paid_at: c.at(-116, '15:00') },
      { id: 'ps_maytrang_tms_3', name: 'Đợt 3 – Go-live', percent: 30, milestone_id: 'ms_maytrang_tms_golive', due_date: c.d(-95), status: 'paid', invoice_no: '0000261', invoiced_at: c.at(-104, '10:00'), paid_at: c.at(-95, '11:00') },
    ]),
    ...makeInstallments('c_maytrang_ops', opsValue, [
      { id: 'ps_maytrang_ops_1', name: 'Đợt 1 – Bàn giao vận hành', percent: 25, milestone_id: 'ms_maytrang_ops_handover', due_date: c.d(-95), status: 'paid', invoice_no: '0000268', invoiced_at: c.at(-100, '10:00'), paid_at: c.at(-93, '10:00') },
      { id: 'ps_maytrang_ops_2', name: 'Đợt 2 – Tối ưu tuyến nội thành', percent: 25, milestone_id: 'ms_maytrang_ops_routes', due_date: c.d(-30), status: 'paid', invoice_no: '0000466', invoiced_at: c.at(-39, '10:00'), paid_at: c.at(-30, '16:00') },
      { id: 'ps_maytrang_ops_3', name: 'Đợt 3 – Rà soát vận hành lần 1', percent: 25, milestone_id: 'ms_maytrang_ops_review1', due_date: c.d(5), status: 'paid', invoice_no: '0000575', invoiced_at: c.at(-9, '10:00'), paid_at: c.at(-3, '10:00') },
      { id: 'ps_maytrang_ops_4', name: 'Đợt 4 – Rà soát vận hành lần 2', percent: 25, milestone_id: 'ms_maytrang_ops_review2', due_date: c.d(90), status: 'not_due' },
    ]),
  ];
  const byId = (id: string) => payment_schedules.find((p) => p.id === id)?.amount ?? 0;
  const A = activityMaker(ACC);
  const activities = [
    A('act_maytrang_p1', AM, 'payment.paid', 'payment', 'ps_maytrang_tms_3', { note: 'Đợt 3 – Go-live', amount: vnd(byId('ps_maytrang_tms_3')) }, 'shared', c.at(-95, '11:05')),
    A('act_maytrang_p2', AM, 'payment.invoiced', 'payment', 'ps_maytrang_ops_3', { note: 'Đợt 3 – Rà soát vận hành lần 1', amount: vnd(byId('ps_maytrang_ops_3')), date: c.dm(5) }, 'shared', c.at(-9, '10:00')),
    A('act_maytrang_p3', AM, 'payment.paid', 'payment', 'ps_maytrang_ops_3', { note: 'Đợt 3 – Rà soát vận hành lần 1', amount: vnd(byId('ps_maytrang_ops_3')) }, 'shared', c.at(-3, '10:05')),
  ];
  return { quotes, quote_lines: [...tmsLines, ...opsLines, ...whLines], contracts, payment_schedules, activities };
}
