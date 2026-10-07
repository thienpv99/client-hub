// Realistic Vietnamese fixtures for CommonGallery (dev only). Dates are relative to today.
import type {
  AccountRef,
  ActivityView,
  BlockerRef,
  ChainNode,
  DueInfo,
  FileView,
  MilestoneRef,
  MilestoneView,
  StatusLine,
  UserRef,
  WaitingCounts,
} from '@/services/contract';
import type { ISODate, ISODateTime } from '@/domain/types';
import { atTime, now, toVnISO, todayISO } from '@/domain/clock';
import { addDays } from '@/domain/dates';
import { formatDateShort } from '@/lib/format';

const today = todayISO();
export const day = (n: number): ISODate => addDays(today, n);
const at = (n: number, hhmm = '09:00'): ISODateTime => atTime(day(n), hhmm);
const minutesAgo = (m: number): ISODateTime => toVnISO(new Date(now().getTime() - m * 60_000));

export function due(daysLeft: number): DueInfo {
  return {
    due_date: day(daysLeft),
    days_left: daysLeft,
    overdue: daysLeft < 0,
    overdue_days: Math.max(0, -daysLeft),
    due_soon: daysLeft >= 0 && daysLeft <= 3,
  };
}

// ───────────── people & accounts ─────────────

export const minh: UserRef = {
  id: 'u_client_minh', full_name: 'Trần Quang Minh', title: 'CEO', salutation: 'anh', org_type: 'client',
  role: 'client_owner', avatar_url: null, email: 'minh@coxanh.vn', phone: '0903 123 456',
};
export const lan: UserRef = {
  id: 'u_client_lan', full_name: 'Phạm Thu Lan', title: 'Giám đốc vận hành', salutation: 'chị', org_type: 'client',
  role: 'client_member', avatar_url: null, email: 'lan@coxanh.vn', phone: null,
};
export const ha: UserRef = {
  id: 'u_am_ha', full_name: 'Nguyễn Thu Hà', title: 'Quản lý khách hàng', salutation: 'chị', org_type: 'internal',
  role: 'am', avatar_url: null, email: 'ha.nguyen@newera.inc', phone: '0912 456 789',
};
export const tuan: UserRef = {
  id: 'u_member_tuan', full_name: 'Phạm Minh Tuấn', title: 'Trưởng nhóm kỹ thuật', salutation: 'anh', org_type: 'internal',
  role: 'member', avatar_url: null, email: 'tuan.pham@newera.inc', phone: null,
};

const mayTrangLogo =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#E0F2FE"/>' +
      '<path d="M12 30c0-4 3-7 7-7 1-4 5-7 9-6 4 0 7 3 8 7 3 0 5 3 5 6H12z" fill="#0284C7"/></svg>',
  );

export const accounts: AccountRef[] = [
  { id: 'acc_coxanh', name: 'Cỏ Xanh Retail', short_name: 'Cỏ Xanh', logo_url: null, brand_color: '#2F7D4F' },
  { id: 'acc_thinhan', name: 'Ngân hàng Thịnh An', short_name: 'Thịnh An', logo_url: null, brand_color: '#1E3A8A' },
  { id: 'acc_giongan', name: 'Năng lượng Gió Ngàn', short_name: 'Gió Ngàn', logo_url: null, brand_color: '#0E7490' },
  { id: 'acc_maytrang', name: 'Mây Trắng Logistics', short_name: 'Mây Trắng', logo_url: mayTrangLogo, brand_color: '#0284C7' },
];

// ───────────── status lines ─────────────

export const statusLines: { line: StatusLine; salutation: string | null }[] = [
  { line: { tone: 'on_track', kind: 'on_track' }, salutation: 'anh' },
  { line: { tone: 'attention', kind: 'due_soon_blocking', count: 1, milestone_name: 'UAT' }, salutation: 'chị' },
  { line: { tone: 'attention', kind: 'overdue', count: 2 }, salutation: 'anh' },
  { line: { tone: 'attention', kind: 'payment_overdue', count: 1 }, salutation: 'anh' },
  { line: { tone: 'blocked', kind: 'waiting_client', count: 1, milestone_name: 'Go-live', delay_days: 6 }, salutation: 'anh' },
  { line: { tone: 'blocked', kind: 'waiting_client', count: 2, milestone_name: 'UAT', delay_days: 3 }, salutation: null },
  {
    line: { tone: 'blocked', kind: 'waiting_client', count: 1, milestone_name: 'Go-live', delay_days: 6, waiting_for: { name: 'anh Minh', company: 'Cỏ Xanh' } },
    salutation: 'chị',
  },
  {
    line: { tone: 'blocked', kind: 'waiting_internal', milestone_name: 'UAT', delay_days: 4, task_title: 'Hoàn thiện API đồng bộ công tơ' },
    salutation: 'anh',
  },
  { line: { tone: 'blocked', kind: 'waiting_internal', milestone_name: 'Go-live', delay_days: 3, task_title: null }, salutation: 'chị' },
  { line: { tone: 'on_track', kind: 'generic' }, salutation: 'anh' },
  { line: { tone: 'attention', kind: 'generic' }, salutation: 'anh' },
  { line: { tone: 'blocked', kind: 'generic' }, salutation: 'anh' },
];

// ───────────── milestones ─────────────

const designCause = {
  task_id: 't_cx_design', task_title: 'Duyệt thiết kế màn hình Đặt hàng', side: 'client' as const, waiting_on: 'client' as const, delay_days: 6,
};

function ms(p: Partial<MilestoneView> & Pick<MilestoneView, 'id' | 'name' | 'order_no' | 'planned_date'>): MilestoneView {
  return {
    project_id: 'p_cx_app', status: 'upcoming', forecast_date: p.planned_date, delay_days: 0, forecast_source: 'on_plan',
    cause: null, cascade_from: null, override_reason: null, client_visible: true, completed_at: null, description: null,
    open_task_count: 3, done_task_count: 0, ...p,
  };
}

/** Cỏ Xanh "App bán hàng đa kênh": design approval 6 days late pushes every later milestone. */
export const coXanhMilestones: MilestoneView[] = [
  ms({ id: 'm_kick', name: 'Kickoff', order_no: 1, planned_date: day(-40), status: 'done', forecast_source: 'done', completed_at: at(-40, '15:00'), open_task_count: 0, done_task_count: 4 }),
  ms({ id: 'm_survey', name: 'Khảo sát', order_no: 2, planned_date: day(-24), forecast_date: day(-21), status: 'done', forecast_source: 'done', completed_at: at(-21, '17:30'), open_task_count: 0, done_task_count: 6 }),
  ms({ id: 'm_design', name: 'Thiết kế', order_no: 3, planned_date: day(-2), forecast_date: day(4), delay_days: 6, status: 'in_progress', forecast_source: 'dependency', cause: designCause }),
  ms({ id: 'm_dev', name: 'Phát triển', order_no: 4, planned_date: day(10), forecast_date: day(16), delay_days: 6, forecast_source: 'cascade', cause: designCause, cascade_from: { milestone_id: 'm_design', milestone_name: 'Thiết kế' } }),
  ms({ id: 'm_uat', name: 'UAT', order_no: 5, planned_date: day(22), forecast_date: day(28), delay_days: 6, forecast_source: 'dependency', cause: designCause }),
  ms({ id: 'm_golive', name: 'Go-live', order_no: 6, planned_date: day(36), forecast_date: day(42), delay_days: 6, forecast_source: 'cascade', cause: designCause, cascade_from: { milestone_id: 'm_uat', milestone_name: 'UAT' } }),
  ms({ id: 'm_support', name: 'Hỗ trợ sau go-live', order_no: 7, planned_date: day(66), forecast_date: day(72), delay_days: 6, forecast_source: 'cascade', cause: designCause, cascade_from: { milestone_id: 'm_golive', milestone_name: 'Go-live' } }),
];

/** One milestone per forecast source / wording variant. */
export const forecastExamples: { note: string; milestone: MilestoneView }[] = [
  { note: 'dependency · client', milestone: coXanhMilestones[4] ?? ms({ id: 'x', name: 'UAT', order_no: 5, planned_date: day(22) }) },
  { note: 'cascade', milestone: coXanhMilestones[5] ?? ms({ id: 'y', name: 'Go-live', order_no: 6, planned_date: day(36) }) },
  {
    note: 'dependency · New Era',
    milestone: ms({
      id: 'm_gn_uat', name: 'UAT', order_no: 4, planned_date: day(12), forecast_date: day(16), delay_days: 4, forecast_source: 'dependency',
      cause: { task_id: 't_gn_api', task_title: 'Hoàn thiện API đồng bộ công tơ', side: 'internal', waiting_on: 'internal', delay_days: 4 },
    }),
  },
  {
    note: 'dependency · hidden task',
    milestone: ms({
      id: 'm_hd_go', name: 'Go-live', order_no: 5, planned_date: day(30), forecast_date: day(33), delay_days: 3, forecast_source: 'dependency',
      cause: { task_id: 't_hidden', task_title: null, side: 'internal', waiting_on: 'internal', delay_days: 3 },
    }),
  },
  {
    note: 'manual · reason',
    milestone: ms({ id: 'm_tr', name: 'Đào tạo người dùng', order_no: 5, planned_date: day(18), forecast_date: day(23), delay_days: 5, forecast_source: 'manual', override_reason: 'Khách dời lịch đào tạo sang tuần sau' }),
  },
  {
    note: 'manual · no reason (client view)',
    milestone: ms({ id: 'm_tr2', name: 'Đào tạo người dùng', order_no: 5, planned_date: day(18), forecast_date: day(23), delay_days: 5, forecast_source: 'manual' }),
  },
  {
    note: 'manual · earlier',
    milestone: ms({ id: 'm_tr3', name: 'Bàn giao tài liệu', order_no: 6, planned_date: day(25), forecast_date: day(23), delay_days: -2, forecast_source: 'manual', override_reason: 'Hoàn tất sớm phần tài liệu' }),
  },
  { note: 'on plan', milestone: ms({ id: 'm_mt', name: 'Báo cáo vận hành quý', order_no: 3, planned_date: day(24) }) },
  { note: 'done', milestone: coXanhMilestones[1] ?? ms({ id: 'z', name: 'Khảo sát', order_no: 2, planned_date: day(-24) }) },
];

// ───────────── chains, impact, blockers ─────────────

export const chains: ChainNode[][] = [
  [
    { kind: 'task', id: 't_cx_design', label: 'Duyệt thiết kế màn hình Đặt hàng', state: 'stuck', side: 'client' },
    { kind: 'task', id: 't_cx_dev', label: 'Lập trình phần Đặt hàng', state: 'pending', side: 'internal' },
    { kind: 'milestone', id: 'm_uat', label: 'UAT', state: 'pending', planned_date: day(22), forecast_date: day(28) },
    { kind: 'milestone', id: 'm_golive', label: 'Go-live', state: 'pending', planned_date: day(36), forecast_date: day(42) },
  ],
  [
    { kind: 'task', id: 't_cx_catalog', label: 'Cung cấp danh mục sản phẩm và giá bán', state: 'done', side: 'client' },
    { kind: 'task', id: 't_hidden', label: null, state: 'stuck', side: 'internal' },
    { kind: 'task', id: 't_cx_import', label: 'Nhập dữ liệu sản phẩm vào hệ thống', state: 'pending', side: 'internal' },
    { kind: 'milestone', id: 'm_design', label: 'Thiết kế', state: 'pending', planned_date: day(-2), forecast_date: day(4) },
    { kind: 'milestone', id: 'm_dev', label: 'Phát triển', state: 'pending', planned_date: day(10), forecast_date: day(16) },
    { kind: 'milestone', id: 'm_golive', label: 'Go-live', state: 'pending', planned_date: day(36), forecast_date: day(42) },
  ],
];

export const impactText = `Nếu chưa duyệt trước ${formatDateShort(day(2))}, team New Era chưa thể lập trình phần Đặt hàng. Mốc UAT ${formatDateShort(day(22))} sẽ lùi theo số ngày trễ.`;

/** the same task 6 days overdue: ImpactBox overdueDays={6} → "Đang ảnh hưởng" */
export const impactTextOverdue = `Nếu chưa duyệt trước ${formatDateShort(day(-6))}, team New Era chưa thể lập trình phần Đặt hàng. Mốc UAT ${formatDateShort(day(22))} sẽ lùi theo số ngày trễ.`;
export const impactOverdueDays = 6;

export const impactMilestones: MilestoneRef[] = [
  { id: 'm_uat', name: 'UAT', project_id: 'p_cx_app', planned_date: day(22), forecast_date: day(28), status: 'upcoming' },
  { id: 'm_golive', name: 'Go-live', project_id: 'p_cx_app', planned_date: day(36), forecast_date: day(42), status: 'upcoming' },
  { id: 'm_pilot', name: 'Chạy thử 3 cửa hàng', project_id: 'p_cx_app', planned_date: day(30), forecast_date: day(30), status: 'upcoming' },
];

export const blockers: BlockerRef[] = [
  { id: 't_cx_design', title: 'Duyệt thiết kế màn hình Đặt hàng', side: 'client', status: 'todo', assignee: minh, due: due(-6) },
  { id: 't_cx_catalog', title: 'Cung cấp danh mục sản phẩm và giá bán', side: 'client', status: 'todo', assignee: null, due: due(3) },
  { id: 't_hidden', title: null, side: 'internal', status: 'in_progress', assignee: null, due: due(2) },
];

export const counts: WaitingCounts[] = [
  { waiting_client: 3, waiting_internal: 2, overdue_client: 1, overdue_internal: 1 },
  { waiting_client: 0, waiting_internal: 4, overdue_client: 0, overdue_internal: 0 },
];

// ───────────── activity ─────────────

export const activities: ActivityView[] = [
  { id: 'a1', account_id: 'acc_coxanh', actor: minh, action: 'task.approved', target_type: 'task', target_id: 't_scope2', params: { task: 'Duyệt phạm vi giai đoạn 2' }, visibility: 'shared', created_at: minutesAgo(25) },
  { id: 'a2', account_id: 'acc_coxanh', actor: lan, action: 'task.files_submitted', target_type: 'task', target_id: 't_cx_catalog', params: { task: 'Cung cấp danh mục sản phẩm và giá bán', count: 2 }, visibility: 'shared', created_at: minutesAgo(190) },
  { id: 'a3', account_id: 'acc_coxanh', actor: minh, action: 'task.delegated', target_type: 'task', target_id: 't_cx_catalog', params: { task: 'Cung cấp danh mục sản phẩm và giá bán', to: 'Phạm Thu Lan', assignee: 'Phạm Thu Lan' }, visibility: 'shared', created_at: at(-1, '16:20') },
  { id: 'a4', account_id: 'acc_coxanh', actor: ha, action: 'quote.sent', target_type: 'quote', target_id: 'q_cx_ext', params: { quote: 'Phụ lục mở rộng 20 người dùng', title: 'Phụ lục mở rộng 20 người dùng', version: 1, code: 'BG-CX-2026-04' }, visibility: 'shared', created_at: at(-3, '10:05') },
  { id: 'a5', account_id: 'acc_coxanh', actor: null, action: 'milestone.completed', target_type: 'milestone', target_id: 'm_survey', params: { milestone: 'Khảo sát' }, visibility: 'shared', created_at: at(-21, '17:30') },
  { id: 'a6', account_id: 'acc_coxanh', actor: tuan, action: 'escalation.sent', target_type: 'task', target_id: 't_cx_design', params: {}, visibility: 'internal', created_at: at(-9, '08:00') },
];

// ───────────── files ─────────────

function designSvg(version: number): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 440" font-family="Be Vietnam Pro, Arial, sans-serif">' +
    '<rect width="720" height="440" fill="#F6F8FC"/>' +
    '<rect x="24" y="24" width="672" height="56" rx="12" fill="#FFFFFF" stroke="#E5E9F0"/>' +
    '<text x="48" y="58" font-size="18" font-weight="600" fill="#0F172A">Cỏ Xanh · Đặt hàng</text>' +
    `<text x="600" y="58" font-size="14" fill="#64748B">Bản v${version}</text>` +
    '<rect x="24" y="100" width="420" height="316" rx="12" fill="#FFFFFF" stroke="#E5E9F0"/>' +
    '<rect x="48" y="128" width="200" height="14" rx="7" fill="#E5E9F0"/><rect x="48" y="160" width="360" height="56" rx="10" fill="#EEF3FF"/>' +
    '<rect x="48" y="232" width="360" height="56" rx="10" fill="#F1F4F9"/><rect x="48" y="304" width="360" height="56" rx="10" fill="#F1F4F9"/>' +
    '<rect x="464" y="100" width="232" height="316" rx="12" fill="#FFFFFF" stroke="#E5E9F0"/>' +
    '<text x="488" y="140" font-size="15" fill="#475569">Tổng đơn hàng</text>' +
    '<text x="488" y="176" font-size="26" font-weight="600" fill="#0F172A">2.450.000 ₫</text>' +
    '<rect x="488" y="340" width="184" height="48" rx="8" fill="#1D4ED8"/>' +
    '<text x="580" y="370" font-size="16" font-weight="600" fill="#FFFFFF" text-anchor="middle">Đặt hàng</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Minimal one-page PDF (ASCII text) so the iframe preview can be exercised. */
function samplePdf(lines: string[]): string {
  const esc = (s: string) => s.replace(/[()\\]/g, (c) => `\\${c}`);
  const content = `BT /F1 20 Tf 64 760 Td (${esc(lines[0] ?? '')}) Tj /F1 13 Tf ${lines
    .slice(1)
    .map((l) => `0 -26 Td (${esc(l)}) Tj`)
    .join(' ')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(pdf)}`;
}

function file(p: Partial<FileView> & Pick<FileView, 'id' | 'name' | 'mime' | 'url'>): FileView {
  return {
    account_id: 'acc_coxanh', project_id: 'p_cx_app', task_id: null, doc_key: p.id, version: 1, size: 48_200,
    visibility: 'shared', kind: 'document', uploaded_by: ha, uploaded_at: at(-2, '14:05'), note: null, ...p,
  };
}

const designV2 = file({ id: 'f_design_v2', name: 'Thiết kế màn hình Đặt hàng.svg', mime: 'image/svg+xml', url: designSvg(2), version: 2, doc_key: 'design-order', kind: 'design', uploaded_at: at(-9, '11:20'), size: 182_400 });
const designV1 = file({ id: 'f_design_v1', name: 'Thiết kế màn hình Đặt hàng.svg', mime: 'image/svg+xml', url: designSvg(1), version: 1, doc_key: 'design-order', kind: 'design', uploaded_at: at(-15, '09:40'), size: 176_900 });

export const files: FileView[] = [
  file({
    id: 'f_design_v3', name: 'Thiết kế màn hình Đặt hàng.svg', mime: 'image/svg+xml', url: designSvg(3), version: 3, doc_key: 'design-order',
    kind: 'design', uploaded_by: tuan, uploaded_at: at(-1, '17:45'), size: 1_284_000, older_versions: [designV2, designV1],
    note: 'Đã chuyển nút Đặt hàng lên đầu trang theo góp ý của anh Minh.',
  }),
  file({
    id: 'f_survey', name: 'Biên bản khảo sát hiện trạng.pdf', mime: 'application/pdf', kind: 'report', size: 356_000,
    url: samplePdf(['Bien ban khao sat hien trang', 'Du an: App ban hang da kenh - Co Xanh Retail', 'Ngay: ' + day(-21), 'Ket luan: 14 quy trinh, 3 he thong can tich hop.']),
  }),
  file({
    id: 'f_catalog', name: 'Danh mục sản phẩm và giá bán.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    url: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,', kind: 'data', uploaded_by: lan, uploaded_at: minutesAgo(190), size: 92_160,
  }),
  file({
    id: 'f_estimate', name: 'Ước tính nỗ lực giai đoạn 2.pdf', mime: 'application/pdf', visibility: 'internal', kind: 'document', size: 128_000,
    url: samplePdf(['Uoc tinh no luc giai doan 2', 'Noi bo New Era - khong chia se voi khach']),
  }),
];
