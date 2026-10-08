// i18n namespace 'projects' — owner: CRM extension (projects UI). Nested keys, Vietnamese text, {param} placeholders.
// Project portfolio /app/projects: Danh mục · Dòng thời gian · Tải việc (ARCHITECTURE §13).
const projects = {
  page: {
    title: 'Dự án',
    /** scope line under the title (the health numbers live in the KPI cards) */
    description: '{total} dự án của {accounts} khách hàng',
    descriptionEmpty: 'Sức khỏe, tiến độ và mốc sắp tới của mọi dự án.',
  },

  tabs: {
    label: 'Cách xem dự án',
    portfolio: 'Danh mục',
    timeline: 'Dòng thời gian',
    workload: 'Tải việc',
  },

  kpi: {
    running: {
      label: 'Dự án đang chạy',
      subDone: '{done} đã hoàn thành',
      subPaused: '{paused} tạm dừng',
      subBoth: '{done} đã hoàn thành · {paused} tạm dừng',
      subAll: 'Tất cả đang triển khai',
      /** progress bar under the number: done tasks / all tasks of the running projects */
      progress: 'Việc đã xong',
    },
    risk: {
      // label = enums.health.blocked · enums.health.attention, value "1 · 2" in the same order
      sub: 'trên {total} dự án chưa hoàn thành',
      subNone: 'Không có dự án nào cần chú ý',
    },
    slip: {
      /** "kế hoạch" is one word (non-breaking space): narrow tiles read "Đang trễ / kế hoạch" */
      label: 'Đang trễ kế hoạch',
      sub: 'Trễ nhất +{days} ngày · {account}',
      subNone: 'Mọi dự án đúng kế hoạch',
    },
    overdue: {
      label: 'Việc quá hạn',
      client: 'Phía khách {count}',
      internal: 'Phía New Era {count}',
    },
  },

  filters: {
    searchLabel: 'Tìm dự án',
    searchPlaceholder: 'Tìm dự án, mã, khách hàng…',
    /** phones (the box shares its row with the status select) */
    searchPlaceholderShort: 'Tìm dự án…',
    statusLabel: 'Trạng thái',
    statusAll: 'Mọi trạng thái',
    chipsLabel: 'Lọc theo sức khỏe dự án',
    amTrigger: 'Theo AM',
    amSelected: 'AM: {name}',
    amMenuLabel: 'Lọc theo AM phụ trách',
    amAll: 'Tất cả AM',
    count: '{total} dự án',
    result: '{shown}/{total} dự án',
    clear: 'Bỏ lọc',
    /** every filter (chips + KPI shortcuts) for the "đang lọc" line */
    labels: {
      blocked: 'Đang bị chặn',
      attention: 'Cần chú ý',
      on_track: 'Đúng kế hoạch',
      at_risk: 'Đang bị chặn hoặc cần chú ý',
      slipping: 'Đang trễ kế hoạch',
      overdue: 'Có việc quá hạn',
    },
  },

  portfolio: {
    tableCaption: 'Danh mục dự án, xếp theo mức độ cần chú ý. Bấm một dòng để mở lộ trình của dự án.',
    columns: {
      project: 'Dự án',
      health: 'Sức khỏe',
      progress: 'Tiến độ',
      next: 'Mốc tiếp theo',
      waiting: 'Đang chờ',
      end: 'Kết thúc',
      actions: 'Thao tác',
    },
    /** table subline under the project name (the AM replaces the "Phụ trách" column from 1280px) */
    subline: '{account} · AM {am}',
    tasksLink: 'Việc',
    tasksLinkLabel: 'Xem việc của {name}',
    empty: {
      none: 'Chưa có dự án nào.',
      noneDescription: 'Khi một khách hàng bắt đầu triển khai, dự án sẽ hiện ở đây kèm sức khỏe, tiến độ và mốc sắp tới.',
      filtered: 'Không có dự án nào khớp bộ lọc đang chọn.',
      filteredDescription: 'Thử bỏ bớt bộ lọc để xem toàn bộ danh mục.',
      search: 'Không tìm thấy dự án nào cho “{query}”.',
    },
  },

  team: {
    label: 'Nhóm đang làm: {names}',
    none: 'Chưa có ai',
  },

  progress: {
    label: 'Tiến độ {name}',
    valueText: 'Đã xong {pct}%',
    pct: '{pct}%',
    tasks: '{done}/{total} việc đã xong',
    noTasks: 'Chưa có việc',
  },

  slip: {
    value: '+{days} ngày',
    title: 'Trễ {days} ngày so với kế hoạch',
    /** slip 0: says the milestones did not move (not the health — a yellow project can have no slip) */
    onPlan: 'Mốc chưa lùi',
  },

  end: {
    forecast: 'Dự báo {date}',
    forecastSr: 'Dự báo',
    done: 'Xong {date}',
    /** table cell, under the date */
    doneShort: 'Đã xong',
    /** tooltip of the end column: planned / forecast = final milestone, end = project end date */
    title: 'Mốc cuối: kế hoạch {planned} → dự báo {forecast} · Dự án kết thúc {end}',
  },

  next: {
    label: 'Mốc tiếp theo',
    none: 'Chưa có mốc nào',
    allDone: 'Đã xong mọi mốc',
  },

  waiting: {
    client: 'Khách',
    internal: 'New Era',
    overdue: '{count} quá hạn',
  },

  timeline: {
    label: 'Dòng thời gian các dự án, cuộn ngang để xem thêm tháng',
    rowsLabel: 'Các dự án',
    /** one-line summary above the chart (DESIGN §4 charts) */
    summarySlipping: '{count} dự án đang trễ kế hoạch, trễ nhất là {name} (+{days} ngày).',
    summaryCalm: 'Mọi dự án đang chạy đúng kế hoạch.',
    hint: 'Mỗi dòng là một dự án, từ ngày bắt đầu đến mốc cuối. Chạm hoặc di chuột vào một mốc để xem kế hoạch và dự báo.',
    hintList: 'Xếp theo mốc sắp tới gần nhất. Xem dòng thời gian đầy đủ trên máy tính bảng hoặc máy tính.',
    zoom: {
      label: 'Thang thời gian',
      month: 'Tháng',
      quarter: 'Quý',
    },
    projectColumn: 'Dự án',
    today: 'Hôm nay',
    month: 'Tháng {month}',
    monthYear: 'Tháng {month}/{year}',
    monthShort: 'T{month}',
    monthShortYear: 'T{month}/{year}',
    rowSummary: 'Từ {start} đến {end}, đã xong {pct}%.',
    rowSummaryLate: 'Từ {start} đến {end}, đang trễ {days} ngày, mốc cuối dự báo {forecast}, đã xong {pct}%.',
    /** marker button: {sentence} = "Kế hoạch 28/10 → Dự báo 03/11 · do …" */
    markerLabel: 'Mốc {name}, {project}: {sentence}',
    legend: {
      span: 'Thời gian dự án (phần đậm: đã xong)',
      planned: 'Kế hoạch',
      forecast: 'Dự báo',
      done: 'Mốc đã xong',
      slip: 'Trễ so với kế hoạch',
      today: 'Hôm nay',
    },
    empty: {
      title: 'Chưa có dự án nào để xếp lên dòng thời gian.',
      description: 'Khi có dự án, mỗi dự án hiện thành một dòng kèm các mốc kế hoạch và dự báo.',
    },
  },

  workload: {
    /** one-line summary heading the heat map */
    summary: '{people} người đang có {open} việc mở, {overdue} việc đã quá hạn.',
    summaryNoOverdue: '{people} người đang có {open} việc mở, không có việc quá hạn.',
    explain: 'Mỗi ô là số việc đến hạn trong tuần; việc quá hạn tính vào tuần này. Ô càng đậm, càng nhiều việc.',
    legendLess: 'Ít',
    legendMore: 'Nhiều',
    tableCaption: 'Tải việc theo người và theo tuần. Bấm một dòng để xem việc của người đó.',
    columns: {
      person: 'Thành viên',
      open: 'Đang mở',
      overdue: 'Quá hạn',
      blocked: 'Bị chặn',
      accounts: 'Khách hàng',
    },
    weekOf: 'Tuần',
    weekOfNow: 'Tuần này',
    perWeek: 'Việc đến hạn theo tuần (cột đầu là tuần này)',
    cellLabel: '{name}: {count} việc tuần {week}',
    cellLabelFirst: '{name}: {count} việc tuần này ({week})',
    cellLabelFirstOverdue: '{name}: {count} việc tuần này ({week}), gồm {overdue} việc đã quá hạn',
    cellLabelNone: '{name}: không có việc đến hạn tuần {week}',
    cellLabelFirstNone: '{name}: không có việc đến hạn tuần này ({week})',
    overdueSr: 'việc quá hạn',
    noAccounts: 'Chưa gắn khách hàng',
    moreAccounts: '+{count}',
    empty: {
      title: 'Hiện không có việc nội bộ nào đang mở.',
      description: 'Khi đội New Era được giao việc, tải việc theo tuần của từng người sẽ hiện ở đây.',
    },
  },
};

export default projects;
