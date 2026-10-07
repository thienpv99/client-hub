// One shared document in the portal: latest version first ("v2 · 3 phiên bản"), older versions expandable,
// preview (FilePreviewDialog, owned by the page) and download. The whole row opens the preview (stretched button),
// so phones get a large tap target; download and the versions toggle sit above it. Full-bleed row of a card list.
import { useId, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import type { FileView } from '@/services/contract';
import { t } from '@/i18n';
import { formatDate, formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FileTypeTile } from '@/components/common/file-list';
import { enumLabel } from '@/components/common/labels';

function VersionPill({ version }: { version: number }) {
  return (
    <span className="inline-flex h-[18px] items-center rounded bg-muted px-1.5 font-semibold tabular text-muted-foreground">
      {t('components.files.version', { version })}
    </span>
  );
}

function DownloadButton({ file, label }: { file: FileView; label: string }) {
  return (
    <Button variant="ghost" size="icon-sm" asChild className="relative z-10">
      <a href={file.url} download={file.name} aria-label={label} title={label}>
        <Download aria-hidden="true" />
      </a>
    </Button>
  );
}

function Dot() {
  return <span aria-hidden="true">·</span>;
}

export interface DocumentRowProps {
  file: FileView;
  onPreview(file: FileView): void;
}

export function DocumentRow({ file, onPreview }: DocumentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const older = file.older_versions ?? [];

  return (
    <li>
      <div className="group relative flex items-start gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-subtle sm:px-5">
        <FileTypeTile file={file} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onPreview(file)}
            aria-label={t('portal.documents.previewName', { name: file.name })}
            className="line-clamp-2 max-w-full break-words rounded text-left text-table font-medium text-foreground transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
          >
            {file.name}
          </button>
          {/* two groups that wrap as wholes (no dangling "·" at a line end on phones) */}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <VersionPill version={file.version} />
              <span>{enumLabel('fileKind', file.kind)}</span>
              <Dot />
              <span className="tabular">{formatFileSize(file.size)}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="whitespace-nowrap tabular">{formatDate(file.uploaded_at)}</span>
              <Dot />
              <span className="min-w-0 truncate">{file.uploaded_by.full_name}</span>
            </span>
          </p>
          {file.note ? <p className="mt-1.5 break-words text-caption">{file.note}</p> : null}
          {older.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="relative z-10 -ml-2.5 mt-1 px-2.5 text-muted-foreground"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpanded((x) => !x)}
            >
              {expanded ? t('portal.documents.hideVersions') : t('portal.documents.showVersions', { count: older.length })}
              <ChevronDown className={cn('transition-transform duration-200', expanded && 'rotate-180')} aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        <DownloadButton file={file} label={t('portal.documents.downloadName', { name: file.name })} />
      </div>

      {older.length > 0 ? (
        <ul
          id={panelId}
          hidden={!expanded}
          aria-label={t('portal.documents.olderLabel', { name: file.name })}
          className="mb-3 ml-[68px] mr-4 divide-y divide-border/60 rounded-lg bg-subtle ring-1 ring-inset ring-border/60 sm:ml-[72px] sm:mr-5"
        >
          {older.map((v) => (
            <li key={v.id} className="flex min-h-tap items-center gap-1 pl-1 pr-1">
              <button
                type="button"
                onClick={() => onPreview(v)}
                aria-label={t('portal.documents.previewVersion', { name: v.name, version: v.version })}
                className="flex min-h-tap min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md px-2 py-1.5 text-left text-micro text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <VersionPill version={v.version} />
                <span className="tabular">{formatDate(v.uploaded_at)}</span>
                <Dot />
                <span className="min-w-0 truncate">{v.uploaded_by.full_name}</span>
              </button>
              <DownloadButton file={v} label={t('portal.documents.downloadVersion', { name: v.name, version: v.version })} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
