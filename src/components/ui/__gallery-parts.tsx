// Dev-only layout helpers for the UI kit gallery. Sample texts are demo data, not UI copy.
import * as React from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';

/** Recommended upload pattern (ARCHITECTURE §3): the native file input stays hidden behind a Button with our text. */
export function FileUploadDemo() {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : null)}
      />
      <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
        <Upload aria-hidden="true" />
        Tải tệp lên
      </Button>
      <span className="text-table text-muted-foreground">{fileName ?? 'Chưa chọn tệp'}</span>
    </div>
  );
}

export function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('scroll-mt-6 rounded-xl border border-border/70 bg-card shadow-card', className)}
    >
      <header className="border-b border-border/60 px-4 py-4 sm:px-6">
        <h2 id={`${id}-title`} className="text-heading font-semibold tracking-tightish text-ink">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-caption">{description}</p> : null}
      </header>
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}

/** One specimen row: a small label on the left (top on phones) and the samples on the right. */
export function Specimen({
  label,
  children,
  className,
  stack = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** samples in a vertical stack instead of a wrapping row */
  stack?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 py-5 sm:px-6 lg:grid-cols-[148px_minmax(0,1fr)] lg:gap-6">
      <p className="text-micro font-medium text-muted-foreground lg:pt-2.5">{label}</p>
      <div className={cn(stack ? 'grid grid-cols-[minmax(0,1fr)] gap-3' : 'flex flex-wrap items-center gap-3', className)}>
        {children}
      </div>
    </div>
  );
}

export const GALLERY_SECTIONS = [
  { id: 'g-buttons', label: 'Button' },
  { id: 'g-badges', label: 'Badge' },
  { id: 'g-cards', label: 'Card' },
  { id: 'g-alerts', label: 'Alert' },
  { id: 'g-forms', label: 'Form' },
  { id: 'g-nav', label: 'Tabs' },
  { id: 'g-table', label: 'Table' },
  { id: 'g-misc', label: 'Avatar · Progress' },
  { id: 'g-overlays', label: 'Overlay' },
  { id: 'g-command', label: 'Command' },
  { id: 'g-toast', label: 'Toast' },
] as const;
