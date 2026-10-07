// "Đăng nhập bằng Google" for New Era staff, above the password form of the "Nội bộ New Era" tab: the official GIS
// button (google.accounts.id.renderButton), fitted to the card width. Shown only when it can work — a client id is
// configured, the page has an http(s) origin, the browser is online and the script loaded; otherwise nothing, except
// one calm caption when the client id is set but the script failed. The token goes straight to api.loginWithGoogle,
// which verifies it again (the UI is never trusted) — it is never logged or kept.
import { useEffect, useId, useRef, useState } from 'react';
import { Info, LoaderCircle } from 'lucide-react';
import { GOOGLE_CLIENT_ID, SSO_ALLOWED_DOMAIN } from '@/config/auth';
import { api } from '@/services/api';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/hooks/useAction';
import { t } from '@/i18n';
import { FormError } from './FormError';
import { GIS_SCRIPT_SRC, gisTestHook, gisUnavailableReason, initGis, loadGis, type GisIdApi } from './googleIdentity';

type LoadState = 'loading' | 'ready' | 'failed';

/** GIS accepts 200–400 px */
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const RESIZE_DEBOUNCE_MS = 150;

function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export function GoogleSignIn({
  remember,
  clientId: clientIdProp,
  scriptSrc: scriptSrcProp,
}: {
  /** "Ghi nhớ thiết bị" of the form below (read when Google answers) */
  remember: boolean;
  /** defaults: src/config/auth.ts (or the QA hook in googleIdentity.ts) */
  clientId?: string;
  scriptSrc?: string;
}) {
  const clientId = (clientIdProp ?? gisTestHook.clientId ?? GOOGLE_CLIENT_ID).trim();
  const scriptSrc = scriptSrcProp ?? gisTestHook.scriptSrc ?? GIS_SCRIPT_SRC;
  const online = useOnline();
  const available = online && gisUnavailableReason(clientId) === null;

  const ids = useId();
  const [state, setState] = useState<LoadState>('loading');
  const [gis, setGis] = useState<GisIdApi | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const rememberRef = useRef(remember);
  const pendingRef = useRef(false);

  useEffect(() => {
    rememberRef.current = remember;
  }, [remember]);

  // the script loads lazily: this component exists only on the login page
  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    setState('loading');
    loadGis(scriptSrc).then(
      (loaded) => {
        if (cancelled) return;
        setGis(loaded);
        setState('ready');
      },
      () => {
        if (!cancelled) setState('failed');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [available, scriptSrc]);

  // credential → service (one sign-in at a time)
  useEffect(() => {
    if (!gis || state !== 'ready') return;
    return initGis(gis, clientId, SSO_ALLOWED_DOMAIN, (credential) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      setError(null);
      // success changes the viewer; LoginPage then redirects
      api.loginWithGoogle(credential, rememberRef.current).then(
        () => {
          pendingRef.current = false;
        },
        (err: unknown) => {
          pendingRef.current = false;
          setPending(false);
          setError(errorMessage(err));
        },
      );
    });
  }, [gis, state, clientId]);

  // draw the official button at the card's width (redrawn when the width changes)
  useEffect(() => {
    const box = boxRef.current;
    const slot = slotRef.current;
    if (!gis || state !== 'ready' || !box || !slot) return;
    let drawnWidth = 0;
    let timer: number | undefined;
    const draw = () => {
      if (box.clientWidth === 0) return;
      const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(box.clientWidth)));
      if (width === drawnWidth) return;
      drawnWidth = width;
      slot.replaceChildren();
      gis.renderButton(slot, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'center',
        width,
        locale: 'vi',
      });
    };
    draw();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(box);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [gis, state]);

  if (!available) return null;

  if (state === 'failed') {
    return (
      <p role="status" className="flex items-start gap-2 text-caption">
        <Info className="mt-px h-4 w-4 shrink-0" aria-hidden />
        <span>{t('auth.google.loadFailed')}</span>
      </p>
    );
  }

  const errorId = `${ids}-google-error`;
  return (
    <div role="group" aria-label={t('auth.google.groupLabel')} aria-describedby={error ? errorId : undefined} className="space-y-3">
      <div ref={boxRef} className="w-full" aria-busy={state === 'loading' || pending}>
        {state === 'loading' ? (
          <>
            <Skeleton className="h-11 w-full rounded-lg md:h-10" />
            <span className="sr-only">{t('auth.google.loading')}</span>
          </>
        ) : null}
        <div
          ref={slotRef}
          className={cn(
            'flex min-h-tap w-full items-center justify-center transition-opacity duration-150',
            state !== 'ready' && 'hidden',
            pending && 'pointer-events-none opacity-60',
          )}
        />
      </div>
      {pending ? (
        <p role="status" className="flex items-center justify-center gap-2 text-caption">
          <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          {t('auth.google.signingIn')}
        </p>
      ) : (
        <p className="text-center text-caption">{t('auth.google.hint', { domain: SSO_ALLOWED_DOMAIN })}</p>
      )}
      <FormError id={errorId} message={error} />
      <div className="flex items-center gap-3 pt-1">
        <span aria-hidden className="h-px flex-1 bg-border" />
        <span className="shrink-0 text-caption">{t('auth.google.divider')}</span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
