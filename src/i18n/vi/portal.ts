// i18n namespace 'portal' — owner: feature: portal. Nested keys, Vietnamese text, {param} placeholders.
// Client wording (SPEC §1.7): "việc", "mốc", "giai đoạn"; neutral tone, never blame.
// {you} = the viewer's salutation ('anh' / 'chị'), {You} = the same at sentence start, {address} = 'anh Minh'.
const portal = {
  /** when a client has no stored salutation */
  youFallback: 'anh/chị',

  common: {
    showMore: 'Xem thêm {count}',
    showLess: 'Thu gọn',
    sentAt: 'Đã gửi {when}',
  },

  /** short status of a task row (lists on the home page and the tasks page) */
  rowStatus: {
    submitted: 'Đã gửi, chờ New Era kiểm tra',
    blocked: 'Đang chờ việc trước',
    newEra: {
      todo: 'Sắp bắt đầu',
      in_progress: 'Đang làm',
      waiting: 'Đang chờ phản hồi',
      done: 'Đã xong',
    },
  },

  /** "Đang chờ phía anh: 3 · Đang chờ New Era: 2" — counts the whole company side, hence "phía" */
  waitingLine: {
    client: 'Đang chờ phía {you}',
    internal: 'Đang chờ New Era',
    overdue: '{count} quá hạn',
  },

  home: {
    dateLine: '{weekday}, {date}',
    greetingWeek: 'Chào {address}, tuần này có {count} việc cần {you} xử lý.',
    greetingLater: 'Chào {address}, có {count} việc cần {you} xử lý trong thời gian tới.',
    greetingLaterSub: 'Tuần này chưa có việc nào đến hạn.',
    greetingNone: 'Chào {address}.',
    myTasks: {
      title: 'Việc cần {you} xử lý',
      count: '{count} việc',
      viewAll: 'Xem tất cả việc',
      emptyOnTrack: 'Hiện không có việc nào cần {you} xử lý. Dự án đang chạy theo kế hoạch.',
      emptyNeutral: 'Hiện không có việc nào cần {you} xử lý.',
      emptyHint: 'Khi New Era cần {you} duyệt hoặc cung cấp tài liệu, việc sẽ hiện ở đây kèm hạn và hệ quả nếu trễ.',
      emptyNeutralHint: 'New Era đang theo dõi sát các điểm cần chú ý và sẽ báo ngay khi cần {you}.',
    },
    delegated: {
      title: 'Đã giao cho người khác',
      description: 'Việc {you} đã nhờ đồng nghiệp xử lý, kèm trạng thái.',
    },
    waiting: {
      title: 'Đã gửi, chờ New Era phản hồi',
      description: 'New Era đang kiểm tra những gì phía {you} đã gửi.',
      show: 'Hiện danh sách đã gửi',
      hide: 'Ẩn danh sách đã gửi',
    },
    progress: {
      title: 'Tiến độ',
      next: 'Mốc tiếp theo',
      allDone: 'Mọi mốc của dự án đã hoàn thành.',
      milestonesDone: 'Đã xong {done}/{total} mốc',
      otherProjects: 'Dự án khác',
      viewDetail: 'Xem tiến độ',
      noNext: 'Không còn mốc nào đang mở',
    },
    newEra: {
      title: 'New Era đang làm',
      description: 'Việc của New Era trong tuần này, kể cả việc đang trễ.',
      empty: 'Tuần này New Era không có việc nào đang mở trong dự án.',
    },
    updates: {
      title: 'Cập nhật mới',
      empty: 'Chưa có cập nhật nào. Mỗi lần duyệt, gửi tài liệu hay hoàn thành mốc sẽ hiện ở đây.',
    },
    summary: {
      title: 'Tóm tắt từ New Era',
      empty: 'New Era sẽ cập nhật tóm tắt tình hình dự án tại đây.',
      contact: 'Đầu mối của {you} tại New Era',
      call: 'Gọi {name}: {phone}',
      email: 'Gửi email cho {name}',
    },
  },

  tasks: {
    title: 'Việc',
    description: 'Việc {company} phối hợp với New Era, xếp theo mức ưu tiên.',
    descriptionNoCompany: 'Việc phối hợp với New Era, xếp theo mức ưu tiên.',
    tabsLabel: 'Nhóm việc',
    tabs: {
      mine: 'Cần xử lý',
      delegated: 'Đã giao',
      waiting: 'Chờ New Era',
      done: 'Đã xong',
    },
    tabCount: '{count} việc',
    aside: {
      title: 'Tình hình phối hợp',
      description: 'Số việc đang chờ mỗi bên xử lý.',
    },
    delegatedDone: 'Đồng nghiệp đã xử lý xong',
    doneListLabel: 'Việc đã xong, mới nhất trước',
    doneBy: 'Phụ trách: {name}',
    empty: {
      mine: 'Hiện không có việc nào cần {you} xử lý.',
      mineHint: 'Khi New Era cần {you} duyệt hoặc cung cấp tài liệu, việc sẽ hiện ở đây kèm hạn và hệ quả nếu trễ.',
      delegated: '{You} chưa giao việc nào cho đồng nghiệp.',
      delegatedHint: 'Ở mỗi việc, chọn “Giao cho đồng nghiệp” để nhờ người phù hợp xử lý. Việc đã giao vẫn hiện ở đây để {you} theo dõi.',
      waiting: 'Chưa có việc nào đang chờ New Era phản hồi.',
      waitingHint: 'Khi {you} gửi tài liệu, báo chuyển khoản hoặc yêu cầu chỉnh sửa, việc sẽ nằm ở đây cho đến khi New Era kiểm tra xong.',
      done: 'Chưa có việc nào hoàn thành.',
      doneHint: 'Việc đã xong sẽ được lưu ở đây, mới nhất trước.',
    },
  },

  progress: {
    title: 'Tiến độ',
    description: 'Các mốc của dự án: ngày kế hoạch, ngày dự báo và lý do nếu lùi.',
    milestonesLabel: 'Các mốc của dự án {name}',
    milestonesDone: 'Đã xong {done}/{total} mốc',
    pct: '{pct}%',
    allDone: 'Mọi mốc của dự án đã hoàn thành.',
    current: 'Đang thực hiện',
    upcoming: 'Sắp tới',
    done: 'Đã hoàn thành',
    tasksDone: '{done}/{total} việc đã xong',
    empty: 'Dự án chưa có mốc nào được chia sẻ.',
    emptyHint: 'Khi New Era lập lộ trình, các mốc sẽ hiện ở đây kèm ngày kế hoạch và dự báo.',
    noProjects: 'Chưa có dự án nào.',
    noProjectsHint: 'Khi dự án bắt đầu, các mốc và tiến độ sẽ hiện ở đây.',
    approvals: {
      title: 'Lịch sử phê duyệt',
      description: 'Những gì {company} đã duyệt hoặc đề nghị điều chỉnh, mới nhất trước.',
      descriptionNoCompany: 'Những gì công ty đã duyệt hoặc đề nghị điều chỉnh, mới nhất trước.',
      empty: 'Chưa có lần phê duyệt nào.',
      emptyHint: 'Mỗi lần công ty duyệt hoặc đề nghị điều chỉnh, lịch sử sẽ được lưu ở đây: ai, lúc nào, nội dung gì.',
      approved: 'Đã duyệt',
      changes: 'Đề nghị điều chỉnh',
    },
  },

  documents: {
    title: 'Tài liệu',
    description: 'Tài liệu dùng chung giữa {company} và New Era, luôn mở phiên bản mới nhất.',
    descriptionNoCompany: 'Tài liệu dùng chung với New Era, luôn mở phiên bản mới nhất.',
    filterLabel: 'Lọc theo loại tài liệu',
    general: 'Tài liệu chung',
    fileCount: '{count} tài liệu',
    showVersions: 'Xem {count} phiên bản cũ',
    hideVersions: 'Ẩn các phiên bản cũ',
    olderLabel: 'Các phiên bản cũ của {name}',
    previewName: 'Xem trước {name}',
    downloadName: 'Tải xuống {name}',
    downloadVersion: 'Tải xuống {name}, phiên bản {version}',
    previewVersion: 'Xem trước {name}, phiên bản {version}',
    empty: 'Chưa có tài liệu nào được chia sẻ.',
    emptyProject: 'Dự án {name} chưa có tài liệu nào được chia sẻ.',
    emptyHint: 'Khi New Era chia sẻ thiết kế, báo cáo hay hợp đồng, tài liệu sẽ hiện ở đây kèm đủ các phiên bản.',
    emptyFiltered: 'Không có tài liệu nào khớp với bộ lọc.',
    emptyFilteredHint: 'Thử tên khác, hoặc xóa bộ lọc để xem mọi tài liệu đã chia sẻ.',
    clearFilters: 'Xóa bộ lọc',
    searchLabel: 'Tìm tài liệu theo tên',
    searchPlaceholder: 'Tìm theo tên tài liệu…',
    resultCount: '{count} tài liệu phù hợp',
    all: 'Tất cả',
  },

  onboarding: {
    dots: 'Chọn màn giới thiệu',
    step: 'Màn {current}/{total}',
    skip: 'Bỏ qua',
    next: 'Tiếp tục',
    start: 'Bắt đầu',
    keyboardHint: 'Dùng phím mũi tên để chuyển màn, Esc để bỏ qua.',
    screens: {
      track: {
        title: 'Đây là nơi {you} theo dõi dự án cùng New Era',
        body: 'Tình hình dự án, các mốc sắp tới và việc New Era đang làm, tất cả ở một chỗ và luôn được cập nhật.',
      },
      tasks: {
        title: 'Việc cần {you} làm sẽ hiện ở trang chủ',
        body: 'Mỗi việc ghi rõ hạn và hệ quả nếu trễ, kèm một nút để xử lý ngay: duyệt, tải tài liệu hay xác nhận chỉ mất vài giây.',
      },
      delegate: {
        title: '{You} có thể giao việc cho đồng nghiệp',
        body: 'Chọn “Giao cho đồng nghiệp” ở mỗi việc. Việc đã giao vẫn nằm trong mục của {you}, kèm trạng thái để tiện theo dõi.',
      },
      ask: {
        title: '{You} có thể hỏi lại New Era bất cứ lúc nào',
        body: 'Chọn “Hỏi lại New Era” ở mỗi việc khi cần làm rõ. Câu hỏi đi thẳng tới người phụ trách bên New Era.',
      },
    },
  },
};

export default portal;
