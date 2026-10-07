// i18n namespace 'activity' — owner: services-core (C): task.*, comment.*, milestone.*, project.*, file.*, account.*, contact.*, user.*, settings.*. Nested keys, Vietnamese text, {param} placeholders.
// Sentences use {actor} (filled by the UI) + the activity params. Several actions are written by more than one
// module (seed, notify, commercial), so each sentence only uses params every writer provides.
const activity = {
  task: {
    created: '{actor} đã tạo việc “{task}”',
    updated: '{actor} đã cập nhật việc “{task}”',
    status_changed: '{actor} đã cập nhật trạng thái việc “{task}”',
    approved: '{actor} đã duyệt “{task}”',
    changes_requested: '{actor} yêu cầu chỉnh sửa “{task}”: {reason}',
    files_submitted: '{actor} đã gửi tài liệu cho việc “{task}”',
    confirmed: '{actor} đã xác nhận “{task}”',
    attendance_confirmed: '{actor} đã xác nhận tham dự “{task}”',
    answered: '{actor} đã trả lời “{task}”',
    signed_submitted: '{actor} đã gửi bản đã ký cho việc “{task}”',
    payment_reported: '{actor} đã báo chuyển khoản cho việc “{task}”',
    delegated: '{actor} đã giao việc “{task}” cho {to}',
    question_asked: '{actor} đã hỏi lại New Era về việc “{task}”: {question}',
    reminded: '{actor} đã nhắc {to} về việc “{task}”',
    unblocked: '{actor} đã mở chặn thủ công việc “{task}”: {reason}',
    submission_accepted: '{actor} đã kiểm tra và hoàn tất việc “{task}”',
    returned_to_client: '{actor} đã gửi lại việc “{task}” để khách xem tiếp',
    visibility_changed: '{actor} đã đổi chế độ “Khách thấy được” của việc “{task}”',
    action_undone: '{actor} đã hoàn tác thao tác vừa thực hiện ở việc “{task}”',
    deleted: '{actor} đã xóa việc “{task}”',
  },
  comment: {
    added: '{actor} đã bình luận ở việc “{task}”',
  },
  milestone: {
    created: '{actor} đã thêm mốc “{milestone}”',
    updated: '{actor} đã cập nhật mốc “{milestone}”',
    forecast_overridden: '{actor} đã điều chỉnh ngày dự báo của mốc “{milestone}”',
    completed: '{actor} đã hoàn thành mốc “{milestone}”',
  },
  project: {
    created: '{actor} đã tạo dự án “{project}”',
  },
  file: {
    uploaded: '{actor} đã tải lên “{file}”',
    visibility_changed: '{actor} đã đổi chế độ hiển thị của “{file}”',
  },
  account: {
    created: '{actor} đã tạo account {account}',
    updated: '{actor} đã cập nhật {fields}',
    /** health_label: enums.health word, logged with the activity */
    health_overridden: '{actor} đã đặt sức khỏe thủ công là “{health_label}”: {reason}',
    am_assigned: '{actor} đã giao {am} phụ trách account',
    exec_summary_updated: '{actor} đã cập nhật tóm tắt điều hành',
  },
  contact: {
    updated: '{actor} đã cập nhật thông tin liên hệ {name}',
  },
  user: {
    invited: '{actor} đã mời {to} tham gia Client Hub',
    role_changed: '{actor} đã cập nhật quyền của {to}',
  },
  settings: {
    updated: '{actor} đã cập nhật cài đặt {section}',
  },

  /** shown when an activity/comment author no longer exists */
  unknown_user: 'Người dùng đã rời hệ thống',

  /** invitation notification + email (sent by the service layer) */
  invite: {
    title: 'Lời mời tham gia Client Hub của New Era',
    body: '{inviter} mời {name} cùng theo dõi dự án của {account} với New Era trên Client Hub. Đăng nhập bằng email này để bắt đầu.',
    internal_title: 'Lời mời tham gia Client Hub',
    internal_body: '{inviter} đã thêm {name} vào Client Hub của New Era. Đăng nhập bằng email công ty để bắt đầu.',
  },

  /** field names written into `fields` / `section` params of *.updated activities */
  field: {
    // account
    name: 'tên',
    short_name: 'tên viết tắt',
    industry: 'ngành',
    tier: 'hạng khách hàng',
    stage: 'giai đoạn',
    logo_url: 'logo',
    brand_color: 'màu nhận diện',
    email_domain: 'tên miền email',
    internal_notes: 'ghi chú nội bộ',
    health_override: 'đánh giá sức khỏe thủ công (đã gỡ)',
    // task
    project_id: 'dự án',
    milestone_id: 'mốc',
    title: 'tên việc',
    description: 'mô tả',
    side: 'phía phụ trách',
    type: 'loại việc',
    assignee_id: 'người phụ trách',
    requires_owner: 'yêu cầu Người quyết định xử lý',
    due_date: 'hạn',
    impact_text: 'hệ quả nếu trễ',
    client_visible: 'chế độ “Khách thấy được”',
    blocks_task_ids: 'việc bị chặn',
    blocks_milestone_ids: 'mốc bị chặn',
    blocked_by_task_ids: 'việc cần xong trước',
    manual_unblock_reason: 'mở chặn thủ công (hết hiệu lực vì lại có việc cần xong trước)',
    // settings
    company_name: 'tên công ty',
    discount_approval_threshold_pct: 'ngưỡng chiết khấu cần duyệt',
    escalation_overdue_days: 'số ngày quá hạn trước khi leo thang',
    reminder_days_before: 'lịch nhắc trước hạn',
    overdue_reminder_per_day: 'số lần nhắc quá hạn mỗi ngày',
    max_emails_per_day: 'số email tối đa mỗi ngày',
    weekly_digest_weekday: 'ngày gửi bản tin tuần',
    weekly_digest_hour: 'giờ gửi bản tin tuần',
    payment_task_auto: 'tự tạo việc thanh toán',
  },
};

export default activity;
