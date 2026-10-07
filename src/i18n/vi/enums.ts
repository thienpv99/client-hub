// i18n namespace 'enums' — owner: shell (G1).
// Labels for every enum of the domain: t('enums.<enumName>.<value>'), e.g. t('enums.health.blocked').
// enumName = the TypeScript type name in camelCase (Role → role, TaskActionKind → taskAction, PriceUnit → priceUnit).
// A few aliases (side, unit, taskActionKind) point at the same objects for convenience.

const taskSide = {
  client: 'Khách hàng',
  internal: 'New Era',
};

const priceUnit = {
  month: 'tháng',
  user: 'user',
  package: 'gói',
  manday: 'man-day',
};

const taskAction = {
  approve: 'Xem & duyệt',
  requestChanges: 'Yêu cầu chỉnh sửa',
  request_changes: 'Yêu cầu chỉnh sửa',
  upload: 'Tải lên',
  confirm: 'Xác nhận',
  sign: 'Tải bản đã ký',
  payment: 'Báo đã chuyển khoản',
  attend: 'Xác nhận tham dự',
  answer: 'Trả lời',
  review_submission: 'Kiểm tra',
  start: 'Bắt đầu',
  complete: 'Hoàn thành',
};

const enums = {
  role: {
    director: 'Giám đốc',
    am: 'Quản lý khách hàng',
    member: 'Thành viên nội bộ',
    client_owner: 'Người quyết định',
    client_member: 'Thành viên',
  },
  /** tight places next to other words about customers (wizard AM picker: "Nguyễn Thu Hà · AM · 5 khách hàng") */
  roleShort: {
    director: 'Giám đốc',
    am: 'AM',
    member: 'Thành viên nội bộ',
    client_owner: 'Người quyết định',
    client_member: 'Thành viên',
  },
  /** longer form when both sides appear in one list (settings, user admin) */
  roleFull: {
    director: 'Giám đốc',
    am: 'Quản lý khách hàng (AM)',
    member: 'Thành viên nội bộ',
    client_owner: 'Khách – Người quyết định',
    client_member: 'Khách – Thành viên',
  },
  orgType: {
    internal: 'Nội bộ New Era',
    client: 'Khách hàng',
  },
  salutation: {
    anh: 'anh',
    'chị': 'chị',
  },
  salutationTitle: {
    anh: 'Anh',
    'chị': 'Chị',
  },
  notificationPref: {
    all: 'Nhận mọi thông báo',
    digest_and_urgent: 'Chỉ nhận bản tin tuần và việc gấp',
  },
  userStatus: {
    active: 'Đang hoạt động',
    invited: 'Đã mời',
    disabled: 'Đã khóa',
  },
  tier: {
    strategic: 'Chiến lược',
    key: 'Trọng điểm',
    standard: 'Tiêu chuẩn',
  },
  stage: {
    prospecting: 'Tiếp cận',
    negotiating: 'Đàm phán',
    implementing: 'Triển khai',
    operating: 'Vận hành',
    paused: 'Tạm dừng',
  },
  health: {
    blocked: 'Đang bị chặn',
    attention: 'Cần chú ý',
    on_track: 'Đúng kế hoạch',
  },
  decisionRole: {
    decision_maker: 'Người quyết định',
    approver: 'Người duyệt',
    ops_contact: 'Đầu mối vận hành',
  },
  projectStatus: {
    active: 'Đang triển khai',
    done: 'Đã hoàn thành',
    paused: 'Tạm dừng',
  },
  milestoneStatus: {
    upcoming: 'Sắp tới',
    in_progress: 'Đang thực hiện',
    done: 'Đã hoàn thành',
  },
  taskSide,
  side: taskSide,
  taskType: {
    approval: 'Phê duyệt',
    upload: 'Cung cấp tài liệu',
    confirm: 'Xác nhận',
    sign: 'Ký hợp đồng',
    payment: 'Thanh toán',
    attend: 'Tham dự',
    answer: 'Trả lời câu hỏi',
    work: 'Việc New Era',
  },
  taskStatus: {
    todo: 'Cần làm',
    in_progress: 'Đang làm',
    waiting: 'Chờ phản hồi',
    done: 'Xong',
  },
  waitingOn: {
    client: 'Đang chờ khách',
    internal: 'Đang chờ New Era',
  },
  taskAction,
  taskActionKind: taskAction,
  /** ClientAction of domain/taskRules */
  clientAction: {
    approve: 'Duyệt',
    request_changes: 'Yêu cầu chỉnh sửa',
    submit_files: 'Gửi tài liệu',
    report_payment: 'Báo đã chuyển khoản',
    confirm: 'Xác nhận',
    answer: 'Trả lời',
  },
  visibility: {
    internal: 'Nội bộ',
    shared: 'Chia sẻ với khách',
  },
  fileKind: {
    design: 'Thiết kế',
    document: 'Tài liệu',
    contract: 'Hợp đồng',
    proof: 'Chứng từ',
    data: 'Dữ liệu',
    report: 'Báo cáo',
    other: 'Khác',
  },
  priceUnit,
  unit: priceUnit,
  vatRate: {
    '0': '0%',
    '5': '5%',
    '8': '8%',
    '10': '10%',
  },
  quoteStatus: {
    draft: 'Nháp',
    pending_approval: 'Chờ Giám đốc duyệt',
    sent: 'Đã gửi khách',
    accepted: 'Khách chấp thuận',
    changes_requested: 'Khách đề nghị điều chỉnh',
    expired: 'Hết hạn',
  },
  lineChange: {
    added: 'Thêm mới',
    removed: 'Đã bỏ',
    modified: 'Thay đổi',
  },
  contractStatus: {
    draft: 'Nháp',
    active: 'Đang hiệu lực',
    completed: 'Đã hoàn tất',
  },
  paymentStatus: {
    not_due: 'Chưa đến hạn',
    invoice_due: 'Đến hạn xuất hóa đơn',
    invoiced: 'Đã xuất hóa đơn',
    paid: 'Đã thu',
    overdue: 'Quá hạn',
  },
  paymentAction: {
    mark_invoice_due: 'Chuyển sang đến hạn xuất hóa đơn',
    invoice: 'Ghi nhận đã xuất hóa đơn',
    mark_paid: 'Xác nhận đã thu',
    reopen: 'Mở lại',
  },
  forecastSource: {
    on_plan: 'Đúng kế hoạch',
    dependency: 'Lùi do việc đang chặn',
    cascade: 'Lùi theo mốc trước',
    manual: 'Điều chỉnh thủ công',
    done: 'Đã hoàn thành',
  },
  notificationKind: {
    due_soon: 'Sắp đến hạn',
    overdue: 'Quá hạn',
    escalation: 'Leo thang',
    reminder: 'Nhắc việc',
    task_update: 'Cập nhật việc',
    comment: 'Bình luận',
    approval_needed: 'Cần duyệt',
    quote: 'Báo giá',
    payment: 'Thanh toán',
    delegated: 'Giao việc',
    digest: 'Bản tin tuần',
    system: 'Hệ thống',
  },
  emailStatus: {
    sent: 'Đã gửi',
    batched: 'Gom vào email trong ngày',
    suppressed: 'Không gửi (theo lựa chọn của người nhận)',
  },
  activityTargetType: {
    task: 'Việc',
    milestone: 'Mốc',
    project: 'Dự án',
    quote: 'Báo giá',
    contract: 'Hợp đồng',
    payment: 'Đợt thanh toán',
    file: 'Tài liệu',
    account: 'Khách hàng',
    contact: 'Liên hệ',
    user: 'Người dùng',
    comment: 'Bình luận',
    settings: 'Cài đặt',
  },
  searchResultType: {
    page: 'Trang',
    account: 'Khách hàng',
    task: 'Việc',
    quote: 'Báo giá',
    contact: 'Liên hệ',
  },
};

export default enums;
