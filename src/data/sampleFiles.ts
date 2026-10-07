// Generated demo files behind `storage_path: 'sample:<key>'`: designs are SVG wireframes, documents are
// small valid one-page PDFs. Built lazily and memoized; nothing is fetched from the network.

import { DESIGNS } from './samples/designs';
import { DOCUMENTS } from './samples/documents';
import { buildPdf } from './samples/pdf';

export interface SampleFile {
  mime: string;
  /** bytes of the decoded file */
  size: number;
  /** data: URL ready for <img src>, <iframe src> or <a download> */
  url: string;
}

const cache = new Map<string, SampleFile | null>();

function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length;
}

function stripPrefix(key: string): string {
  return key.startsWith('sample:') ? key.slice('sample:'.length) : key;
}

function build(key: string): SampleFile | null {
  if (Object.prototype.hasOwnProperty.call(DESIGNS, key)) {
    const svg = DESIGNS[key]();
    return { mime: 'image/svg+xml', size: utf8Length(svg), url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
  }
  if (Object.prototype.hasOwnProperty.call(DOCUMENTS, key)) {
    const pdf = buildPdf(DOCUMENTS[key]);
    return { mime: 'application/pdf', size: pdf.length, url: `data:application/pdf;base64,${btoa(pdf)}` };
  }
  return null;
}

/** Full generated file for a sample key ('coxanh-order-v2' or 'sample:coxanh-order-v2'); null when unknown. */
export function getSampleFile(key: string): SampleFile | null {
  const k = stripPrefix(key);
  if (!cache.has(k)) cache.set(k, build(k));
  return cache.get(k) ?? null;
}

/** data: URL for a sample key (accepts the bare key or the full 'sample:<key>' storage path). */
export function sampleFileUrl(key: string): string | null {
  return getSampleFile(key)?.url ?? null;
}

/** mime + byte size, used by the seed to fill FileItem.mime / size. */
export function sampleFileMeta(key: string): { mime: string; size: number } | null {
  const f = getSampleFile(key);
  return f ? { mime: f.mime, size: f.size } : null;
}

/** Every key that sampleFileUrl can resolve. */
export function sampleFileKeys(): string[] {
  return [...Object.keys(DESIGNS), ...Object.keys(DOCUMENTS)];
}
