# Generates src/data/samples/pdfFont.ts: the glyphs the demo PDFs need (printable ASCII, the whole Vietnamese
# alphabet, every other character used by src/data/samples/*.ts) taken from vendor/fonts/DejaVuSans.ttf, hinting
# stripped, composite glyphs renumbered. src/data/samples/pdf.ts subsets this further per document and embeds it
# as a TrueType CID font, so the sample PDFs show Vietnamese with its diacritics.
#
# Run from anywhere (Windows PowerShell 5.1, a fresh process: Add-Type cannot redefine the class in one session):
#   powershell -NoProfile -ExecutionPolicy Bypass -File "client-hub\vendor\fonts\build-pdf-font.ps1"
# Re-run after adding a character outside that set to a sample document (pdf.ts folds unknown characters to ASCII).

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent (Split-Path -Parent $here)
$ttf = Join-Path $here 'DejaVuSans.ttf'
$out = Join-Path $root 'src\data\samples\pdfFont.ts'
$samples = Join-Path $root 'src\data\samples'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

public static class PdfFontSubset {
  static byte[] f;
  static int U16(int o) { return (f[o] << 8) | f[o + 1]; }
  static int I16(int o) { return (short)U16(o); }
  static int U32(int o) { return (int)(((uint)f[o] << 24) | ((uint)f[o + 1] << 16) | ((uint)f[o + 2] << 8) | f[o + 3]); }

  static Dictionary<string, int[]> tables = new Dictionary<string, int[]>();
  static int locFmt, numGlyphs, nhm;

  static int Loca(int g) { return locFmt == 0 ? U16(tables["loca"][0] + 2 * g) * 2 : U32(tables["loca"][0] + 4 * g); }

  static int CmapLookup(int c) {
    int baseO = tables["cmap"][0];
    int n = U16(baseO + 2);
    for (int i = 0; i < n; i++) {
      int p = U16(baseO + 4 + 8 * i), e = U16(baseO + 6 + 8 * i), off = U32(baseO + 8 + 8 * i);
      int o = baseO + off;
      if (p != 3 || e != 1 || U16(o) != 4) continue;
      int segX2 = U16(o + 6), segs = segX2 / 2;
      int endO = o + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
      for (int s = 0; s < segs; s++) {
        int end = U16(endO + 2 * s), start = U16(startO + 2 * s);
        if (c < start || c > end) continue;
        int delta = I16(deltaO + 2 * s), ro = U16(rangeO + 2 * s);
        if (ro == 0) return (c + delta) & 0xFFFF;
        int g = U16(rangeO + 2 * s + ro + 2 * (c - start));
        return g == 0 ? 0 : (g + delta) & 0xFFFF;
      }
    }
    return 0;
  }

  static List<int> Components(int g) {
    var list = new List<int>();
    int s = Loca(g), e = Loca(g + 1);
    if (e <= s) return list;
    int o = tables["glyf"][0] + s;
    if (I16(o) >= 0) return list;
    int p = o + 10;
    while (true) {
      int flags = U16(p);
      list.Add(U16(p + 2));
      p += 4 + ((flags & 1) != 0 ? 4 : 2);
      if ((flags & 8) != 0) p += 2; else if ((flags & 0x40) != 0) p += 4; else if ((flags & 0x80) != 0) p += 8;
      if ((flags & 0x20) == 0) break;
    }
    return list;
  }

  /** glyph bytes without hinting instructions; composite component indices remapped */
  static byte[] Glyph(int g, Dictionary<int, int> remap) {
    int s = Loca(g), e = Loca(g + 1);
    if (e <= s) return new byte[0];
    int o = tables["glyf"][0] + s;
    var ms = new MemoryStream();
    int nc = I16(o);
    if (nc >= 0) {
      int hdr = 10 + 2 * nc;
      int insLen = U16(o + hdr);
      ms.Write(f, o, hdr);
      ms.WriteByte(0); ms.WriteByte(0);
      int rest = o + hdr + 2 + insLen;
      ms.Write(f, rest, (tables["glyf"][0] + e) - rest);
    } else {
      ms.Write(f, o, 10);
      int p = o + 10;
      while (true) {
        int flags = U16(p);
        int len = 4 + ((flags & 1) != 0 ? 4 : 2);
        if ((flags & 8) != 0) len += 2; else if ((flags & 0x40) != 0) len += 4; else if ((flags & 0x80) != 0) len += 8;
        bool more = (flags & 0x20) != 0;
        int nf = flags & ~0x100;
        var rec = new byte[len];
        Array.Copy(f, p, rec, 0, len);
        rec[0] = (byte)(nf >> 8); rec[1] = (byte)(nf & 0xFF);
        int ni = remap[U16(p + 2)];
        rec[2] = (byte)(ni >> 8); rec[3] = (byte)(ni & 0xFF);
        ms.Write(rec, 0, len);
        p += len;
        if (!more) break;
      }
    }
    return ms.ToArray();
  }

  static string NameRecord(int id) {
    int o = tables["name"][0];
    int count = U16(o + 2), strO = o + U16(o + 4);
    for (int i = 0; i < count; i++) {
      int r = o + 6 + 12 * i;
      if (U16(r) == 3 && U16(r + 6) == id) {
        int len = U16(r + 8), off = U16(r + 10);
        return Encoding.BigEndianUnicode.GetString(f, strO + off, len);
      }
    }
    return "";
  }

  static string B64(int tableOffset, int len) { return Convert.ToBase64String(f, tableOffset, len); }

  public static string License(string path) {
    f = File.ReadAllBytes(path);
    ReadTables();
    return NameRecord(0) + "\r\n\r\n" + NameRecord(13) + "\r\n\r\n" + NameRecord(14) + "\r\n";
  }

  static void ReadTables() {
    tables.Clear();
    int n = U16(4);
    for (int i = 0; i < n; i++) {
      int o = 12 + 16 * i;
      string tag = Encoding.ASCII.GetString(f, o, 4);
      tables[tag] = new int[] { U32(o + 8), U32(o + 12) };
    }
    locFmt = I16(tables["head"][0] + 50);
    numGlyphs = U16(tables["maxp"][0] + 4);
    nhm = U16(tables["hhea"][0] + 34);
  }

  public static string Build(string path, string chars, out string missing) {
    f = File.ReadAllBytes(path);
    ReadTables();
    var order = new List<int> { 0 };
    var remap = new Dictionary<int, int> { { 0, 0 } };
    var mappedChars = new List<int>();
    var charGlyphs = new List<int>();
    var miss = new StringBuilder();
    Action<int> add = null;
    add = (g) => {
      if (remap.ContainsKey(g)) return;
      remap[g] = order.Count;
      order.Add(g);
      foreach (int c in Components(g)) add(c);
    };
    foreach (char ch in chars.Distinct().OrderBy(c => c)) {
      int g = CmapLookup(ch);
      if (g == 0) { miss.Append(ch); continue; }
      add(g);
      mappedChars.Add(ch);
      charGlyphs.Add(remap[g]);
    }
    missing = miss.ToString();
    var data = new MemoryStream();
    var offsets = new List<int> { 0 };
    var adv = new List<int>();
    var lsb = new List<int>();
    int hm = tables["hmtx"][0];
    foreach (int g in order) {
      var bytes = Glyph(g, remap);
      data.Write(bytes, 0, bytes.Length);
      offsets.Add((int)data.Length);
      adv.Add(g < nhm ? U16(hm + 4 * g) : U16(hm + 4 * (nhm - 1)));
      lsb.Add(g < nhm ? I16(hm + 4 * g + 2) : I16(hm + 4 * nhm + 2 * (g - nhm)));
    }
    int head = tables["head"][0], hhea = tables["hhea"][0];
    int capHeight = 0;
    if (tables.ContainsKey("OS/2") && U16(tables["OS/2"][0]) >= 2) capHeight = I16(tables["OS/2"][0] + 88);
    var sb = new StringBuilder();
    sb.Append("// GENERATED by vendor/fonts/build-pdf-font.ps1 from vendor/fonts/DejaVuSans.ttf - do not edit by hand.\r\n");
    sb.Append("// A subset of DejaVu Sans (Copyright (c) 2003 by Bitstream, Inc.; glyphs from Arev (c) 2006 Tavmjong Bah;\r\n");
    sb.Append("// DejaVu changes are in the public domain),\r\n");
    sb.Append("// hinting removed, embedded in the demo PDFs as \"ClientHubSans\" (the Bitstream Vera license reserves the names\r\n");
    sb.Append("// \"Bitstream\" and \"Vera\" for modified copies). License: vendor/fonts/LICENSE-DejaVu.txt.\r\n");
    sb.Append("// Glyphs are numbered in this file's own order (0 = .notdef); composite glyphs point at that numbering.\r\n\r\n");
    sb.Append("export const PDF_FONT = {\r\n");
    sb.Append("  unitsPerEm: " + U16(head + 18) + ",\r\n");
    sb.Append("  ascent: " + I16(hhea + 4) + ",\r\n");
    sb.Append("  descent: " + I16(hhea + 6) + ",\r\n");
    sb.Append("  capHeight: " + capHeight + ",\r\n");
    sb.Append("  bbox: [" + I16(head + 36) + ", " + I16(head + 38) + ", " + I16(head + 40) + ", " + I16(head + 42) + "],\r\n");
    sb.Append("  /** original head / hhea / maxp tables (the subsetter patches glyph counts and the loca format) */\r\n");
    sb.Append("  head: '" + B64(head, 54) + "',\r\n");
    sb.Append("  hhea: '" + B64(hhea, 36) + "',\r\n");
    sb.Append("  maxp: '" + B64(tables["maxp"][0], 32) + "',\r\n");
    sb.Append("  /** code points (BMP) and their glyph numbers */\r\n");
    sb.Append("  codePoints: [" + string.Join(", ", mappedChars) + "],\r\n");
    sb.Append("  charGlyphs: [" + string.Join(", ", charGlyphs) + "],\r\n");
    sb.Append("  advances: [" + string.Join(", ", adv) + "],\r\n");
    sb.Append("  lsbs: [" + string.Join(", ", lsb) + "],\r\n");
    sb.Append("  /** byte offsets of each glyph in `glyphs` (n + 1 entries) */\r\n");
    sb.Append("  glyphOffsets: [" + string.Join(", ", offsets) + "],\r\n");
    sb.Append("  glyphs: '" + Convert.ToBase64String(data.ToArray()) + "',\r\n");
    sb.Append("};\r\n");
    return sb.ToString();
  }
}
'@

# printable ASCII, Latin-1 letters, the Vietnamese letters outside Latin-1 (both cases: a-breve, d-stroke, i/u-tilde,
# o/u-horn and the whole Latin Extended Additional block U+1EA0-1EF9) and the typographic marks the documents use
# (code points only: Windows PowerShell 5.1 reads this file as ANSI)
$chars = New-Object System.Text.StringBuilder
$ranges = @(@(0x20, 0x7E), @(0xB0, 0xB0), @(0xB7, 0xB7), @(0xC0, 0xFF), @(0x102, 0x103), @(0x110, 0x111), @(0x128, 0x129),
  @(0x168, 0x169), @(0x1A0, 0x1A1), @(0x1AF, 0x1B0), @(0x1EA0, 0x1EF9), @(0x2013, 0x2014), @(0x2018, 0x2019),
  @(0x201C, 0x201D), @(0x2022, 0x2022), @(0x2026, 0x2026), @(0x20AB, 0x20AB), @(0x2192, 0x2192), @(0x2264, 0x2265))
foreach ($r in $ranges) { for ($c = $r[0]; $c -le $r[1]; $c++) { [void]$chars.Append([char]$c) } }
# every non-ASCII character of the sample sources (string literals and comments alike)
Get-ChildItem -LiteralPath $samples -Filter *.ts | Where-Object { $_.Name -ne 'pdfFont.ts' } | ForEach-Object {
  $text = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8).Normalize([System.Text.NormalizationForm]::FormC)
  foreach ($ch in $text.ToCharArray()) { if ([int]$ch -gt 0x7E -and -not [char]::IsSurrogate($ch) -and -not [char]::IsControl($ch)) { [void]$chars.Append($ch) } }
}

$missing = ''
$ts = [PdfFontSubset]::Build($ttf, $chars.ToString(), [ref]$missing)
[System.IO.File]::WriteAllText($out, $ts, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText((Join-Path $here 'LICENSE-DejaVu.txt'), [PdfFontSubset]::License($ttf), (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("wrote {0} ({1:N0} bytes); characters without a glyph: '{2}'" -f $out, (Get-Item -LiteralPath $out).Length, $missing)
