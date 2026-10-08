// Logo upload (FileReader → data URL, raster images scaled down to 256 px so the stored account stays small) and a
// curated brand-colour palette used behind the initials when there is no logo.
import { useRef, useState } from 'react';
import { Check, ImageUp, Trash2 } from 'lucide-react';
import { AccountLogo } from '@/components/common/account-logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { FieldError } from '@/features/settings/fieldParts';
import { BRAND_COLORS } from './wizardModel';

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_RASTER_BYTES = 5 * 1024 * 1024;
const MAX_SVG_BYTES = 200 * 1024;
const MAX_SIDE = 256;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read')));
    reader.onerror = () => reject(reader.error ?? new Error('read'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** data URL of the logo, raster images scaled to fit 256×256 (PNG keeps transparency) */
async function prepareLogo(file: File): Promise<string> {
  if (!ACCEPT.includes(file.type)) throw new Error('type');
  if (file.type === 'image/svg+xml') {
    if (file.size > MAX_SVG_BYTES) throw new Error('size');
    return readAsDataUrl(file);
  }
  if (file.size > MAX_RASTER_BYTES) throw new Error('size');
  const url = await readAsDataUrl(file);
  const img = await loadImage(url);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight, 1));
  if (scale === 1 && file.size <= 150 * 1024) return url;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return url;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export function LogoPicker({
  name,
  shortName,
  logoUrl,
  brandColor,
  onLogoChange,
  onColorChange,
}: {
  name: string;
  shortName: string;
  logoUrl: string | null;
  brandColor: string;
  onLogoChange: (url: string | null) => void;
  onColorChange: (color: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const displayName = name.trim() || t('wizard.company.logoPlaceholderName');

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onLogoChange(await prepareLogo(file));
    } catch (err) {
      const reason = err instanceof Error ? err.message : '';
      setError(t(reason === 'size' ? 'wizard.company.logo.tooLarge' : 'wizard.company.logo.wrongType'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-4">
        <AccountLogo
          account={{ name: displayName, short_name: shortName.trim() || displayName, logo_url: logoUrl, brand_color: brandColor }}
          size="lg"
          className="h-16 w-16 text-title"
        />
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
              {/* kept while busy: the Button swaps it for its spinner after 150 ms (DESIGN §8.2) */}
              <ImageUp aria-hidden="true" />
              {logoUrl ? t('wizard.company.logo.replace') : t('wizard.company.logo.upload')}
            </Button>
            {logoUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onLogoChange(null)}>
                <Trash2 aria-hidden="true" />
                {t('wizard.company.logo.remove')}
              </Button>
            ) : null}
          </div>
          <p className="text-caption">{t('wizard.company.logo.hint')}</p>
        </div>
      </div>
      {error ? (
        <div role="alert">
          <FieldError live={false}>{error}</FieldError>
        </div>
      ) : null}

      <div className="grid gap-2">
        <p id="wz-color-label" className="text-table font-medium text-foreground">
          {t('wizard.company.color.label')}
        </p>
        <div role="radiogroup" aria-labelledby="wz-color-label" aria-describedby="wz-color-hint" className="flex flex-wrap gap-2">
          {BRAND_COLORS.map((c) => {
            const checked = c.value.toLowerCase() === brandColor.toLowerCase();
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={t(`wizard.company.color.names.${c.key}`)}
                title={t(`wizard.company.color.names.${c.key}`)}
                onClick={() => onColorChange(c.value)}
                onKeyDown={(e) => {
                  const i = BRAND_COLORS.findIndex((x) => x.key === c.key);
                  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                  if (!step) return;
                  e.preventDefault();
                  const next = BRAND_COLORS[(i + step + BRAND_COLORS.length) % BRAND_COLORS.length];
                  if (!next) return;
                  onColorChange(next.value);
                  const parent = e.currentTarget.parentElement;
                  const target = parent?.querySelectorAll<HTMLButtonElement>('button')[(i + step + BRAND_COLORS.length) % BRAND_COLORS.length];
                  target?.focus();
                }}
                tabIndex={checked || (!BRAND_COLORS.some((x) => x.value.toLowerCase() === brandColor.toLowerCase()) && c.key === BRAND_COLORS[0]?.key) ? 0 : -1}
                className={cn(
                  'relative flex h-11 w-11 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgb(var(--ink)/0.08)] transition-shadow duration-150 ease-out-quart md:h-8 md:w-8',
                  'touch-tap-square focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                  checked ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : 'hover:ring-2 hover:ring-border-strong hover:ring-offset-2 hover:ring-offset-card',
                )}
                // brand colours are account data (see BRAND_COLORS), applied inline like AccountLogo does
                style={{ backgroundColor: c.value }}
              >
                {checked ? <Check className="h-4 w-4 animate-check-in text-primary-foreground" strokeWidth={3} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        <p id="wz-color-hint" className="text-caption">
          {logoUrl ? t('wizard.company.color.hintWithLogo') : t('wizard.company.color.hint')}
        </p>
      </div>
    </div>
  );
}
