// Clean blue/white SVG wireframes used as "design" files in the demo (labels in Vietnamese).
// Single-quoted attributes keep the encodeURIComponent'd data: URLs short.

const FONT = 'Be Vietnam Pro, Inter, Arial, sans-serif';
const C = {
  primary: '#1D4ED8',
  soft: '#EEF3FF',
  pborder: '#C7D7FE',
  border: '#E5E9F0',
  bg: '#F6F8FC',
  fg: '#0F172A',
  muted: '#475569',
  caption: '#64748B',
  ok: '#15803D',
  okSoft: '#ECFDF3',
  warn: '#B45309',
  warnSoft: '#FFF7E6',
  bad: '#B91C1C',
  badSoft: '#FEF2F2',
  white: '#FFFFFF',
};

interface TextOpts {
  size?: number;
  fill?: string;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function r(x: number, y: number, w: number, h: number, fill: string, rx = 0, stroke?: string): string {
  return `<rect x='${x}' y='${y}' width='${w}' height='${h}' rx='${rx}' fill='${fill}'${stroke ? ` stroke='${stroke}'` : ''}/>`;
}

function t(x: number, y: number, s: string, o: TextOpts = {}): string {
  const anchor = o.anchor && o.anchor !== 'start' ? ` text-anchor='${o.anchor}'` : '';
  const weight = o.weight && o.weight !== 400 ? ` font-weight='${o.weight}'` : '';
  return `<text x='${x}' y='${y}' font-size='${o.size ?? 13}' fill='${o.fill ?? C.fg}'${anchor}${weight}>${esc(s)}</text>`;
}

function doc(w: number, h: number, body: string): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' font-family='${FONT}'>${r(0, 0, w, h, C.bg, 24, C.border)}${body}</svg>`;
}

/** Phone screen 360×740 with a blue top bar and an optional version badge at the bottom. */
function phone(title: string, body: string, badge?: string): string {
  return doc(
    360,
    740,
    t(24, 30, '9:41', { size: 12, weight: 600 }) +
      r(0, 44, 360, 56, C.primary) +
      t(180, 79, title, { size: 17, weight: 600, fill: C.white, anchor: 'middle' }) +
      body +
      (badge ? r(16, 700, 328, 28, C.soft, 8, C.pborder) + t(180, 719, badge, { size: 11, fill: C.primary, anchor: 'middle', weight: 600 }) : ''),
  );
}

const CART: [string, string, string][] = [
  ['Gạo ST25 túi 5kg', 'SL: 2', '378.000 ₫'],
  ['Dầu ăn hướng dương 1L', 'SL: 1', '72.000 ₫'],
  ['Sữa tươi không đường 1L', 'SL: 4', '136.000 ₫'],
];

function cartItems(y0: number): string {
  return CART.map(([name, qty, price], i) => {
    const y = y0 + i * 84;
    return r(16, y, 328, 74, C.white, 12, C.border) + r(28, y + 11, 52, 52, C.soft, 8) + t(92, y + 30, name, { size: 14, weight: 500 }) + t(92, y + 52, qty, { size: 12, fill: C.caption }) + t(332, y + 52, price, { size: 14, weight: 600, anchor: 'end' });
  }).join('');
}

function summary(y: number): string {
  return (
    r(16, y, 328, 104, C.white, 12, C.border) +
    t(32, y + 28, 'Tạm tính', { fill: C.muted }) + t(328, y + 28, '586.000 ₫', { anchor: 'end' }) +
    t(32, y + 54, 'Phí giao hàng', { fill: C.muted }) + t(328, y + 54, '15.000 ₫', { anchor: 'end' }) +
    t(32, y + 86, 'Tổng cộng', { size: 15, weight: 600 }) + t(328, y + 86, '601.000 ₫', { size: 16, weight: 700, anchor: 'end', fill: C.primary })
  );
}

function orderV1(): string {
  return phone(
    'Đặt hàng',
    t(16, 132, 'Giỏ hàng (3 sản phẩm)', { size: 15, weight: 600 }) +
      cartItems(146) +
      summary(404) +
      r(16, 524, 328, 44, C.white, 8, C.border) + t(32, 551, 'Nhập mã giảm giá', { fill: C.caption }) +
      r(16, 584, 328, 48, C.primary, 8) + t(180, 614, 'Thanh toán ngay', { size: 15, weight: 600, fill: C.white, anchor: 'middle' }),
    'Bản 1 · nút thanh toán nằm trong giỏ hàng',
  );
}

function orderV2(): string {
  const option = (y: number, label: string, sub: string, on: boolean) =>
    r(16, y, 328, 56, on ? C.soft : C.white, 10, on ? C.pborder : C.border) +
    `<circle cx='38' cy='${y + 28}' r='8' fill='${C.white}' stroke='${on ? C.primary : C.caption}' stroke-width='2'/>` +
    (on ? `<circle cx='38' cy='${y + 28}' r='4' fill='${C.primary}'/>` : '') +
    t(56, y + 24, label, { size: 13, weight: 500 }) + t(56, y + 43, sub, { size: 11, fill: C.caption });
  return phone(
    'Đặt hàng',
    t(16, 132, 'Giỏ hàng (3 sản phẩm)', { size: 15, weight: 600 }) +
      cartItems(146) +
      t(16, 418, 'Chọn kho giao hàng', { size: 15, weight: 600 }) +
      option(430, 'Kho Thủ Đức', 'Giao trong 2 giờ · còn đủ hàng', true) +
      option(494, 'Cửa hàng Quận 3', 'Nhận tại cửa hàng sau 30 phút', false) +
      r(0, 600, 360, 88, C.white, 0, C.border) +
      t(16, 630, 'Tổng cộng', { size: 12, fill: C.caption }) + t(16, 656, '601.000 ₫', { size: 18, weight: 700, fill: C.primary }) +
      r(172, 616, 172, 48, C.primary, 8) + t(258, 646, 'Tiếp tục thanh toán', { size: 14, weight: 600, fill: C.white, anchor: 'middle' }),
    'Bản 2 · tách nút thanh toán, thêm chọn kho',
  );
}

function home(): string {
  const cats = ['Rau củ', 'Gạo', 'Sữa', 'Đồ uống'];
  const products: [string, string][] = [['Cải bó xôi 300g', '18.000 ₫'], ['Táo Envy 1kg', '129.000 ₫'], ['Trứng gà 10 quả', '32.000 ₫'], ['Nước cam 1L', '45.000 ₫']];
  return phone(
    'Cỏ Xanh',
    r(16, 116, 328, 44, C.white, 22, C.border) + t(40, 143, 'Tìm sản phẩm, thương hiệu…', { fill: C.caption }) +
      r(16, 176, 328, 112, C.soft, 12, C.pborder) + t(32, 214, 'Ưu đãi cuối tuần', { size: 18, weight: 700, fill: C.primary }) + t(32, 240, 'Giảm 10% rau củ hữu cơ', { fill: C.muted }) + r(32, 252, 96, 24, C.primary, 12) + t(80, 268, 'Xem ngay', { size: 11, fill: C.white, anchor: 'middle', weight: 600 }) +
      cats.map((c, i) => `<circle cx='${52 + i * 85}' cy='${330}' r='24' fill='${C.white}' stroke='${C.border}'/>` + t(52 + i * 85, 374, c, { size: 12, anchor: 'middle', fill: C.muted })).join('') +
      t(16, 414, 'Bán chạy', { size: 15, weight: 600 }) +
      products.map(([n, p], i) => {
        const x = 16 + (i % 2) * 168;
        const y = 428 + Math.floor(i / 2) * 124;
        return r(x, y, 160, 114, C.white, 12, C.border) + r(x + 10, y + 10, 140, 50, C.soft, 8) + t(x + 10, y + 80, n, { size: 12, weight: 500 }) + t(x + 10, y + 100, p, { size: 13, weight: 700, fill: C.primary });
      }).join('') +
      r(0, 684, 360, 56, C.white, 0, C.border) +
      ['Trang chủ', 'Danh mục', 'Giỏ hàng', 'Tài khoản'].map((l, i) => t(45 + i * 90, 716, l, { size: 11, anchor: 'middle', fill: i === 0 ? C.primary : C.caption, weight: i === 0 ? 600 : 400 })).join(''),
  );
}

function brand(): string {
  const leaf = (cx: number, cy: number, fill: string) => `<path d='M${cx} ${cy - 20} C${cx + 16} ${cy - 15} ${cx + 20} ${cy} ${cx} ${cy + 20} C${cx - 20} ${cy} ${cx - 16} ${cy - 15} ${cx} ${cy - 20}Z' fill='${fill}'/>`;
  const swatches: [string, string][] = [['#2F7D4F', 'Xanh lá chủ đạo'], [C.primary, 'Xanh liên kết'], [C.bg, 'Nền trang'], [C.fg, 'Chữ chính']];
  return doc(
    720,
    460,
    t(32, 48, 'Bộ nhận diện giao diện – Cỏ Xanh Retail', { size: 20, weight: 700 }) + t(32, 72, 'Logo, bảng màu và kiểu chữ dùng trong app', { fill: C.muted }) +
      r(32, 96, 200, 150, C.white, 12, C.border) + `<circle cx='132' cy='150' r='32' fill='#2F7D4F'/>` + leaf(132, 150, C.white) + t(132, 222, 'Cỏ Xanh', { size: 18, weight: 700, anchor: 'middle', fill: '#2F7D4F' }) +
      r(260, 96, 200, 150, '#2F7D4F', 12) + leaf(360, 150, C.white) + t(360, 222, 'Cỏ Xanh', { size: 18, weight: 700, anchor: 'middle', fill: C.white }) +
      r(488, 96, 200, 150, C.white, 12, C.border) + r(553, 121, 70, 70, '#2F7D4F', 18) + leaf(588, 156, C.white) + t(588, 222, 'Biểu tượng app', { size: 13, anchor: 'middle', fill: C.muted }) +
      swatches.map(([hex, label], i) => r(32 + i * 168, 280, 152, 64, hex, 10, C.border) + t(32 + i * 168, 366, label, { size: 12, weight: 600 }) + t(32 + i * 168, 384, hex, { size: 11, fill: C.caption })).join('') +
      t(32, 428, 'Be Vietnam Pro — Aa Bb Cc Đđ Ơơ Ưư 0123', { size: 16, weight: 500 }),
  );
}

/** Desktop frame 960×600 with a left sidebar. */
function desktop(title: string, nav: string[], body: string): string {
  return doc(
    960,
    600,
    r(0, 0, 200, 600, C.white, 0, C.border) + t(24, 40, 'New Era', { size: 16, weight: 700, fill: C.primary }) +
      nav.map((n, i) => (i === 0 ? r(12, 66 + i * 40, 176, 32, C.soft, 8) : '') + t(28, 87 + i * 40, n, { size: 13, fill: i === 0 ? C.primary : C.muted, weight: i === 0 ? 600 : 400 })).join('') +
      t(228, 48, title, { size: 20, weight: 700 }) + body,
  );
}

function kpis(items: [string, string, string?][], y: number): string {
  return items.map(([label, value, tone], i) => r(228 + i * 180, y, 168, 84, C.white, 12, C.border) + t(244 + i * 180, y + 28, label, { size: 12, fill: C.caption }) + t(244 + i * 180, y + 64, value, { size: 24, weight: 700, fill: tone ?? C.fg })).join('');
}

function windDashboard(): string {
  const pts = [8, 22, 18, 30, 44, 52, 48, 61, 70, 66, 74, 80, 76, 69, 72, 64].map((v, i) => `${248 + i * 30},${380 - v * 1.8}`).join(' ');
  const alerts: [string, string, string, string][] = [['WTG-07', 'Rung cao 6,8 mm/s', C.bad, C.badSoft], ['WTG-18', 'Nhiệt độ hộp số 82 °C', C.warn, C.warnSoft], ['WTG-31', 'Mất kết nối 12 phút', C.warn, C.warnSoft]];
  return desktop(
    'Giám sát vận hành – Trang trại gió',
    ['Tổng quan', 'Tua-bin', 'Cảnh báo', 'Báo cáo sản lượng', 'Cài đặt'],
    kpis([['Công suất hiện tại', '86,4 MW'], ['Tua-bin hoạt động', '40/42'], ['Sản lượng hôm nay', '1.284 MWh'], ['Cảnh báo', '3', C.warn]], 72) +
      r(228, 172, 480, 236, C.white, 12, C.border) + t(248, 200, 'Công suất 24 giờ qua (MW)', { size: 13, weight: 600 }) +
      `<polyline points='${pts}' fill='none' stroke='${C.primary}' stroke-width='3'/>` +
      `<line x1='248' y1='380' x2='698' y2='380' stroke='${C.border}'/>` + t(248, 398, '00:00', { size: 11, fill: C.caption }) + t(698, 398, '24:00', { size: 11, fill: C.caption, anchor: 'end' }) +
      r(724, 172, 208, 236, C.white, 12, C.border) + t(740, 200, 'Tua-bin cần chú ý', { size: 13, weight: 600 }) +
      alerts.map(([id, msg, fg, bg], i) => r(740, 216 + i * 62, 176, 52, bg, 8) + t(752, 237 + i * 62, id, { size: 12, weight: 700, fill: fg }) + t(752, 256 + i * 62, msg, { size: 11, fill: C.muted })).join('') +
      r(228, 424, 704, 148, C.white, 12, C.border) + t(248, 452, 'Sản lượng theo cụm tua-bin', { size: 13, weight: 600 }) +
      ['Cụm A', 'Cụm B', 'Cụm C', 'Cụm D'].map((n, i) => t(248, 486 + i * 22, n, { size: 12, fill: C.muted }) + r(320, 474 + i * 22, [420, 380, 300, 350][i], 14, i === 2 ? C.pborder : C.primary, 4)).join(''),
  );
}

function productionBoard(): string {
  const cols: [string, [string, string, number][]][] = [
    ['Chờ sản xuất (4)', [['LSX-0415 · Tủ điện 600x800', '80 bộ · Xưởng cơ khí', 0], ['LSX-0416 · Khung máng cáp', '300 m · Xưởng cơ khí', 0]]],
    ['Đang chạy (3)', [['LSX-0412 · Vỏ tủ điện IP55', '120 bộ · Xưởng sơn', 0.65], ['LSX-0413 · Tủ phân phối', '45 bộ · Xưởng lắp ráp', 0.3]]],
    ['Hoàn thành hôm nay (5)', [['LSX-0409 · Tủ điều khiển', '60 bộ · đạt 100%', 1], ['LSX-0410 · Thang cáp', '520 m · đạt 100%', 1]]],
  ];
  return desktop(
    'Điều phối lệnh sản xuất',
    ['Lệnh sản xuất', 'Kế hoạch tuần', 'Xuất kho vật tư', 'Máy CNC', 'Báo cáo'],
    kpis([['Lệnh đang chạy', '3'], ['Hoàn thành tuần', '18'], ['Máy CNC hoạt động', '11/12'], ['Trễ kế hoạch', '1', C.warn]], 72) +
      cols.map(([title, cards], i) => {
        const x = 228 + i * 240;
        return r(x, 172, 228, 400, C.white, 12, C.border) + t(x + 16, 200, title, { size: 13, weight: 600 }) +
          cards.map(([name, sub, p], j) => {
            const y = 216 + j * 108;
            const bar = p > 0 ? r(x + 26, y + 70, 176, 8, C.border, 4) + r(x + 26, y + 70, Math.round(176 * p), 8, p >= 1 ? C.ok : C.primary, 4) : '';
            return r(x + 14, y, 200, 94, C.bg, 10, C.border) + t(x + 26, y + 26, name, { size: 12, weight: 600 }) + t(x + 26, y + 48, sub, { size: 11, fill: C.caption }) + bar;
          }).join('');
      }).join(''),
  );
}

function approvalFlow(): string {
  const boxes = ['Kế toán doanh nghiệp lập lệnh', 'Kiểm soát viên kiểm tra', 'Phê duyệt theo hạn mức', 'Gửi core banking', 'Đối soát cuối ngày'];
  return doc(
    960,
    380,
    t(32, 48, 'Luồng phê duyệt chuyển tiền – bản nháp', { size: 20, weight: 700 }) + t(32, 72, 'Cổng ngân hàng số doanh nghiệp · Thịnh An', { fill: C.muted }) +
      boxes.map((b, i) => {
        const x = 32 + i * 184;
        const arrow = i < boxes.length - 1 ? `<path d='M${x + 160} 150 L${x + 180} 150' stroke='${C.primary}' stroke-width='2'/><path d='M${x + 174} 144 L${x + 182} 150 L${x + 174} 156' fill='none' stroke='${C.primary}' stroke-width='2'/>` : '';
        const words = b.split(' ');
        const cut = Math.ceil(words.length / 2);
        const [l1, l2] = b.length > 20 ? [words.slice(0, cut).join(' '), words.slice(cut).join(' ')] : [b, ''];
        return r(x, 104, 160, 84, i === 2 ? C.soft : C.white, 12, i === 2 ? C.pborder : C.border) + t(x + 14, 128, `Bước ${i + 1}`, { size: 11, fill: C.caption }) + t(x + 14, 152, l1, { size: 12, weight: 600 }) + (l2 ? t(x + 14, 170, l2, { size: 12, weight: 600 }) : '') + arrow;
      }).join('') +
      r(400, 220, 260, 56, C.white, 10, C.border) + t(414, 244, '≤ 500 triệu: Kế toán trưởng duyệt', { size: 12 }) + t(414, 264, 'Thời gian xử lý mục tiêu: 15 phút', { size: 11, fill: C.caption }) +
      r(400, 288, 260, 56, C.white, 10, C.border) + t(414, 312, '> 500 triệu: Giám đốc tài chính duyệt', { size: 12 }) + t(414, 332, 'Cần 2 người duyệt nếu > 5 tỷ', { size: 11, fill: C.caption }) +
      `<path d='M448 188 L448 220' stroke='${C.primary}' stroke-width='2' stroke-dasharray='4 4'/>`,
  );
}

function unitGrid(): string {
  const status = ['ok', 'ok', 'hold', 'dep', 'ok', 'dep', 'hold', 'ok', 'ok', 'dep', 'ok', 'hold', 'dep', 'ok', 'ok', 'ok', 'dep', 'ok', 'hold', 'ok', 'ok', 'dep', 'ok', 'ok'];
  const fill = (s: string) => (s === 'dep' ? C.okSoft : s === 'hold' ? C.warnSoft : C.white);
  // shared attributes live on <g> wrappers to keep the file small
  const pos = (i: number): [number, number] => [228 + (i % 6) * 84, 112 + Math.floor(i / 6) * 70];
  const cells = status.map((s, i) => `<rect x='${pos(i)[0]}' y='${pos(i)[1]}' width='76' height='60' rx='8' fill='${fill(s)}'/>`).join('');
  const labels = status.map((_, i) => `<text x='${pos(i)[0] + 38}' y='${pos(i)[1] + 35}'>A-${12 - Math.floor(i / 6)}0${(i % 6) + 1}</text>`).join('');
  const units = [`<g stroke='${C.border}'>${cells}</g>`, `<g font-size='12' font-weight='600' text-anchor='middle' fill='${C.fg}'>${labels}</g>`];
  const legend: [string, string][] = [[C.white, 'Còn trống'], [C.warnSoft, 'Đang giữ chỗ'], [C.okSoft, 'Đã đặt cọc']];
  return desktop(
    'Giỏ hàng căn hộ – Hải Đăng Riverside',
    ['Giỏ hàng', 'Khách hàng tiềm năng', 'Đặt cọc', 'Thanh toán', 'Báo cáo'],
    t(228, 92, 'Tòa A · tầng 9–12', { size: 13, fill: C.muted }) + units.join('') +
      legend.map(([c, l], i) => r(228 + i * 150, 412, 16, 16, c, 4, C.border) + t(252 + i * 150, 425, l, { size: 12, fill: C.muted })).join('') +
      r(744, 92, 188, 360, C.white, 12, C.border) + t(760, 120, 'Phân bổ khách hôm nay', { size: 13, weight: 600 }) +
      [['Website', '18'], ['Sàn giao dịch', '11'], ['Người giới thiệu', '6']].map(([k, v], i) => t(760, 156 + i * 28, k, { size: 12, fill: C.muted }) + t(916, 156 + i * 28, v, { size: 12, weight: 700, anchor: 'end' })).join('') +
      r(760, 250, 156, 40, C.primary, 8) + t(838, 275, 'Chia khách tự động', { size: 12, weight: 600, fill: C.white, anchor: 'middle' }),
  );
}

function driverApp(): string {
  const stops: [string, string, boolean][] = [['Kho Tân Bình', 'Lấy 24 kiện · 07:30', true], ['45 Nguyễn Trãi, Quận 1', 'Giao 6 kiện · 08:15', false], ['12 Lê Văn Sỹ, Quận 3', 'Giao 4 kiện · 08:50', false], ['88 Cộng Hòa, Tân Bình', 'Giao 9 kiện · 09:40', false]];
  return phone(
    'Chuyến hôm nay',
    r(16, 116, 328, 170, C.soft, 12, C.pborder) +
      `<polyline points='48,250 96,214 150,226 210,170 268,186 312,140' fill='none' stroke='${C.primary}' stroke-width='4' stroke-linecap='round'/>` +
      `<circle cx='48' cy='250' r='7' fill='${C.ok}'/><circle cx='312' cy='140' r='7' fill='${C.primary}'/>` +
      t(32, 142, '4 điểm · 23 km · dự kiến 3 giờ', { size: 12, fill: C.muted }) +
      stops.map(([name, sub, done], i) => {
        const y = 304 + i * 76;
        return r(16, y, 328, 66, C.white, 12, C.border) + `<circle cx='40' cy='${y + 33}' r='12' fill='${done ? C.ok : C.soft}'/>` + t(40, y + 38, done ? '✓' : String(i + 1), { size: 12, weight: 700, anchor: 'middle', fill: done ? C.white : C.primary }) + t(64, y + 28, name, { size: 14, weight: 600 }) + t(64, y + 49, sub, { size: 12, fill: C.caption });
      }).join('') +
      r(16, 624, 328, 56, C.primary, 12) + t(180, 659, 'Bắt đầu giao điểm tiếp theo', { size: 16, weight: 700, fill: C.white, anchor: 'middle' }),
    'Bản phác thảo v2 · chữ to, nút lớn',
  );
}

/** key → SVG source builder */
export const DESIGNS: Record<string, () => string> = {
  'coxanh-order-v1': orderV1,
  'coxanh-order-v2': orderV2,
  'coxanh-home': home,
  'coxanh-brand': brand,
  'giongan-dashboard': windDashboard,
  'thientruong-dashboard': productionBoard,
  'thinhan-flow': approvalFlow,
  'haidang-pipeline': unitGrid,
  'maytrang-driver-app': driverApp,
};
