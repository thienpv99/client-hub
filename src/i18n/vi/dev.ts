// i18n namespace 'dev' — owner: shell (G1). Self-test page (/dev/selftest).
const dev = {
  title: 'Tự kiểm tra hệ thống',
  description:
    'Chạy các bộ kiểm tra logic, bán hàng, phân quyền dữ liệu, đăng nhập Google và dữ liệu mẫu ngay trong trình duyệt.',
  runAll: 'Chạy tất cả',
  run: 'Chạy',
  running: 'Đang chạy…',
  notRun: 'Chưa chạy',
  backHome: 'Về ứng dụng',
  summary: '{passed} đạt · {failed} lỗi',
  allPassed: 'Tất cả {count} kiểm tra đều đạt.',
  showPassed: 'Xem {count} kiểm tra đạt',
  hidePassed: 'Ẩn kiểm tra đạt',
  failures: 'Kiểm tra lỗi',
  unavailable: 'Chưa chạy được bộ kiểm tra này: {message}',
  noResults: 'Bộ kiểm tra không trả về kết quả nào.',
  seedAllGood: 'Dữ liệu mẫu đầy đủ và nhất quán, không phát hiện lỗi.',
  sessionRestored: 'Đã khôi phục phiên đăng nhập trước khi chạy.',
  sessionRestoreFailed: 'Chưa khôi phục được phiên đăng nhập trước đó. Vui lòng đăng nhập lại.',
  duration: '{ms} ms',
  suites: {
    domain: {
      title: 'Logic nghiệp vụ',
      description: 'Chặn, dự báo mốc, sức khỏe khách hàng, thứ tự việc, tính báo giá, thanh toán quá hạn.',
    },
    rbac: {
      title: 'Phân quyền dữ liệu',
      description: 'Khách không nhận được giá vốn, biên lợi nhuận, ghi chú nội bộ; chế độ chỉ đọc.',
    },
    crm: {
      title: 'Bán hàng và bản đồ khách hàng',
      description:
        'Điểm phù hợp, phân khúc, phễu và dự báo bán hàng, khối lượng việc; bản đồ khách hàng: giá trị theo chỉ số, nhóm doanh nghiệp, phạm vi của AM.',
    },
    sso: {
      title: 'Đăng nhập Google',
      description:
        'Kiểm tra chữ ký và các trường của mã đăng nhập Google bằng khóa thử, chỉ nhận tài khoản @newera.inc, tạo thành viên mới một lần. Chạy trên bản sao riêng.',
    },
    seed: {
      title: 'Dữ liệu mẫu',
      description: 'Đủ 6 tình huống mẫu, ngày tương đối theo hôm nay, liên kết hợp lệ.',
    },
    care: {
      title: 'Chăm sóc khách hàng',
      description:
        'Yêu cầu chưa xử lý quá 7 ngày, nợ triển khai và lý do, độ phủ phòng ban, chặn mở rộng, nhịp chăm sóc; luồng gửi → tiếp nhận → lên kế hoạch → xong kèm thông báo; dữ liệu mẫu. Chạy trên bản sao riêng.',
    },
    api: {
      title: 'Gọi API tổng quát',
      description:
        'Gọi mọi hàm đọc dữ liệu với từng vai trò và kiểm tra 6 tình huống mẫu trên một bản sao riêng. Dữ liệu demo đang dùng không bị thay đổi.',
    },
  },
};

export default dev;
