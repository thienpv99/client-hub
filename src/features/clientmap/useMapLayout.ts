// Owns the force simulation of the map: ~300 synchronous ticks before the first paint (the final layout is known at
// once, so the view is fitted to it from the start), then the bubbles settle in, biggest first (fade + grow from 60 %,
// ease-out-quart, no overshoot). When the data or the metric changes: a gentle re-heat with the radii tweened over
// 400 ms. The requestAnimationFrame loop runs only while something moves and the page is visible: it stops once the
// layout has settled, and a hidden tab finishes the layout at once (no frames are spent on a page nobody sees).
// Dragging pins a node and re-heats the simulation.
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import type { ClientMapLink, ClientMapNode } from '@/services/crmContract';
import { easeOutQuart } from '@/hooks/useMotion';
import { ForceSim, seedLayout, type SimNode } from './forceSim';

export interface LayoutInput {
  nodes: ClientMapNode[];
  links: ClientMapLink[];
  /** member node id → hub node id */
  hubOf: Map<string, string>;
  /** target radius per node id */
  radii: Map<string, number>;
  /** canvas width / height */
  aspect: number;
}

export interface MapLayout {
  /** the simulation as of this render */
  sim: ForceSim | null;
  /** the latest simulation (effects that run after a re-layout in the same commit) */
  getSim(): ForceSim | null;
  /** changes on every painted frame */
  version: number;
  /** the animation loop is active */
  running: boolean;
  /** frames painted by the loop since mount (smoothness check: stops growing once settled) */
  frames: number;
  dragStart(id: string): void;
  dragMove(id: string, x: number, y: number): void;
  dragEnd(id: string): void;
}

const TWEEN_MS = 400;
const REHEAT = 0.45;
const DRAG_HEAT = 0.3;
/** entrance: each bubble settles in this long, the last one starts INTRO_STAGGER after the first */
const INTRO_MS = 520;
const INTRO_STAGGER = 360;
/** ticks that finish a re-heated layout at once (a hidden page) */
const FINISH_TICKS = 320;

interface Tween {
  from: Map<string, number>;
  to: Map<string, number>;
  start: number;
}

interface Intro {
  start: number;
  delay: Map<string, number>;
}

function layoutKey(input: LayoutInput | null): string {
  if (!input) return '';
  const nodes = input.nodes.map((n) => `${n.id}:${Math.round((input.radii.get(n.id) ?? 0) * 2)}`).join('|');
  const links = input.links.map((l) => `${l.source}>${l.target}`).join('|');
  return `${nodes}#${links}#${Math.round(input.aspect * 20)}`;
}

export function useMapLayout(input: LayoutInput | null, reducedMotion: boolean, onFrame: (sim: ForceSim, done: boolean) => void): MapLayout {
  const simRef = useRef<ForceSim | null>(null);
  const tween = useRef<Tween | null>(null);
  const intro = useRef<Intro | null>(null);
  const introTimer = useRef<number | null>(null);
  const loop = useRef<number | null>(null);
  const dragging = useRef<string | null>(null);
  const aspectRef = useRef<number | null>(null);
  const frames = useRef(0);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const [version, bump] = useReducer((x: number) => x + 1, 0);

  const endIntro = useCallback((sim: ForceSim | null) => {
    intro.current = null;
    if (introTimer.current !== null) window.clearTimeout(introTimer.current);
    introTimer.current = null;
    if (sim) for (const n of sim.nodes) n.grow = 1;
  }, []);

  const step = useCallback(
    (now: number) => {
      const sim = simRef.current;
      if (!sim) {
        loop.current = null;
        return;
      }
      let busy = false;
      const it = intro.current;
      if (it) {
        let done = true;
        for (const n of sim.nodes) {
          const p = Math.max(0, Math.min(1, (now - it.start - (it.delay.get(n.id) ?? 0)) / INTRO_MS));
          n.grow = p >= 1 ? 1 : easeOutQuart(p);
          if (p < 1) done = false;
        }
        if (done) endIntro(sim);
        else busy = true;
      }
      const tw = tween.current;
      if (tw) {
        const p = Math.min(1, (now - tw.start) / TWEEN_MS);
        const e = easeOutQuart(p);
        for (const n of sim.nodes) {
          const from = tw.from.get(n.id) ?? n.r;
          const to = tw.to.get(n.id) ?? n.r;
          n.r = from + (to - from) * e;
        }
        if (p >= 1) tween.current = null;
        else busy = true;
      }
      if (!sim.settled) {
        const ticks = dragging.current ? 1 : 2;
        let speed = 0;
        for (let i = 0; i < ticks; i++) speed = sim.tick();
        // the tail of the alpha decay barely moves anything: end it early so the loop stops sooner
        if (!dragging.current && !tween.current && sim.alpha < 0.06 && speed < 0.04) sim.alpha = 0;
        busy = busy || !sim.settled;
      }
      frames.current += 1;
      loop.current = busy ? requestAnimationFrame(step) : null;
      onFrameRef.current(sim, !busy);
      bump();
    },
    [endIntro],
  );

  const start = useCallback(() => {
    if (loop.current === null) loop.current = requestAnimationFrame(step);
  }, [step]);

  useEffect(
    () => () => {
      if (loop.current !== null) cancelAnimationFrame(loop.current);
      loop.current = null;
      if (introTimer.current !== null) window.clearTimeout(introTimer.current);
    },
    [],
  );

  // A hidden page gets no frames: stop the loop and finish what was moving (entrance, radius tween, re-heat) so the
  // map is complete and still when the page is shown again; a drag in progress picks up where it was.
  useEffect(() => {
    const onVisibility = () => {
      const sim = simRef.current;
      if (document.visibilityState === 'hidden') {
        if (loop.current !== null) cancelAnimationFrame(loop.current);
        loop.current = null;
        if (!sim) return;
        endIntro(sim);
        const tw = tween.current;
        if (tw) {
          for (const n of sim.nodes) n.r = tw.to.get(n.id) ?? n.r;
          tween.current = null;
        }
        if (!dragging.current && !sim.settled) {
          sim.run(FINISH_TICKS);
          sim.alpha = 0;
        }
        onFrameRef.current(sim, true);
        bump();
      } else if (sim && (dragging.current || !sim.settled)) {
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [endIntro, start]);

  const key = layoutKey(input);
  useLayoutEffect(() => {
    if (!input) return;
    const prev = simRef.current;
    const prevPos = prev ? new Map(prev.nodes.map((n) => [n.id, { x: n.x, y: n.y, r: n.r }])) : null;
    const nodes: SimNode[] = input.nodes.map((n) => {
      const hubId = input.hubOf.get(n.id) ?? null;
      return {
        id: n.id,
        r: input.radii.get(n.id) ?? 20,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        hubId,
        isHub: n.kind === 'ecosystem',
        weight: n.value,
        grow: 1,
      };
    });
    endIntro(null);
    // a canvas of another shape (rotation, resize) gets a fresh layout in its proportions instead of a re-heat
    const reshaped = aspectRef.current !== null && Math.abs(Math.log(input.aspect / aspectRef.current)) > 0.15;
    aspectRef.current = input.aspect;
    // a hidden page paints nothing: its layout is settled at once like the first paint
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const animate = prevPos !== null && !reducedRef.current && !reshaped && !hidden;
    // without animation the picture is rebuilt from the deterministic seed: same data → same map, whatever came before
    seedLayout(nodes, animate ? prevPos : null, input.aspect);
    const sim = new ForceSim(nodes, input.links, input.aspect);
    dragging.current = null;
    if (!animate) {
      // first paint (or reduced motion): settle synchronously; the view is fitted to the final layout at once
      sim.run(300);
      sim.reshape(input.aspect);
      sim.alpha = 0;
      tween.current = null;
      simRef.current = sim;
      if (prev === null && !reducedRef.current && !hidden) {
        const order = [...nodes].sort((a, b) => b.r - a.r || (a.id < b.id ? -1 : 1));
        const last = Math.max(1, order.length - 1);
        intro.current = { start: performance.now(), delay: new Map(order.map((n, i) => [n.id, (i / last) * INTRO_STAGGER])) };
        for (const n of nodes) n.grow = 0;
        // a tab that stops painting mid-entrance still ends with every bubble shown
        introTimer.current = window.setTimeout(() => {
          endIntro(simRef.current);
          bump();
        }, INTRO_MS + INTRO_STAGGER + 400);
        start();
      }
      onFrameRef.current(sim, true);
      bump();
      return;
    }
    const to = new Map(nodes.map((n) => [n.id, n.r]));
    const from = new Map(nodes.map((n) => [n.id, prevPos.get(n.id)?.r ?? n.r * 0.3]));
    for (const n of nodes) n.r = from.get(n.id) ?? n.r;
    tween.current = { from, to, start: performance.now() };
    sim.alpha = REHEAT;
    simRef.current = sim;
    bump();
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const dragStart = useCallback(
    (id: string) => {
      const sim = simRef.current;
      const n = sim?.byId.get(id);
      if (!sim || !n) return;
      n.fx = n.x;
      n.fy = n.y;
      dragging.current = id;
      if (reducedRef.current) return;
      sim.alphaTarget = DRAG_HEAT;
      if (sim.alpha < DRAG_HEAT) sim.alpha = DRAG_HEAT;
      start();
    },
    [start],
  );

  const dragMove = useCallback(
    (id: string, x: number, y: number) => {
      const sim = simRef.current;
      const n = sim?.byId.get(id);
      if (!sim || !n) return;
      n.fx = x;
      n.fy = y;
      if (reducedRef.current) {
        n.x = x;
        n.y = y;
        bump();
        return;
      }
      start();
    },
    [start],
  );

  const dragEnd = useCallback(
    (id: string) => {
      const sim = simRef.current;
      const n = sim?.byId.get(id);
      dragging.current = null;
      if (!sim || !n) return;
      if (reducedRef.current) {
        // resolve overlaps at once, then let the node go where it was dropped
        sim.alpha = DRAG_HEAT;
        sim.run(160);
        sim.alpha = 0;
        n.fx = null;
        n.fy = null;
        onFrameRef.current(sim, true);
        bump();
        return;
      }
      n.fx = null;
      n.fy = null;
      sim.alphaTarget = 0;
      start();
    },
    [start],
  );

  const getSim = useCallback(() => simRef.current, []);

  return {
    sim: simRef.current,
    getSim,
    version,
    running: loop.current !== null,
    frames: frames.current,
    dragStart,
    dragMove,
    dragEnd,
  };
}
