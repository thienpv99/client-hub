// i18n activity sentences for CRM actions — owner: crm-services. Top-level keys: opportunity, lead, interaction.
// Merged into `activity.*` by i18n/index.ts; rendered as t('activity.<action>', { actor, ...params }).
// Every CRM activity is logged with visibility 'internal'. Params each writer (services AND seed) must provide:
//   opportunity.*        { opportunity: name }  + stage_changed / created: { stage, stage_label }  + lost: { reason }
//                        + won: { project } (may be '')  + updated: { fields } (readable list)
//   lead.*               { lead: company name } + status_changed: { status, status_label } + assigned: { to }
//                        + updated: { fields }
//   interaction.logged   { subject, kind, kind_label }
//   icp.updated          { fields } (readable list of the changed ICP fields)
//   ecosystem.saved      { ecosystem: group name, count: number of member companies after the save }
// `stage_label` / `status_label` / `kind_label` are the readable words below (activity.<ns>.<x>_label.<value>).
const activityCrm = {
  opportunity: {
    created: '{actor} đã tạo cơ hội “{opportunity}”',
    updated: '{actor} đã cập nhật {fields} của cơ hội “{opportunity}”',
    stage_changed: '{actor} đã chuyển cơ hội “{opportunity}” sang giai đoạn {stage_label}',
    won: '{actor} đã chốt thắng cơ hội “{opportunity}”',
    lost: '{actor} đã đóng cơ hội “{opportunity}” (không thành công): {reason}',
    reopened: '{actor} đã mở lại cơ hội “{opportunity}”',
    stage_label: {
      qualified: 'Đủ điều kiện',
      discovery: 'Khảo sát nhu cầu',
      proposal: 'Đề xuất & báo giá',
      negotiation: 'Đàm phán',
      won: 'Thắng',
      lost: 'Không thành công',
    },
    field: {
      account_id: 'khách hàng',
      name: 'tên',
      value: 'giá trị',
      probability: 'khả năng thành công',
      stage: 'giai đoạn',
      expected_close_date: 'ngày dự kiến chốt',
      owner_id: 'người phụ trách',
      source: 'nguồn',
      price_item_ids: 'sản phẩm quan tâm',
      next_step: 'bước tiếp theo',
      next_step_date: 'ngày của bước tiếp theo',
      quote_id: 'báo giá',
    },
  },
  lead: {
    created: '{actor} đã thêm khách hàng mục tiêu “{lead}”',
    updated: '{actor} đã cập nhật {fields} của “{lead}”',
    status_changed: '{actor} đã chuyển “{lead}” sang trạng thái {status_label}',
    assigned: '{actor} đã giao “{lead}” cho {to}',
    converted: '{actor} đã chuyển “{lead}” thành khách hàng và mở cơ hội bán hàng',
    /** `to` of lead.assigned when the lead goes back to the team pool */
    team_pool: 'nhóm chung',
    status_label: {
      new: 'Mới',
      contacted: 'Đã liên hệ',
      interested: 'Quan tâm',
      nurturing: 'Nuôi dưỡng',
      disqualified: 'Không phù hợp',
      converted: 'Đã chuyển cơ hội',
    },
    field: {
      company_name: 'tên công ty',
      industry: 'ngành',
      province: 'tỉnh/thành',
      size: 'quy mô',
      revenue_band: 'doanh thu',
      website: 'website',
      contact_name: 'người liên hệ',
      contact_title: 'chức danh',
      contact_salutation: 'danh xưng',
      contact_email: 'email',
      contact_phone: 'số điện thoại',
      source: 'nguồn',
      owner_id: 'người phụ trách',
      tags: 'nhãn',
      need_summary: 'nhu cầu',
      budget_estimate: 'ngân sách dự kiến',
      notes: 'ghi chú',
      next_follow_up_date: 'ngày liên hệ lại',
    },
  },
  /** icp.updated { fields } (readable list) — target 'settings' / the ICP row, no account */
  icp: {
    updated: '{actor} đã cập nhật chân dung khách hàng lý tưởng: {fields}',
    field: {
      name: 'tên',
      target_industries: 'ngành mục tiêu',
      target_provinces: 'khu vực mục tiêu',
      target_sizes: 'quy mô mục tiêu',
      target_revenue_bands: 'doanh thu mục tiêu',
      weights: 'trọng số chấm điểm',
    },
  },
  /** ecosystem.saved { ecosystem, count } — target 'settings' / the ecosystem row, no account (director feeds) */
  ecosystem: {
    saved: '{actor} đã cập nhật hệ sinh thái “{ecosystem}” ({count} công ty)',
  },
  interaction: {
    logged: '{actor} đã ghi nhận {kind_label} “{subject}”',
    kind_label: {
      call: 'cuộc gọi',
      meeting: 'buổi gặp',
      email: 'email',
      demo: 'buổi demo',
      zalo: 'tin nhắn Zalo',
      note: 'ghi chú',
    },
  },
};

export default activityCrm;
