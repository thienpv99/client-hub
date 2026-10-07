// i18n namespace 'components' — owner: common components (G2). Nested keys, Vietnamese text, {param} placeholders.
const components = {
  brand: { newEra: 'New Era' },
  loading: 'Đang tải…',

  /** used only when the matching enums.* key (owner G1) is missing */
  enumFallback: {
    health: { blocked: 'Đang bị chặn', attention: 'Cần chú ý', on_track: 'Đúng kế hoạch' },
    taskType: {
      approval: 'Phê duyệt',
      upload: 'Cung cấp tài liệu',
      confirm: 'Xác nhận',
      sign: 'Ký hợp đồng',
      payment: 'Thanh toán',
      attend: 'Tham dự',
      answer: 'Trả lời câu hỏi',
      work: 'Việc của New Era',
    },
    taskAction: {
      approve: 'Xem & duyệt',
      upload: 'Tải lên',
      confirm: 'Xác nhận',
      sign: 'Tải bản đã ký',
      payment: 'Báo đã chuyển khoản',
      attend: 'Xác nhận tham dự',
      answer: 'Trả lời',
      review_submission: 'Kiểm tra bản khách gửi',
      start: 'Bắt đầu làm',
      complete: 'Đánh dấu xong',
    },
    visibility: { internal: 'Nội bộ', shared: 'Chia sẻ với khách' },
    taskSide: { client: 'Khách hàng', internal: 'New Era' },
  },

  statusBand: {
    on_track: 'Dự án đang chạy đúng kế hoạch.',
    due_soon_blocking: 'Có {count} việc sắp đến hạn có thể làm lùi mốc {milestone}.',
    overdue: 'Có {count} việc đã quá hạn, chưa ảnh hưởng đến các mốc.',
    payment_overdue: 'Có {count} đợt thanh toán đã quá hạn.',
    waiting_client: 'Mốc {milestone} đang chờ {count} việc từ phía {salutation}. Mỗi ngày chậm, {milestone} lùi thêm 1 ngày.',
    waiting_internal: 'Mốc {milestone} đang lùi {days} ngày do New Era chậm “{task}”. New Era đang xử lý.',
    waiting_internal_hidden: 'Mốc {milestone} đang lùi {days} ngày do New Era chậm một việc chuẩn bị. New Era đang xử lý.',
    waiting_internal_risk: 'Mốc {milestone} có thể lùi do New Era chậm “{task}”. New Era đang xử lý.',
    waiting_internal_risk_hidden: 'Mốc {milestone} có thể lùi do New Era chậm một việc chuẩn bị. New Era đang xử lý.',
    clientSide: 'khách hàng',
    /** milestone chip on the status hero */
    milestoneSr: 'Mốc',
    delayChip: 'lùi {days} ngày',
    generic: {
      on_track: 'Dự án đang chạy đúng kế hoạch.',
      attention: 'Dự án có vài điểm cần chú ý. New Era đang theo dõi sát.',
      blocked: 'Dự án đang có việc bị chặn. New Era đang phối hợp để gỡ.',
    },
  },

  due: {
    daysLeft: 'Còn {days} ngày · {date}',
    today: 'Hôm nay · {date}',
    tomorrow: 'Ngày mai · {date}',
    overdue: 'Đã quá hạn {days} ngày',
    overdueCompact: 'Quá hạn {days} ngày',
    done: 'Xong · {date}',
    doneNoDate: 'Xong',
    plain: 'Hạn {date}',
    title: 'Hạn {date}',
  },

  forecast: {
    planned: 'Kế hoạch {date}',
    forecast: 'Dự báo {date}',
    onPlan: 'Đúng kế hoạch',
    done: 'Hoàn thành {date}',
    doneCompact: 'Xong {date}',
    causeClient: 'do chờ {task} {days} ngày',
    causeClientNoDays: 'do chờ {task}',
    causeInternal: 'do New Era chậm {task} {days} ngày',
    causeInternalNoDays: 'do New Era chậm {task}',
    causeHidden: 'do việc chuẩn bị của New Era chậm {days} ngày',
    causeHiddenNoDays: 'do việc chuẩn bị của New Era',
    cascade: 'do mốc {milestone} lùi {days} ngày',
    cascadeNoDays: 'do mốc {milestone} lùi',
    manual: '{reason} (điều chỉnh tay)',
    manualNoReason: 'Đã điều chỉnh tay',
    later: 'lùi {days} ngày',
    earlier: 'sớm {days} ngày',
    /** read before the bare dates "28/10 → 03/11" */
    plannedSr: 'Kế hoạch',
    forecastSr: 'Dự báo',
  },

  kpi: {
    filtering: 'Đang lọc theo thẻ này',
    trendUp: 'Tăng',
    trendDown: 'Giảm',
    trendFlat: 'Không đổi',
    progress: '{value}/{max}',
    progressPct: '{pct}%',
  },

  waiting: {
    client: 'Đang chờ khách',
    internal: 'Đang chờ New Era',
    /** WaitingCountsLine compact (narrow cards) */
    clientShort: 'Chờ khách',
    internalShort: 'Chờ New Era',
    overdue: '{count} quá hạn',
  },

  date: {
    none: '—',
    today: 'hôm nay',
    yesterday: 'hôm qua',
    tomorrow: 'ngày mai',
    daysAgo: '{days} ngày trước',
    inDays: '{days} ngày nữa',
  },

  error: {
    title: 'Chưa tải được dữ liệu',
    description: 'Kết nối có thể đang chập chờn. Vui lòng thử lại sau giây lát.',
    retry: 'Thử lại',
    /** forbidden / not_found: retrying cannot help */
    deniedTitle: 'Không xem được nội dung này',
    notFoundTitle: 'Không tìm thấy nội dung này',
  },

  pageHeader: { back: 'Quay lại' },

  stepper: {
    label: 'Các mốc của dự án',
    empty: 'Dự án chưa có mốc nào.',
    done: 'Xong {date}',
    stateDone: 'đã xong',
    stateCurrent: 'đang thực hiện',
    stateUpcoming: 'sắp tới',
    forecastTitle: 'Kế hoạch {planned} → Dự báo {forecast}',
  },

  chain: {
    label: 'Chuỗi ảnh hưởng',
    hiddenTask: 'Việc chuẩn bị của New Era',
    stuck: 'đang kẹt',
    done: 'đã xong',
    milestone: 'mốc',
  },

  impact: {
    title: 'Nếu chưa làm',
    milestones: 'Mốc bị ảnh hưởng',
  },

  blocked: {
    label: 'Việc này đang bị chặn',
    waiting: 'Đang chờ: {task} – {who}',
    waitingHidden: 'Đang chờ: việc chuẩn bị của New Era',
  },

  internal: {
    only: 'Chỉ nội bộ',
    noteTitle: 'Ghi chú nội bộ',
  },

  activity: {
    generic: '{actor} đã cập nhật thông tin',
    system: 'Hệ thống',
    empty: 'Chưa có cập nhật nào.',
  },

  files: {
    version: 'v{version}',
    versions: 'Các phiên bản',
    latest: 'mới nhất',
    download: 'Tải xuống',
    downloadName: 'Tải xuống {name}',
    preview: 'Xem trước {name}',
    noPreview: 'Tệp này chưa xem trước được trong ứng dụng. Tải xuống để mở.',
    shared: 'Chia sẻ với khách',
    empty: 'Chưa có tài liệu nào.',
  },

  dialog: {
    cancel: 'Hủy',
    working: 'Đang xử lý…',
    submitHint: 'Ctrl + Enter để gửi',
  },

  gallery: {
    title: 'Thành phần chung',
    subtitle: 'Bản xem nhanh mọi thành phần hiển thị dùng chung, với dữ liệu mẫu.',
    open: 'Mở',
    actionDocs: 'Tài liệu',
    actionNew: 'Tạo việc',
    kpiHint: 'Thẻ đầu tiên bấm được (lọc nhanh).',
    kpi: {
      risk: 'Account cần chú ý',
      overdue: 'Việc quá hạn',
      overdueSub: 'Phía khách 3 · Phía New Era 2',
      contract: 'Giá trị hợp đồng năm nay',
      contractSub: '7 hợp đồng đã ký',
      receivable: 'Phải thu',
      receivableOverdue: 'đã quá hạn',
      collected: 'Đã thu năm nay',
      collectedSub: 'Kế hoạch năm 6,2 tỷ ₫',
      collectedProgress: 'Đã thu 4/6 đợt',
      pipeline: 'Pipeline đang mở',
      pipelineSub: '12 cơ hội đang theo',
      vsLastMonth: 'so với tháng trước',
      winRate: 'Tỷ lệ thắng',
      winRateSub: '180 ngày gần nhất',
      overdueTrendSub: 'Giảm từ 8 việc tuần trước',
      trendPipeline: '+1,2 tỷ',
      trendWinRate: '−5 điểm',
    },
    header: {
      eyebrow: 'Khách hàng · Bán lẻ',
      title: 'Cỏ Xanh Retail',
      description: 'AM Nguyễn Thu Hà · Hợp đồng 3,2 tỷ ₫ · Mốc tiếp theo UAT',
      tabs: { overview: 'Tổng quan', tasks: 'Việc', roadmap: 'Lộ trình', documents: 'Tài liệu' },
    },
    list: {
      title: 'Mốc sắp tới',
      description: '3 mốc trong 45 ngày tới',
      viewAll: 'Xem lộ trình',
      footer: 'Dự báo cập nhật mỗi khi một việc đổi trạng thái.',
    },
    internalNote: 'Anh Minh thường duyệt vào buổi tối, nên nhắc qua Zalo trước 17h. Không nhắc lại chuyện chiết khấu ở buổi họp tới.',
    chips: { blocked: 'Đang bị chặn', waitingClient: 'Chờ khách', overdueReceivable: 'Quá hạn thu' },
    reason: {
      open: 'Yêu cầu chỉnh sửa',
      title: 'Yêu cầu chỉnh sửa thiết kế',
      description: 'New Era sẽ nhận được nội dung này và gửi lại bản mới.',
      label: 'Cần chỉnh sửa gì?',
      placeholder: 'Ví dụ: chuyển nút Đặt hàng lên đầu trang',
      confirm: 'Gửi yêu cầu',
    },
    confirm: {
      open: 'Xóa việc',
      title: 'Xóa việc này?',
      description: 'Việc “Chuẩn bị dữ liệu mẫu” sẽ bị xóa khỏi lộ trình. Thao tác này không hoàn tác được.',
      label: 'Xóa việc',
    },
    previewImage: 'Xem ảnh thiết kế',
    previewPdf: 'Xem PDF',
    previewOther: 'Xem tệp Excel',
    empty: {
      title: 'Hiện không có việc nào cần anh xử lý. Dự án đang chạy theo kế hoạch.',
      description: 'Khi New Era cần anh duyệt hoặc cung cấp tài liệu, việc sẽ hiện ở đây kèm hạn và hệ quả nếu trễ.',
      action: 'Xem tiến độ',
      compact: 'Chưa có bình luận nào.',
    },
    sections: {
      badges: 'Huy hiệu và nhãn',
      statusBand: 'Băng trạng thái',
      due: 'Hạn việc',
      forecast: 'Dự báo mốc',
      counts: 'Bộ đếm',
      identity: 'Logo và ảnh đại diện',
      layout: 'Tiêu đề trang, thẻ và KPI',
      stepper: 'Thanh giai đoạn',
      impact: 'Chuỗi ảnh hưởng và hệ quả',
      internal: 'Nội bộ',
      activity: 'Cập nhật mới',
      files: 'Tài liệu',
      dialogs: 'Hộp thoại',
      chips: 'Bộ lọc nhanh',
      states: 'Trạng thái rỗng',
      errors: 'Lỗi',
      skeletons: 'Đang tải',
      kpiVariants: 'Thẻ KPI: xu hướng, tiến độ, biểu đồ nhỏ',
      cards: 'Thẻ nội dung: danh sách có vạch chia và chân thẻ',
      pageHeader: 'Tiêu đề trang chi tiết (dòng nhỏ, thẻ tab)',
    },
  },
};

export default components;
