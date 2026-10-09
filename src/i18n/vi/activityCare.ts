// i18n activity sentences of the client care refocus — owner: care core. Top-level keys: deployment, department,
// stakeholder, relation, care_plan, change_request. Merged into `activity.*` by i18n/index.ts; rendered as
// t('activity.<action>', { actor, ...params }). Params every writer (services AND seed) provides:
//   deployment.*                 { deployment } + created: { category_label } + updated: { fields }
//   department.updated           { department_label, status_label }
//   department.gate_overridden   { department_label, count, reason }
//   stakeholder.updated          { name }
//   relation.saved / .deleted    { from, to } + saved: { kind_label }
//   care_plan.updated            { fields }
//   change_request.*             { code, request } + status_changed: { status_label } (client wording) + updated: { fields }
//                                + rescheduled: { date } ('dd/mm/yyyy')
// Visibility: internal, except change_request.submitted / created / triaged / status_changed / rescheduled, which are
// 'shared' (they show in the client's "Cập nhật mới") — unless the request is New Era's own idea (source 'internal').
const activityCare = {
  deployment: {
    created: '{actor} đã thêm giải pháp “{deployment}” ({category_label})',
    updated: '{actor} đã cập nhật {fields} của giải pháp “{deployment}”',
    deleted: '{actor} đã gỡ giải pháp “{deployment}” khỏi danh sách',
    field: {
      project_id: 'dự án',
      name: 'tên',
      category: 'nhóm giải pháp',
      summary: 'mô tả',
      status: 'trạng thái',
      go_live_date: 'ngày đưa vào dùng',
      departments: 'phòng ban sử dụng',
      active_users: 'số người dùng',
      contract_value: 'giá trị ước tính',
      adoption: 'mức độ sử dụng',
      notes: 'ghi chú nội bộ',
      owner_id: 'người phụ trách',
    },
  },
  department: {
    updated: '{actor} đã cập nhật phòng ban {department_label} trên bản đồ mở rộng ({status_label})',
    gate_overridden: '{actor} đã mở rộng sang phòng ban {department_label} dù còn {count} yêu cầu nợ triển khai: {reason}',
  },
  stakeholder: {
    updated: '{actor} đã cập nhật quan hệ với {name}',
  },
  relation: {
    saved: '{actor} đã ghi mối quan hệ giữa {from} và {to} ({kind_label})',
    deleted: '{actor} đã xóa mối quan hệ giữa {from} và {to}',
  },
  care_plan: {
    updated: '{actor} đã cập nhật kế hoạch chăm sóc: {fields}',
    field: {
      cadence_days: 'nhịp chăm sóc',
      next_action: 'việc chăm sóc tiếp theo',
      next_action_due: 'hạn của việc tiếp theo',
      next_action_owner_id: 'người phụ trách việc tiếp theo',
    },
  },
  change_request: {
    submitted: '{actor} đã gửi yêu cầu {code}: “{request}”',
    created: '{actor} đã ghi nhận yêu cầu {code}: “{request}”',
    triaged: '{actor} đã tiếp nhận yêu cầu {code}: “{request}”',
    status_changed: '{actor} đã chuyển yêu cầu {code} “{request}” sang “{status_label}”',
    rescheduled: '{actor} đã dời ngày dự kiến xong của yêu cầu {code} “{request}” sang {date}',
    updated: '{actor} đã cập nhật {fields} của yêu cầu {code}',
    field: {
      status: 'trạng thái',
      priority: 'mức độ cần',
      owner_id: 'người phụ trách',
      promised_date: 'ngày hẹn với khách',
      plan_ref: 'kế hoạch',
      task_id: 'việc được gắn',
      client_note: 'lời nhắn gửi khách',
      internal_note: 'ghi chú nội bộ',
      decline_reason: 'lý do chưa thực hiện',
      title: 'nội dung',
      description: 'mô tả',
      project_id: 'dự án',
      deployment_id: 'giải pháp liên quan',
    },
  },
};

export default activityCare;
