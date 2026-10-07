// The file to approve, previewed large (image inline, PDF in a frame), and the FilePreviewDialog state shared by
// every file of the drawer (versions, download).
import { forwardRef, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Maximize2 } from 'lucide-react';
import type { FileView } from '@/services/contract';
import { t } from '@/i18n';
import { formatRelativeTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fileTypeIcon, isImageFile, isPdfFile } from '@/components/common/file-list';
import { FilePreviewDialog } from '@/components/common/file-preview-dialog';

/** Chrome refuses some data: PDFs in frames; a blob: URL always works. */
function useFrameUrl(url: string, enabled: boolean): string | null {
  const needsBlob = enabled && url.startsWith('data:');
  const [out, setOut] = useState<string | null>(needsBlob ? null : url);
  useEffect(() => {
    if (!needsBlob) {
      setOut(url);
      return undefined;
    }
    let cancelled = false;
    let created: string | null = null;
    setOut(null);
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setOut(created);
      })
      .catch(() => {
        if (!cancelled) setOut(url);
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url, needsBlob]);
  return out;
}

function LargePreview({ file, onOpen }: { file: FileView; onOpen: () => void }) {
  const image = isImageFile(file);
  const pdf = !image && isPdfFile(file);
  const frameUrl = useFrameUrl(file.url, pdf);
  const Icon = fileTypeIcon(file);

  if (image) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('task.drawer.previewOf', { name: file.name })}
        className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-subtle ring-1 ring-inset ring-border/60 transition-shadow duration-150 ease-out-quart hover:ring-primary-border"
      >
        <img src={file.url} alt={file.name} className="mx-auto max-h-[60vh] w-full object-contain" />
      </button>
    );
  }
  if (pdf) {
    return frameUrl ? (
      <iframe src={frameUrl} title={file.name} className="h-[420px] w-full rounded-lg border border-border/70 bg-card md:h-[520px]" />
    ) : (
      <Skeleton className="h-[420px] w-full rounded-lg md:h-[520px]" />
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-lg bg-subtle p-4 text-left ring-1 ring-inset ring-border/60 transition-shadow duration-150 ease-out-quart hover:ring-primary-border"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-xs" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-table font-medium text-foreground">{file.name}</span>
    </button>
  );
}

export interface ApprovalPreviewProps {
  file: FileView;
  onOpen: (file: FileView) => void;
}

/** The file to approve, shown large with its version and author. */
export const ApprovalPreview = forwardRef<HTMLDivElement, ApprovalPreviewProps>(function ApprovalPreview({ file, onOpen }, ref) {
  return (
    <div ref={ref} className="scroll-mt-4 space-y-3">
      <LargePreview file={file} onOpen={() => onOpen(file)} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-table font-medium text-foreground">{file.name}</p>
          <p className="mt-0.5 text-micro text-muted-foreground">
            {t('task.drawer.fileMeta', {
              version: t('components.files.version', { version: file.version }),
              name: file.uploaded_by.full_name,
              when: formatRelativeTime(file.uploaded_at),
            })}
          </p>
          {file.note ? <p className="mt-1 text-table text-muted-foreground">{file.note}</p> : null}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(file)}>
          <Maximize2 aria-hidden="true" />
          {t('task.drawer.openFull')}
        </Button>
      </div>
    </div>
  );
});

/** Owns the FilePreviewDialog state for a set of task files. */
export function useFilePreview(): { preview: (f: FileView) => void; dialog: ReactNode } {
  const [file, setFile] = useState<FileView | null>(null);
  return {
    preview: setFile,
    dialog: <FilePreviewDialog file={file} onOpenChange={(o) => (!o ? setFile(null) : undefined)} />,
  };
}
