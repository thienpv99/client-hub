// i18n namespace 'dev' — owner: shell (G1). Self-test page (/dev/selftest).
const dev = {
  title: 'Tự kiểm tra hệ thống',
  description: 'Chạy các bộ kiểm tra logic, phân quyền dữ liệu và dữ liệu mẫu ngay trong trình duyệt.',
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
      description: 'Chặn, dự báo mốc, sức khỏe account, thứ tự việc, tính báo giá, thanh toán quá hạn.',
    },
    rbac: {
      title: 'Phân quyền dữ liệu',
      description: 'Khách không nhận được giá vốn, biên lợi nhuận, ghi chú nội bộ; chế độ chỉ đọc.',
    },
    seed: {
      title: 'Dữ liệu mẫu',
      description: 'Đủ 6 tình huống mẫu, ngày tương đối theo hôm nay, liên kết hợp lệ.',
    },
    api: {
      title: 'Gọi API tổng quát',
      description:
        'Gọi mọi hàm đọc dữ liệu với từng vai trò và kiểm tra 6 tình huống mẫu. Dữ liệu demo được đặt lại sau khi chạy.',
    },
  },
};

export default dev;
