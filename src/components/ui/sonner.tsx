import * as React from 'react';
import { Toaster as Sonner } from 'sonner';
import { CircleAlert, CircleCheck, CircleX, Info, Loader2 } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';

type SonnerProps = React.ComponentPropsWithoutRef<typeof Sonner>;

export interface ToasterProps extends SonnerProps {
  /** Distance from the bottom on phones/small tablets (<768px), clears the portal's bottom tab bar. */
  mobileOffset?: number;
}

const DESKTOP_QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function useIsDesktop(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

/** Status icon in a soft disc (DESIGN.md §4 toast: white card, status icon, primary action). */
function ToastIcon({ tone, children }: { tone: 'success' | 'danger' | 'warning' | 'primary' | 'muted'; children: React.ReactNode }) {
  const tint = {
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    primary: 'bg-primary-soft text-primary',
    muted: 'bg-muted text-muted-foreground',
  }[tone];
  return (
    <span className={cn('flex h-6 w-6 items-center justify-center rounded-full [&_svg]:h-4 [&_svg]:w-4', tint)} aria-hidden="true">
      {children}
    </span>
  );
}

/** Mount once (App). Bottom-center on mobile, bottom-right from md. Use toast() from 'sonner' or '@/lib/toast'. */
function Toaster({
  mobileOffset = 80,
  position,
  offset,
  style,
  icons,
  toastOptions,
  containerAriaLabel,
  ...props
}: ToasterProps) {
  const desktop = useIsDesktop();
  const extra = toastOptions?.classNames;

  const tokenStyle = {
    fontFamily: 'inherit',
    '--normal-bg': 'rgb(var(--card))',
    '--normal-border': 'rgb(var(--border))',
    '--normal-text': 'rgb(var(--foreground))',
    '--border-radius': '12px',
    '--width': '380px',
    ...(desktop ? {} : { bottom: `calc(${mobileOffset}px + env(safe-area-inset-bottom))` }),
    ...style,
  } as React.CSSProperties;

  return (
    <Sonner
      theme="light"
      position={position ?? (desktop ? 'bottom-right' : 'bottom-center')}
      offset={offset ?? (desktop ? 24 : mobileOffset)}
      gap={10}
      containerAriaLabel={containerAriaLabel ?? t('layout.bell.title')}
      style={tokenStyle}
      icons={{
        success: (
          <ToastIcon tone="success">
            <CircleCheck />
          </ToastIcon>
        ),
        error: (
          <ToastIcon tone="danger">
            <CircleX />
          </ToastIcon>
        ),
        warning: (
          <ToastIcon tone="warning">
            <CircleAlert />
          </ToastIcon>
        ),
        info: (
          <ToastIcon tone="primary">
            <Info />
          </ToastIcon>
        ),
        loading: (
          <ToastIcon tone="muted">
            <Loader2 className="animate-spin" />
          </ToastIcon>
        ),
        ...icons,
      }}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...extra,
          toast: cn(
            '!items-center !gap-3 !rounded-xl !border !border-border/70 !bg-card !py-3 !pl-3.5 !pr-3 !text-table !text-foreground !shadow-pop',
            extra?.toast,
          ),
          title: cn('!text-table !font-medium !leading-5 !text-foreground', extra?.title),
          description: cn('!mt-0.5 !text-caption', extra?.description),
          icon: cn('!m-0 !h-6 !w-6 !shrink-0 !self-start', extra?.icon),
          // "Hoàn tác" is how a client undoes an approval on a phone: 44px tap target below md
          actionButton: cn(
            'touch-tap !ml-auto !h-auto !min-h-tap !shrink-0 !self-center !rounded-lg !bg-transparent !px-3 !py-1 !text-table !font-semibold !text-primary transition-colors hover:!bg-primary-soft focus-visible:!ring-2 focus-visible:!ring-primary md:!min-h-8 md:!px-2.5',
            extra?.actionButton,
          ),
          cancelButton: cn(
            'touch-tap !h-auto !min-h-tap !shrink-0 !self-center !rounded-lg !bg-muted !px-3 !py-1 !text-table !font-medium !text-muted-foreground md:!min-h-8 md:!px-2.5',
            extra?.cancelButton,
          ),
          closeButton: cn('!border-border !bg-card !text-muted-foreground hover:!bg-muted', extra?.closeButton),
        },
      }}
      {...props}
    />
  );
}
Toaster.displayName = 'Toaster';

export { Toaster };
