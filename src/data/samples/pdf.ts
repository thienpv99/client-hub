// Tiny one-page PDF writer for the demo documents. Base-14 Helvetica has no Vietnamese glyphs,
// so every string is folded to plain ASCII (unaccented Vietnamese). xref offsets are computed from
// the ASCII output, so byte offsets equal string indices.

export interface PdfSection {
  heading?: string;
  /** lines starting with '- ' are rendered as indented bullets */
  lines: string[];
}

export interface PdfDoc {
  title: string;
  subtitle?: string;
  /** label/value rows under the title */
  meta?: [string, string][];
  sections: PdfSection[];
  footer?: string;
}

const REPLACEMENTS: [RegExp, string][] = [
  [/đ/g, 'd'],
  [/Đ/g, 'D'],
  [/[–—]/g, '-'],
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
  [/₫/g, 'VND'],
  [/…/g, '...'],
  [/•/g, '-'],
  [/→/g, '->'],
  [/×/g, 'x'],
  [/\s?°C/g, ' do C'],
  [/°/g, ' do'],
  [/≤/g, '<='],
  [/≥/g, '>='],
];

/** 'Đặt hàng – 1.250.000 ₫' → 'Dat hang - 1.250.000 VND' */
export function toAscii(s: string): string {
  let out = s;
  for (const [re, rep] of REPLACEMENTS) out = out.replace(re, rep);
  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '?');
}

function str(s: string): string {
  return `(${toAscii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > max) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

const RGB = {
  primary: '0.114 0.306 0.847',
  fg: '0.059 0.090 0.165',
  muted: '0.278 0.333 0.412',
  caption: '0.392 0.455 0.545',
  border: '0.898 0.914 0.941',
  white: '1 1 1',
};

function text(font: 'F1' | 'F2', size: number, x: number, y: number, s: string): string {
  return `BT /${font} ${size} Tf ${x} ${y} Td ${str(s)} Tj ET`;
}

function content(doc: PdfDoc): string {
  const ops: string[] = [];
  ops.push(`${RGB.primary} rg 0 787 595 55 re f`);
  ops.push(`${RGB.white} rg`, text('F2', 16, 40, 808, 'NEW ERA'), text('F1', 9, 400, 810, 'Client Hub - tai lieu mau'));
  ops.push(`${RGB.fg} rg`, text('F2', 18, 40, 748, doc.title));
  let y = 748;
  if (doc.subtitle) {
    y -= 20;
    ops.push(`${RGB.muted} rg`, text('F1', 11, 40, y, doc.subtitle));
  }
  y -= 14;
  for (const [label, value] of doc.meta ?? []) {
    y -= 15;
    ops.push(`${RGB.caption} rg`, text('F1', 10, 40, y, label), `${RGB.fg} rg`, text('F1', 10, 170, y, value));
  }
  y -= 12;
  ops.push(`${RGB.border} RG 0.8 w 40 ${y} m 555 ${y} l S`);
  for (const section of doc.sections) {
    if (y < 90) break;
    if (section.heading) {
      y -= 26;
      ops.push(`${RGB.primary} rg`, text('F2', 12, 40, y, section.heading));
      y -= 4;
    }
    ops.push(`${RGB.fg} rg`);
    for (const line of section.lines) {
      const bullet = line.startsWith('- ');
      const parts = wrap(bullet ? line.slice(2) : line, bullet ? 88 : 94);
      parts.forEach((part, i) => {
        y -= 15;
        if (y < 70) return;
        if (bullet && i === 0) ops.push(text('F1', 10.5, 46, y, '-'));
        ops.push(text('F1', 10.5, bullet ? 58 : 40, y, part));
      });
    }
  }
  ops.push(`${RGB.border} RG 0.8 w 40 58 m 555 58 l S`);
  ops.push(`${RGB.caption} rg`, text('F1', 8, 40, 44, doc.footer ?? 'New Era - Cong ty giai phap chuyen doi so'));
  ops.push(text('F1', 8, 40, 32, 'Tai lieu mau trong ban demo Client Hub, khong co gia tri phap ly.'));
  return ops.join('\n');
}

/** Raw PDF bytes as a latin-1/ASCII string (use btoa for a data: URL). */
export function buildPdf(doc: PdfDoc): string {
  const stream = content(doc);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Title ${str(doc.title)} /Producer (Client Hub demo) >>`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}
