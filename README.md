# Client Hub · New Era

Hệ thống quản lý khách hàng, dự án, việc, báo giá, bán hàng (CRM) và khách hàng mục tiêu của New Era. App có hai phía:

- **Nội bộ New Era** (Giám đốc, AM, thành viên):
  - Tổng quan ngoại lệ, danh mục khách hàng, chi tiết account.
  - Việc dạng Kanban / Danh sách / Timeline, lộ trình và ngày dự báo.
  - Thương mại: báo giá có phiên bản và duyệt chiết khấu, hợp đồng, lịch thanh toán, phải thu.
  - Bán hàng (pipeline cơ hội), khách hàng mục tiêu (chấm điểm phù hợp, phân khúc), danh mục dự án và khối lượng việc.
  - Thông báo, nhắc khách, leo thang, bản tin tuần.
- **Khách hàng** (Người quyết định, Thành viên):
  - Trang chủ "việc cần anh/chị xử lý": mỗi việc có hạn, hệ quả nếu chưa làm và 1 nút chính.
  - Tiến độ, thương mại, tài liệu, giao việc cho đồng nghiệp.

Đặc tả gốc: [SPEC.md](SPEC.md). Kiến trúc và quy ước kỹ thuật: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. Chạy thử nhanh: mở 1 file

Mở `dist/ClientHub-demo.html` bằng Chrome hoặc Edge (bấm đúp là được).

- Cần **kết nối mạng**: thư viện React, Tailwind và font tải từ CDN.
- Dữ liệu demo nằm trong trình duyệt (localStorage). Muốn xóa thao tác của mình: menu tài khoản → **Đặt lại dữ liệu demo**.

## 2. Chạy bằng Vite (máy có Node.js sạch)

```bash
npm install
```

```bash
npm run dev
```

Mở địa chỉ Vite in ra, thường là http://localhost:5173. Các lệnh khác:

| Lệnh | Việc làm |
|---|---|
| `npm run build` | build bản production |
| `npm run typecheck` | kiểm tra kiểu TypeScript |

## 3. Chạy không cần Node (Windows, PowerShell)

Dùng khi máy không có hoặc không chạy được Node:

Từ thư mục `client-hub`:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
```

Rồi mở http://localhost:8780. Service Worker (`sw.js`) dịch TypeScript/TSX ngay trong trình duyệt.

- Kiểm tra kiểu: http://localhost:8780/tools/typecheck.html?auto=1
- Đóng gói lại file demo: http://localhost:8780/tools/build-standalone.html?auto=1 (kết quả ghi ra `dist/ClientHub-demo.html`)

---

## 4. Đăng nhập demo

Màn đăng nhập có nút **Vào nhanh** theo vai trò:

| Nút | Người dùng | Ghi chú |
|---|---|---|
| Giám đốc | Lê Hoàng Nam | thấy mọi thứ, kể cả giá vốn và biên lợi nhuận |
| AM | Nguyễn Thu Hà | phụ trách Cỏ Xanh, Thịnh An, Hải Đăng; **không** được xem giá vốn |
| Khách – Người quyết định | anh Trần Quang Minh (CEO Cỏ Xanh Retail) | account đang bị chặn |
| Khách – Thành viên | chị Phạm Thu Lan (Cỏ Xanh Retail) | có việc được anh Minh giao |
| Thành viên nội bộ (link nhỏ) | Phạm Minh Tuấn | chỉ thấy việc được giao |

Đăng nhập thủ công:
- **Khách:** nhập email → mã OTP demo `246810`.
- **Nội bộ:** email + mật khẩu `newera2026`. AM Trần Đức Anh có quyền xem giá vốn.

"Ghi nhớ thiết bị" giữ phiên đăng nhập sau khi đóng trình duyệt. Mỗi tab giữ phiên riêng, nên có thể mở song song một tab nội bộ và một tab khách.

## 5. Tình huống có sẵn trong dữ liệu mẫu

Các ngày đều tính theo hôm nay, nên tình huống luôn đúng mỗi khi mở.

| Khách hàng (hư cấu) | Tình huống |
|---|---|
| Cỏ Xanh Retail (bán lẻ) | **Đang bị chặn**: khách chưa duyệt thiết kế, quá hạn 6 ngày, UAT và Go-live dự báo lùi 6 ngày. Người quyết định đã giao việc cho đồng nghiệp. Có báo giá phụ lục chờ chấp thuận. |
| Ngân hàng Thịnh An | Báo giá **v2 chiết khấu 15%** đang chờ Giám đốc duyệt; nút "Gửi khách" bị khóa đến khi được duyệt. |
| Cơ điện Thiên Trường (sản xuất) | **Đợt thanh toán quá hạn** khoảng 12 ngày. |
| Năng lượng Gió Ngàn | **New Era đang trễ việc**, mốc UAT lùi 4 ngày; khách thấy rõ lý do. |
| Địa ốc Hải Đăng (bất động sản) | Việc sắp đến hạn đang chặn mốc. Người quyết định chưa đăng nhập lần nào, nên thấy 3 màn giới thiệu (đăng nhập bằng OTP). |
| Mây Trắng Logistics | **Đúng kế hoạch**, không có việc chờ khách. |

Thêm cho CRM: khoảng 24 khách hàng mục tiêu, 12–14 cơ hội ở các giai đoạn, khoảng 45 lần tương tác, 4 phân khúc và chân dung khách hàng lý tưởng mặc định.

## 6. Cấu trúc

```
src/
  domain/      logic thuần: chặn & dự báo mốc, sức khỏe account, quy tắc việc, tính báo giá, CRM (điểm phù hợp)
  data/        dữ liệu mẫu (sinh theo ngày hôm nay)
  services/    lớp dữ liệu giả lập: api.ts = hợp đồng duy nhất UI được gọi; lọc quyền (RBAC) ngay tại đây
  components/  ui (kiểu shadcn) · common (thành phần sản phẩm) · task · crm · commercial · remind
  features/    các màn hình: portal, dashboard, account, tasks, roadmap, commercial, notifications,
               settings, wizard, crm, targets, projects
  i18n/vi/     toàn bộ chữ hiển thị (thêm tiếng Anh: tạo i18n/en/ cùng khóa)
supabase/      schema Postgres + RLS + hàm RPC cho backend thật sau này
tools/         typecheck.html (kiểm tra kiểu trong trình duyệt), build-standalone.html (đóng gói 1 file)
```

**Bảo mật:** tài khoản khách không bao giờ nhận được các dữ liệu sau, vì chúng bị lọc ở lớp `services/` trước khi tới giao diện (bảng `window.__CH_NET__` ghi lại mọi phản hồi để kiểm chứng):
- giá vốn, biên lợi nhuận;
- ghi chú nội bộ;
- việc đã tắt "Khách thấy được";
- dữ liệu CRM.

Khi chuyển sang Supabase, các luật tương ứng nằm ở `supabase/schema.sql` (RLS và view không có cột giá vốn).

## 7. Tự kiểm tra

Trang **/dev/selftest** (Giám đốc → menu tài khoản) chạy các bộ kiểm tra:
- logic miền: chặn, dự báo, sức khỏe, báo giá;
- phân quyền tầng dữ liệu;
- tính toàn vẹn của dữ liệu mẫu;
- gọi thử toàn bộ API;
- CRM.

## 8. Chưa làm ở bản này

Theo mục 12 của đặc tả: chat realtime, ký điện tử, hóa đơn điện tử, Zalo OA/ZNS, app native, AI tóm tắt, xuất báo cáo 1 trang.

Hai phần đang được mô phỏng:
- **Email:** chưa gửi thật; xem ở "Thông báo → Hộp thư mô phỏng".
- **"Nhắc qua Zalo":** copy sẵn tin nhắn rồi mở zalo.me để người dùng tự dán và gửi.
