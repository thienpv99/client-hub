// Vietnamese name helpers: given name, polite address ("anh Minh") and avatar initials.
import type { Salutation } from './types';

/** Common Vietnamese family names (lowercase, NFC). Used to tell person names from company names. */
const FAMILY_NAMES = new Set(
  [
    'nguyễn', 'trần', 'lê', 'phạm', 'hoàng', 'huỳnh', 'phan', 'vũ', 'võ', 'đặng', 'bùi', 'đỗ', 'hồ', 'ngô',
    'dương', 'lý', 'đinh', 'đoàn', 'trương', 'lâm', 'trịnh', 'đào', 'lưu', 'tạ', 'tô', 'quách', 'kiều',
    'lương', 'chu', 'triệu', 'vương', 'phùng', 'nghiêm', 'doãn', 'hứa', 'lại', 'diệp', 'tống', 'bạch',
  ].map((s) => s.normalize('NFC')),
);

function words(name: string): string[] {
  return name
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function firstLetter(word: string): string {
  const chars = Array.from(word);
  return (chars[0] ?? '').toUpperCase();
}

/**
 * Given names that double as a salutation ('Anh'): a person called 'Trần Đức Anh' is addressed by the compound
 * ('anh Đức Anh'), never 'anh Anh'.
 */
const COMPOUND_LAST = new Set(['anh']);
/** Gender-marking middle names that are never part of how a person is called ('Nguyễn Văn Anh' → 'Anh'). */
const MARKER_MIDDLE = new Set(['văn', 'thị'].map((s) => s.normalize('NFC')));

/**
 * 'Trần Quang Minh' → 'Minh' (Vietnamese names put the given name last).
 * A last word that reads as a salutation keeps the word before it: 'Trần Đức Anh' → 'Đức Anh'.
 */
export function givenName(fullName: string): string {
  const ws = words(fullName);
  if (ws.length === 0) return '';
  const last = ws[ws.length - 1] ?? '';
  const before = ws[ws.length - 2] ?? '';
  if (ws.length >= 3 && COMPOUND_LAST.has(last.toLowerCase()) && !MARKER_MIDDLE.has(before.toLowerCase())) {
    return `${before} ${last}`;
  }
  return last;
}

/** 'anh Minh' / 'chị Lan'; without a salutation the full name is used. */
export function addressName(s: Salutation | null, fullName: string): string {
  const given = givenName(fullName);
  if (!s || !given) return fullName.trim();
  return `${s} ${given}`;
}

/**
 * Two uppercase letters for avatars/logos.
 * Person names ('Trần Quang Minh') → middle + given name ('QM'); other names ('Cỏ Xanh Retail') → first two words ('CX').
 * A single word gives its first two letters.
 */
export function initials(name: string): string {
  const ws = words(name);
  if (ws.length === 0) return '';
  if (ws.length === 1) {
    const chars = Array.from(ws[0] ?? '');
    return chars.slice(0, 2).join('').toUpperCase();
  }
  const first = (ws[0] ?? '').toLowerCase();
  if (ws.length >= 3 && FAMILY_NAMES.has(first)) {
    return firstLetter(ws[ws.length - 2] ?? '') + firstLetter(ws[ws.length - 1] ?? '');
  }
  return firstLetter(ws[0] ?? '') + firstLetter(ws[1] ?? '');
}
