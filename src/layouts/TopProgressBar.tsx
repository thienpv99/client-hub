// Top progress bar (DESIGN.md §8.6): a 2px primary line at the very top of the window that appears only when api
// work (a page loading its data, a save) stays in flight for more than 200 ms, trickles towards 90 %, then completes
// and fades. With the default zero latency it never shows; `?latency=600` makes it visible. Decorative (aria-hidden):
// skeletons and busy buttons carry the state for assistive tech. Driven by DOM writes from timers — no React renders.
import { useEffect, useRef } from 'react';
import { apiInFlight, onApiActivity } from '@/services/api';

const SHOW_AFTER_MS = 200;
const TRICKLE_MS = 450;
/** a call that ends and the next that starts right after (navigation chains) keep one bar */
const SETTLE_MS = 80;

export function TopProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return undefined;
    let showTimer = 0;
    let settleTimer = 0;
    let trickleTimer = 0;
    let hideTimer = 0;
    let visible = false;
    let progress = 0;

    const setProgress = (p: number) => {
      progress = p;
      bar.style.transform = `scaleX(${p})`;
    };
    const trickle = () => {
      setProgress(progress + (0.9 - progress) * 0.2);
      trickleTimer = window.setTimeout(trickle, TRICKLE_MS);
    };
    const start = () => {
      window.clearTimeout(hideTimer);
      visible = true;
      bar.style.transition = 'none';
      setProgress(0.1);
      bar.style.opacity = '1';
      void bar.offsetWidth; // commit the reset before the transitions come back
      bar.style.transition = '';
      trickleTimer = window.setTimeout(trickle, 60);
    };
    const finish = () => {
      window.clearTimeout(trickleTimer);
      setProgress(1);
      hideTimer = window.setTimeout(() => {
        bar.style.opacity = '0';
        visible = false;
      }, 220);
    };

    const onActivity = (count: number) => {
      if (count > 0) {
        window.clearTimeout(settleTimer);
        settleTimer = 0;
        if (!visible && !showTimer) {
          showTimer = window.setTimeout(() => {
            showTimer = 0;
            if (apiInFlight() > 0) start();
          }, SHOW_AFTER_MS);
        }
        return;
      }
      if (showTimer) {
        window.clearTimeout(showTimer);
        showTimer = 0;
      }
      if (visible && !settleTimer) {
        settleTimer = window.setTimeout(() => {
          settleTimer = 0;
          if (apiInFlight() === 0) finish();
        }, SETTLE_MS);
      }
    };

    const off = onApiActivity(onActivity);
    if (apiInFlight() > 0) onActivity(apiInFlight());
    return () => {
      off();
      window.clearTimeout(showTimer);
      window.clearTimeout(settleTimer);
      window.clearTimeout(trickleTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      <div
        ref={barRef}
        data-top-progress=""
        className="h-full w-full origin-left scale-x-0 rounded-r-full bg-primary opacity-0 transition-[transform,opacity] duration-300 ease-out-quart"
      />
    </div>
  );
}
