// Google Identity Services (GIS) for the login page: availability check, lazy script loading, one initialize per
// client id. The script cannot be vendored into the single-file build — it always loads from accounts.google.com,
// and only on the login page.
import { GOOGLE_JS_ORIGINS } from '@/config/auth';

export const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const LOAD_TIMEOUT_MS = 10000;

interface GisCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GisIdConfiguration {
  client_id: string;
  callback: (response: GisCredentialResponse) => void;
  hd?: string;
  ux_mode?: 'popup' | 'redirect';
  auto_select?: boolean;
  use_fedcm_for_prompt?: boolean;
  context?: 'signin' | 'signup' | 'use';
}

export interface GisButtonConfiguration {
  type: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  /** px, 200–400 */
  width?: number;
  locale?: string;
}

export interface GisIdApi {
  initialize(config: GisIdConfiguration): void;
  renderButton(parent: HTMLElement, options: GisButtonConfiguration): void;
}

/**
 * QA hook (this tab only, never stored): show the button with another client id or script URL, e.g. to check how
 * the login page handles a script that fails to load. The service never reads it — `loginWithGoogle` always
 * verifies tokens against GOOGLE_CLIENT_ID (src/config/auth.ts).
 */
export const gisTestHook: { clientId?: string; scriptSrc?: string } = {};

export type GisUnavailableReason = 'unconfigured' | 'unsupported_origin' | 'offline';

/**
 * Why Google sign-in cannot be offered here (null = it can). GIS needs an http(s) origin that is registered for the
 * client id (GOOGLE_JS_ORIGINS) — elsewhere Google refuses the button — and the token check needs WebCrypto.
 */
export function gisUnavailableReason(clientId: string, origins: readonly string[] = GOOGLE_JS_ORIGINS): GisUnavailableReason | null {
  if (!clientId.trim()) return 'unconfigured';
  if (typeof window === 'undefined') return 'unsupported_origin';
  const protocol = window.location.protocol;
  if (protocol !== 'https:' && protocol !== 'http:') return 'unsupported_origin';
  if (!origins.includes(window.location.origin)) return 'unsupported_origin';
  if (!window.isSecureContext || typeof crypto === 'undefined' || !crypto.subtle) return 'unsupported_origin';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  return null;
}

function currentGis(): GisIdApi | null {
  const g = (window as unknown as { google?: { accounts?: { id?: GisIdApi } } }).google;
  const id = g?.accounts?.id;
  return id && typeof id.initialize === 'function' && typeof id.renderButton === 'function' ? id : null;
}

const loads = new Map<string, Promise<GisIdApi>>();

/** Loads the GIS script once per URL; rejects on a network error, a non-GIS response or after 10 s (then retryable). */
export function loadGis(src: string = GIS_SCRIPT_SRC): Promise<GisIdApi> {
  const ready = src === GIS_SCRIPT_SRC ? currentGis() : null;
  if (ready) return Promise.resolve(ready);
  let pending = loads.get(src);
  if (!pending) {
    pending = new Promise<GisIdApi>((resolve, reject) => {
      const script = document.createElement('script');
      const done = (err: Error | null) => {
        window.clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        const gis = err ? null : currentGis();
        if (gis) {
          resolve(gis);
          return;
        }
        script.remove();
        loads.delete(src);
        reject(err ?? new Error('Google Identity Services did not start'));
      };
      const timer = window.setTimeout(() => done(new Error('Google Identity Services timed out')), LOAD_TIMEOUT_MS);
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => done(null);
      script.onerror = () => done(new Error('Google Identity Services failed to load'));
      document.head.appendChild(script);
    });
    loads.set(src, pending);
  }
  return pending;
}

let initializedFor: { gis: GisIdApi; clientId: string } | null = null;
let credentialHandler: ((credential: string) => void) | null = null;

/**
 * google.accounts.id.initialize once per GIS instance and client id (GIS warns when it is called again); the
 * credential goes to the handler registered last. Returns a function that unregisters `onCredential`.
 */
export function initGis(gis: GisIdApi, clientId: string, hostedDomain: string, onCredential: (credential: string) => void): () => void {
  credentialHandler = onCredential;
  if (initializedFor?.gis !== gis || initializedFor.clientId !== clientId) {
    gis.initialize({
      client_id: clientId,
      callback: (response) => {
        if (typeof response.credential === 'string' && response.credential) credentialHandler?.(response.credential);
      },
      hd: hostedDomain,
      ux_mode: 'popup',
      auto_select: false,
      use_fedcm_for_prompt: true,
      context: 'signin',
    });
    initializedFor = { gis, clientId };
  }
  return () => {
    if (credentialHandler === onCredential) credentialHandler = null;
  };
}
