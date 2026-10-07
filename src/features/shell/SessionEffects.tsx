// Session side effects mounted once in App: the daily notification sweep (SPEC §6 reminders, escalations and the
// Monday 08:00 bulletin). The sweep is idempotent per day (and per bulletin week), so it is simply re-triggered:
// after login, when the tab comes back into view or gets focus, every 15 minutes (a tab left open past midnight or
// opened before 08:00 on Monday), and right after a demo reset (sweepNow).
import { useEffect } from 'react';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { useViewer } from '@/hooks/useViewer';

const INTERVAL_MS = 15 * 60 * 1000;
/** focus / visibility events closer than this do not trigger another run on the same day */
const MIN_GAP_MS = 60 * 1000;

let lastRunAt = 0;
let lastRunDay = '';
let running = false;

function sweep(force: boolean): void {
  const viewer = api.getViewer();
  if (!viewer || viewer.read_only || running) return;
  const day = todayISO();
  if (!force && day === lastRunDay && Date.now() - lastRunAt < MIN_GAP_MS) return;
  running = true;
  lastRunAt = Date.now();
  lastRunDay = day;
  api
    .runNotificationSweep()
    .catch((err: unknown) => {
      // the session ended (logout / switch) while the call was in flight: nothing to report
      const code = err && typeof err === 'object' ? (err as { code?: unknown }).code : undefined;
      if (code === 'unauthenticated') return;
      console.warn('[sweep] notification sweep failed', err);
    })
    .finally(() => {
      running = false;
    });
}

/** Run the daily sweep now (e.g. right after "Đặt lại dữ liệu demo", which clears the last sweep date). */
export function sweepNow(): void {
  sweep(true);
}

export function SessionEffects() {
  const viewer = useViewer();
  const userId = viewer?.user.id ?? null;
  const readOnly = viewer?.read_only ?? false;

  useEffect(() => {
    if (!userId || readOnly) return;
    sweep(true);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') sweep(false);
    };
    const onFocus = (): void => sweep(false);
    const timer = window.setInterval(() => sweep(true), INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [userId, readOnly]);

  return null;
}
