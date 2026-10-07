// Content of the demo PDF documents (proposals, survey reports, signed contracts, data templates…).
// Written in Vietnamese; pdf.ts embeds a font subset with the Vietnamese glyphs (./pdfFont). A character outside
// that subset is folded to ASCII — re-run vendor/fonts/build-pdf-font.ps1 after adding a new kind of character.
// No calendar dates here: files are keyed, not generated per day.

import type { PdfDoc } from './pdf';

function contract(code: string, title: string, client: string, scope: string[], schedule: string[]): PdfDoc {
  return {
    title: `Hợp đồng ${code}`,
    subtitle: title,
    meta: [
      ['Bên A', client],
      ['Bên B', 'Công ty Cổ phần Giải pháp New Era'],
      ['Tình trạng', 'Bản scan đã ký và đóng dấu hai bên'],
    ],
    sections: [
      { heading: 'Điều 1. Phạm vi công việc', lines: scope.map((s) => `- ${s}`) },
      { heading: 'Điều 2. Lịch thanh toán', lines: schedule.map((s) => `- ${s}`) },
      { heading: 'Điều 3. Nghiệm thu', lines: ['Mỗi mốc được nghiệm thu bằng biên bản có chữ ký của đại diện hai bên. Đợt thanh toán gắn với mốc đến hạn xuất hóa đơn khi mốc hoàn thành.'] },
      { heading: 'Chữ ký', lines: ['Đại diện Bên A: đã ký', 'Đại diện Bên B: đã ký'] },
    ],
  };
}

function survey(title: string, client: string, findings: string[], proposals: string[]): PdfDoc {
  return {
    title,
    subtitle: client,
    meta: [['Người lập', 'Nhóm phân tích nghiệp vụ New Era'], ['Phiên bản', '1.0 – đã chia sẻ với khách hàng']],
    sections: [
      { heading: 'Hiện trạng', lines: findings.map((s) => `- ${s}`) },
      { heading: 'Đề xuất', lines: proposals.map((s) => `- ${s}`) },
    ],
  };
}

function dataFile(title: string, client: string, columns: string, rows: string[], note?: string): PdfDoc {
  return {
    title,
    subtitle: client,
    sections: [{ heading: 'Cột dữ liệu', lines: [columns] }, { heading: 'Dữ liệu mẫu', lines: rows.map((s) => `- ${s}`) }, ...(note ? [{ heading: 'Ghi chú', lines: [note] }] : [])],
  };
}

export const DOCUMENTS: Record<string, PdfDoc> = {
  // ── Cỏ Xanh Retail
  'coxanh-proposal': {
    title: 'Đề xuất giải pháp App bán hàng đa kênh',
    subtitle: 'Cỏ Xanh Retail',
    meta: [['Phiên bản', '1.2'], ['Người lập', 'Nguyễn Thu Hà – Quản lý khách hàng']],
    sections: [
      { heading: 'Mục tiêu', lines: ['Cho khách đặt hàng trên điện thoại, chọn kho giao gần nhất và theo dõi đơn theo thời gian thực tại 24 cửa hàng.'] },
      { heading: 'Phạm vi', lines: ['- App bán hàng cho khách (iOS, Android)', '- Trang quản trị đơn hàng cho cửa hàng', '- Kết nối tồn kho 24 cửa hàng và 3 kho tổng', '- Báo cáo doanh thu theo kênh'] },
      { heading: 'Lộ trình', lines: ['Kickoff → Khảo sát → Thiết kế → Phát triển → UAT → Go-live, khoảng 15 tuần.'] },
    ],
  },
  'coxanh-contract': contract('CX-APP', 'Triển khai App bán hàng đa kênh', 'Công ty Cổ phần Bán lẻ Cỏ Xanh', ['Phân tích, thiết kế, lập trình và kiểm thử app bán hàng', '50 bản quyền người dùng 12 tháng', '12 tháng hạ tầng đám mây', '2 gói đào tạo người dùng'], ['Đợt 1 – Ký hợp đồng: 30%', 'Đợt 2 – Hoàn thành khảo sát: 20%', 'Đợt 3 – Hoàn thành thiết kế: 25%', 'Đợt 4 – Go-live: 25%']),
  'coxanh-survey': survey('Báo cáo khảo sát nghiệp vụ', 'Cỏ Xanh Retail', ['Đơn online đang nhận qua điện thoại và mạng xã hội, nhập tay vào phần mềm bán hàng', 'Tồn kho cửa hàng cập nhật cuối ngày nên hay bán vượt tồn', '6 cửa hàng mẫu xử lý trung bình 140 đơn giao mỗi ngày'], ['Đồng bộ tồn kho theo thời gian thực', 'Cho khách chọn kho giao hoặc nhận tại cửa hàng', 'Gom đơn online về một màn hình cho từng cửa hàng']),
  'tpl-catalog': dataFile('Mẫu danh mục sản phẩm và giá bán', 'Dùng cho việc "Cung cấp danh mục sản phẩm và giá bán"', 'Mã sản phẩm | Tên sản phẩm | Nhóm hàng | Đơn vị tính | Giá bán lẻ | Mã vạch', ['RAU-0001 | Cải bó xôi 300g | Rau củ | gói | 18.000 | 893...', 'GAO-0012 | Gạo ST25 túi 5kg | Gạo | túi | 189.000 | 893...'], 'Mỗi dòng một mã sản phẩm. Giá bán chưa gồm khuyến mãi. Gửi file Excel hoặc PDF đều được.'),
  'coxanh-stores': dataFile('Danh sách cửa hàng và kho hàng', 'Cỏ Xanh Retail – do chị Phạm Thu Lan gửi', 'Mã kho | Tên cửa hàng | Địa chỉ | Giao online', ['KHO-TD | Kho tổng Thủ Đức | TP. Thủ Đức | Có', 'CH-Q3-01 | Cỏ Xanh Võ Văn Tần | Quận 3 | Có', 'CH-BD-02 | Cỏ Xanh Thủ Dầu Một | Bình Dương | Chưa có mã kho'], '24 cửa hàng và 3 kho tổng. 3 cửa hàng tại Bình Dương đang bổ sung mã kho.'),
  // internal pricing notes carry NO cost or margin figures: files and comments reach every internal viewer,
  // including members and AMs without cost permission (SPEC §2) — cost lives only in the cost-gated fields
  'coxanh-estimate': {
    title: 'Bảng giá đề xuất phụ lục 20 người dùng',
    subtitle: 'Tài liệu nội bộ – không gửi khách hàng',
    sections: [
      { heading: 'Giá bán', lines: ['- 20 bản quyền x 3.240.000 ₫ (đơn giá ưu đãi)', '- 1 gói đào tạo x 24.000.000 ₫'] },
      { heading: 'Chiết khấu', lines: ['- Đơn giá ưu đãi theo hợp đồng hiện hành của Cỏ Xanh', '- Chiết khấu hiệu lực nằm trong ngưỡng 10%'] },
      { heading: 'Kết luận', lines: ['Giữ đơn giá thỏa thuận, không cần Giám đốc duyệt.'] },
    ],
  },
  // ── Ngân hàng Thịnh An
  'thinhan-proposal': {
    title: 'Đề xuất giải pháp Cổng ngân hàng số doanh nghiệp',
    subtitle: 'Ngân hàng Thịnh An – Giai đoạn 1',
    sections: [
      { heading: 'Mục tiêu', lines: ['Khách hàng doanh nghiệp tự lập lệnh chuyển tiền, phê duyệt nhiều cấp theo hạn mức và đối soát giao dịch trực tuyến.'] },
      { heading: 'Nguyên tắc', lines: ['- Triển khai tại trung tâm dữ liệu của ngân hàng', '- Kiểm thử bảo mật độc lập trước UAT', '- Phân quyền theo quy định hạn mức hiện hành'] },
    ],
  },
  'thinhan-contract': contract('TA-CB', 'Triển khai Cổng ngân hàng số doanh nghiệp – Giai đoạn 1', 'Ngân hàng TMCP Thịnh An', ['Phân tích, thiết kế, lập trình, kiểm thử cổng ngân hàng số', '50 bản quyền người dùng nội bộ', 'Hỗ trợ kiểm thử bảo mật và UAT'], ['Đợt 1 – Ký hợp đồng: 30%', 'Đợt 2 – Hoàn thành khảo sát: 20%', 'Đợt 3 – Hoàn thành thiết kế giải pháp: 20%', 'Đợt 4 – Go-live: 30%']),
  'thinhan-survey': survey('Báo cáo khảo sát hiện trạng', 'Ngân hàng Thịnh An – khối khách hàng doanh nghiệp', ['Lệnh chuyển tiền doanh nghiệp vẫn nộp bản giấy tại quầy', 'Phê duyệt nhiều cấp thực hiện qua email, khó truy vết', 'Đối soát cuối ngày làm thủ công bằng bảng tính'], ['Lập lệnh và phê duyệt trực tuyến theo hạn mức', 'Nhật ký phê duyệt đầy đủ: ai, lúc nào, nội dung gì', 'Tự động đối soát với core banking cuối ngày']),
  'thinhan-core-api': dataFile('Tài liệu API core banking v3.2', 'Ngân hàng Thịnh An – do chị Đinh Ngọc Mai gửi', 'Dịch vụ | Phương thức | Mô tả', ['balance/inquiry | POST | Truy vấn số dư tài khoản', 'transfer/create | POST | Lập lệnh chuyển tiền', 'reconcile/daily | GET | Tệp đối soát cuối ngày (mục 5)'], 'Bản tóm tắt. Bản đầy đủ chỉ chia sẻ qua kênh mã hóa của ngân hàng.'),
  'thinhan-p2-analysis': {
    title: 'Phân tích chiết khấu giai đoạn 2',
    subtitle: 'Tài liệu nội bộ – không gửi khách hàng',
    sections: [
      { heading: 'Thay đổi so với bản 1', lines: ['- Lập trình: 80 → 60 ngày công', '- Bản quyền 100 người dùng: chiết khấu 10% → 20%', '- Bổ sung 11 gói đào tạo cho chi nhánh', '- Chiết khấu tổng: 5% → 10%'] },
      { heading: 'Kết quả', lines: ['Chiết khấu hiệu lực so với đơn giá áp dụng: 15%. Vượt ngưỡng 10% nên cần Giám đốc duyệt.'] },
    ],
  },
  // ── Cơ điện Thiên Trường
  'thientruong-contract': contract('TT-MES', 'Triển khai hệ thống quản lý sản xuất (MES)', 'Công ty Cổ phần Cơ điện Thiên Trường', ['Kế hoạch sản xuất, điều phối lệnh, xuất kho nguyên vật liệu', 'Kết nối dữ liệu 12 máy CNC', 'Chuyển đổi dữ liệu và đào tạo 3 xưởng'], ['Đợt 1 – Ký hợp đồng: 30%', 'Đợt 2 – Hoàn thành thiết kế: 30%', 'Đợt 3 – Nghiệm thu UAT: 25%', 'Đợt 4 – Go-live: 15%']),
  'thientruong-survey': survey('Báo cáo khảo sát 3 xưởng', 'Cơ điện Thiên Trường', ['Lệnh sản xuất lập trên bảng tính, chuyển xuống xưởng bằng giấy', 'Không theo dõi được tiến độ từng lệnh theo thời gian thực', 'Xuất kho vật tư chưa đối chiếu định mức'], ['Điều phối lệnh trên một bảng chung cho 3 xưởng', 'Xuất kho theo định mức nguyên vật liệu', 'Kết nối máy CNC để ghi nhận sản lượng tự động']),
  'thientruong-invoice-2': {
    title: 'Hóa đơn đợt 2 – số 0000528',
    subtitle: 'Hợp đồng TT-MES – Đợt 2: Hoàn thành thiết kế (30%)',
    meta: [['Người mua', 'Công ty Cổ phần Cơ điện Thiên Trường'], ['Người bán', 'Công ty Cổ phần Giải pháp New Era'], ['Hạn thanh toán', '15 ngày kể từ ngày xuất hóa đơn']],
    sections: [{ heading: 'Thông tin chuyển khoản', lines: ['Nội dung: TT-MES dot 2', 'Sau khi chuyển khoản, vui lòng bấm "Báo đã chuyển khoản" trong Client Hub và đính kèm chứng từ.'] }],
  },
  'tpl-bom': dataFile('Mẫu khai báo định mức nguyên vật liệu', 'Dùng cho việc "Cung cấp định mức nguyên vật liệu"', 'Mã sản phẩm | Mã nguyên vật liệu | Số lượng | Đơn vị | Hao hụt cho phép (%)', ['TD-600x800 | THEP-1.2 | 6,4 | kg | 3', 'TD-600x800 | SON-TINH-DIEN | 0,8 | kg | 5']),
  'thientruong-bom': dataFile('Định mức nguyên vật liệu – 120 mã', 'Cơ điện Thiên Trường – do anh Bùi Trường Sơn gửi', 'Mã sản phẩm | Mã nguyên vật liệu | Số lượng | Đơn vị | Hao hụt (%)', ['TD-600x800 | THEP-1.2 | 6,4 | kg | 3', 'TPP-400 | DONG-THANH | 2,1 | kg | 2', '... 118 mã khác'], 'Còn thiếu định mức của 14 mã bán thành phẩm, sẽ bổ sung.'),
  // ── Năng lượng Gió Ngàn
  'giongan-contract': contract('GN-OPS', 'Nền tảng giám sát vận hành trang trại gió', 'Công ty Cổ phần Năng lượng Gió Ngàn', ['Bảng điều khiển vận hành 42 tua-bin', 'Tích hợp dữ liệu SCADA', 'Cảnh báo tự động và báo cáo sản lượng', 'Bản quyền doanh nghiệp và 12 tháng hạ tầng'], ['Đợt 1 – Ký hợp đồng: 30%', 'Đợt 2 – Hoàn thành khảo sát: 20%', 'Đợt 3 – Hoàn thành thiết kế: 20%', 'Đợt 4 – Go-live: 30%']),
  'giongan-survey': survey('Báo cáo khảo sát hệ thống SCADA', 'Năng lượng Gió Ngàn', ['SCADA của từng cụm tua-bin xem trên phần mềm riêng của hãng', 'Cảnh báo rung và nhiệt độ chỉ hiện tại trung tâm điều hành', 'Báo cáo sản lượng tổng hợp thủ công mỗi sáng'], ['Một bảng điều khiển chung cho 42 tua-bin', 'Cảnh báo theo ngưỡng gửi tới trưởng ca', 'Báo cáo sản lượng tự động theo ngày']),
  'giongan-thresholds': dataFile('Bảng ngưỡng cảnh báo đề xuất', 'Năng lượng Gió Ngàn', 'Chỉ số | Ngưỡng cảnh báo | Ngưỡng nguy hiểm', ['Rung trục chính | 4,5 mm/s | 7,1 mm/s', 'Nhiệt độ hộp số | 75 °C | 85 °C', 'Mất kết nối | 5 phút | 15 phút'], 'Theo khuyến nghị của hãng tua-bin. Anh Tài xác nhận hoặc ghi ngưỡng muốn dùng.'),
  'giongan-scada-notes': {
    title: 'Ghi chú kỹ thuật giao thức SCADA mới',
    subtitle: 'Tài liệu nội bộ – không gửi khách hàng',
    sections: [
      { heading: 'Vấn đề', lines: ['Trang trại nâng cấp SCADA sang giao thức mới, bộ chuyển đổi cũ không đọc được dữ liệu rung và nhiệt độ.'] },
      { heading: 'Kế hoạch', lines: ['- Viết lại bộ chuyển đổi cho 3 loại thiết bị', '- Kiểm thử với dữ liệu 7 ngày của cụm A', '- Bổ sung 1 kỹ sư tích hợp đến khi xong'] },
    ],
  },
  // ── Địa ốc Hải Đăng
  'haidang-contract': contract('HD-CRM', 'Triển khai CRM bán hàng dự án', 'Công ty Cổ phần Địa ốc Hải Đăng', ['Giỏ hàng căn hộ và theo dõi đặt cọc', 'Phân bổ khách hàng tiềm năng', '60 bản quyền người dùng và 2 gói đào tạo'], ['Đợt 1 – Ký hợp đồng: 40%', 'Đợt 2 – Hoàn thành thiết kế: 30%', 'Đợt 3 – Go-live: 30%']),
  'haidang-survey': survey('Báo cáo khảo sát quy trình bán hàng', 'Địa ốc Hải Đăng – 2 sàn giao dịch', ['Giỏ hàng căn hộ cập nhật bằng bảng tính dùng chung', 'Khách hàng tiềm năng chia thủ công, dễ trùng', 'Chưa theo dõi được tiến độ thanh toán theo đợt của khách mua'], ['Giỏ hàng trực tuyến cập nhật theo thời gian thực', 'Chia khách tự động theo quy tắc thống nhất', 'Nhắc lịch thanh toán cho khách mua']),
  'haidang-lead-flow': {
    title: 'Quy trình phân bổ khách hàng tiềm năng',
    subtitle: 'Địa ốc Hải Đăng – chờ chị Lâm Tường Vy duyệt',
    sections: [
      { heading: 'Nguồn khách', lines: ['- Website dự án', '- Sàn giao dịch', '- Người giới thiệu'] },
      { heading: 'Quy tắc chia (trang 2)', lines: ['- Chia đều lần lượt cho nhân viên đang trong ca', '- Khách quay lại giữ nguyên nhân viên cũ', '- Sau 2 giờ chưa liên hệ thì chuyển người khác'] },
    ],
  },
  'haidang-projects': dataFile('Danh sách dự án và bảng giá', 'Địa ốc Hải Đăng – do anh Phan Gia Khang gửi', 'Dự án | Tòa | Số căn | Giá từ', ['Hải Đăng Riverside | A, B | 420 | 3,2 tỷ', 'Hải Đăng Garden | C | 260 | 2,6 tỷ', 'Hải Đăng Central | D | 180 | 4,1 tỷ'], 'Dự án thứ 4 sẽ bổ sung sau.'),
  // ── Mây Trắng Logistics
  'maytrang-contract': contract('MT-TMS', 'Triển khai hệ thống quản lý vận tải (TMS)', 'Công ty Cổ phần Mây Trắng Logistics', ['Điều phối xe và ghép chuyến', 'Ứng dụng tài xế', 'Chuyển đổi dữ liệu và 40 bản quyền người dùng'], ['Đợt 1 – Ký hợp đồng: 30%', 'Đợt 2 – Nghiệm thu UAT: 40%', 'Đợt 3 – Go-live: 30%']),
  'maytrang-support-contract': contract('MT-OPS', 'Hỗ trợ vận hành và mở rộng TMS', 'Công ty Cổ phần Mây Trắng Logistics', ['Hỗ trợ vận hành 8x5 trong 12 tháng', '12 tháng hạ tầng đám mây', '60 ngày công phát triển mở rộng'], ['Đợt 1 – Bàn giao vận hành: 25%', 'Đợt 2 – Tối ưu tuyến nội thành: 25%', 'Đợt 3 – Rà soát vận hành lần 1: 25%', 'Đợt 4 – Rà soát vận hành lần 2: 25%']),
  'maytrang-handover': {
    title: 'Tài liệu vận hành TMS',
    subtitle: 'Mây Trắng Logistics',
    sections: [
      { heading: 'Vận hành hằng ngày', lines: ['- Kiểm tra đồng bộ đơn lúc 6:00 và 13:00', '- Xử lý chuyến lỗi trong màn hình Điều phối', '- Sao lưu tự động mỗi đêm'] },
      { heading: 'Liên hệ hỗ trợ', lines: ['Gói hỗ trợ 8x5, phản hồi trong 8 giờ làm việc.'] },
    ],
  },
  'maytrang-review': {
    title: 'Báo cáo rà soát vận hành lần 1',
    subtitle: 'Mây Trắng Logistics',
    sections: [
      { heading: 'Kết quả', lines: ['- 98% đơn giao đúng hẹn', '- Quãng đường trung bình giảm 11% sau tối ưu tuyến', '- Không có sự cố nghiêm trọng'] },
      { heading: 'Đề xuất', lines: ['- Kết nối sàn thương mại điện tử', '- Ứng dụng tài xế phiên bản 2 chữ to, nút lớn'] },
    ],
  },
  'maytrang-shop-list': dataFile('Danh sách cửa hàng đối tác trên sàn', 'Mây Trắng Logistics – do chị Châu Mỹ Hạnh gửi', 'Mã cửa hàng | Tên cửa hàng | Sàn | Mã kho lấy hàng', ['SHOP-001 | Nhà Sách Hoa Mai | Sàn A | KHO-TB', 'SHOP-002 | Gia dụng Thu Cúc | Sàn B | KHO-Q7', '... 84 cửa hàng khác']),
};
