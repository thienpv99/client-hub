// v1 · v2 · v3 of one quote as a segmented control of links (same look as segmented tabs, DESIGN §4).
import { Link } from 'react-router-dom';
import type { QuoteSummary } from '@/services/contract';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { quoteStatusLabel } from './status';

export function VersionSwitcher({
  currentId,
  versions,
  hrefFor,
  label,
  audience = 'internal',
}: {
  currentId: string;
  versions: QuoteSummary[];
  hrefFor: (id: string) => string;
  /** accessible name of the group ("Các phiên bản") */
  label: string;
  audience?: 'internal' | 'client';
}) {
  if (versions.length <= 1) return null;
  const ordered = [...versions].sort((a, b) => a.version - b.version);
  return (
    <nav aria-label={label} className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-1 ring-1 ring-inset ring-border/70">
      {ordered.map((v) => {
        const active = v.id === currentId;
        return (
          <Link
            key={v.id}
            to={hrefFor(v.id)}
            aria-current={active ? 'page' : undefined}
            title={`${t('commercial.quote.versionLabel', { version: v.version })} · ${quoteStatusLabel(v.status, audience)}`}
            className={cn(
              'touch-tap-square inline-flex h-7 min-w-9 items-center justify-center rounded-md px-2 text-table font-medium tabular transition-[color,background-color,box-shadow] duration-150 ease-out-quart',
              active ? 'bg-card text-foreground shadow-segment' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            v{v.version}
          </Link>
        );
      })}
    </nav>
  );
}
