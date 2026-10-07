import { Download, File, FileArchive, FileImage, FileSpreadsheet, FileText, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FileView } from '@/services/contract';
import { t } from '@/i18n';
import { formatFileSize } from '@/lib/format';
import { cx } from './cx';
import { DateText } from './date-text';
import { InternalOnlyBadge } from './internal-only-badge';

export function isImageFile(f: Pick<FileView, 'mime'>): boolean {
  return f.mime.startsWith('image/');
}

export function isPdfFile(f: Pick<FileView, 'mime' | 'name'>): boolean {
  return f.mime === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
}

export function fileTypeIcon(f: Pick<FileView, 'mime' | 'name'>): LucideIcon {
  const mime = f.mime.toLowerCase();
  const name = f.name.toLowerCase();
  if (mime.startsWith('image/')) return FileImage;
  if (mime === 'application/pdf' || mime.startsWith('text/') || /\.(pdf|docx?|txt|md)$/.test(name)) return FileText;
  if (mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv' || /\.(xlsx?|csv)$/.test(name)) return FileSpreadsheet;
  if (mime.includes('zip') || mime.includes('compressed') || /\.(zip|rar|7z)$/.test(name)) return FileArchive;
  return File;
}

/** "PDF", "XLSX", "SVG"… from the file name (null when there is no short extension). */
export function fileExtension(f: Pick<FileView, 'name'>): string | null {
  const m = /\.([a-z0-9]{1,5})$/i.exec(f.name.trim());
  return m && m[1] ? m[1].toUpperCase() : null;
}

/** File-type icon in a soft rounded square (lists, preview header). */
export function FileTypeTile({ file, size = 'md', className }: { file: Pick<FileView, 'mime' | 'name'>; size?: 'sm' | 'md'; className?: string }) {
  const Icon = fileTypeIcon(file);
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center rounded-lg bg-subtle text-muted-foreground ring-1 ring-inset ring-border/80',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} strokeWidth={1.75} />
    </span>
  );
}

/** Small "Chia sẻ với khách" badge (internal views) — counterpart of InternalOnlyBadge. */
export function SharedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-muted pl-1.5 pr-2 text-micro font-medium text-muted-foreground',
        className,
      )}
    >
      <Users className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden="true" />
      {t('components.files.shared')}
    </span>
  );
}

export interface FileListProps {
  files: FileView[];
  /** row click → preview (usually opens FilePreviewDialog) */
  onPreview?: (file: FileView) => void;
  /** show the visibility badge ("Chỉ nội bộ" / "Chia sẻ với khách"); turn off on client pages */
  showVisibility?: boolean;
  /** show the uploader's name in the meta line (default true) */
  showUploader?: boolean;
  emptyText?: string;
  className?: string;
}

export function FileList({ files, onPreview, showVisibility = true, showUploader = true, emptyText, className }: FileListProps) {
  if (files.length === 0) {
    return <p className={cx('text-table text-muted-foreground', className)}>{emptyText ?? t('components.files.empty')}</p>;
  }
  return (
    <ul className={cx('divide-y divide-border/60', className)}>
      {files.map((f) => {
        const ext = fileExtension(f);
        return (
          <li
            key={f.id}
            className={cx(
              'relative -mx-2 flex min-h-tap items-center gap-3 rounded-lg px-2 py-3 transition-colors',
              onPreview && 'hover:bg-subtle',
            )}
          >
            <FileTypeTile file={f} />
            <div className="min-w-0 flex-1">
              {onPreview ? (
                <button
                  type="button"
                  onClick={() => onPreview(f)}
                  aria-label={t('components.files.preview', { name: f.name })}
                  className="block max-w-full truncate rounded text-left text-table font-medium text-foreground after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:text-primary"
                >
                  {f.name}
                </button>
              ) : (
                <span className="block truncate text-table font-medium text-foreground">{f.name}</span>
              )}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-micro text-muted-foreground">
                <span className="inline-flex h-[18px] items-center rounded bg-muted px-1.5 font-semibold tabular text-muted-foreground">
                  {t('components.files.version', { version: f.version })}
                </span>
                {ext ? <span className="font-medium">{ext}</span> : null}
                {ext ? <span aria-hidden="true">·</span> : null}
                <span className="tabular">{formatFileSize(f.size)}</span>
                <span aria-hidden="true">·</span>
                <DateText value={f.uploaded_at} />
                {showUploader ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{f.uploaded_by.full_name}</span>
                  </>
                ) : null}
              </p>
              {showVisibility && f.visibility === 'internal' ? <InternalOnlyBadge className="mt-1.5 sm:hidden" /> : null}
            </div>
            {showVisibility ? (
              <span className="relative z-10 hidden sm:inline-flex">
                {f.visibility === 'internal' ? <InternalOnlyBadge /> : <SharedBadge />}
              </span>
            ) : null}
            <a
              href={f.url}
              download={f.name}
              aria-label={t('components.files.downloadName', { name: f.name })}
              className="touch-tap-square relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-9 md:w-9"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
