// i18n namespace 'settings' — owner: feature: settings. Nested keys, Vietnamese text, {param} placeholders.
const settings = {
  page: {
    title: 'Cài đặt',
    description: 'Người dùng, lời mời, mẫu lộ trình và quy tắc vận hành của New Era.',
  },
  nav: {
    label: 'Mục cài đặt',
    users: 'Người dùng & vai trò',
    invites: 'Mời khách',
    templates: 'Mẫu lộ trình',
    pricing: 'Bảng giá',
    rules: 'Ngưỡng & quy tắc',
  },
  navShort: {
    users: 'Người dùng',
    invites: 'Mời khách',
    templates: 'Mẫu lộ trình',
    pricing: 'Bảng giá',
    rules: 'Quy tắc',
  },
  tabs: {
    users: {
      title: 'Người dùng và vai trò',
      description: 'Tài khoản của đội New Era và của khách hàng, kèm vai trò và lần đăng nhập gần nhất.',
    },
    invites: {
      title: 'Mời khách vào hệ thống',
      description: 'Mời người phía khách vào cổng khách hàng. Họ đăng nhập bằng email công ty, không cần mật khẩu.',
    },
    templates: {
      title: 'Mẫu lộ trình',
      description: 'Các mốc chuẩn tạo sẵn khi mở dự án mới, tính từ ngày bắt đầu dự án.',
    },
    pricing: {
      title: 'Bảng giá',
      description: 'Đơn giá niêm yết, giá vốn và đơn giá riêng theo từng khách hàng.',
      /** viewer without "Được xem giá vốn" */
      descriptionNoCost: 'Đơn giá niêm yết và đơn giá riêng theo từng khách hàng.',
    },
    rules: {
      title: 'Ngưỡng và quy tắc',
      description: 'Ngưỡng chiết khấu cần duyệt, nhắc việc, leo thang và nhịp gửi email cho cả hai phía.',
    },
  },
  readOnly: {
    users:
      'Chỉ Giám đốc đổi được vai trò và quyền xem giá vốn. Danh sách gồm đội New Era và người dùng phía khách của các khách hàng mà tài khoản này phụ trách.',
    rules: 'Chỉ Giám đốc thay đổi được các quy tắc này. Tài khoản Quản lý khách hàng (AM) xem ở chế độ chỉ đọc.',
  },
  email: {
    required: 'Vui lòng nhập email.',
    invalid: 'Phần trước @ chỉ gồm chữ không dấu, số, dấu chấm, gạch nối hoặc gạch dưới.',
    noAt: 'Chỉ cần nhập phần trước @{domain}.',
    noDomain: 'tên miền công ty',
  },
  salutation: {
    label: 'Danh xưng',
    required: 'Vui lòng chọn Anh hoặc Chị.',
  },

  users: {
    groups: {
      internal: 'Nội bộ New Era',
      client: 'Khách hàng',
    },
    groupCount: '{count} người dùng',
    groupHint: {
      internal: 'Quản lý khách hàng (AM) được cấp riêng quyền xem giá vốn và biên lợi nhuận.',
      internalReadOnly: 'Giám đốc, Quản lý khách hàng (AM) và thành viên nội bộ của New Era.',
      client: 'Người dùng phía khách chỉ thấy những gì đã chia sẻ của công ty mình.',
    },
    filter: {
      label: 'Lọc người dùng',
      all: 'Tất cả',
      internal: 'Nội bộ',
      client: 'Khách hàng',
    },
    searchPlaceholder: 'Tìm tên, email, công ty',
    searchLabel: 'Tìm người dùng',
    columns: {
      user: 'Người dùng',
      role: 'Vai trò',
      title: 'Chức danh',
      account: 'Khách hàng',
      status: 'Trạng thái',
    },
    roleFor: 'Vai trò của {name}',
    self: 'Tài khoản đang đăng nhập',
    selfShort: 'Bạn',
    /** tag of a staff member created by their first Google sign-in */
    google: 'Google',
    googleTitle: 'Tự tạo khi đăng nhập lần đầu bằng Google',
    lastLogin: 'Đăng nhập',
    neverLoggedIn: 'Chưa đăng nhập lần nào',
    noTitle: 'Chưa có chức danh',
    cost: {
      label: 'Được xem giá vốn',
      aria: 'Cho {name} xem giá vốn',
      always: 'Luôn xem được giá vốn',
      granted: 'Được xem giá vốn',
      notGranted: 'Không xem giá vốn',
    },
    empty: {
      search: 'Không có người dùng nào khớp với “{query}”.',
      group: 'Chưa có người dùng nào trong nhóm này.',
      clear: 'Xem tất cả người dùng',
    },
    toast: {
      role: 'Đã đổi vai trò của {name} thành {role}.',
      costOn: '{name} đã được xem giá vốn.',
      costOff: '{name} không còn xem được giá vốn.',
    },
    invite: {
      open: 'Mời người dùng nội bộ',
      openShort: 'Mời',
      title: 'Mời người dùng nội bộ',
      description: 'Người được mời nhận email để đăng nhập Client Hub với vai trò đã chọn.',
      name: 'Họ và tên',
      namePlaceholder: 'Ví dụ: Trần Minh Khoa',
      nameRequired: 'Vui lòng nhập họ và tên.',
      email: 'Email công ty',
      emailPlaceholder: 'khoa.tran',
      role: 'Vai trò',
      jobTitle: 'Chức danh',
      jobTitlePlaceholder: 'Ví dụ: Quản lý khách hàng',
      roleHint: {
        am: 'Quản lý khách hàng (AM) phụ trách các khách hàng được giao; quyền xem giá vốn cấp riêng sau.',
        member: 'Thành viên nội bộ xem và làm các việc được giao, không thấy giá vốn.',
        director: 'Giám đốc thấy và sửa mọi thứ, kể cả giá vốn và cài đặt hệ thống.',
      },
      submit: 'Gửi lời mời',
      toast: 'Đã gửi lời mời tới {name}.',
    },
  },

  invites: {
    formTitle: 'Lời mời mới',
    account: 'Khách hàng',
    domainHint: 'Chỉ mời được email có đuôi @{domain}.',
    name: 'Họ và tên',
    namePlaceholder: 'Ví dụ: Phạm Thu Lan',
    nameRequired: 'Vui lòng nhập họ và tên.',
    email: 'Email',
    emailPlaceholder: 'lan.pham',
    jobTitle: 'Chức danh',
    jobTitlePlaceholder: 'Ví dụ: Giám đốc vận hành',
    role: 'Vai trò trong hệ thống',
    roleHint: {
      client_owner: 'Xem tiến độ, báo giá, hợp đồng; duyệt và giao việc cho đồng nghiệp.',
      client_member: 'Xem việc được giao và tiến độ chung, không thấy mục Thương mại.',
    },
    contactRole: 'Vai trò liên hệ',
    contactRoleHint: 'Hiện ở tab Liên hệ của khách hàng.',
    after: 'Lời mời được gửi ngay qua email và ghi vào nhật ký.',
    submit: 'Gửi lời mời',
    toast: 'Đã gửi lời mời tới {name} ({email}).',
    noAccounts: 'Chưa có khách hàng nào để mời người dùng.',
    createAccount: 'Tạo khách hàng mới',
    pendingTitle: 'Lời mời đang chờ',
    pendingDescription: 'Người được mời rời danh sách này sau lần đăng nhập đầu tiên.',
    pendingEmpty: 'Hiện không có lời mời nào đang chờ. Mọi người được mời đều đã đăng nhập.',
    pendingCount: '{count} lời mời',
  },

  templates: {
    meta: '{count} mốc · {days} ngày',
    chainLabel: 'Các mốc của mẫu {name}',
    offsetStart: 'Ngày bắt đầu',
    offsetDays: '+{days} ngày',
    internalMilestone: 'Mốc chỉ nội bộ, khách không thấy',
    empty: 'Chưa có mẫu lộ trình nào.',
    footnote: 'Mẫu được dùng khi tạo khách hàng mới hoặc thêm dự án ở tab Lộ trình. Sau khi tạo, từng mốc vẫn sửa được ngày và tên.',
  },

  pricing: {
    title: 'Bảng giá nằm trong mục Thương mại',
    line: 'Đơn giá dịch vụ, giá vốn và đơn giá riêng của từng khách hàng được quản lý cùng báo giá và hợp đồng.',
    lineNoCost: 'Đơn giá dịch vụ và đơn giá riêng của từng khách hàng được quản lý cùng báo giá và hợp đồng.',
    open: 'Mở bảng giá',
  },

  rules: {
    sections: {
      quotes: 'Báo giá',
      reminders: 'Nhắc việc và leo thang',
      email: 'Email và bản tin tuần',
      payments: 'Thanh toán',
    },
    threshold: {
      label: 'Ngưỡng chiết khấu cần Giám đốc duyệt',
      hint: 'Báo giá có tổng chiết khấu so với đơn giá áp dụng cho khách vượt ngưỡng này phải được Giám đốc duyệt trước khi gửi.',
      error: 'Nhập một số từ 0 đến 100, tối đa 2 chữ số thập phân.',
    },
    reminders: {
      label: 'Nhắc khách trước hạn',
      hint: 'Việc đang chờ khách được nhắc qua chuông và email vào những ngày đã chọn trước hạn.',
      unit: 'ngày',
      choiceAria: 'Nhắc trước {days} ngày',
      day: '{days} ngày',
      summary: 'Nhắc trước hạn {list}.',
      none: 'Không nhắc trước hạn; việc chỉ được nhắc khi đã quá hạn.',
    },
    escalation: {
      label: 'Leo thang khi quá hạn',
      hint: 'Việc phía khách đang chặn mốc và quá hạn từ số ngày này được báo cho Người quyết định phía khách và Giám đốc New Era.',
      suffix: 'ngày',
      error: 'Nhập số ngày từ 1 đến 60.',
    },
    overdueOncePerDay: 'Việc đã quá hạn được nhắc tối đa 1 lần mỗi ngày.',
    maxEmails: {
      label: 'Số email tối đa mỗi người mỗi ngày',
      hint: 'Thông báo vượt mức được gom vào email của ngày hôm sau. Email leo thang luôn gửi ngay.',
      suffix: 'email/ngày',
      error: 'Nhập số từ 1 đến 20.',
    },
    digest: {
      label: 'Bản tin tuần',
      hint: 'Tình hình, việc đã xong, việc đang chờ và mốc sắp tới, gửi cho C-level của cả hai phía.',
      weekday: 'Thứ gửi bản tin',
      hour: 'Giờ gửi bản tin',
      summary: 'Gửi lúc {hour} {weekday} hằng tuần.',
    },
    paymentAuto: {
      label: 'Tự tạo việc “Thanh toán” cho khách',
      hint: 'Khi một đợt thanh toán đến hạn, khách nhận việc “Thanh toán” trên trang chủ. AM vẫn tắt được cho từng đợt.',
      on: 'Đang bật',
      off: 'Đang tắt',
    },
    saveBar: {
      dirty: 'Có thay đổi chưa lưu.',
      invalid: 'Có giá trị chưa hợp lệ, vui lòng kiểm tra lại.',
      discard: 'Hủy thay đổi',
      save: 'Lưu thay đổi',
    },
    toast: {
      saved: 'Đã lưu quy tắc. Các lần nhắc và email tiếp theo dùng giá trị mới.',
    },
  },
};

export default settings;
