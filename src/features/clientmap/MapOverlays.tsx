// Controls around the map canvas, never over the bubbles: search and zoom in the card's top bar, the legend in its
// footer bar; while a search is typed a small result chip floats over the canvas' top-left corner.
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { CircleCheck, Maximize, Minus, OctagonX, Plus, Search, TriangleAlert, X } from 'lucide-react';
import type { ClientMapMetric } from '@/services/crmContract';
import { SMALL } from '@/components/common/cx';
import { SCROLL_FADE_CLASS, useScrollFade } from '@/components/ui/use-scroll-fade';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';

export interface MapSearchProps {
  value: string;
  onChange(v: string): void;
  onSubmit(): void;
  className?: string;
}

/** input styled as the kit's small Input (32px with the mouse, 44px on touch) */
export function MapSearch({ value, onChange, onSubmit, className }: MapSearchProps) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={t('clientmap.map.searchPlaceholder')}
        aria-label={t('clientmap.map.searchLabel')}
        autoComplete="off"
        enterKeyHint="search"
        className={cn(
          'touch-tap h-11 w-full min-w-0 rounded-lg border border-border-strong bg-card pl-9 pr-10 text-base text-foreground shadow-xs md:h-8 md:text-table',
          'transition-[border-color,box-shadow] duration-150 ease-out-quart placeholder:text-muted-foreground hover:border-caption/40',
          'focus:border-primary focus:shadow-focus focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden',
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('clientmap.map.searchClear')}
          className="touch-tap-square absolute right-0.5 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground md:h-7 md:w-7"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** "3 kết quả" over the canvas while a search is typed (announced politely) */
export function SearchCount({ count }: { count: number | null }) {
  return (
    <p
      aria-live="polite"
      className={cn(
        'pointer-events-none absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 font-medium shadow-xs md:left-4 md:top-4',
        SMALL,
        count === null ? 'sr-only' : 'border border-border/70 bg-card/95 backdrop-blur',
        count === 0 ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {count === null ? '' : count === 0 ? t('clientmap.map.searchNone') : t('clientmap.map.searchCount', { count })}
    </p>
  );
}

/** −, +, fit: one quiet segmented group (32px with the mouse, 44px on touch) */
export function ZoomControls({ onZoomIn, onZoomOut, onFit }: { onZoomIn(): void; onZoomOut(): void; onFit(): void }) {
  const btn =
    'touch-tap-square inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-7 md:w-7';
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label={t('clientmap.map.zoomLabel')}>
      <button type="button" className={btn} onClick={onZoomOut} aria-label={t('clientmap.map.zoomOut')} title={t('clientmap.map.zoomOut')}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" className={btn} onClick={onZoomIn} aria-label={t('clientmap.map.zoomIn')} title={t('clientmap.map.zoomIn')}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" className={btn} onClick={onFit} aria-label={t('clientmap.map.fit')} title={t('clientmap.map.fit')}>
        <Maximize className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function Swatch({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0" aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * The card's footer bar: one row; scrolls sideways with a faded edge on phones. It states the size rules of
 * mapModel.computeRadii: companies (customers and targets) on one value scale, ecosystem hubs on their own.
 */
export function MapLegend({ showLeads, metric }: { showLeads: boolean; metric: ClientMapMetric }) {
  const ref = useRef<HTMLUListElement>(null);
  useScrollFade(ref);
  const item = cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap', SMALL);
  return (
    <ul
      ref={ref}
      aria-label={t('clientmap.legend.title')}
      className={cn(
        'no-scrollbar flex items-center gap-x-5 overflow-x-auto border-t border-border/60 bg-card px-4 py-2.5 text-muted-foreground md:px-5',
        SCROLL_FADE_CLASS,
      )}
    >
      <li className={item}>
        <Swatch>
          <circle cx="5" cy="12" r="3.5" className="fill-card stroke-border-strong" strokeWidth="1.5" />
          <circle cx="12" cy="8" r="5.5" className="fill-card stroke-border-strong" strokeWidth="1.5" />
        </Swatch>
        {t('clientmap.legend.size')}
      </li>
      <li className={item}>
        <CircleCheck className="h-4 w-4 text-success" aria-hidden="true" />
        {t('enums.health.on_track')}
      </li>
      <li className={item}>
        <TriangleAlert className="h-4 w-4 text-warning" aria-hidden="true" />
        {t('enums.health.attention')}
      </li>
      <li className={item}>
        <OctagonX className="h-4 w-4 text-danger" aria-hidden="true" />
        {t('enums.health.blocked')}
      </li>
      <li className={item}>
        <Swatch>
          <circle cx="9" cy="9" r="6" className="fill-primary-soft stroke-primary" strokeWidth="1.5" />
        </Swatch>
        {t('clientmap.legend.hub')}
      </li>
      {showLeads ? (
        <li className={item}>
          <Swatch>
            <circle cx="9" cy="9" r="6.5" className="fill-card stroke-caption" strokeWidth="1.25" strokeDasharray="2.5 2.5" />
          </Swatch>
          {metric === 'contract_value' ? t('clientmap.legend.leadNoValue') : t('clientmap.legend.lead')}
        </li>
      ) : null}
    </ul>
  );
}
