// First-login intro (SPEC 5.5): 3 short skippable screens. Full screen on phones, a centred card from sm up.
// Keyboard: ←/→ move between screens, Esc skips (Radix Dialog). Swipe left/right on touch screens.
// Rendered by ClientLayout when viewer.user.onboarded_at === null and not in "Xem như khách hàng" mode.
import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent, TouchEvent } from 'react';
import {
  BellRing,
  CalendarClock,
  Flag,
  Handshake,
  ListChecks,
  MessageCircleQuestion,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useSlidingIndicator } from '@/components/ui/use-sliding-indicator';
import { NewEraLogo } from '@/components/common/new-era-logo';
import { useViewer } from '@/hooks/useViewer';
import { saluteOf } from './portalText';

export interface OnboardingIntroProps {
  onDone(): void;
}

interface Screen {
  key: 'track' | 'tasks' | 'delegate' | 'ask';
  icon: LucideIcon;
  /** two small satellites around the main icon */
  badges: [LucideIcon, LucideIcon];
}

const TRACK: Screen = { key: 'track', icon: Handshake, badges: [Flag, CalendarClock] };
const TASKS: Screen = { key: 'tasks', icon: ListChecks, badges: [BellRing, Flag] };
const DELEGATE: Screen = { key: 'delegate', icon: UserPlus, badges: [Users, Send] };
const ASK: Screen = { key: 'ask', icon: MessageCircleQuestion, badges: [Send, Users] };

function Illustration({ screen }: { screen: Screen }) {
  const Main = screen.icon;
  const [A, B] = screen.badges;
  return (
    // the empty-state halo at hero size (DESIGN §4): soft blue disc, white inner disc, two quiet satellites
    <div className="relative h-36 w-36 shrink-0 sm:h-40 sm:w-40" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-primary-soft" />
      <div className="absolute inset-6 flex items-center justify-center rounded-full bg-card shadow-xs ring-1 ring-inset ring-primary-border/70">
        <Main className="h-11 w-11 text-primary" strokeWidth={1.75} />
      </div>
      <span className="absolute -right-1 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-card ring-1 ring-inset ring-border/70">
        <A className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="absolute -left-2 bottom-4 flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-card ring-1 ring-inset ring-border/70">
        <B className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
    </div>
  );
}

const SWIPE_MIN = 48;

/**
 * Page dots: one 24px pill glides to the current dot (sliding indicator, DESIGN §8.3). The indicator covers the
 * current button's box and centres the pill in it, so it also follows the 44px touch boxes. Its own component so the
 * indicator is measured once the dialog content is in the DOM (the dialog renders in a portal after its first pass).
 */
function StepDots({ keys, current, onGo }: { keys: string[]; current: number; onGo(index: number): void }) {
  const dotsRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  useSlidingIndicator(dotsRef, pillRef, { activeSelector: 'button[aria-current="step"]', itemSelector: 'button' });
  return (
    <div ref={dotsRef} className="group/dots relative mx-auto flex items-center justify-center gap-1" role="group" aria-label={t('portal.onboarding.dots')}>
      <span
        ref={pillRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 flex items-center justify-center opacity-0 transition-[transform,width,height] duration-250 ease-out-quart"
      >
        <span className="block h-2 w-6 rounded-full bg-primary" />
      </span>
      {keys.map((key, i) => (
        <button
          key={key}
          type="button"
          onClick={() => onGo(i)}
          aria-label={t('portal.onboarding.step', { current: i + 1, total: keys.length })}
          aria-current={i === current ? 'step' : undefined}
          className="touch-tap-square group relative inline-flex h-8 min-w-8 items-center justify-center rounded-full"
        >
          {/* until the pill is placed the current dot draws itself; then it steps aside (no width animation) */}
          <span
            aria-hidden="true"
            className={cn(
              'block h-2 rounded-full transition-colors duration-150 ease-out-quart',
              i === current ? 'w-6 bg-primary group-data-[indicator=ready]/dots:invisible' : 'w-2 bg-border group-hover:bg-caption',
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function OnboardingIntro({ onDone }: OnboardingIntroProps) {
  const viewer = useViewer();
  const salute = saluteOf(viewer);
  // a member cannot delegate (SPEC §2): the third screen tells them how to ask New Era instead
  const screens: Screen[] = [TRACK, TASKS, viewer?.role === 'client_owner' ? DELEGATE : ASK];
  const [step, setStep] = useState(0);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const touchX = useRef<number | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  const last = step === screens.length - 1;
  const go = (to: number) => setStep(Math.max(0, Math.min(screens.length - 1, to)));
  const next = () => (last ? finish() : go(step + 1));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(step + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(step - 1);
    }
  };
  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touchX.current;
    touchX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start === null || end === undefined) return;
    const dx = end - start;
    if (Math.abs(dx) < SWIPE_MIN) return;
    go(dx < 0 ? step + 1 : step - 1);
  };

  const screen = screens[step] ?? TRACK;
  const params = { you: salute.you, You: salute.You };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) finish();
      }}
    >
      <DialogContent
        mobileFullScreen
        showCloseButton={false}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          primaryRef.current?.focus();
        }}
        // an accidental tap beside the card must not end the intro; Esc and "Bỏ qua" do
        onPointerDownOutside={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        // phones: full screen (the kit's mobileFullScreen); sm+: a centred card sized by its content
        className="flex-col gap-0 p-0 sm:max-h-[92vh] sm:p-0"
      >
        <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          <NewEraLogo size="sm" withText />
          <p className="text-micro font-medium tabular text-muted-foreground" aria-hidden="true">
            {step + 1}/{screens.length}
          </p>
        </div>

        {/* keyed: each screen fades up 6px as it comes in (DESIGN §8 rise), the dots' pill glides along */}
        <div
          key={screen.key}
          aria-live="polite"
          className="flex flex-1 animate-rise flex-col items-center justify-center px-6 py-8 text-center sm:px-10 sm:py-10"
        >
          <Illustration screen={screen} />
          <p className="sr-only">{t('portal.onboarding.step', { current: step + 1, total: screens.length })}</p>
          <DialogTitle className="mt-8 max-w-sm text-balance text-title font-semibold tracking-tightish text-ink">
            {t(`portal.onboarding.screens.${screen.key}.title`, params)}
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-sm text-pretty text-body text-muted-foreground">
            {t(`portal.onboarding.screens.${screen.key}.body`, params)}
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-8">
          <StepDots keys={screens.map((s) => s.key)} current={step} onGo={go} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={finish}
              // the last screen keeps the button's box (invisible, not hidden): the dots and "Bắt đầu" stay where the
              // thumb already is (DESIGN §6: primary actions keep their position)
              className={cn('text-muted-foreground', last && 'invisible')}
              disabled={last}
              aria-hidden={last || undefined}
              tabIndex={last ? -1 : undefined}
            >
              {t('portal.onboarding.skip')}
            </Button>
            <Button ref={primaryRef} size="touch" onClick={next} className="w-full sm:w-auto sm:min-w-[160px]">
              {last ? t('portal.onboarding.start') : t('portal.onboarding.next')}
            </Button>
          </div>
          <p className="hidden text-center text-micro text-muted-foreground [@media(pointer:fine)]:block">{t('portal.onboarding.keyboardHint')}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
