// Quotes, contracts, installments and commercial activities — Cỏ Xanh, Thịnh An, Thiên Trường.
// Contract value = grand total (incl. VAT) of the accepted quote; installment amounts follow the percentages.

import type { Bundle, SeedCtx } from './helpers';
import { activityMaker } from './helpers';
import { makeContract, makeInstallments, makeLines, makeQuote, quoteGrandTotal, vnd } from './catalog';
import { THIENTRUONG_INVOICE_2 } from './thientruong';

export function buildDealsCoXanh(c: SeedCtx): Partial<Bundle> {
  const ACC = 'acc_coxanh';
  const AM = 'u_am_ha';
  const MINH = 'u_client_minh';
  const mainLines = makeLines('q_coxanh_main_v1', [
    ['pi_svc_ba', 25, 4_500_000, 0, 10],
    ['pi_svc_ux', 30, 4_200_000, 0, 10],
    ['pi_svc_dev', 160, 4_000_000, 0, 10],
    ['pi_svc_qa', 35, 3_200_000, 0, 10],
    ['pi_svc_pm', 25, 4_800_000, 0, 10],
    ['pi_lic_usr', 50, 3_240_000, 0, 0],
    ['pi_cld_mth', 12, 18_000_000, 0, 10],
    ['pi_trn_pkg', 2, 24_000_000, 0, 10],
  ]);
  const extLines = makeLines('q_coxanh_ext_v1', [
    ['pi_lic_usr', 20, 3_240_000, 0, 0, 'Đội bán hàng miền Nam'],
    ['pi_trn_pkg', 1, 24_000_000, 0, 10, 'Đào tạo người dùng mới'],
  ]);
  const quotes = [
    makeQuote({ id: 'q_coxanh_main_v1', account_id: ACC, project_id: 'prj_coxanh_app', code: `BG-CX-${c.y(-82)}-01`, title: 'Triển khai App bán hàng đa kênh', status: 'accepted', valid_until: c.d(-52), sent_at: c.at(-80, '15:00'), sent_by: AM, client_decision: 'accepted', client_decided_by: MINH, client_decided_at: c.at(-73, '11:00'), client_note: 'Đồng ý. Ưu tiên app trên điện thoại trước.', notes: 'Giá đã gồm 12 tháng hạ tầng đám mây. Bản quyền tính theo đơn giá ưu đãi của hợp đồng khung.', created_by: AM, created_at: c.at(-82, '10:00') }),
    makeQuote({ id: 'q_coxanh_ext_v1', account_id: ACC, project_id: 'prj_coxanh_app', code: `BG-CX-${c.y(-3)}-02`, title: 'Phụ lục mở rộng 20 người dùng', status: 'sent', valid_until: c.d(28), sent_at: c.at(-2, '15:30'), sent_by: AM, notes: 'Bản quyền 20 người dùng tính đến hết kỳ hợp đồng hiện tại, cùng đơn giá ưu đãi.', internal_note: 'Giữ đơn giá ưu đãi của hợp đồng khung, chiết khấu trong ngưỡng nên không cần duyệt.', created_by: AM, created_at: c.at(-3, '11:00') }),
  ];
  const value = quoteGrandTotal(mainLines, 0);
  const contracts = [
    makeContract({ id: 'c_coxanh_app', account_id: ACC, quote_id: 'q_coxanh_main_v1', code: `HĐ-CX-${c.y(-70)}-01`, title: 'Hợp đồng triển khai App bán hàng đa kênh', value, signed_date: c.d(-70), start_date: c.d(-70), end_date: c.d(40), status: 'active', file_id: 'f_coxanh_contract' }),
  ];
  const payment_schedules = makeInstallments('c_coxanh_app', value, [
    { id: 'ps_coxanh_1', name: 'Đợt 1 – Ký hợp đồng', percent: 30, milestone_id: 'ms_coxanh_kickoff', due_date: c.d(-66), status: 'paid', invoice_no: '0000318', invoiced_at: c.at(-69, '10:00'), paid_at: c.at(-66, '14:00') },
    { id: 'ps_coxanh_2', name: 'Đợt 2 – Hoàn thành khảo sát', percent: 20, milestone_id: 'ms_coxanh_survey', due_date: c.d(-35), status: 'paid', invoice_no: '0000402', invoiced_at: c.at(-42, '10:00'), paid_at: c.at(-36, '15:00') },
    { id: 'ps_coxanh_3', name: 'Đợt 3 – Hoàn thành thiết kế', percent: 25, milestone_id: 'ms_coxanh_design', due_date: c.d(9), status: 'not_due' },
    { id: 'ps_coxanh_4', name: 'Đợt 4 – Go-live', percent: 25, milestone_id: 'ms_coxanh_golive', due_date: c.d(45), status: 'not_due' },
  ]);
  const A = activityMaker(ACC);
  const activities = [
    A('act_coxanh_p1', AM, 'payment.paid', 'payment', 'ps_coxanh_1', { note: 'Đợt 1 – Ký hợp đồng', amount: vnd(payment_schedules[0].amount) }, 'shared', c.at(-66, '14:05')),
    A('act_coxanh_p2', AM, 'payment.paid', 'payment', 'ps_coxanh_2', { note: 'Đợt 2 – Hoàn thành khảo sát', amount: vnd(payment_schedules[1].amount) }, 'shared', c.at(-36, '15:05')),
  ];
  return { quotes, quote_lines: [...mainLines, ...extLines], contracts, payment_schedules, activities };
}

export function buildDealsThinhAn(c: SeedCtx): Partial<Bundle> {
  const ACC = 'acc_thinhan';
  const AM = 'u_am_ha';
  const LONG = 'u_client_long';
  const p1Lines = makeLines('q_thinhan_p1_v1', [
    ['pi_svc_ba', 30, 4_300_000, 0, 10],
    ['pi_svc_ux', 25, 4_200_000, 0, 10],
    ['pi_svc_dev', 120, 3_800_000, 0, 10],
    ['pi_svc_qa', 30, 3_200_000, 0, 10],
    ['pi_svc_pm', 25, 4_800_000, 0, 10],
    ['pi_lic_usr', 50, 3_600_000, 0, 0],
  ]);
  const supLines = makeLines('q_thinhan_sup_v1', [['pi_sup_247', 12, 42_000_000, 0, 10]]);
  // Phase 2: v1 → client asked for changes; v2 cuts dev days, raises the license discount and adds training.
  const v1Lines = makeLines('q_thinhan_p2_v1', [
    ['pi_svc_ba', 40, 4_300_000, 0, 10],
    ['pi_svc_dev', 80, 3_800_000, 0, 10],
    ['pi_svc_qa', 40, 3_200_000, 0, 10],
    ['pi_svc_pm', 30, 4_800_000, 0, 10],
    ['pi_lic_usr', 100, 3_600_000, 10, 0],
  ]);
  // effective discount = 1 − 1.101.600.000 / 1.296.000.000 = 15,00 % (> 10 % threshold)
  const v2Lines = makeLines('q_thinhan_p2_v2', [
    ['pi_svc_ba', 40, 4_300_000, 0, 10],
    ['pi_svc_dev', 60, 3_800_000, 0, 10],
    ['pi_svc_qa', 40, 3_200_000, 0, 10],
    ['pi_svc_pm', 30, 4_800_000, 0, 10],
    ['pi_lic_usr', 100, 3_600_000, 20, 0],
    ['pi_trn_pkg', 11, 24_000_000, 0, 10, 'Đào tạo cho 11 chi nhánh'],
  ]);
  const p2Code = `BG-TA-${c.y(-16)}-03`;
  const quotes = [
    makeQuote({ id: 'q_thinhan_p1_v1', account_id: ACC, project_id: 'prj_thinhan_corp', code: `BG-TA-${c.y(-58)}-01`, title: 'Giai đoạn 1 – Cổng ngân hàng số doanh nghiệp', status: 'accepted', valid_until: c.d(-28), discount_pct_total: 5, sent_at: c.at(-56, '10:00'), sent_by: AM, client_decision: 'accepted', client_decided_by: LONG, client_decided_at: c.at(-52, '10:00'), notes: 'Triển khai tại trung tâm dữ liệu của ngân hàng. Chiết khấu 5% trên tổng giá trị.', created_by: AM, created_at: c.at(-58, '14:00') }),
    makeQuote({ id: 'q_thinhan_sup_v1', account_id: ACC, code: `BG-TA-${c.y(-61)}-02`, title: 'Gói hỗ trợ vận hành 24/7', status: 'expired', valid_until: c.d(-30), sent_at: c.at(-60, '10:00'), sent_by: AM, notes: 'Áp dụng sau go-live giai đoạn 1.', created_by: AM, created_at: c.at(-61, '15:00') }),
    makeQuote({ id: 'q_thinhan_p2_v1', account_id: ACC, code: p2Code, title: 'Giai đoạn 2 – Phân hệ tín dụng doanh nghiệp', status: 'changes_requested', valid_until: c.d(16), discount_pct_total: 5, sent_at: c.at(-14, '09:30'), sent_by: AM, client_decision: 'changes_requested', client_decided_by: LONG, client_decided_at: c.at(-10, '16:20'), client_note: 'Đề nghị giảm số ngày công lập trình, tăng ưu đãi bản quyền và bổ sung đào tạo cho 11 chi nhánh.', notes: 'Báo giá có hiệu lực 30 ngày.', created_by: AM, created_at: c.at(-16, '14:00') }),
    makeQuote({ id: 'q_thinhan_p2_v2', account_id: ACC, code: p2Code, title: 'Giai đoạn 2 – Phân hệ tín dụng doanh nghiệp', version: 2, parent_id: 'q_thinhan_p2_v1', status: 'pending_approval', valid_until: c.d(28), discount_pct_total: 10, approval_requested_at: c.at(-1, '09:40'), approval_requested_by: AM, notes: `Đã điều chỉnh theo đề nghị ngày ${c.dm(-10)}: giảm ngày công lập trình, tăng ưu đãi bản quyền, bổ sung đào tạo cho 11 chi nhánh.`, internal_note: 'Khách đang so sánh với một nhà cung cấp khác. Chiết khấu hiệu lực 15% vượt ngưỡng, cần Giám đốc duyệt trước khi gửi.', created_by: AM, created_at: c.at(-2, '16:00') }),
  ];
  const value = quoteGrandTotal(p1Lines, 5);
  const contracts = [
    makeContract({ id: 'c_thinhan_cb', account_id: ACC, quote_id: 'q_thinhan_p1_v1', code: `HĐ-TA-${c.y(-50)}-01`, title: 'Hợp đồng triển khai Cổng ngân hàng số doanh nghiệp – Giai đoạn 1', value, signed_date: c.d(-50), start_date: c.d(-50), end_date: c.d(110), status: 'active', file_id: 'f_thinhan_contract' }),
  ];
  const payment_schedules = makeInstallments('c_thinhan_cb', value, [
    { id: 'ps_thinhan_1', name: 'Đợt 1 – Ký hợp đồng', percent: 30, milestone_id: 'ms_thinhan_kickoff', due_date: c.d(-45), status: 'paid', invoice_no: '0000377', invoiced_at: c.at(-49, '10:00'), paid_at: c.at(-44, '11:00') },
    { id: 'ps_thinhan_2', name: 'Đợt 2 – Hoàn thành khảo sát', percent: 20, milestone_id: 'ms_thinhan_survey', due_date: c.d(9), status: 'invoiced', invoice_no: '0000561', invoiced_at: c.at(-6, '10:00'), task_id: 't_thinhan_payment2' },
    { id: 'ps_thinhan_3', name: 'Đợt 3 – Hoàn thành thiết kế giải pháp', percent: 20, milestone_id: 'ms_thinhan_design', due_date: c.d(20), status: 'not_due' },
    { id: 'ps_thinhan_4', name: 'Đợt 4 – Go-live', percent: 30, milestone_id: 'ms_thinhan_golive', due_date: c.d(108), status: 'not_due' },
  ]);
  const A = activityMaker(ACC);
  const activities = [
    A('act_thinhan_p1', LONG, 'quote.accepted', 'quote', 'q_thinhan_p1_v1', { quote: 'Giai đoạn 1 – Cổng ngân hàng số doanh nghiệp', version: 1 }, 'shared', c.at(-52, '10:00')),
    A('act_thinhan_p2', AM, 'contract.created', 'contract', 'c_thinhan_cb', { quote: 'Giai đoạn 1 – Cổng ngân hàng số doanh nghiệp', amount: vnd(value) }, 'shared', c.at(-50, '16:00')),
    A('act_thinhan_p3', AM, 'payment.paid', 'payment', 'ps_thinhan_1', { note: 'Đợt 1 – Ký hợp đồng', amount: vnd(payment_schedules[0].amount) }, 'shared', c.at(-44, '11:05')),
    A('act_thinhan_p4', AM, 'quote.sent', 'quote', 'q_thinhan_p2_v1', { quote: 'Giai đoạn 2 – Phân hệ tín dụng doanh nghiệp', version: 1 }, 'shared', c.at(-14, '09:30')),
    A('act_thinhan_p5', LONG, 'quote.changes_requested', 'quote', 'q_thinhan_p2_v1', { quote: 'Giai đoạn 2 – Phân hệ tín dụng doanh nghiệp', version: 1, reason: 'Giảm ngày công lập trình, tăng ưu đãi bản quyền, bổ sung đào tạo cho 11 chi nhánh.' }, 'shared', c.at(-10, '16:20')),
    A('act_thinhan_p6', AM, 'payment.invoiced', 'payment', 'ps_thinhan_2', { note: 'Đợt 2 – Hoàn thành khảo sát', amount: vnd(payment_schedules[1].amount), date: c.dm(9) }, 'shared', c.at(-6, '10:00')),
    A('act_thinhan_p7', AM, 'quote.version_created', 'quote', 'q_thinhan_p2_v2', { quote: 'Giai đoạn 2 – Phân hệ tín dụng doanh nghiệp', version: 2 }, 'internal', c.at(-2, '16:00')),
    A('act_thinhan_p8', AM, 'quote.approval_requested', 'quote', 'q_thinhan_p2_v2', { quote: 'Giai đoạn 2 – Phân hệ tín dụng doanh nghiệp', version: 2, note: 'Chiết khấu hiệu lực 15%' }, 'internal', c.at(-1, '09:40')),
  ];
  return { quotes, quote_lines: [...p1Lines, ...supLines, ...v1Lines, ...v2Lines], contracts, payment_schedules, activities };
}

export function buildDealsThienTruong(c: SeedCtx): Partial<Bundle> {
  const ACC = 'acc_thientruong';
  const AM = 'u_am_ducanh';
  const HUNG = 'u_client_hung';
  const mainLines = makeLines('q_thientruong_main_v1', [
    ['pi_svc_ba', 30, 4_500_000, 0, 10],
    ['pi_svc_ux', 20, 4_200_000, 0, 10],
    ['pi_svc_dev', 200, 3_700_000, 0, 10],
    ['pi_svc_qa', 40, 3_200_000, 0, 10],
    ['pi_svc_pm', 35, 4_800_000, 0, 10],
    ['pi_lic_usr', 80, 3_600_000, 10, 0],
    ['pi_mig_pkg', 1, 60_000_000, 0, 10],
    ['pi_trn_pkg', 3, 24_000_000, 0, 10],
  ]);
  const supportLines = makeLines('q_thientruong_support_v1', [
    ['pi_sup_mth', 12, 25_000_000, 0, 10],
    ['pi_cld_mth', 12, 18_000_000, 0, 10],
  ]);
  const quotes = [
    makeQuote({ id: 'q_thientruong_main_v1', account_id: ACC, project_id: 'prj_thientruong_mes', code: `BG-TT-${c.y(-188)}-01`, title: 'Triển khai hệ thống quản lý sản xuất (MES)', status: 'accepted', valid_until: c.d(-155), sent_at: c.at(-185, '10:00'), sent_by: AM, client_decision: 'accepted', client_decided_by: HUNG, client_decided_at: c.at(-178, '07:30'), notes: 'Triển khai cho 3 xưởng: cơ khí, sơn, lắp ráp.', created_by: AM, created_at: c.at(-188, '14:00') }),
    makeQuote({ id: 'q_thientruong_support_v1', account_id: ACC, code: `BG-TT-${c.y(-4)}-02`, title: 'Gói hỗ trợ vận hành sau go-live 12 tháng', status: 'draft', valid_until: c.d(30), internal_note: 'Chờ thu xong đợt 2 rồi mới gửi.', created_by: AM, created_at: c.at(-4, '15:00') }),
  ];
  const value = quoteGrandTotal(mainLines, 0);
  const contracts = [
    makeContract({ id: 'c_thientruong_mes', account_id: ACC, quote_id: 'q_thientruong_main_v1', code: `HĐ-TT-${c.y(-175)}-01`, title: 'Hợp đồng triển khai hệ thống MES', value, signed_date: c.d(-175), start_date: c.d(-175), end_date: c.d(95), status: 'active', file_id: 'f_thientruong_contract' }),
  ];
  const payment_schedules = makeInstallments('c_thientruong_mes', value, [
    { id: 'ps_thientruong_1', name: 'Đợt 1 – Ký hợp đồng', percent: 30, milestone_id: 'ms_thientruong_kickoff', due_date: c.d(-168), status: 'paid', invoice_no: '0000124', invoiced_at: c.at(-172, '10:00'), paid_at: c.at(-165, '10:00') },
    { id: 'ps_thientruong_2', name: 'Đợt 2 – Hoàn thành thiết kế', percent: 30, milestone_id: 'ms_thientruong_design', due_date: c.d(-12), status: 'invoiced', invoice_no: THIENTRUONG_INVOICE_2, invoiced_at: c.at(-27, '10:00'), task_id: 't_thientruong_payment2' },
    { id: 'ps_thientruong_3', name: 'Đợt 3 – Nghiệm thu UAT', percent: 25, milestone_id: 'ms_thientruong_uat', due_date: c.d(52), status: 'not_due' },
    { id: 'ps_thientruong_4', name: 'Đợt 4 – Go-live', percent: 15, milestone_id: 'ms_thientruong_golive', due_date: c.d(70), status: 'not_due' },
  ]);
  const ps2 = payment_schedules[1];
  const A = activityMaker(ACC);
  const activities = [
    A('act_thientruong_p1', HUNG, 'quote.accepted', 'quote', 'q_thientruong_main_v1', { quote: 'Triển khai hệ thống quản lý sản xuất (MES)', version: 1 }, 'shared', c.at(-178, '07:30')),
    A('act_thientruong_p2', AM, 'payment.paid', 'payment', 'ps_thientruong_1', { note: 'Đợt 1 – Ký hợp đồng', amount: vnd(payment_schedules[0].amount) }, 'shared', c.at(-165, '10:05')),
    A('act_thientruong_p3', null, 'payment.invoice_due', 'payment', ps2.id, { note: ps2.name, amount: vnd(ps2.amount), milestone: 'Thiết kế' }, 'internal', c.at(-42, '17:01')),
    A('act_thientruong_p4', AM, 'payment.invoiced', 'payment', ps2.id, { note: ps2.name, amount: vnd(ps2.amount), date: c.dm(-12) }, 'shared', c.at(-27, '10:00')),
    A('act_thientruong_p5', null, 'payment.overdue', 'payment', ps2.id, { note: ps2.name, amount: vnd(ps2.amount), days: 1 }, 'internal', c.at(-11, '07:00')),
  ];
  return { quotes, quote_lines: [...mainLines, ...supportLines], contracts, payment_schedules, activities };
}
