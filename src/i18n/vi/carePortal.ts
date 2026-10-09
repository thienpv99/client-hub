// i18n namespace 'carePortal' — owner: portal agent (features/portal/**, features/notifications/kinds.ts):
// "Giải pháp đang dùng", "Yêu cầu của anh/chị", "Gửi yêu cầu mới" and the home card "Yêu cầu đang xử lý".
// Client wording (SPEC §1.7, SPEC-CARE §5): plain words for executives — no "CR", "SLA", ticket, sprint or internal
// statuses. {you} = 'anh' / 'chị', {You} = the same at sentence start. Status words come from care.crStatusClient.*.
const carePortal = {
  requests: {
    title: 'Yêu cầu của {you}',
    description: 'Thay đổi, bổ sung đã đề nghị New Era, kèm trạng thái và ngày dự kiến xong.',
    newButton: 'Gửi yêu cầu mới',
    /** the card header on phones / iPad portrait (the page header carries the full button) */
    newButtonShort: 'Gửi yêu cầu',
    readOnly: 'Đang xem như khách hàng: chỉ xem, không gửi được yêu cầu.',
    openListLabel: 'Yêu cầu đang xử lý',
    closedListLabel: 'Yêu cầu đã xử lý xong',
    showClosed: 'Xem {count} yêu cầu đã xử lý xong',
    hideClosed: 'Ẩn yêu cầu đã xử lý xong',
    noOpen: 'Không có yêu cầu nào đang chờ New Era.',
    empty: '{You} chưa gửi yêu cầu nào.',
    emptyHint: 'Cần thay đổi hay bổ sung gì cho giải pháp đang dùng, {you} gửi yêu cầu tại đây. New Era sẽ phản hồi và báo ngày dự kiến xong.',
    emptyProject: 'Dự án {name} chưa có yêu cầu nào.',
    /** one line of time under a request (non-breaking spaces keep a date with its words) */
    promised: 'Dự kiến xong {date}',
    promisedToday: 'Dự kiến xong hôm nay',
    lateBadge: 'Trễ {days} ngày',
    sentOn: 'Gửi {date}',
    sentByOn: '{name} gửi {date}',
    /** a request New Era wrote down itself (no named sender) */
    loggedOn: 'New Era ghi nhận {date}',
    doneOn: 'Hoàn thành {date}',
    newEraNote: 'New Era: {note}',
    declineReason: 'Lý do: {reason}',
    openDetail: 'Xem chi tiết',
  },

  detail: {
    stepsTitle: 'Các bước xử lý',
    step: {
      new: 'Đã gửi',
      triaged: 'New Era tiếp nhận',
      planned: 'Lên kế hoạch',
      in_progress: 'Đang thực hiện',
      done: 'Hoàn thành',
      declined: 'Chưa thực hiện được',
    },
    /** screen-reader state of a step */
    stepState: {
      done: 'đã xong',
      current: 'bước hiện tại',
      upcoming: 'sắp tới',
    },
    noteTitle: 'Lời nhắn của New Era',
    declineTitle: 'Lý do chưa thực hiện được',
    contentTitle: 'Nội dung yêu cầu',
    noDescription: 'Không có mô tả thêm.',
    factsTitle: 'Thông tin',
    project: 'Dự án',
    general: 'Chung, không gắn dự án',
    sender: 'Người gửi',
    senderNewEra: 'New Era ghi nhận',
    sentAt: 'Ngày gửi',
    promised: 'Dự kiến xong',
    doneAt: 'Hoàn thành',
    late: 'Trễ {days} ngày so với dự kiến',
  },

  form: {
    title: 'Gửi yêu cầu mới',
    description: 'Yêu cầu đến thẳng {am}, đầu mối của {you} tại New Era.',
    descriptionNoAm: 'Yêu cầu đến thẳng đầu mối của {you} tại New Era.',
    requestTitle: '{You} cần gì?',
    requestTitlePlaceholder: 'Ví dụ: Thêm báo cáo theo cửa hàng',
    titleRequired: 'Cần ghi ngắn gọn {you} cần gì.',
    details: 'Mô tả thêm',
    detailsHint: 'Bối cảnh, ai sẽ dùng, cần trước ngày nào… Càng rõ, New Era càng phản hồi nhanh.',
    project: 'Dự án liên quan',
    projectNone: 'Chung, không gắn dự án',
    priority: 'Mức độ cần',
    submit: 'Gửi yêu cầu',
    sent: 'Đã gửi yêu cầu {code}. New Era sẽ phản hồi {you} trong vòng 7 ngày.',
  },

  solutions: {
    title: 'Giải pháp New Era triển khai',
    description: 'Những gì New Era đã triển khai cho {company}.',
    descriptionNoCompany: 'Những gì New Era đã triển khai cho công ty.',
    /** the split under the title: in use vs still being rolled out / piloted */
    split: '{live} đang sử dụng · {progress} đang triển khai',
    splitLive: 'Tất cả đang sử dụng',
    splitProgress: 'Đang triển khai, chưa dùng chính thức',
    count: '{count} giải pháp',
    since: 'Dùng từ {date}',
    planned: 'Dự kiến dùng từ {date}',
    /** the project's go-live forecast moved (the same date as the timeline above) */
    plannedLate: 'Dự kiến dùng từ {date} (lùi {days} ngày)',
    users: '{count} người dùng',
    departments: 'Bộ phận dùng',
    empty: 'Chưa có giải pháp nào được bàn giao.',
    emptyHint: 'Khi New Era bàn giao một giải pháp, giải pháp sẽ hiện ở đây kèm ngày bắt đầu dùng và số người dùng.',
    emptyProject: 'Dự án {name} chưa có giải pháp nào được bàn giao.',
  },

  home: {
    title: 'Yêu cầu đang xử lý',
    count: '{count} yêu cầu đang xử lý',
    viewAll: 'Xem tất cả',
    viewAllLabel: 'Xem tất cả yêu cầu của {you}',
    none: 'Không có yêu cầu nào đang chờ New Era.',
    noneHint: 'Cần thay đổi hay bổ sung gì, {you} gửi yêu cầu cho New Era tại đây.',
    more: 'Và {count} yêu cầu khác',
  },
};

export default carePortal;
