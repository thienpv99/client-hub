// Price list, project templates, default settings and small commercial builders
// (quote totals → contract value → installments) used by the deal files.

import type {
  AccountPrice,
  Contract,
  ContractStatus,
  ID,
  ISODate,
  ISODateTime,
  PaymentSchedule,
  PaymentStatus,
  PriceItem,
  PriceUnit,
  ProjectTemplate,
  Quote,
  QuoteLine,
  QuoteStatus,
  Settings,
  VatRate,
} from '@/domain/types';

function item(id: ID, code: string, name: string, unit: PriceUnit, list: number, cost: number, category: string, description: string | null, active = true): PriceItem {
  return { id, code, name, unit, list_price: list, cost_price: cost, category, active, description, deleted_at: null };
}

export function buildPriceItems(): PriceItem[] {
  return [
    item('pi_lic_usr', 'NE-LIC-USR', 'Bản quyền phần mềm theo người dùng (12 tháng)', 'user', 3_600_000, 1_400_000, 'Bản quyền', 'Tính theo số người dùng đăng nhập, gia hạn hằng năm.'),
    item('pi_lic_ent', 'NE-LIC-ENT', 'Gói bản quyền doanh nghiệp (không giới hạn người dùng)', 'package', 480_000_000, 190_000_000, 'Bản quyền', 'Bản quyền vĩnh viễn cho một pháp nhân, kèm 12 tháng cập nhật.'),
    item('pi_cld_mth', 'NE-CLD-MTH', 'Hạ tầng đám mây vận hành', 'month', 18_000_000, 11_000_000, 'Hạ tầng', 'Máy chủ, sao lưu hằng ngày, giám sát 24/7.'),
    item('pi_sup_mth', 'NE-SUP-MTH', 'Gói hỗ trợ vận hành 8x5', 'month', 25_000_000, 12_000_000, 'Hỗ trợ', 'Hỗ trợ giờ hành chính, phản hồi trong 8 giờ làm việc.'),
    item('pi_sup_247', 'NE-SUP-247', 'Gói hỗ trợ 24/7 (SLA 4 giờ)', 'month', 45_000_000, 22_000_000, 'Hỗ trợ', 'Trực sự cố 24/7, khắc phục sự cố nghiêm trọng trong 4 giờ.'),
    item('pi_svc_ba', 'NE-SVC-BA', 'Phân tích nghiệp vụ', 'manday', 4_500_000, 2_200_000, 'Dịch vụ triển khai', null),
    item('pi_svc_dev', 'NE-SVC-DEV', 'Lập trình và tích hợp', 'manday', 4_000_000, 2_000_000, 'Dịch vụ triển khai', null),
    item('pi_svc_ux', 'NE-SVC-UX', 'Thiết kế trải nghiệm và giao diện', 'manday', 4_200_000, 2_100_000, 'Dịch vụ triển khai', null),
    item('pi_svc_qa', 'NE-SVC-QA', 'Kiểm thử và hỗ trợ UAT', 'manday', 3_200_000, 1_500_000, 'Dịch vụ triển khai', null),
    item('pi_svc_pm', 'NE-SVC-PM', 'Quản lý dự án', 'manday', 4_800_000, 2_400_000, 'Dịch vụ triển khai', null),
    item('pi_trn_pkg', 'NE-TRN-PKG', 'Đào tạo người dùng (gói 2 buổi)', 'package', 24_000_000, 9_000_000, 'Đào tạo', 'Tối đa 25 học viên mỗi gói, kèm tài liệu hướng dẫn.'),
    item('pi_mig_pkg', 'NE-MIG-PKG', 'Chuyển đổi dữ liệu từ hệ thống cũ', 'package', 60_000_000, 28_000_000, 'Dịch vụ triển khai', 'Làm sạch, đối soát và nhập dữ liệu lịch sử.'),
    item('pi_sup_year', 'NE-SUP-YEAR', 'Gói bảo trì năm (mẫu cũ)', 'package', 120_000_000, 70_000_000, 'Hỗ trợ', 'Đã thay bằng gói hỗ trợ theo tháng.', false),
    item('pi_lic_sme', 'NE-LIC-SME', 'Bản quyền gói SME (ngừng bán)', 'user', 2_400_000, 1_100_000, 'Bản quyền', 'Ngừng bán từ năm trước.', false),
  ];
}

export function buildAccountPrices(): AccountPrice[] {
  const ap = (id: ID, account_id: ID, price_item_id: ID, negotiated_price: number, note: string | null): AccountPrice => ({ id, account_id, price_item_id, negotiated_price, note });
  return [
    ap('ap_coxanh_lic', 'acc_coxanh', 'pi_lic_usr', 3_240_000, 'Giá ưu đãi theo hợp đồng khung 3 năm'),
    ap('ap_thinhan_ba', 'acc_thinhan', 'pi_svc_ba', 4_300_000, 'Đơn giá thỏa thuận cho khối ngân hàng'),
    ap('ap_thinhan_dev', 'acc_thinhan', 'pi_svc_dev', 3_800_000, 'Đơn giá thỏa thuận cho khối ngân hàng'),
    ap('ap_thinhan_sup', 'acc_thinhan', 'pi_sup_247', 42_000_000, null),
    ap('ap_thientruong_dev', 'acc_thientruong', 'pi_svc_dev', 3_700_000, 'Cam kết tối thiểu 200 ngày công'),
    ap('ap_maytrang_sup', 'acc_maytrang', 'pi_sup_mth', 22_000_000, 'Ký hỗ trợ 12 tháng'),
  ];
}

export function buildTemplates(): ProjectTemplate[] {
  return [
    {
      id: 'tpl_software',
      name: 'Triển khai phần mềm',
      description: 'Lộ trình chuẩn cho dự án triển khai phần mềm theo yêu cầu, khoảng 4–5 tháng.',
      milestones: [
        { name: 'Kickoff', offset_days: 0, client_visible: true },
        { name: 'Khảo sát', offset_days: 21, client_visible: true },
        { name: 'Thiết kế', offset_days: 49, client_visible: true },
        { name: 'Phát triển', offset_days: 91, client_visible: true },
        { name: 'UAT', offset_days: 112, client_visible: true },
        { name: 'Go-live', offset_days: 126, client_visible: true },
        { name: 'Hỗ trợ sau go-live', offset_days: 156, client_visible: true },
      ],
    },
    {
      id: 'tpl_consulting',
      name: 'Tư vấn chuyển đổi số',
      description: 'Đánh giá hiện trạng và đề xuất lộ trình chuyển đổi số trong khoảng 2 tháng.',
      milestones: [
        { name: 'Kickoff', offset_days: 0, client_visible: true },
        { name: 'Khảo sát hiện trạng', offset_days: 14, client_visible: true },
        { name: 'Workshop định hướng', offset_days: 28, client_visible: true },
        { name: 'Báo cáo lộ trình', offset_days: 45, client_visible: true },
        { name: 'Nghiệm thu', offset_days: 60, client_visible: true },
      ],
    },
  ];
}

export function buildSettings(): Settings {
  return {
    company_name: 'New Era',
    timezone: 'Asia/Ho_Chi_Minh',
    discount_approval_threshold_pct: 10,
    escalation_overdue_days: 3,
    reminder_days_before: [3, 1],
    overdue_reminder_per_day: 1,
    max_emails_per_day: 1,
    weekly_digest_weekday: 1,
    weekly_digest_hour: 8,
    payment_task_auto: true,
  };
}

/** '1.250.000.000 ₫' — for activity params that are interpolated as-is into sentences. */
export function vnd(value: number): string {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;
}

// ───────────────────────────── Quote math (ARCHITECTURE §7 quoteMath) ─────────────────────────────

/** Grand total incl. VAT, same rounding as the domain engine (each money value rounded to whole VND). */
export function quoteGrandTotal(lines: QuoteLine[], discountPctTotal: number): number {
  let total = 0;
  for (const l of lines) {
    const subtotal = Math.round(l.qty * l.unit_price);
    const discount = Math.round((subtotal * l.discount_pct) / 100);
    const share = Math.round(((subtotal - discount) * discountPctTotal) / 100);
    const net = subtotal - discount - share;
    const vat = Math.round((net * l.vat_rate) / 100);
    total += net + vat;
  }
  return total;
}

/** Quote lines of one quote: [price_item_id, qty, unit_price, discount_pct, vat_rate, description?] */
export type LineTuple = [ID, number, number, number, VatRate, (string | null)?];

export function makeLines(quoteId: ID, tuples: LineTuple[]): QuoteLine[] {
  return tuples.map(([price_item_id, qty, unit_price, discount_pct, vat_rate, description], i) => ({
    id: `${quoteId}_l${i + 1}`,
    quote_id: quoteId,
    price_item_id,
    description: description ?? null,
    qty,
    unit_price,
    discount_pct,
    vat_rate,
    sort_order: i + 1,
  }));
}

export interface QuoteSpec extends Partial<Quote> {
  id: ID;
  account_id: ID;
  code: string;
  title: string;
  status: QuoteStatus;
  valid_until: ISODate;
  created_by: ID;
  created_at: ISODateTime;
}

export function makeQuote(s: QuoteSpec): Quote {
  const q: Quote = {
    id: s.id,
    account_id: s.account_id,
    project_id: s.project_id ?? null,
    code: s.code,
    title: s.title,
    version: s.version ?? 1,
    parent_id: s.parent_id ?? null,
    status: s.status,
    valid_until: s.valid_until,
    discount_pct_total: s.discount_pct_total ?? 0,
    approval_requested_at: s.approval_requested_at ?? null,
    approval_requested_by: s.approval_requested_by ?? null,
    director_approved_by: s.director_approved_by ?? null,
    director_approved_at: s.director_approved_at ?? null,
    approval_note: s.approval_note ?? null,
    sent_at: s.sent_at ?? null,
    sent_by: s.sent_by ?? null,
    client_decision: s.client_decision ?? null,
    client_decided_by: s.client_decided_by ?? null,
    client_decided_at: s.client_decided_at ?? null,
    client_note: s.client_note ?? null,
    notes: s.notes ?? null,
    internal_note: s.internal_note ?? null,
    created_by: s.created_by,
    created_at: s.created_at,
    updated_at: '',
    deleted_at: null,
  };
  q.updated_at = s.updated_at ?? [q.created_at, q.approval_requested_at, q.director_approved_at, q.sent_at, q.client_decided_at].reduce<string>((m, v) => (v && v > m ? v : m), '');
  return q;
}

export interface ContractSpec {
  id: ID;
  account_id: ID;
  quote_id: ID | null;
  code: string;
  title: string;
  value: number;
  signed_date: ISODate | null;
  start_date: ISODate;
  end_date: ISODate;
  status: ContractStatus;
  file_id: ID | null;
}

export function makeContract(s: ContractSpec): Contract {
  return { ...s, deleted_at: null };
}

export interface InstallmentSpec {
  id: ID;
  name: string;
  percent: number;
  milestone_id: ID | null;
  due_date: ISODate;
  status: PaymentStatus;
  invoice_no?: string | null;
  invoiced_at?: ISODateTime | null;
  paid_at?: ISODateTime | null;
  client_reported_at?: ISODateTime | null;
  task_id?: ID | null;
}

/** Installments of a contract; amounts follow the percentages and the last one absorbs rounding. */
export function makeInstallments(contractId: ID, value: number, specs: InstallmentSpec[]): PaymentSchedule[] {
  let allocated = 0;
  return specs.map((s, i) => {
    const last = i === specs.length - 1;
    const amount = last ? value - allocated : Math.round((value * s.percent) / 100);
    allocated += amount;
    return {
      id: s.id,
      contract_id: contractId,
      name: s.name,
      percent: s.percent,
      amount,
      milestone_id: s.milestone_id,
      due_date: s.due_date,
      status: s.status,
      invoice_no: s.invoice_no ?? null,
      invoiced_at: s.invoiced_at ?? null,
      paid_at: s.paid_at ?? null,
      client_reported_at: s.client_reported_at ?? null,
      proof_file_id: null,
      auto_task_enabled: true,
      task_id: s.task_id ?? null,
      deleted_at: null,
    };
  });
}
