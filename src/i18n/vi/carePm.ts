// i18n namespace 'carePm' — owner: projects agent (features/projects/**, features/clientmap/**): the "Yêu cầu" tab of
// Dự án (board + promised-date timeline, SPEC-CARE §6.5) and the "Ma trận" view of Bản đồ & tập đoàn (§6.6).
// Plain words for executives: "yêu cầu", "nợ triển khai", "chưa xử lý quá 7 ngày", "còn có thể bán thêm" — never "CR",
// "SLA", "whitespace". Enum labels (statuses, categories…) come from care.ts. Two-syllable words in narrow KPI labels
// are joined with a non-breaking space ( ) so a tile never breaks inside a word (DESIGN §7.4).
const carePm = {
  // ───────────── Dự án → Yêu cầu ─────────────
  kpi: {
    namesMore: '{first} và {count} khách khác',
    open: {
      label: 'Yêu cầu đang mở',
      sub: 'ở {accounts} khách hàng · {done} xong trong 30 ngày',
      subNone: 'Không có yêu cầu đang mở · {done} xong trong 30 ngày',
    },
    debt: {
      label: 'Nợ triển khai',
      sub: 'ở {names}',
      subNone: 'Ngày đã hẹn đều có người và kế hoạch',
    },
    untriaged: {
      label: 'Chưa xử lý quá 7 ngày',
      sub: 'chưa tiếp nhận · {names}',
      subNone: 'Mọi yêu cầu đã được tiếp nhận',
    },
    urgent: {
      label: 'Cần gấp',
      sub: 'đang mở, khách cần gấp',
      subNone: 'Không có yêu cầu gấp',
    },
  },

  toolbar: {
    viewLabel: 'Cách xem yêu cầu',
    viewBoard: 'Theo trạng thái',
    viewTimeline: 'Theo ngày hẹn',
    /** phones */
    viewBoardShort: 'Trạng thái',
    viewTimelineShort: 'Ngày hẹn',
    count: '{total} yêu cầu',
    result: '{shown}/{total} yêu cầu',
    /** the "đang lọc" line */
    flags: {
      debt: 'Nợ triển khai',
      untriaged: 'Chưa xử lý quá 7 ngày',
      urgent: 'Cần gấp',
    },
    mine: 'Tôi phụ trách',
    mineLabel: 'Chỉ yêu cầu tôi phụ trách',
    searchLabel: 'Tìm yêu cầu',
    searchPlaceholder: 'Tìm yêu cầu, khách hàng…',
    /** phones (the box shares its row with the client select) */
    searchPlaceholderShort: 'Tìm yêu cầu…',
    accountLabel: 'Lọc theo khách hàng',
    accountAll: 'Tất cả khách hàng',
    clear: 'Bỏ lọc',
  },

  empty: {
    title: 'Chưa có yêu cầu nào',
    description: 'Yêu cầu khách gửi qua Client Hub, hoặc New Era ghi lại từ buổi họp, email, tin nhắn, sẽ hiện ở đây.',
    search: 'Không tìm thấy yêu cầu nào cho “{query}”.',
    filtered: 'Không có yêu cầu nào khớp với bộ lọc đang chọn.',
    filteredHint: 'Thử từ khóa khác hoặc bỏ bớt bộ lọc.',
  },

  board: {
    label: 'Bảng yêu cầu theo trạng thái, cuộn ngang để xem thêm cột',
    columnCount: '{count} yêu cầu',
    debtCount: '{count} yêu cầu nợ triển khai',
    waitingCount: '{count} yêu cầu chưa xử lý quá 7 ngày',
    moveTo: 'Chuyển sang…',
    moveMenu: 'Chuyển {code} “{title}” sang trạng thái khác',
    /** right of a menu item that opens a short form first */
    asks: {
      planned: 'Cần ngày hẹn',
      declined: 'Cần lý do',
    },
    showMore: 'Xem thêm {count} yêu cầu',
    showLess: 'Thu gọn',
    empty: {
      new: 'Không có yêu cầu mới',
      triaged: 'Chưa có yêu cầu nào ở bước này',
      planned: 'Chưa có yêu cầu nào đã lên kế hoạch',
      in_progress: 'Không có yêu cầu nào đang làm',
      done: 'Chưa có yêu cầu nào xong',
      declined: 'Không có yêu cầu nào bị từ chối',
    },
  },

  /** the one date a card shows */
  date: {
    done: 'Xong {date}',
    declined: 'Từ chối {date}',
    late: 'Quá hẹn {days} ngày · {date}',
    lateLong: 'Đã quá ngày hẹn {days} ngày',
    promised: 'Hẹn {date}',
    promisedToday: 'Hẹn hôm nay',
    received: 'Nhận {date}',
    noPromise: 'Chưa hẹn ngày',
  },
  owner: 'Phụ trách: {name}',

  move: {
    done: 'Đã chuyển {code} sang “{status}”.',
  },
  plan: {
    title: 'Lên kế hoạch cho {code}',
    description: '“{title}” — khách sẽ nhận thông báo kèm ngày hẹn.',
    linkedTask: 'Đang gắn với việc “{task}”.',
    debtHint: 'Đã hẹn ngày với khách thì cần người phụ trách và kế hoạch; thiếu một trong hai, yêu cầu sẽ thành nợ triển khai.',
    confirm: 'Lưu kế hoạch',
  },
  decline: {
    title: 'Từ chối yêu cầu {code}',
    description: 'Khách sẽ đọc được lý do này trong Client Hub và nhận thông báo.',
    placeholder: 'Ví dụ: Phần này nằm ngoài phạm vi hợp đồng hiện tại; New Era sẽ đề xuất ở giai đoạn sau.',
    confirm: 'Từ chối và báo khách',
  },

  timeline: {
    summaryNone: 'Chưa có yêu cầu nào đã hẹn ngày với khách.',
    summaryLate: '{dated} yêu cầu đã hẹn ngày với khách, {late} yêu cầu đã quá hẹn.',
    summaryCalm: '{dated} yêu cầu đã hẹn ngày với khách, chưa yêu cầu nào quá hẹn.',
    undatedCount: '{count} yêu cầu chưa hẹn ngày.',
    undatedNone: 'Mọi yêu cầu đang mở đều đã có ngày hẹn.',
    hint: 'Thanh mờ chạy từ ngày nhận đến ngày hẹn; bấm một dòng để xem chi tiết.',
    label: 'Dòng thời gian các yêu cầu theo ngày hẹn, cuộn ngang để xem thêm tuần',
    requestColumn: 'Yêu cầu',
    today: 'Hôm nay',
    todayLine: 'Hôm nay, {date}',
    groupCount: '{count} yêu cầu',
    groupDebt: '{count} nợ triển khai',
    rowSummary: 'Hẹn {date}; nhận ngày {received}.',
    rowLate: 'Hẹn {date}, đã quá {days} ngày; nhận ngày {received}.',
    undated: 'Chưa hẹn ngày',
    undatedHeading: 'Chưa hẹn ngày · {count}',
    legend: {
      span: 'Từ ngày nhận đến ngày hẹn',
      promised: 'Ngày hẹn với khách',
      late: 'Đã quá ngày hẹn',
      today: 'Hôm nay',
    },
    empty: {
      title: 'Không có yêu cầu nào đang mở',
      description: 'Khi khách gửi yêu cầu hoặc New Era ghi lại một yêu cầu, ngày hẹn của nó sẽ hiện trên dòng thời gian.',
    },
  },
  /** getUTCDay(): 0 = Chủ nhật */
  weekdayShort: {
    0: 'CN',
    1: 'T2',
    2: 'T3',
    3: 'T4',
    4: 'T5',
    5: 'T6',
    6: 'T7',
  },

  // ───────────── Bản đồ & tập đoàn → Ma trận ─────────────
  matrix: {
    title: 'Ma trận giải pháp',
    picker: 'Tập đoàn',
    pickerLabel: 'Chọn tập đoàn',
    units: '{count} công ty',
    showOnMap: 'Xem trên bản đồ',
    showOnMapLabel: 'Xem {name} trên bản đồ',
    amScope: 'Bạn đang xem các công ty mình phụ trách trong tập đoàn này.',
    /** the link named a group without any company the viewer manages */
    notInScope: 'Tập đoàn trong đường dẫn không có khách hàng nào bạn được xem — đang hiển thị một tập đoàn khác.',
    /** the focal sentence above the matrix: what is left to sell in the group */
    summary: {
      noUnits: 'Tập đoàn này chưa có công ty nào là khách hàng của New Era.',
      /** every company of the group shown is still a prospect (no signed contract) */
      noSigned: 'Chưa có công ty nào trong tập đoàn đã ký hợp đồng với New Era — các công ty dưới đây đang ở giai đoạn tiếp cận.',
      full: 'Các công ty trong tập đoàn đã dùng đủ mọi mảng giải pháp — tập trung chăm sóc để giữ chân.',
      /** `none` counts empty CELLS (a category one company does not have yet) — never say "công ty chưa dùng giải pháp
       *  nào" here: that is the sister-companies line below (review: "2 mảng công ty…" read like 2 companies) */
      both: 'Còn có thể bán thêm: {opportunity} cơ hội đã rõ nhu cầu (ước tính {value}) và {none} ô “Còn trống” có thể đề xuất.',
      bothNoValue: 'Còn có thể bán thêm: {opportunity} cơ hội đã rõ nhu cầu và {none} ô “Còn trống” có thể đề xuất.',
      opportunityOnly: 'Còn {opportunity} cơ hội đã rõ nhu cầu, ước tính {value}.',
      opportunityOnlyNoValue: 'Còn {opportunity} cơ hội đã rõ nhu cầu.',
      noneOnly: 'Còn {none} ô “Còn trống” — mảng giải pháp công ty đó chưa có, có thể đề xuất.',
      /** appended when prospects are in the group */
      unsigned: 'Chưa tính {count} công ty chưa ký hợp đồng.',
    },
    figures: {
      liveSub: 'mảng đã có giải pháp',
      inProgressSub: 'mảng đang làm',
      opportunity: 'Cơ hội đã rõ',
      opportunitySub: 'ước tính {value}',
      opportunitySubNone: 'chưa có ước tính',
      noneSub: 'mảng có thể đề xuất',
    },
    cell: {
      live: 'Đang dùng',
      in_progress: 'Đang triển khai',
      opportunity: 'Cơ hội',
      none: 'Còn trống',
      /** an empty cell is room to sell, not a failure */
      noneHint: 'Có thể đề xuất',
      more: '{name} +{count}',
      opportunityNoValue: '{count} nhu cầu',
      /** a cell in use where another department still wants more of that category */
      extra: '+ {value}',
      extraNoValue: '+ {count} nhu cầu',
    },
    /** a prospect (no signed contract) shown in the matrix, left out of the figures */
    unsignedBadge: 'Chưa ký hợp đồng',
    /** sister companies that use nothing from New Era yet */
    otherMembers: '{count} công ty khác trong tập đoàn chưa dùng giải pháp nào của New Era: {names}.',
    /** the same states in the ~95px tiles of the table */
    cellShort: {
      live: 'Đang dùng',
      in_progress: 'Triển khai',
      opportunity: 'Cơ hội',
      none: 'Còn trống',
    },
    a11y: {
      live: '{unit}, {category}: đang dùng {names}.',
      in_progress: '{unit}, {category}: đang triển khai {names}.',
      alsoOpportunity: 'Còn {count} cơ hội bán thêm.',
      openDelivery: 'Mở tab Triển khai.',
      openExpansion: 'Mở tab Mở rộng.',
      opportunity: '{unit}, {category}: {count} cơ hội, ước tính {value}. Mở tab Mở rộng.',
      opportunityNoValue: '{unit}, {category}: {count} cơ hội. Mở tab Mở rộng.',
      none: '{unit}, {category}: chưa dùng, có thể đề xuất. Mở tab Mở rộng.',
    },
    tooltip: {
      opportunity: 'Cơ hội ở {department}',
      none: 'Công ty chưa dùng giải pháp nào ở mảng này — có thể đề xuất.',
      openDelivery: 'Bấm để mở tab Triển khai',
      openExpansion: 'Bấm để mở tab Mở rộng',
    },
    columns: {
      unit: 'Công ty',
      coverage: 'Phòng ban',
      coverageSr: 'phòng ban đã phủ',
      debt: 'Nợ triển khai',
      care: 'Chăm sóc',
    },
    amLine: 'Phụ trách: {name}',
    debtNone: 'Không có',
    debtCount: '{count} yêu cầu',
    /** under the company name (1280–1439px), where no column header says "Nợ triển khai" */
    debtWords: '{count} nợ triển khai',
    waitingCount: '{count} chưa xử lý quá 7 ngày',
    tableLabel: 'Ma trận giải pháp của {group}, cuộn ngang để xem thêm',
    caption: 'Các công ty của {group} theo từng mảng giải pháp: đang dùng, đang triển khai, có cơ hội hay còn trống.',
    cardCells: 'Các mảng giải pháp của {unit}',
    footer: 'Còn có thể bán thêm',
    footerCount: '{count} công ty',
    footerFull: 'Đã phủ hết',
    legend: {
      label: 'Chú giải ma trận',
      live: 'giải pháp đang chạy',
      in_progress: 'đang làm hoặc chạy thử',
      opportunity: 'một phòng ban đã có nhu cầu, kèm ước tính',
      none: 'chưa dùng gì ở mảng này (hoặc giải pháp đã tạm dừng), có thể đề xuất',
      extraWord: '+ Cơ hội',
      extra: 'đã dùng mảng này nhưng phòng ban khác còn nhu cầu',
    },
    empty: {
      title: 'Chưa có tập đoàn nào để xem',
      description: 'Gom các khách hàng cùng tập đoàn (nút “Quản lý tập đoàn”) để thấy mỗi công ty đang dùng gì và còn có thể bán thêm gì.',
      descriptionAm: 'Các khách hàng bạn phụ trách chưa thuộc tập đoàn nào.',
    },
  },

  relations: {
    title: 'Quan hệ trong tập đoàn',
    description: 'Ai quen ai giữa các công ty — đầu mối để giới thiệu và bán chéo.',
    emptyTitle: 'Chưa ghi nhận mối quan hệ nào giữa các công ty',
    emptyDescription: 'Thêm quan hệ ở tab Quan hệ của từng khách hàng, ví dụ ai đã giới thiệu ai.',
  },
};

export default carePm;
