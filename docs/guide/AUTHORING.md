# Viết & chụp tài liệu hướng dẫn (docs/guide)

Tài liệu PDF `docs/ClientHub-HuongDan.pdf` được dựng từ HTML: `index.html` (bìa, mục lục, kiểu chữ) + các chương
`sections/NN-ten.html` + ảnh chụp `shots/`. Không cần Node: chụp và in bằng Edge chạy ẩn qua PowerShell.

## Lệnh

| Việc | Lệnh (PowerShell, cần dev server cổng 8780 và bản build mới `dist/ClientHub-demo.html`) |
| --- | --- |
| Chụp ảnh | viết một script `.ps1`, dot-source `tools/guide/cdp.ps1`, gọi `Start-Guide`, `Login-As`, `Nav`, `Mark`, `Save-Shot`, `Stop-Edge` |
| In PDF | `powershell -File tools/guide/build-pdf.ps1` → `docs/ClientHub-HuongDan.pdf` |
| Xem lại từng trang | `powershell -File tools/guide/review-pdf.ps1 -OutDir <thư mục>` → `page-01.jpg`… |

Hàm chụp (`tools/guide/cdp.ps1`):

- `Start-Guide -Port 9351 -ProfileDir "$env:TEMP\ch-guide-w1"`: mở bản build trong Edge ẩn với hồ sơ riêng. Dữ liệu demo
  nằm trong hồ sơ đó, nên thao tác ở đây không ảnh hưởng nơi khác. Mỗi người chụp dùng cổng và hồ sơ riêng.
- `Use-Desktop` (1440×900, ảnh 2160px) và `Use-Phone` (390×844, ảnh 780px).
- `Login-As '<chữ trên thẻ demo>'`: đăng nhập bằng thẻ demo (tự xóa phiên cũ và tải lại trang). Nên dùng tên người cho chắc:
  `'Lê Hoàng Nam'` (Giám đốc), `'Nguyễn Thu Hà'` (Quản lý khách hàng), `'Trần Quang Minh'` (khách, Người quyết định),
  `'Phạm Thu Lan'` (khách, Thành viên), `'Vào với vai trò Thành viên nội bộ'` (thành viên nội bộ).
- `Nav '/app/crm'`: chuyển trang (HashRouter) rồi chờ giao diện đứng yên.
- `Click-El "__g.byText('Thêm khách hàng')"`, `Type-Text '...'`, `Press 'Enter'|'Escape'|'Tab'`, `Hover-At x y`:
  thao tác thật bằng chuột và phím. Menu Radix chỉ mở bằng `Click-El`, không mở bằng `el.click()`.
- `Eval '<js>'`: chạy JS trong trang. Helper `__g`: `q(sel)`, `all(sel)`, `byText(text, sel?)`, `anyText(text)`,
  `up(el, sel)`, `field(label)`, `idle()`, `rect(el)`.
- `Mark "__g.mark(1, __g.byText('Tạo việc')); __g.mark(2, __g.q('table'), { pad: 4 })"`: đặt chú thích số lên phần
  tử. Tùy chọn: `pad`, `side: 'right'`, `shape: 'ring'`. Gọi trước `Save-Shot`.
- `Save-Shot '05-account-list'`: ghi `shots/05-account-list.jpg` và `.json` (gồm chú thích và cỡ ảnh).
  `build-pdf.ps1` gộp các file `.json` thành `manifest.json`.
- Luôn gọi `Stop-Edge "$env:TEMP\ch-guide-w1"` ở `finally`. Lệnh này chỉ đóng Edge ẩn của hồ sơ đó.

## Cách viết một chương

```html
<section class="chapter" id="khach-hang">
  <h2>Khách hàng</h2>
  <p class="intro">Một hai câu: phần này dùng để làm gì, ai dùng.</p>

  <h3>Thêm khách hàng mới</h3>
  <p>Ai làm được: Giám đốc, Quản lý khách hàng.</p>
  <ol class="steps">
    <li>Mở <span class="ui">Khách hàng</span> ở thanh bên, bấm <span class="ui">Thêm khách hàng</span>.</li>
    <li>…</li>
  </ol>
  <figure class="shot" data-shot="05-wizard-company" data-caption="Bước 1 — Thông tin công ty"></figure>
  <ol class="legend"><li>Ý nghĩa số 1 trên ảnh</li><li>Ý nghĩa số 2</li></ol>
  <p class="tip">Mẹo ngắn.</p>
</section>
```

- Ảnh điện thoại: đặt trong `<div class="phones">…</div>`, mỗi hàng 2–3 ảnh. Ảnh chụp bằng `Use-Phone` tự có khung
  điện thoại. Muốn ảnh máy tính nhỏ lại thì thêm `data-size="half"`.
- Hộp ghi chú có ba loại: `p.tip` (Mẹo), `p.note` (Lưu ý), `p.warn` (Quan trọng). Bảng dùng `<table>` thường. Phím tắt
  dùng `<kbd>`.
- Đừng đánh số thủ công: số chương và số mục (1.1, 1.2…) được tạo tự động từ `h2`/`h3`.

## Giọng văn

- Tiếng Việt, xưng **anh/chị** với người đọc, câu ngắn. Bước thao tác viết dạng mệnh lệnh: "Bấm…", "Chọn…", "Nhập…".
- Tên nút, tab, menu ghi **đúng như trên màn hình**, đặt trong `<span class="ui">`.
- Mỗi tính năng trả lời ba câu: để làm gì, ai dùng được, làm thế nào. Thêm một mẹo nếu thật sự có ích.
- Không bịa tính năng. Chỉ mô tả cái đã thấy và đã chụp được. Dữ liệu trong ảnh là dữ liệu demo hư cấu.
- Mỗi ảnh có 1–4 chú thích số, và `ol.legend` ngay dưới giải thích từng số theo đúng thứ tự.
- Ảnh máy tính chiếm cả bề ngang trang. Mỗi chương khoảng 3–8 ảnh. Toàn bộ PDF nên dưới 25 MB.
