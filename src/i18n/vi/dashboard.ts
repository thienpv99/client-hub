// i18n namespace 'dashboard' — owner: feature: dashboard. Nested keys, Vietnamese text, {param} placeholders.
// Director / AM overview (/app) and the account portfolio (/app/accounts) — SPEC §4.1, DESIGN §5.
const dashboard = {
  title: 'Tổng quan',
  /** browser tab: {page} = page title, {app} = common.appName */
  documentTitle: '{page} · {app}',
  /** "Thứ Tư, 07/10/2026" */
  dateLine: '{weekday}, {date}',
  /** {name} = "anh Nam" (salutation + given name) or the given name alone */
  greeting: 'Chào {name}',
  /** one sentence under the greeting */
  summary: {
    director: 'Hôm nay có {count} điểm cần chú ý trên {total} khách hàng.',
    am: 'Hôm nay có {count} điểm cần chú ý trong {total} khách hàng đang phụ trách.',
    calmDirector: 'Hôm nay không có điểm nào cần chú ý trên {total} khách hàng.',
    calmAm: 'Hôm nay không có điểm nào cần chú ý trong {total} khách hàng đang phụ trách.',
  },
  digest: 'Bản tin tuần',

  kpi: {
    risk: {
      /** short: one line in the 2-up phone tile */
      label: 'Account rủi ro',
      blocked: '{count} bị chặn',
      attention: '{count} cần chú ý',
      allClear: 'Không có account nào gặp rủi ro',
      noActive: 'Chưa có account đang triển khai',
      /** progress caption: on-track share of the accounts in delivery */
      onTrack: '{count}/{total} đúng kế hoạch',
    },
    overdue: {
      label: 'Việc quá hạn',
      client: 'Khách {count}',
      internal: 'New Era {count}',
      none: 'Không có việc trễ hạn',
    },
    contract: {
      label: 'Giá trị hợp đồng {year}',
      sub: '{count} hợp đồng đã ký',
      subNone: 'Chưa có hợp đồng ký trong năm',
    },
    receivable: {
      label: 'Phải thu',
      overdue: '{amount} quá hạn',
      noOverdue: 'Không có khoản quá hạn',
    },
  },

  attention: {
    title: 'Cần chú ý hôm nay',
    countLabel: '{count} điểm cần chú ý',
    listLabel: 'Các điểm cần chú ý, nặng nhất lên đầu',
    viewOverdue: 'Xem mọi việc quá hạn',
    /** header caption: only the non-zero parts, joined with " · " */
    bySeverity: {
      '1': '{count} nghiêm trọng',
      '2': '{count} cần xử lý',
      '3': '{count} theo dõi',
    },
    empty: {
      title: 'Hôm nay không có điểm nào cần chú ý.',
      description: 'Khi có việc quá hạn, báo giá chờ duyệt hay khoản thu trễ, chúng sẽ hiện ở đây.',
    },
    severity: {
      '1': 'Nghiêm trọng',
      '2': 'Cần xử lý',
      '3': 'Theo dõi',
    },
    /** caption under each sentence: whose move it is / what it is about */
    meta: {
      client_overdue_blocking: 'Phía khách · đang chặn mốc',
      due_soon_blocking: 'Phía khách · đang chặn mốc',
      escalation: 'Phía khách · đã báo Người quyết định',
      internal_overdue_blocking: 'Phía New Era · đang chặn mốc',
      internal_overdue: 'Phía New Era',
      quote_pending_approval: 'Báo giá · tổng {amount}',
      payment_overdue: 'Công nợ',
      quote_changes_requested: 'Báo giá',
      quote_changes_requested_note: 'Khách ghi: “{note}”',
    },
    // One sentence per AttentionKind, filled with AttentionItem.params ({task} is lower-cased mid-sentence).
    client_overdue_blocking: '{account}: {milestone} đang chờ khách {task}, đã quá hạn {days} ngày',
    internal_overdue_blocking: '{account}: {milestone} đang chờ New Era {task}, đã quá hạn {days} ngày',
    escalation: '{account}: đã báo Người quyết định phía khách về “{task}”, quá hạn {days} ngày',
    quote_pending_approval: 'Báo giá v{version} cho {account} chiết khấu {discount}%, chờ duyệt',
    payment_overdue: '{account}: {payment} ({amount}) đã quá hạn thu {days} ngày',
    quote_changes_requested: '{account} đề nghị điều chỉnh báo giá v{version} “{quote}”',
    due_soon_blocking: '{account}: mốc {milestone} chờ khách {task}, còn {days} ngày',
    due_soon_blocking_today: '{account}: mốc {milestone} chờ khách {task}, đến hạn hôm nay',
    due_soon_blocking_tomorrow: '{account}: mốc {milestone} chờ khách {task}, đến hạn ngày mai',
    internal_overdue: '{account}: việc “{task}” của New Era đã quá hạn {days} ngày',
    generic: '{account}: có điểm cần xem lại',
    actions: {
      remind_client: 'Nhắc khách',
      open_account: 'Mở account',
      approve_quote: 'Duyệt',
      view_quote: 'Xem',
      open_task: 'Xem việc',
      view_receivables: 'Xem phải thu',
      zalo: 'Nhắc qua Zalo',
    },
    approve: {
      title: 'Duyệt báo giá v{version} cho {account}?',
      description:
        'Chiết khấu {discount}% · tổng {amount}. Sau khi duyệt, AM gửi được báo giá này cho khách. Thao tác này không hoàn tác được.',
      confirm: 'Duyệt báo giá',
      done: 'Đã duyệt báo giá v{version} cho {account}.',
    },
  },

  cashflow: {
    title: 'Thu tiền {year}',
    /** after the big "đã thu" number */
    planned: 'Kế hoạch thu',
    ofPlan: 'trên {planned} kế hoạch đến tháng này',
    rate: 'Đạt {pct}',
    actual: 'Thực thu',
    month: 'Tháng {n}',
    empty: 'Chưa có đợt thu nào được lên lịch trong năm {year}.',
    tableCaption: 'Thực thu và kế hoạch thu theo tháng, năm {year}',
    tableMonth: 'Tháng',
    receivables: 'Phải thu',
  },

  upcoming: {
    title: 'Mốc sắp tới',
    late: 'lùi {days} ngày',
    rowLabel: '{milestone}, {account}, dự báo {date}',
    empty: 'Chưa có mốc nào sắp tới.',
    emptyDescription: 'Khi dự án có mốc mới, chúng sẽ hiện ở đây theo ngày dự báo.',
    viewAll: 'Xem dòng thời gian',
  },

  valueMap: {
    title: 'Bản đồ giá trị',
    description: 'Khách hàng lớn nhất theo hợp đồng và pipeline',
    open: 'Mở bản đồ',
    openLabel: 'Mở bản đồ khách hàng',
    contract: 'Hợp đồng',
    pipeline: 'Pipeline',
    total: 'Tổng {value} trên {count} khách hàng',
    listLabel: 'Khách hàng xếp theo tổng giá trị',
    rowLabel: 'Hạng {rank}: {name}, {value} (hợp đồng {contract}, pipeline {pipeline})',
    empty: 'Chưa có khách hàng nào có giá trị.',
    emptyDescription: 'Khi có hợp đồng hoặc cơ hội, khách hàng lớn nhất sẽ hiện ở đây.',
  },

  portfolio: {
    title: 'Danh mục khách hàng',
    viewAll: 'Xem tất cả',
    chipsLabel: 'Lọc nhanh danh mục khách hàng',
    chips: {
      blocked: 'Đang bị chặn',
      waiting_client: 'Chờ khách',
      overdue_receivable: 'Quá hạn thu',
    },
    /** label of every filter (chips + KPI shortcuts) for the "đang lọc" line */
    filters: {
      blocked: 'Đang bị chặn',
      waiting_client: 'Có việc chờ khách',
      overdue_receivable: 'Có khoản quá hạn thu',
      at_risk: 'Đang bị chặn hoặc cần chú ý',
      overdue_tasks: 'Có việc quá hạn',
      receivable: 'Còn phải thu',
    },
    am: {
      trigger: 'Theo AM',
      selected: 'AM: {name}',
      menuLabel: 'Lọc theo Account Manager',
      all: 'Tất cả AM',
    },
    count: '{count} khách hàng',
    result: '{shown}/{total} khách hàng',
    clear: 'Bỏ lọc',
    columns: {
      account: 'Khách hàng',
      am: 'AM',
      stage: 'Giai đoạn',
      health: 'Sức khỏe',
      next: 'Mốc tiếp theo',
      waiting: 'Đang chờ',
      contract: 'Giá trị HĐ',
      receivable: 'Phải thu',
      updated: 'Cập nhật',
    },
    tableCaption: 'Danh mục khách hàng, bấm một dòng để mở chi tiết',
    nextLabel: 'Mốc tiếp theo',
    noMilestone: 'Chưa có mốc sắp tới',
    waitingClient: 'Khách',
    waitingInternal: 'New Era',
    waitingOverdue: '{count} quá hạn',
    waitingTitle: 'Đang chờ khách: {client} · Đang chờ New Era: {internal}',
    /** non-breaking space: "quá hạn" never splits in a narrow table cell */
    receivableOverdue: '{amount} quá hạn',
    noReceivable: 'Không có',
    /** contract value column for prospects without a signed contract */
    noContract: 'Chưa có',
    updatedPrefix: 'Cập nhật',
    empty: {
      none: 'Chưa có khách hàng nào.',
      noneDescription: 'Khi có account mới, khách hàng sẽ hiện ở đây kèm sức khỏe, mốc tiếp theo và công nợ.',
      filtered: 'Không có khách hàng nào khớp bộ lọc đang chọn.',
      filteredDescription: 'Thử bỏ bớt bộ lọc để xem toàn bộ danh mục.',
      search: 'Không tìm thấy khách hàng nào cho “{query}”.',
    },
  },

  accounts: {
    title: 'Khách hàng',
    /** header sentence: health of the portfolio (the count itself is on the result line) */
    description: '{blocked} khách hàng đang bị chặn, {attention} cần chú ý.',
    descriptionBlocked: '{blocked} khách hàng đang bị chặn, còn lại đúng kế hoạch.',
    descriptionAttention: '{attention} khách hàng cần chú ý, còn lại đúng kế hoạch.',
    descriptionCalm: 'Tất cả khách hàng đang chạy đúng kế hoạch.',
    descriptionEmpty: 'Sức khỏe, mốc tiếp theo và công nợ của từng khách hàng.',
    create: 'Tạo account',
    searchLabel: 'Tìm khách hàng',
    searchPlaceholder: 'Tìm theo tên, ngành hoặc AM…',
    sortLabel: 'Sắp xếp',
    sort: {
      health: 'Theo sức khỏe',
      name: 'Theo tên',
      receivable: 'Theo phải thu',
      next: 'Theo mốc tiếp theo',
    },
  },
};

export default dashboard;
