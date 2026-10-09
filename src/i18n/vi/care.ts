// i18n namespace 'care' — owner: care core (SPEC-CARE). Enum labels and shared sentences of the client care refocus,
// used by the service layer (DTO labels) and by the shared care UI kit (components/care/**). Screen copy lives in the
// screen namespaces (careAccount, carePortfolio, carePm, carePortal). `errors` is merged into `errors.care.*` by
// i18n/index.ts (ApiError('conflict', 'errors.care.expansionBlocked')).
// Plain words for executives: never "CR", "SLA", "whitespace" — "yêu cầu", "chưa xử lý quá 7 ngày", "còn có thể bán thêm".
const care = {
  /** solution categories — full names (lists, forms) */
  category: {
    mobile_app: 'Ứng dụng di động',
    web_portal: 'Web & cổng thông tin',
    crm_erp: 'CRM / ERP / quản trị',
    data_bi: 'Dữ liệu & báo cáo',
    ai_automation: 'AI & tự động hóa',
    integration: 'Tích hợp hệ thống',
    support: 'Vận hành & bảo trì',
  },
  /** short names for narrow places (matrix column headers, chips) */
  categoryShort: {
    mobile_app: 'App di động',
    web_portal: 'Web & cổng',
    crm_erp: 'CRM / ERP',
    data_bi: 'Dữ liệu',
    ai_automation: 'AI & tự động',
    integration: 'Tích hợp',
    support: 'Vận hành',
  },
  department: {
    executive: 'Ban điều hành',
    sales: 'Kinh doanh',
    marketing: 'Marketing',
    operations: 'Vận hành',
    supply_chain: 'Chuỗi cung ứng',
    finance: 'Tài chính – Kế toán',
    hr: 'Nhân sự',
    it: 'Công nghệ thông tin',
    customer_service: 'Chăm sóc khách hàng',
    production: 'Sản xuất',
  },
  /** effective status of a department on the expansion map ('using' is derived from the deployments) */
  departmentStatus: {
    /** a live, rolling-out or pilot solution lists the department (it may not be in daily use yet) */
    using: 'Đã có giải pháp',
    engaged: 'Đang trao đổi',
    untouched: 'Chưa tiếp cận',
    not_fit: 'Không phù hợp',
  },
  deploymentStatus: {
    live: 'Đang dùng',
    rolling_out: 'Đang triển khai',
    pilot: 'Chạy thử',
    paused: 'Tạm dừng',
    retired: 'Đã ngừng',
  },
  /** what the client reads (portal "Giải pháp đang dùng") */
  deploymentStatusClient: {
    live: 'Đang sử dụng',
    rolling_out: 'Đang triển khai',
    pilot: 'Đang chạy thử',
    paused: 'Tạm dừng',
    retired: 'Đã ngừng',
  },
  adoption: {
    high: 'Dùng nhiều',
    medium: 'Dùng vừa phải',
    low: 'Ít dùng',
  },
  influence: {
    decision_maker: 'Người quyết định',
    influencer: 'Người có ảnh hưởng',
    user: 'Người sử dụng',
    gatekeeper: 'Người giữ cửa',
  },
  stance: {
    champion: 'Người ủng hộ mạnh',
    supporter: 'Ủng hộ',
    neutral: 'Trung lập',
    skeptic: 'Còn nghi ngại',
    blocker: 'Phản đối',
  },
  /** how close New Era is to the person */
  strength: {
    strong: 'Thân thiết',
    warm: 'Khá tốt',
    cold: 'Còn xa',
  },
  /** verb inside a relation sentence: "Anh Bình (Mây Trắng) đã giới thiệu anh Minh (Cỏ Xanh)" */
  relationVerb: {
    introduced: 'đã giới thiệu',
    works_with: 'làm việc cùng',
    reports_to: 'báo cáo cho',
    former_colleague: 'từng là đồng nghiệp của',
  },
  /** relation kind as a label (pickers, legends) */
  relationKind: {
    introduced: 'Giới thiệu',
    works_with: 'Làm việc cùng',
    reports_to: 'Báo cáo cho',
    former_colleague: 'Đồng nghiệp cũ',
  },
  relationSentence: {
    /** two companies of one group */
    cross: '{from} ({fromAccount}) {verb} {to} ({toAccount})',
    /** same company */
    same: '{from} {verb} {to}',
  },
  /** change-request status, New Era wording */
  crStatus: {
    new: 'Mới',
    triaged: 'Đã tiếp nhận',
    planned: 'Đã lên kế hoạch',
    in_progress: 'Đang làm',
    done: 'Xong',
    declined: 'Từ chối',
  },
  /** change-request status as the client reads it */
  crStatusClient: {
    new: 'Đã gửi, chờ New Era tiếp nhận',
    triaged: 'New Era đã tiếp nhận',
    planned: 'Đã lên kế hoạch',
    in_progress: 'Đang thực hiện',
    done: 'Đã hoàn thành',
    declined: 'Chưa thực hiện được',
  },
  crSource: {
    client_portal: 'Khách gửi qua Client Hub',
    meeting: 'Trong buổi họp',
    email: 'Qua email',
    chat: 'Qua Zalo / tin nhắn',
    internal: 'New Era đề xuất',
  },
  crPriority: {
    high: 'Cần gấp',
    normal: 'Bình thường',
    low: 'Không gấp',
  },
  flags: {
    untriaged: 'Chưa xử lý quá 7 ngày',
    /** with the exact count */
    untriagedDays: 'Chưa xử lý {days} ngày',
    /** taken in more than 14 days ago, no date told to the client yet */
    undated: 'Tiếp nhận quá 14 ngày, chưa hẹn ngày',
    undatedDays: 'Tiếp nhận {days} ngày, chưa hẹn ngày',
    undatedHint: 'Đã tiếp nhận từ {days} ngày trước mà chưa hẹn ngày xong với khách.',
    debt: 'Nợ triển khai',
  },
  /** why a request is delivery debt (full sentence) */
  debtReason: {
    no_owner: 'Đã hẹn ngày với khách nhưng chưa có người phụ trách',
    no_plan: 'Đã hẹn ngày với khách nhưng chưa có kế hoạch làm',
    date_passed: 'Đã qua ngày hẹn với khách',
  },
  debtReasonShort: {
    no_owner: 'Chưa có người phụ trách',
    no_plan: 'Chưa có kế hoạch',
    date_passed: 'Quá ngày hẹn',
  },
  /** inside a sentence: "… đã hẹn khách ngày 05/10 nhưng {reason}" (daily notice to the AM / directors) */
  debtReasonInline: {
    no_owner: 'chưa có người phụ trách',
    no_plan: 'chưa có kế hoạch làm',
    date_passed: 'đã qua ngày hẹn mà chưa xong',
  },
  /** delivery health of an account (request roll-up) */
  deliveryHealth: {
    ok: 'Triển khai ổn định',
    /** a request waiting > 7 days to be taken in, or taken in > 14 days ago with no date for the client */
    attention: 'Có yêu cầu cần chú ý',
    debt: 'Có nợ triển khai',
  },
  careStatus: {
    ok: 'Đúng nhịp chăm sóc',
    due_soon: 'Sắp đến hạn chăm sóc',
    overdue: 'Quá hạn chăm sóc',
  },
  careStatusShort: {
    ok: 'Đúng nhịp',
    due_soon: 'Sắp đến hạn',
    overdue: 'Quá hạn',
  },
  /** group matrix cell */
  matrixCell: {
    live: 'Đang dùng',
    in_progress: 'Đang triển khai',
    opportunity: 'Cơ hội',
    none: 'Trống',
  },
  /** the expansion gate */
  gate: {
    blocked: 'Còn {count} yêu cầu nợ triển khai — xử lý xong mới mở rộng sang phòng ban mới.',
    open: 'Không còn nợ triển khai — có thể mở rộng sang phòng ban mới.',
    blockedBadge: 'Tạm dừng mở rộng',
  },
  coverage: 'Phòng ban đã phủ {covered}/{total}',
  /** shared care UI kit (components/care/**) */
  kit: {
    cadence: 'Nhịp chăm sóc {days} ngày',
    lastTouch: 'Lần chăm sóc gần nhất',
    neverTouched: 'Chưa có lần chăm sóc nào',
    daysSince: '{days} ngày trước',
    today: 'Hôm nay',
    logTouch: 'Ghi lần chăm sóc',
    logTouchFor: 'Ghi lần chăm sóc {account}',
    gateTitle: 'Tạm dừng mở rộng sang phòng ban mới',
    gateOverrideHint: 'Giám đốc có thể mở rộng ngoại lệ, kèm lý do được ghi vào nhật ký.',
    viewDebt: 'Xem yêu cầu đang nợ',
    newRequest: 'Thêm yêu cầu',
    requestForm: {
      title: 'Thêm yêu cầu của khách',
      description: 'Ghi lại một yêu cầu thay đổi khách nêu qua họp, email hay tin nhắn. Yêu cầu bắt đầu ở trạng thái Mới.',
      account: 'Khách hàng',
      accountPlaceholder: 'Chọn khách hàng',
      accountRequired: 'Chọn khách hàng của yêu cầu.',
      requestTitle: 'Khách cần gì',
      requestTitlePlaceholder: 'Ví dụ: Thêm bộ lọc cửa hàng trong báo cáo doanh thu',
      details: 'Mô tả',
      detailsPlaceholder: 'Bối cảnh, ai cần, cần trước khi nào…',
      source: 'Nhận qua',
      receivedAt: 'Ngày nhận',
      requestedBy: 'Người yêu cầu',
      requestedByNone: 'Không ghi',
      project: 'Dự án',
      deployment: 'Giải pháp liên quan',
      none: 'Không chọn',
      priority: 'Mức độ cần',
      submit: 'Thêm yêu cầu',
      created: 'Đã thêm yêu cầu {code}.',
      titleRequired: 'Cần ghi khách cần gì.',
      /** under "Khách cần gì" / "Mô tả": what the client reads */
      clientSees: 'Khách đọc được nội dung và mô tả này trong Client Hub.',
      internalOnly: 'Đề xuất của New Era chỉ nội bộ thấy — khách không thấy và không nhận thông báo.',
    },
    triage: {
      title: '{code} · {title}',
      description: 'Tiếp nhận, phân công, hẹn ngày với khách và lên kế hoạch. Khách thấy nội dung, mô tả, trạng thái, ngày hẹn, lời nhắn gửi khách và lý do từ chối.',
      /** a request New Era proposed itself (source 'internal') */
      descriptionInternal: 'Đề xuất của New Era: chỉ nội bộ thấy, khách không nhận được thông báo nào.',
      /** the promised date has passed: prompt to agree a new one */
      reschedulePrompt: 'Đã qua ngày hẹn với khách. Hẹn lại ngày mới và để lại lời nhắn — khách sẽ nhận được thông báo.',
      status: 'Trạng thái',
      owner: 'Người phụ trách (New Era)',
      ownerNone: 'Chưa phân công',
      promisedDate: 'Ngày hẹn với khách',
      promisedHint: 'Đã hẹn ngày thì cần người phụ trách và kế hoạch, nếu không sẽ thành nợ triển khai.',
      plan: 'Kế hoạch',
      planRef: 'Đợt làm / ghi chú kế hoạch',
      planRefPlaceholder: 'Ví dụ: Đợt phát triển 4',
      task: 'Hoặc gắn với một việc',
      taskNone: 'Không gắn việc',
      priority: 'Mức độ cần',
      clientNote: 'Lời nhắn gửi khách',
      clientNoteHint: 'Khách đọc được lời nhắn này trong Client Hub.',
      internalNote: 'Ghi chú nội bộ',
      internalNoteHint: 'Chỉ New Era thấy.',
      declineReason: 'Lý do chưa thực hiện được',
      declineHint: 'Bắt buộc khi từ chối; khách đọc được lý do này.',
      requestedBy: 'Người yêu cầu',
      openAccount: 'Mở trang khách hàng',
      receivedAt: 'Nhận ngày {date}',
      source: 'Nguồn',
      save: 'Lưu',
      saved: 'Đã cập nhật yêu cầu {code}.',
      readOnly: 'Chỉ Giám đốc, người quản lý khách hàng hoặc người phụ trách yêu cầu được cập nhật.',
      plannedNeedsDate: 'Cần ngày hẹn với khách để chuyển sang “Đã lên kế hoạch”.',
      declineNeedsReason: 'Cần ghi lý do để gửi khách khi từ chối.',
    },
    touch: {
      subjectDefault: 'Chăm sóc định kỳ',
      /** LogInteractionDialog in care mode (CareTouchButton) */
      title: 'Ghi lần chăm sóc',
      description: 'Lưu lại cuộc gọi, buổi gặp hay trao đổi vừa có với khách, rồi hẹn việc chăm sóc tiếp theo.',
      submit: 'Lưu lần chăm sóc',
      toast: 'Đã ghi lần chăm sóc.',
      nextTitle: 'Việc chăm sóc tiếp theo',
      current: 'Đang hẹn: “{action}”, hạn {date}.',
      currentSettled: 'Việc đã hẹn “{action}” (hạn {date}) được tính là xong với lần chăm sóc này.',
      next: 'Việc tiếp theo',
      nextPlaceholder: 'Ví dụ: Mời anh Minh xem bản demo báo cáo',
      nextHint: 'Để trống nếu chưa hẹn việc nào.',
      nextDue: 'Hạn',
      nextNeedsText: 'Ghi việc cần làm cho ngày hẹn này.',
    },
  },
  errors: {
    expansionBlocked: 'Còn yêu cầu nợ triển khai — xử lý xong mới mở rộng sang phòng ban mới.',
    expansionBlocked_detail: 'Còn {count} yêu cầu nợ triển khai — xử lý xong mới mở rộng sang phòng ban mới.',
    declineReasonRequired: 'Cần ghi lý do để gửi khách khi từ chối yêu cầu.',
    plannedNeedsDate: 'Cần ngày hẹn với khách để chuyển sang “Đã lên kế hoạch”.',
    titleRequired: 'Cần nhập nội dung yêu cầu.',
    nameRequired: 'Cần nhập tên giải pháp.',
    invalidOwner: 'Người phụ trách phải là thành viên New Era đang hoạt động.',
    invalidTask: 'Việc được gắn phải thuộc cùng khách hàng.',
    invalidProject: 'Dự án phải thuộc cùng khách hàng.',
    invalidDeployment: 'Giải pháp phải thuộc cùng khách hàng.',
    invalidContact: 'Người liên hệ phải thuộc cùng khách hàng.',
    receivedInFuture: 'Ngày nhận yêu cầu không thể ở tương lai.',
    relationSelf: 'Hãy chọn hai người khác nhau.',
    relationScope: 'Chỉ nối hai người cùng một công ty hoặc cùng một tập đoàn.',
    reportsToCycle: 'Quan hệ báo cáo đang tạo thành vòng lặp.',
    relationExists: 'Mối quan hệ này đã được ghi — hãy sửa mối quan hệ có sẵn.',
    cannotReopenAsNew: 'Yêu cầu đã được tiếp nhận không quay lại “Mới” — hãy chuyển về “Đã tiếp nhận”.',
    cadenceRange: 'Nhịp chăm sóc từ 1 đến 180 ngày.',
    noGroup: 'Không tìm thấy tập đoàn này.',
  },
};

export default care;
