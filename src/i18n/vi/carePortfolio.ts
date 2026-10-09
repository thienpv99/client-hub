// i18n namespace 'carePortfolio' — owner: dashboard / list / nav agent (features/dashboard/**, layouts/navItems.ts,
// App.tsx, CommandPalette): care KPIs, attention items, "còn có thể bán thêm", portfolio columns and filters.
// Plain words for executives: "yêu cầu", "nợ triển khai", "chưa xử lý quá 7 ngày", "còn có thể bán thêm" — never CR / SLA.
// Two-syllable words in KPI labels are joined with a non-breaking space ( ) so a narrow tile never splits them.
const carePortfolio = {
  kpi: {
    /** health: blocked + attention (the old "Khách hàng rủi ro" tile) */
    risk: {
      label: 'Khách cần chú ý',
    },
    debt: {
      label: 'Nợ triển khai',
      /** sub-line: how many clients the debt sits with */
      accounts: 'ở {count} khách hàng',
      none: 'Không có yêu cầu nợ',
    },
    untriaged: {
      label: 'Chưa xử lý quá 7 ngày',
      accounts: 'ở {count} khách hàng',
      open: '{count} yêu cầu đang mở',
      none: 'Mọi yêu cầu đã được tiếp nhận',
    },
    care: {
      label: 'Khách quá hạn chăm sóc',
      dueSoon: '{count} sắp đến hạn',
      allOk: 'Tất cả đúng nhịp',
      /** progress caption */
      onTrack: '{count}/{total} khách đã ký đúng nhịp',
      none: 'Chưa có khách hàng',
    },
  },

  attention: {
    empty: {
      title: 'Hôm nay không có điểm nào cần chú ý.',
      description:
        'Khi có yêu cầu nợ triển khai, yêu cầu chưa xử lý quá 7 ngày, khách quá hạn chăm sóc, bước mở rộng đến hạn, việc quá hạn hay khoản thu trễ, chúng sẽ hiện ở đây.',
    },
    /** one request owed to the client ("nợ triển khai"), by its main reason */
    debtOne: {
      date_passed: '{account}: yêu cầu “{request}” đã quá ngày hẹn {date} với khách',
      no_plan: '{account}: yêu cầu “{request}” đã hẹn khách ngày {date} nhưng chưa có kế hoạch làm',
      no_owner: '{account}: yêu cầu “{request}” đã hẹn khách ngày {date} nhưng chưa có người phụ trách',
    },
    debtMany: '{account}: {count} yêu cầu nợ triển khai, tạm dừng mở rộng sang phòng ban mới',
    untriagedOne: '{account}: yêu cầu “{request}” chưa xử lý đã {days} ngày',
    untriagedMany: '{account}: {count} yêu cầu chưa xử lý quá 7 ngày, lâu nhất {days} ngày',
    /** taken in more than 14 days ago, still no date told to the client */
    undatedOne: '{account}: yêu cầu “{request}” đã tiếp nhận {days} ngày nhưng chưa hẹn ngày với khách',
    undatedMany: '{account}: {count} yêu cầu đã tiếp nhận quá 14 ngày nhưng chưa hẹn ngày với khách',
    /** the expansion map's next selling step (Mở rộng) */
    nextStepOne: '{account}: bước tiếp theo ở {department} “{step}” hạn {date}',
    nextStepOneOverdue: '{account}: bước tiếp theo ở {department} “{step}” đã quá hạn {days} ngày',
    nextStepMany: '{account}: {count} bước tiếp theo ở Mở rộng đến hạn trong tuần, sớm nhất {date}',
    nextStepManyOverdue: '{account}: {count} bước tiếp theo ở Mở rộng đến hạn, có bước đã quá hạn',
    /** care: the planned next care action is past its date */
    careAction: '{account}: việc chăm sóc “{action}” đã quá hạn {days} ngày',
    /** care: no touch for longer than the account's rhythm */
    careCadence: '{account}: đã {days} ngày chưa chăm sóc, quá nhịp {cadence} ngày',
    careNever: '{account}: chưa có lần chăm sóc nào',
    careDueSoon: '{account}: sắp đến hạn chăm sóc, lần gần nhất {days} ngày trước (nhịp {cadence} ngày)',
    /** caption under each sentence (after the severity word) */
    meta: {
      debt: 'Nợ triển khai · {code}',
      debtMany: 'Nợ triển khai',
      untriaged: 'Chưa xử lý quá 7 ngày · {code} · {source}',
      untriagedMany: 'Chưa xử lý quá 7 ngày',
      undated: 'Chưa hẹn ngày với khách · {code}',
      undatedMany: 'Chưa hẹn ngày với khách',
      care: 'Chăm sóc · {owner} phụ trách',
      careNoOwner: 'Chăm sóc',
      nextStep: 'Mở rộng · {owner} phụ trách',
      nextStepNoOwner: 'Mở rộng',
    },
    actions: {
      triage: 'Xử lý yêu cầu',
      accept: 'Tiếp nhận',
      schedule: 'Hẹn ngày',
      viewDelivery: 'Xem triển khai',
      openAccount: 'Mở khách hàng',
      viewExpansion: 'Xem mở rộng',
    },
    /** the steps listed under a grouped next-step row */
    stepList: 'Các bước tiếp theo ở Mở rộng của {account}',
    stepOpen: 'Mở {department}: {step}, hạn {date}',
    stepDue: 'Hạn {date}',
    stepOverdue: 'Quá hạn {date}',
    /** the requests listed under a grouped row */
    requestList: 'Các yêu cầu của {account}',
    requestOpen: 'Xử lý yêu cầu {code}: {title}',
    more: 'Xem thêm {count} điểm',
    less: 'Thu gọn',
    viewRequests: 'Xem mọi yêu cầu',
  },

  /** "Còn có thể bán thêm" — the room to grow inside signed clients */
  room: {
    title: 'Còn có thể bán thêm',
    description: '{value} cơ hội ở {count} khách hàng đã ký',
    descriptionEmpty: 'Cơ hội mở rộng theo phòng ban của khách hàng đã ký',
    open: 'Xem ma trận tập đoàn',
    openLabel: 'Mở ma trận tập đoàn: giải pháp đã dùng và còn trống theo từng đơn vị',
    meta: '{count} cơ hội · Phòng ban đã phủ {covered}/{total}',
    blocked: 'Tạm dừng mở rộng',
    blockedTitle: 'Còn yêu cầu nợ triển khai — xử lý xong mới mở rộng sang phòng ban mới.',
    rowLabel: 'Hạng {rank}: {name}, còn {value} cơ hội ({count} cơ hội, phòng ban đã phủ {covered}/{total})',
    rowBlocked: ', tạm dừng mở rộng',
    listLabel: 'Khách hàng đã ký xếp theo giá trị còn có thể bán thêm',
    groups: 'Theo tập đoàn',
    groupUnits: '{count} đơn vị',
    groupLabel: 'Mở ma trận {name}: {count} đơn vị, {value} cơ hội',
    empty: 'Chưa ghi nhận cơ hội mở rộng nào.',
    emptyDescription: 'Khi người phụ trách ghi cơ hội ở từng phòng ban của khách, giá trị còn có thể bán thêm sẽ hiện ở đây.',
  },

  portfolio: {
    views: {
      label: 'Cách xem danh mục',
      care: 'Chăm sóc',
      progress: 'Tiến độ',
    },
    chips: {
      debt: 'Nợ triển khai',
      care_overdue: 'Quá hạn chăm sóc',
    },
    /** label of the care filters on the "đang lọc" line */
    filters: {
      debt: 'Có nợ triển khai',
      untriaged: 'Có yêu cầu chưa xử lý quá 7 ngày',
      care_overdue: 'Quá hạn chăm sóc',
    },
    columns: {
      account: 'Khách hàng',
      deployed: 'Đã triển khai',
      departments: 'Phòng ban đã phủ',
      requests: 'Yêu cầu',
      care: 'Chăm sóc tiếp theo',
      decisionMaker: 'Người quyết định',
    },
    tableCaption: 'Danh mục khách hàng theo việc chăm sóc, bấm một dòng để mở chi tiết',
    am: 'Phụ trách: {name}',
    deployedCount: '{count} giải pháp',
    deployedNone: 'Chưa có giải pháp',
    deployedLive: '{count} đang dùng',
    departments: 'Phòng ban {covered}/{total}',
    departmentsShort: '{covered}/{total}',
    opportunities: '{count} cơ hội · {value}',
    blocked: 'Tạm dừng mở rộng',
    /** non-breaking spaces: a narrow column wraps "2 chưa xử lý / quá 7 ngày", never "… quá 7 / ngày" */
    requestsDebt: 'Nợ triển khai {count}',
    requestsUntriaged: '{count} chưa xử lý quá 7 ngày',
    requestsUndated: '{count} chưa hẹn ngày',
    requestsUndatedTitle: '{count} yêu cầu đã tiếp nhận quá 14 ngày mà chưa hẹn ngày với khách',
    /** screen readers, before the owner's name beside the care status (table) */
    careOwnerSr: 'Người phụ trách:',
    requestsOpen: '{count} đang mở',
    requestsNone: 'Không có yêu cầu mở',
    careDue: 'Hạn {date}',
    careOverdue: 'Quá hạn {date}',
    careNoAction: 'Chưa hẹn việc chăm sóc tiếp theo',
    /** followed by a relative date (“3 ngày trước”) */
    lastTouchPrefix: 'Chăm sóc gần nhất',
    neverTouched: 'Chưa có lần chăm sóc nào',
    dmNone: 'Chưa xác định',
    dmOwner: 'Phụ trách: {name}',
    dmLabel: 'Người quyết định {name}, {title}, quan hệ {strength}',
  },

  sort: {
    care: 'Theo mức cần chăm sóc',
  },

  accounts: {
    /** header sentence of /app/accounts for the director / AM (parts joined with ", ") */
    parts: {
      debt: '{count} khách hàng đang nợ triển khai',
      careOverdue: '{count} quá hạn chăm sóc',
      blocked: '{count} đang bị chặn',
      attention: '{count} cần chú ý',
    },
    sentence: '{parts}.',
    calm: 'Không nợ triển khai, mọi khách hàng đang được chăm sóc đúng nhịp.',
    empty: 'Những gì đã triển khai, việc chăm sóc và sức khỏe của từng khách hàng.',
  },
};

export default carePortfolio;
