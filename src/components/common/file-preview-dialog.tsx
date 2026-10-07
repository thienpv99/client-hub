import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { FileView } from '@/services/contract';
import { t } from '@/i18n';
import { formatDateTime, formatFileSize } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cx, SMALL } from './cx';
import { FileTypeTile, fileTypeIcon, isImageFile, isPdfFile } from './file-list';
import { InternalOnlyBadge } from './internal-only-badge';

/** All versions of the document, newest first (the file itself included once). */
function versionsOf(file: FileView): FileView[] {
  const all = [file, ...(file.older_versions ?? [])];
  const byId = new Map<string, FileView>();
  for (const v of all) if (!byId.has(v.id)) byId.set(v.id, v);
  return Array.from(byId.values()).sort((a, b) => b.version - a.version);
}

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

function PreviewBody({ file }: { file: FileView }) {
  const image = isImageFile(file);
  const pdf = !image && isPdfFile(file);
  const frameUrl = useFrameUrl(file.url, pdf);
  const Icon = fileTypeIcon(file);

  if (image) {
    // desktop: the dialog is at most 92vh; header, version switch, footer and padding take ≈ 16rem
    return <img src={file.url} alt={file.name} className="max-h-full w-full rounded-lg object-contain sm:max-h-[calc(92vh-16rem)]" />;
  }
  if (pdf) {
    return frameUrl ? (
      <iframe
        src={frameUrl}
        title={file.name}
        className="h-full min-h-[60vh] w-full rounded-lg border border-border/70 bg-card sm:h-[calc(92vh-16rem)] sm:min-h-[320px]"
      />
    ) : (
      <Skeleton className="h-full min-h-[60vh] w-full rounded-lg sm:h-[calc(92vh-16rem)] sm:min-h-[320px]" />
    );
  }
  return (
    <div className="flex max-w-sm flex-col items-center gap-4 py-12 text-center">
      <span className="flex h-18 w-18 items-center justify-center rounded-full bg-primary-soft" aria-hidden="true">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-primary shadow-xs ring-1 ring-inset ring-primary-border/70">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
      </span>
      <p className="text-table text-muted-foreground">{t('components.files.noPreview')}</p>
      <Button asChild>
        <a href={file.url} download={file.name}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {t('components.files.download')}
        </a>
      </Button>
    </div>
  );
}

export interface FilePreviewDialogProps {
  /** null = closed */
  file: FileView | null;
  onOpenChange: (open: boolean) => void;
}

/** Images inline, PDFs in a frame, other types → download. Full screen on phones. */
export function FilePreviewDialog({ file, onOpenChange }: FilePreviewDialogProps) {
  // keep the last file while the close animation runs
  const [lastFile, setLastFile] = useState<FileView | null>(file);
  const [versionId, setVersionId] = useState<string | null>(null);
  useEffect(() => {
    if (file) setLastFile(file);
    setVersionId(null);
  }, [file]);
  const shown = file ?? lastFile;

  const versions = useMemo(() => (shown ? versionsOf(shown) : []), [shown]);
  const current = (versionId ? versions.find((v) => v.id === versionId) : undefined) ?? shown;

  return (
    <Dialog open={file !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-fit sm:max-h-[92vh] sm:max-w-4xl sm:rounded-xl sm:border sm:p-0"
        {...(current ? {} : { 'aria-describedby': undefined })}
      >
        {current ? (
          <>
            <DialogHeader className="flex-row items-start gap-3 space-y-0 border-b border-border/70 px-4 py-4 pr-14 text-left sm:px-5 sm:pr-16">
              <FileTypeTile file={current} className="mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1">
                {/* arbitrary size: the kit's cn() may not know the text-heading token yet */}
                <DialogTitle className="truncate text-[17px] font-semibold leading-6 tracking-tightish text-ink">{current.name}</DialogTitle>
                <DialogDescription className={cx('flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground', SMALL)}>
                  <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 text-micro font-semibold tabular">
                    {t('components.files.version', { version: current.version })}
                  </span>
                  <span>{current.uploaded_by.full_name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular">{formatDateTime(current.uploaded_at)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular">{formatFileSize(current.size)}</span>
                  {current.visibility === 'internal' ? <InternalOnlyBadge className="ml-1" /> : null}
                </DialogDescription>
                {current.note ? <p className="pt-1 text-table text-foreground">{current.note}</p> : null}
              </div>
            </DialogHeader>

            {versions.length > 1 ? (
              <div className="border-b border-border/70 px-4 py-2.5 sm:px-5">
                <div
                  className="no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1"
                  role="group"
                  aria-label={t('components.files.versions')}
                >
                  {versions.map((v, i) => {
                    const active = v.id === current.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setVersionId(v.id)}
                        className={cx(
                          'touch-tap inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 font-medium tabular transition-colors',
                          SMALL,
                          active ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {t('components.files.version', { version: v.version })}
                        {i === 0 ? <span className="font-normal text-muted-foreground">· {t('components.files.latest')}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-subtle p-2 sm:p-5">
              <PreviewBody key={current.id} file={current} />
            </div>

            {/* files without a preview already show their download button in the body */}
            {isImageFile(current) || isPdfFile(current) ? (
              <div className="flex justify-end border-t border-border/70 bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
                <Button variant="secondary" asChild>
                  <a href={current.url} download={current.name}>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t('components.files.download')}
                  </a>
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <DialogTitle className="sr-only">{t('components.files.versions')}</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}
