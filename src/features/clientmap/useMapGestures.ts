// Pointer gestures of the map canvas (pointer events, one code path for mouse, pen and touch):
// - drag on the background pans; mouse wheel / trackpad pinch / two-finger pinch zoom around the pointer
// - drag a bubble to move it (mouse/pen at once; touch after a short hold so a swipe over a bubble still pans)
// - double-click on the background fits everything; a tap on the background clears the selection
// Clicks on bubbles are handled by the bubbles themselves (so keyboard and screen readers share that path);
// `suppressClick()` tells them a drag just ended.
import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { ForceSim } from './forceSim';
import { clampK, type Viewport } from './useViewport';

const LONG_PRESS_MS = 350;

type Mode =
  | { kind: 'none' }
  | { kind: 'press'; pointerId: number; nodeId: string | null; x0: number; y0: number; t0: number; touch: boolean }
  | { kind: 'drag'; pointerId: number; nodeId: string; offX: number; offY: number }
  | { kind: 'pan'; pointerId: number; lastX: number; lastY: number }
  | { kind: 'pinch'; ids: [number, number]; dist0: number; k0: number; wx: number; wy: number };

export interface GestureDeps {
  svg: SVGSVGElement | null;
  viewport: Viewport;
  getSim(): ForceSim | null;
  dragStart(id: string): void;
  dragMove(id: string, x: number, y: number): void;
  dragEnd(id: string): void;
  onHover(id: string | null): void;
  onDragChange(id: string | null): void;
  onBackgroundTap(): void;
  onFit(): void;
}

function nodeIdOf(target: EventTarget | null): string | null {
  const el = target instanceof Element ? target.closest('[data-node-id]') : null;
  return el ? el.getAttribute('data-node-id') : null;
}

export function useMapGestures(deps: GestureDeps) {
  const d = useRef(deps);
  d.current = deps;
  const mode = useRef<Mode>({ kind: 'none' });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const suppress = useRef(false);
  const lastType = useRef('mouse');

  const local = (e: { clientX: number; clientY: number }) => {
    const r = d.current.svg?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const capture = (e: ReactPointerEvent<SVGSVGElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // the pointer is already gone
    }
  };

  const endDrag = () => {
    const m = mode.current;
    if (m.kind === 'drag') {
      d.current.dragEnd(m.nodeId);
      d.current.onDragChange(null);
    }
  };

  const onPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    lastType.current = e.pointerType;
    suppress.current = false;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      endDrag();
      const ids = [...pointers.current.keys()] as [number, number];
      const [a, b] = ids.map((id) => pointers.current.get(id) ?? p);
      const v = d.current.viewport.viewRef.current;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      mode.current = {
        kind: 'pinch',
        ids,
        dist0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        k0: v.k,
        wx: (mx - v.x) / v.k,
        wy: (my - v.y) / v.k,
      };
      suppress.current = true;
      return;
    }
    if (pointers.current.size > 2) return;
    mode.current = {
      kind: 'press',
      pointerId: e.pointerId,
      nodeId: nodeIdOf(e.target),
      x0: p.x,
      y0: p.y,
      t0: e.timeStamp,
      touch: e.pointerType === 'touch',
    };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const p = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    const m = mode.current;
    const vp = d.current.viewport;
    if (m.kind === 'none') {
      if (e.pointerType === 'mouse') d.current.onHover(nodeIdOf(e.target));
      return;
    }
    if (m.kind === 'pinch') {
      const a = pointers.current.get(m.ids[0]);
      const b = pointers.current.get(m.ids[1]);
      if (!a || !b) return;
      const k = clampK((m.k0 * Math.hypot(a.x - b.x, a.y - b.y)) / m.dist0);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      vp.autoFit.current = false;
      vp.stop();
      vp.setView({ k, x: mx - m.wx * k, y: my - m.wy * k });
      return;
    }
    if (m.pointerId !== e.pointerId) return;
    if (m.kind === 'press') {
      const dx = p.x - m.x0;
      const dy = p.y - m.y0;
      const threshold = m.touch ? 8 : 4;
      if (dx * dx + dy * dy < threshold * threshold) return;
      suppress.current = true;
      const node = m.nodeId ? d.current.getSim()?.byId.get(m.nodeId) : undefined;
      if (m.nodeId && node && (!m.touch || e.timeStamp - m.t0 >= LONG_PRESS_MS)) {
        const w = vp.toWorld(m.x0, m.y0);
        mode.current = { kind: 'drag', pointerId: e.pointerId, nodeId: m.nodeId, offX: node.x - w.x, offY: node.y - w.y };
        capture(e);
        vp.autoFit.current = false;
        d.current.dragStart(m.nodeId);
        d.current.onDragChange(m.nodeId);
        const now = vp.toWorld(p.x, p.y);
        d.current.dragMove(m.nodeId, now.x + node.x - w.x, now.y + node.y - w.y);
      } else {
        mode.current = { kind: 'pan', pointerId: e.pointerId, lastX: p.x, lastY: p.y };
        capture(e);
        d.current.onHover(null);
        vp.panBy(dx, dy);
      }
      return;
    }
    if (m.kind === 'drag') {
      const w = vp.toWorld(p.x, p.y);
      d.current.dragMove(m.nodeId, w.x + m.offX, w.y + m.offY);
      return;
    }
    vp.panBy(p.x - m.lastX, p.y - m.lastY);
    m.lastX = p.x;
    m.lastY = p.y;
  }, []);

  const finish = useCallback((e: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    pointers.current.delete(e.pointerId);
    const m = mode.current;
    if (m.kind === 'pinch') {
      // the finger left on the glass does nothing until it is lifted too
      if (pointers.current.size === 0) mode.current = { kind: 'none' };
      return;
    }
    if (m.kind === 'none' || m.pointerId !== e.pointerId) return;
    if (m.kind === 'drag') endDrag();
    if (m.kind === 'press' && !m.nodeId && !cancelled) d.current.onBackgroundTap();
    mode.current = { kind: 'none' };
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<SVGSVGElement>) => finish(e, false), [finish]);
  const onPointerCancel = useCallback((e: ReactPointerEvent<SVGSVGElement>) => finish(e, true), [finish]);
  const onPointerLeave = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && mode.current.kind === 'none') d.current.onHover(null);
  }, []);
  const onDoubleClick = useCallback((e: ReactMouseEvent<SVGSVGElement>) => {
    if (!nodeIdOf(e.target)) d.current.onFit();
  }, []);

  // wheel zoom needs a non-passive listener to keep the page from scrolling
  const svg = deps.svg;
  useEffect(() => {
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0018));
      d.current.viewport.zoomAt(e.clientX - r.left, e.clientY - r.top, factor);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [svg]);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, onDoubleClick },
    /** a drag / pan / pinch just happened: the click that follows is not an activation */
    suppressClick: () => suppress.current,
    /** pointer type of the last press ('mouse' | 'touch' | 'pen') */
    lastPointerType: () => lastType.current,
  };
}
