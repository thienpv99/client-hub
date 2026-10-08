// Zoom & pan of the map canvas: a { k, x, y } transform (screen = world × k + (x, y)), animated moves (ease-out-quart,
// the app's curve), and the "fit everything" view. `autoFit` stays on until the person zooms or pans by hand ("Vừa màn
// hình" turns it back on). Animated zooms chain: a second step (wheel notch, "+" pressed twice) continues from where
// the running one is heading, so stepping through zoom levels glides instead of stuttering.
import { useCallback, useEffect, useRef, useState } from 'react';
import { easeOutQuart } from '@/hooks/useMotion';

export interface View {
  k: number;
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const K_MIN = 0.3;
export const K_MAX = 4;
/** the radii are sized for the canvas (fit ≈ 1); a small map (AM filter) may be enlarged up to this */
const FIT_MAX = 1.8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** one animated zoom step (buttons, wheel notches) */
const ZOOM_MS = 200;

export function clampK(k: number): number {
  return clamp(k, K_MIN, K_MAX);
}

/** the view that shows every bubble inside the canvas minus the overlay insets */
export function fitView(b: Bounds, width: number, height: number, inset: Insets): View {
  const bw = Math.max(1, b.maxX - b.minX);
  const bh = Math.max(1, b.maxY - b.minY);
  const aw = Math.max(40, width - inset.left - inset.right);
  const ah = Math.max(40, height - inset.top - inset.bottom);
  const k = clamp(Math.min(aw / bw, ah / bh), K_MIN, FIT_MAX);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { k, x: inset.left + aw / 2 - cx * k, y: inset.top + ah / 2 - cy * k };
}

export function lerpView(a: View, b: View, t: number): View {
  return { k: a.k + (b.k - a.k) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function sameView(a: View, b: View): boolean {
  return Math.abs(a.k - b.k) < 1e-3 && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

export interface Viewport {
  view: View;
  /** always the latest view (event handlers) */
  viewRef: { current: View };
  /** follow the layout with a fit until the person moves the view */
  autoFit: { current: boolean };
  /** set at once (no animation) */
  setView(v: View): void;
  animateTo(v: View, ms?: number): void;
  /** zoom around a canvas point; manual = turns autoFit off */
  zoomAt(px: number, py: number, factor: number, animated?: boolean): void;
  panBy(dx: number, dy: number): void;
  toWorld(px: number, py: number): { x: number; y: number };
  stop(): void;
}

export function useViewport(reducedMotion: boolean): Viewport {
  const [view, setState] = useState<View>({ k: 1, x: 0, y: 0 });
  const viewRef = useRef<View>(view);
  const autoFit = useRef(true);
  const anim = useRef<number | null>(null);
  /** where the running animation is heading (null when none runs) */
  const heading = useRef<View | null>(null);
  const reduced = useRef(reducedMotion);
  reduced.current = reducedMotion;

  const stop = useCallback(() => {
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    anim.current = null;
    heading.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const setView = useCallback((v: View) => {
    if (sameView(viewRef.current, v)) return;
    viewRef.current = v;
    setState(v);
  }, []);

  const animateTo = useCallback(
    (target: View, ms = 280) => {
      stop();
      // reduced motion, or a hidden page (no frames would come): jump
      if (reduced.current || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) {
        setView(target);
        return;
      }
      const from = viewRef.current;
      const start = performance.now();
      heading.current = target;
      const frame = (now: number) => {
        const p = Math.min(1, (now - start) / ms);
        setView(lerpView(from, target, easeOutQuart(p)));
        if (p < 1) anim.current = requestAnimationFrame(frame);
        else {
          anim.current = null;
          heading.current = null;
        }
      };
      anim.current = requestAnimationFrame(frame);
    },
    [setView, stop],
  );

  const zoomAt = useCallback(
    (px: number, py: number, factor: number, animated = false) => {
      // an animated step continues from where a running animation is heading (chained steps add up)
      const v = (animated ? heading.current : null) ?? viewRef.current;
      const k = clampK(v.k * factor);
      const wx = (px - v.x) / v.k;
      const wy = (py - v.y) / v.k;
      const next = { k, x: px - wx * k, y: py - wy * k };
      autoFit.current = false;
      if (animated) animateTo(next, ZOOM_MS);
      else {
        stop();
        setView(next);
      }
    },
    [animateTo, setView, stop],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const v = viewRef.current;
      autoFit.current = false;
      stop();
      setView({ k: v.k, x: v.x + dx, y: v.y + dy });
    },
    [setView, stop],
  );

  const toWorld = useCallback((px: number, py: number) => {
    const v = viewRef.current;
    return { x: (px - v.x) / v.k, y: (py - v.y) / v.k };
  }, []);

  return { view, viewRef, autoFit, setView, animateTo, zoomAt, panBy, toWorld, stop };
}
