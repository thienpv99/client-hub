// i18n namespace 'roadmap' — owner: feature: roadmap. Nested keys, Vietnamese text, {param} placeholders.
const roadmap = {
  project: {
    switcher: 'Dự án',
    dates: '{start} – {end}',
    progress: '{done}/{total} mốc đã xong',
  },

  /** the 5-second answer heading the timeline card: launch milestone forecast + shift chip */
  headline: {
    forecast: 'Mốc {name} dự báo {date}',
    expected: 'Mốc {name} dự kiến {date}',
    allDone: 'Đã hoàn thành mọi mốc',
    later: 'lùi {days} ngày',
    earlier: 'sớm {days} ngày',
    onPlan: 'Đúng kế hoạch',
    planned: 'Kế hoạch {date}',
    /** screen readers: the whole sentence in one go */
    laterSr: 'Mốc {name} dự báo {date}, lùi {days} ngày so với kế hoạch {planned}.',
    earlierSr: 'Mốc {name} dự báo {date}, sớm {days} ngày so với kế hoạch {planned}.',
  },

  actions: {
    fromTemplate: 'Tạo nhanh từ mẫu',
    addMilestone: 'Thêm mốc',
    more: 'Thao tác với mốc {name}',
    edit: 'Sửa tên, ngày kế hoạch',
    override: 'Điều chỉnh dự báo',
    addTask: 'Thêm việc vào mốc',
    complete: 'Đánh dấu hoàn thành',
    completeShort: 'Hoàn thành mốc',
  },

  tags: {
    manual: 'Điều chỉnh tay',
    hidden: 'Ẩn với khách',
  },

  delay: {
    later: '+{days} ngày',
    earlier: '−{days} ngày',
    laterAria: 'Lùi {days} ngày so với kế hoạch',
    earlierAria: 'Sớm {days} ngày so với kế hoạch',
  },

  counts: {
    none: 'Chưa có việc',
    openOnly: '{open} việc đang mở',
    doneOnly: '{done} việc đã xong',
    both: '{open} đang mở · {done} đã xong',
  },

  visible: {
    label: 'Khách thấy được',
    shown: 'Khách sẽ thấy mốc “{name}”.',
    hidden: 'Đã ẩn mốc “{name}” với khách.',
  },

  help: {
    aria: 'Cách tính ngày dự báo',
    title: 'Cách tính ngày dự báo',
    rule: 'Ngày dự báo = kế hoạch + số ngày trễ lớn nhất của việc đang chặn; các mốc sau lùi theo.',
    extra:
      'Việc chặn gián tiếp cũng được tính, việc đã xong muộn tính đến ngày hoàn thành. Account Manager có thể điều chỉnh tay kèm lý do.',
  },

  timeline: {
    title: 'Dòng thời gian',
    milestoneCol: 'Mốc',
    month: 'T{month}',
    monthYear: 'T{month}/{year}',
    todayDate: 'Hôm nay · {date}',
    markerPlanned: 'Kế hoạch {date}',
    doneOn: 'Xong {date}',
    legend: 'Chú giải',
    legendOnPlan: 'Đúng kế hoạch',
    legendPlanned: 'Kế hoạch',
    legendForecast: 'Dự báo',
    legendDone: 'Đã xong',
    legendToday: 'Hôm nay',
    legendPhase: 'Giai đoạn',
  },

  list: {
    title: 'Các mốc',
    description: '{done}/{count} mốc đã xong',
    colMilestone: 'Mốc',
    colForecast: 'Kế hoạch → Dự báo',
    colTasks: 'Việc',
    colActions: 'Thao tác',
  },

  tasks: {
    title: 'Việc trong mốc {name}',
    show: 'Xem {count} việc',
    hide: 'Ẩn danh sách việc',
    /** screen readers, after the counts on the toggle button */
    toggleSr: 'việc của mốc {name}',
    empty: 'Mốc này chưa có việc nào.',
  },

  empty: {
    noProjects: '{account} chưa có dự án nào.',
    noProjectsManager: 'Chọn một mẫu lộ trình để có ngay các mốc chuẩn, rồi chỉnh ngày theo dự án.',
    noProjectsViewer: 'Khi Account Manager lập lộ trình, các mốc sẽ hiện ở đây.',
    noMilestones: 'Dự án “{project}” chưa có mốc nào.',
    noMilestonesManager: 'Áp dụng một mẫu lộ trình để có ngay các mốc chuẩn, hoặc thêm từng mốc.',
    noMilestonesViewer: 'Khi Account Manager thêm mốc, lộ trình sẽ hiện ở đây.',
    applyTemplate: 'Áp dụng mẫu',
  },

  form: {
    addTitle: 'Thêm mốc',
    addDescription: 'Mốc mới được thêm vào cuối lộ trình của dự án “{project}”.',
    editTitle: 'Sửa mốc “{name}”',
    editDescription: 'Đổi tên, ngày kế hoạch hoặc mô tả. Ngày dự báo được tính lại theo ngày kế hoạch mới.',
    name: 'Tên mốc',
    namePlaceholder: 'Ví dụ: UAT vòng 2',
    nameRequired: 'Vui lòng nhập tên mốc.',
    planned: 'Ngày kế hoạch',
    plannedHint: 'các mốc sau tính lại dự báo theo ngày này',
    dateRequired: 'Vui lòng chọn ngày hợp lệ.',
    dateSpelled: '{weekday}, {date}',
    warnBeforeLast: 'Ngày này sớm hơn mốc cuối hiện tại “{name}” ({date}).',
    warnBefore: 'Ngày này sớm hơn mốc trước “{name}” ({date}).',
    warnAfter: 'Ngày này muộn hơn mốc sau “{name}” ({date}).',
    description: 'Mô tả ngắn',
    descriptionPlaceholder: 'Mốc này gồm những gì, khách cần chuẩn bị gì',
    visibleHint: 'Khách sẽ thấy mốc này ở trang Tiến độ.',
    submitAdd: 'Thêm mốc',
    submitEdit: 'Lưu thay đổi',
    added: 'Đã thêm mốc “{name}”.',
    saved: 'Đã lưu mốc “{name}”.',
  },

  override: {
    title: 'Điều chỉnh dự báo mốc “{name}”',
    description:
      'Dùng khi đã biết mốc sẽ xong vào một ngày khác với cách tính tự động. Ngày này được giữ cho đến khi về tính tự động.',
    current: 'Hiện tại',
    date: 'Ngày dự báo mới',
    shiftLater: 'lùi {days} ngày so với kế hoạch {date}',
    shiftEarlier: 'sớm {days} ngày so với kế hoạch {date}',
    shiftNone: 'trùng ngày kế hoạch {date}',
    cascadeNote: 'Các mốc sau trong dự án sẽ lùi theo.',
    reason: 'Lý do',
    reasonPlaceholder: 'Ví dụ: Khách dời lịch UAT sang tuần sau',
    reasonHintClient: 'Khách sẽ thấy lý do này cạnh ngày dự báo.',
    reasonHintInternal: 'Mốc này đang ẩn với khách. Lý do được lưu trong nhật ký.',
    reasonRequired: 'Vui lòng ghi lý do điều chỉnh.',
    clearHint: 'Mốc đang dùng ngày điều chỉnh tay. Về tính tự động để hệ thống tính lại theo các việc đang chặn.',
    clear: 'Về tính tự động',
    submit: 'Lưu dự báo',
    saved: 'Đã điều chỉnh dự báo mốc “{name}” sang {date}.',
    cleared: 'Mốc “{name}” đã về dự báo tự động.',
  },

  complete: {
    title: 'Đánh dấu hoàn thành mốc “{name}”?',
    body: 'Mốc sẽ được ghi nhận hoàn thành hôm nay ({date}).',
    clientSees: 'Khách sẽ thấy mốc này đã xong ở trang Tiến độ.',
    openTasks: 'Mốc vẫn còn {count} việc chưa xong. Các việc này giữ nguyên trạng thái.',
    payments: 'Đợt thanh toán gắn với mốc này sẽ chuyển sang “Đến hạn xuất hóa đơn”:',
    paymentItem: '{name} · {percent} · {amount}',
    paymentsGeneric: 'Đợt thanh toán gắn với mốc này (nếu có) sẽ chuyển sang “Đến hạn xuất hóa đơn”.',
    paymentsLoading: 'Đang kiểm tra các đợt thanh toán gắn với mốc…',
    noPayments: 'Không có đợt thanh toán nào đang chờ mốc này.',
    irreversible: 'Thao tác này không hoàn tác được.',
    confirm: 'Hoàn thành mốc',
    done: 'Đã hoàn thành mốc “{name}”.',
    doneWithPayments: 'Đã hoàn thành mốc “{name}”. {count} đợt thanh toán đã chuyển sang Đến hạn xuất hóa đơn.',
  },

  template: {
    title: 'Tạo nhanh từ mẫu',
    descriptionNew: 'Chọn mẫu lộ trình, đặt tên dự án và ngày bắt đầu. Các mốc được tạo sẵn theo mẫu và sửa được sau.',
    descriptionApply: 'Các mốc của mẫu sẽ được thêm vào dự án “{project}”, tính ngày từ ngày bắt đầu.',
    target: 'Áp dụng cho',
    targetExisting: 'Dự án “{project}”',
    targetNew: 'Dự án mới',
    pick: 'Mẫu lộ trình',
    meta: '{count} mốc · khoảng {weeks} tuần',
    empty: 'Chưa có mẫu lộ trình nào. Mẫu được quản lý trong Cài đặt.',
    projectName: 'Tên dự án',
    projectNamePlaceholder: 'Ví dụ: Cổng đặt hàng đại lý',
    nameRequired: 'Vui lòng nhập tên dự án.',
    startDate: 'Ngày bắt đầu',
    schedule: 'Lịch dự kiến theo mẫu',
    submitNew: 'Tạo dự án',
    submitApply: 'Áp dụng mẫu',
    created: 'Đã tạo dự án “{name}” với {count} mốc.',
    applied: 'Đã thêm {count} mốc vào dự án “{name}”.',
  },
};

export default roadmap;
