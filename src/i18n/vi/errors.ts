// i18n namespace 'errors' — owner: services-core (C). Nested keys, Vietnamese text, {param} placeholders.
// One message per ApiErrorCode (errors.<code>) plus the specific keys thrown by the service layer.
// The generic keys read correctly without params (useAction translates them without details);
// the *_detail variants use ApiError.details: blocked → { blockers: string[] }, cycle → { path: string[] },
// domain_mismatch → { domain: string } (join arrays before passing them to t()).
const errors = {
  // ApiErrorCode
  unauthenticated: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.',
  forbidden: 'Tài khoản này chưa có quyền thực hiện thao tác này.',
  not_found: 'Không tìm thấy nội dung này. Có thể nội dung đã được thay đổi hoặc gỡ bỏ.',
  validation: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  blocked: 'Việc này đang chờ việc khác hoàn thành trước nên chưa chuyển trạng thái được.',
  blocked_detail: 'Việc này đang chờ: {blockers}.',
  cycle: 'Không thể tạo phụ thuộc vòng tròn giữa các việc.',
  cycle_detail: 'Không thể tạo phụ thuộc vòng tròn: {path}.',
  read_only: 'Đang ở chế độ xem như khách hàng nên chỉ xem được, không thay đổi được.',
  needs_approval: 'Báo giá có chiết khấu vượt ngưỡng, cần Giám đốc duyệt trước khi gửi khách.',
  domain_mismatch: 'Email cần dùng đúng tên miền email của công ty.',
  domain_mismatch_detail: 'Email cần dùng tên miền của công ty (@{domain}).',
  requires_owner: 'Việc này cần Người quyết định xử lý trực tiếp nên không giao cho người khác được.',
  conflict: 'Dữ liệu vừa được cập nhật ở nơi khác. Vui lòng tải lại và thử lại.',

  // general
  unexpected: 'Đã có lỗi ngoài dự kiến. Vui lòng thử lại sau ít phút.',
  undo_expired: 'Đã quá thời gian hoàn tác.',
  undo_conflict: 'Việc này vừa có thay đổi mới sau thao tác vừa rồi nên không hoàn tác được nữa.',
  reason_required: 'Vui lòng ghi lý do.',
  invalid_transition: 'Không thể chuyển việc sang trạng thái này.',
  hidden_blocker: 'việc chuẩn bị của New Era',
  this_task: 'Việc này',
  /** a task in a dependency cycle the viewer may not name (cycle → { path }) */
  other_task: 'một việc khác',

  // sign-in
  unknown_email: 'Không tìm thấy tài khoản với email này.',
  invalid_otp: 'Mã xác thực chưa đúng. Vui lòng kiểm tra lại.',
  invalid_password: 'Mật khẩu chưa đúng.',
  invalid_preference: 'Lựa chọn nhận thông báo chưa hợp lệ.',

  // tasks
  task_not_waiting: 'Việc này hiện không chờ thao tác nào.',
  action_not_allowed: 'Thao tác này không áp dụng cho loại việc này.',
  files_required: 'Vui lòng đính kèm ít nhất một tệp.',
  invalid_file: 'Tệp đính kèm chưa hợp lệ.',
  answer_required: 'Vui lòng nhập câu trả lời.',
  question_required: 'Vui lòng nhập câu hỏi.',
  comment_required: 'Vui lòng nhập nội dung bình luận.',
  message_required: 'Vui lòng nhập lời nhắn cho khách.',
  invalid_reply: 'Bình luận được trả lời không còn tồn tại.',
  invalid_visibility: 'Chế độ hiển thị chưa hợp lệ.',
  delegate_target_required: 'Vui lòng chọn người nhận việc hoặc nhập email để mời.',
  delegate_self: 'Vui lòng chọn một đồng nghiệp khác để giao việc.',
  invalid_delegate: 'Người nhận việc cần là thành viên đang hoạt động của công ty.',
  title_required: 'Vui lòng nhập tên việc.',
  invalid_date: 'Ngày chưa hợp lệ.',
  invalid_type: 'Loại việc không khớp với phía phụ trách.',
  invalid_project: 'Dự án không hợp lệ.',
  invalid_task: 'Việc được chọn không hợp lệ.',
  invalid_milestone: 'Mốc cần thuộc cùng dự án với việc.',
  invalid_assignee: 'Người phụ trách cần thuộc đúng phía phụ trách của việc.',
  dependency_scope: 'Việc và mốc phụ thuộc cần thuộc cùng một khách hàng.',
  impact_required: 'Vui lòng viết 1–2 câu “Nếu trễ thì sao” cho việc này.',
  not_blocked: 'Việc này hiện không bị chặn.',
  client_task_always_visible: 'Việc phía khách luôn hiển thị với khách hàng.',
  nothing_to_review: 'Việc này hiện không có nội dung chờ New Era kiểm tra.',
  approval_needs_client: 'Việc duyệt chỉ hoàn thành khi khách duyệt. Hãy gửi bản mới để khách xem lại.',
  quote_task_needs_version: 'Việc này đi theo báo giá. Hãy tạo và gửi phiên bản báo giá mới cho khách.',

  // commercial
  quote_expired: 'Báo giá này đã hết hiệu lực. New Era sẽ gửi phiên bản mới nếu cần.',

  // roadmap
  name_required: 'Vui lòng nhập tên.',
  invalid_template: 'Mẫu lộ trình không còn tồn tại.',
  invalid_order: 'Thứ tự mốc chưa hợp lệ.',
  already_done: 'Mốc này đã hoàn thành.',

  // accounts & people
  invalid_domain: 'Tên miền email chưa hợp lệ, ví dụ: congty.vn.',
  invalid_email: 'Email chưa hợp lệ.',
  email_exists: 'Email này đã có tài khoản trong hệ thống.',
  salutation_required: 'Vui lòng chọn danh xưng (Anh/Chị).',
  invalid_role: 'Vai trò chưa hợp lệ.',
  invalid_decision_role: 'Vai trò phía khách chưa hợp lệ.',
  invalid_am: 'Vui lòng chọn một Quản lý khách hàng (AM) đang hoạt động.',
  exec_summary_lines: 'Tóm tắt điều hành tối đa 3 dòng.',
  cannot_change_self: 'Không thể tự đổi vai trò của chính tài khoản đang đăng nhập.',
  cost_am_only: 'Quyền xem giá vốn chỉ cấp cho Quản lý khách hàng (AM).',

  // settings
  invalid_settings: 'Giá trị cài đặt chưa hợp lệ.',

  // CRM (extension)
  interaction_in_future: 'Thời điểm tương tác cần là lúc đã diễn ra, không sau thời điểm hiện tại.',
  follow_up_needs_target: 'Ngày hẹn theo dõi cần gắn với một khách hàng mục tiêu đang theo đuổi hoặc một cơ hội đang mở.',
};

export default errors;
