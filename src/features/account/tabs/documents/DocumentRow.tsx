// One document (doc_key group): newest version on top, earlier versions in a collapsible history.
import { useId, useState } from 'react';
import { ChevronDown, Download, FilePlus2, History } from 'lucide-react';
import type { FileView } from '@/services/contract';
import { t } from '@/i18n';
import { formatFileSize } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { DateText } from '@/components/common/date-text';
import { FileTypeTile } from '@/components/common/file-list';
import { enumLabel } from '@/components/common/labels';
import { VisibilityControl } from './VisibilityControl';

function versionLabel(f: FileView): string {
  return t('components.files.version', { version: f.version });
}

function VersionChip({ file, className }: { file: FileView; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-md bg-muted px-1.5 text-micro font-semibold tabular text-muted-foreground',
        className,
      )}
    >
      {versionLabel(file)}
    </span>
  );
}

/** two unbreakable groups — "Tài liệu · 2,2 KB" and "Nguyễn Thu Hà · hôm qua" — so a wrap never strands a "·" */
function Meta({ file, showKind }: { file: FileView; showKind: boolean }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-micro text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {showKind ? (
          <>
            <span>{enumLabel('fileKind', file.kind)}</span>
            <span aria-hidden="true">·</span>
          </>
        ) : null}
        <span className="tabular">{formatFileSize(file.size)}</span>
      </span>
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate">{file.uploaded_by.full_name}</span>
        <span aria-hidden="true">·</span>
        <DateText value={file.uploaded_at} relative time />
      </span>
    </p>
  );
}

function DownloadLink({ file }: { file: FileView }) {
  return (
    <Button asChild variant="ghost" size="icon-sm">
      <a
        href={file.url}
        download={file.name}
        aria-label={t('account.documents.downloadVersion', { name: file.name, version: file.version })}
        title={t('common.download')}
      >
        <Download aria-hidden="true" />
      </a>
    </Button>
  );
}

export interface DocumentRowProps {
  /** newest version, older ones in `older_versions` */
  file: FileView;
  canManage: boolean;
  canUpload: boolean;
  onPreview: (file: FileView) => void;
  onNewVersion: (file: FileView) => void;
}

export function DocumentRow({ file, canManage, canUpload, onPreview, onNewVersion }: DocumentRowProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const older = file.older_versions ?? [];

  return (
    <li className="px-4 py-3.5 sm:px-5">
      {/* phones / iPad portrait: the actions get their own row under the file; from lg: on the right */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-6">
        {/* the whole file block opens the preview (large tap target); the name is the button */}
        <div className="group relative -m-1.5 flex min-h-tap min-w-0 flex-1 items-start gap-3 rounded-lg p-1.5 transition-colors duration-150 hover:bg-subtle">
          <FileTypeTile file={file} />
          <div className="min-w-0 flex-1">
            {/* the version chip flows right after the last word, so a long name never leaves it alone on a line */}
            <button
              type="button"
              onClick={() => onPreview(file)}
              aria-label={t('components.files.preview', { name: file.name })}
              className="block max-w-full break-words rounded text-left text-table font-medium text-foreground transition-colors after:absolute after:inset-0 after:rounded-lg after:content-[''] group-hover:text-primary"
            >
              {file.name}
              <VersionChip file={file} className="ml-2" />
            </button>
            <Meta file={file} showKind />
            {file.note ? <p className="mt-1 break-words text-caption">{file.note}</p> : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 sm:pl-[52px] lg:shrink-0 lg:justify-end lg:pl-0">
          <VisibilityControl file={file} canEdit={canManage} versionLabel={versionLabel(file)} />
          <div className="flex shrink-0 items-center gap-0.5">
            {canUpload ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onNewVersion(file)}
                aria-label={t('account.documents.newVersionOf', { name: file.name })}
                title={t('account.documents.newVersion')}
              >
                <FilePlus2 aria-hidden="true" />
              </Button>
            ) : null}
            <DownloadLink file={file} />
          </div>
        </div>
      </div>

      {older.length > 0 ? (
        <div className="mt-1.5 sm:pl-[52px]">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={`${id}-history`}
            onClick={() => setExpanded((v) => !v)}
            className="touch-tap -ml-1.5 inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 text-caption font-medium transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            {t('account.documents.history', { count: older.length })}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', expanded && 'rotate-180')} aria-hidden="true" />
          </button>
          {expanded ? (
            <ol id={`${id}-history`} className="mt-1 border-l border-border-strong/70 pl-3 sm:pl-4">
              {older.map((v) => (
                <li key={v.id} className="flex flex-col gap-2 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                  <div className="group relative flex min-h-tap min-w-0 flex-col justify-center md:min-h-0">
                    <button
                      type="button"
                      onClick={() => onPreview(v)}
                      aria-label={t('account.documents.previewVersion', { name: v.name, version: v.version })}
                      className="flex min-w-0 items-center gap-2 rounded text-left text-table text-foreground transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-primary"
                    >
                      <VersionChip file={v} />
                      {v.name !== file.name ? <span className="min-w-0 break-words">{v.name}</span> : null}
                    </button>
                    <Meta file={v} showKind={false} />
                  </div>
                  <div className="flex items-center justify-between gap-2 lg:shrink-0 lg:justify-end">
                    <VisibilityControl file={v} canEdit={canManage} versionLabel={versionLabel(v)} />
                    <DownloadLink file={v} />
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
