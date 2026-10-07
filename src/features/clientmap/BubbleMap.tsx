// The hero of "Bản đồ khách hàng": an SVG bubble map (crisp text) laid out by our own force simulation and fitted
// to fill its canvas. Every bubble is focusable (Tab), opens with Enter; hubs select their ecosystem. Hover / focus
// shows a card, search dims the rest; each ecosystem sits on a soft blue ground, the selected one is outlined and
// gets a side panel. Search and zoom live in
// the top bar, the legend in the footer bar: nothing covers the bubbles but the card of the one being looked at.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ClientMap, EcosystemView } from '@/services/crmContract';
import { useBreakpoint, useMediaQuery } from '@/hooks/useMedia';
import { t } from '@/i18n';
import { BubbleDefs, BubbleNode, type BubbleHandlers } from './BubbleNode';
import { EcosystemPanel } from './EcosystemSummary';
import { boundsOf, type ForceSim } from './forceSim';
import { MapLinks, Territories } from './MapLayers';
import { MapLegend, MapSearch, SearchCount, ZoomControls } from './MapOverlays';
import { MapTooltip } from './MapTooltip';
import { computeRadii, ecosystemsById, hubIndex, matchesQuery, nodeAriaLabel, spokenMoney } from './mapModel';
import { useElementSize } from './useElementSize';
import { useMapGestures } from './useMapGestures';
import { useMapLayout, type LayoutInput } from './useMapLayout';
import { fitView, K_MIN, lerpView, useViewport, type Insets } from './useViewport';

export interface BubbleMapProps {
  map: ClientMap;
  showLeads: boolean;
  /** selected ecosystem id (its hub is highlighted and its panel open) */
  selectedEco: string | null;
  onSelectEco(id: string | null): void;
  onEditEco(eco: EcosystemView): void;
}

/** ecosystem panel width from md (px) */
const PANEL_WIDTH = 340;
/** phones: the docked ecosystem panel takes at most this share of the canvas height (keep in step with max-h-[52%]) */
const PHONE_PANEL_SHARE = 0.52;

/** dotted-grid spacing that follows the zoom but stays between 14 and 28 px */
function gridStep(k: number): number {
  let s = 22 * k;
  while (s < 14) s *= 2;
  while (s > 28) s /= 2;
  return s;
}

export function BubbleMap({ map, showLeads, selectedEco, onSelectEco, onEditEco }: BubbleMapProps) {
  const navigate = useNavigate();
  const phone = useBreakpoint() === 'mobile';
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const coarse = useMediaQuery('(pointer: coarse)');
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const size = useElementSize(container);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tooltipId = `${uid}-tip`;

  const hubOf = useMemo(() => hubIndex(map), [map]);
  const ecos = useMemo(() => ecosystemsById(map), [map]);
  const byId = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map]);
  // paint and Tab order: biggest first
  const ordered = useMemo(() => [...map.nodes].sort((a, b) => b.value - a.value || a.id.localeCompare(b.id)), [map]);
  // nothing floats over the canvas: the fitted map keeps a plain margin (24px, 16px on phones)
  const pad = phone ? 16 : 24;
  const inset: Insets = { top: pad, right: pad, bottom: pad, left: pad };
  // the layout is sized for the free area (canvas minus overlays) in 32px steps: a scrollbar appearing does not
  // re-run it (the fit still follows)
  const freeW = size.width - inset.left - inset.right;
  const freeH = size.height - inset.top - inset.bottom;
  const layoutW = size.width > 0 ? Math.max(160, Math.round(freeW / 32) * 32) : 0;
  const layoutH = size.height > 0 ? Math.max(160, Math.round(freeH / 32) * 32) : 0;
  const radii = useMemo(
    () => (layoutW > 0 && layoutH > 0 ? computeRadii(map.nodes, hubOf, layoutW, layoutH) : null),
    [map.nodes, hubOf, layoutW, layoutH],
  );
  const input = useMemo<LayoutInput | null>(
    () => (radii ? { nodes: ordered, links: map.links, hubOf, radii, aspect: layoutW / layoutH } : null),
    [radii, ordered, map.links, hubOf, layoutW, layoutH],
  );

  const vp = useViewport(reduced);
  const frameCtx = useRef({ size, inset, reduced });
  frameCtx.current = { size, inset, reduced };

  const fitTarget = useCallback((sim: ForceSim | null) => {
    const b = sim ? boundsOf(sim.nodes) : null;
    const { size: s, inset: i } = frameCtx.current;
    return b && s.width > 0 ? fitView(b, s.width, s.height, i) : null;
  }, []);

  // keep everything in view while the layout moves, until the person zooms or pans
  const onFrame = useCallback(
    (sim: ForceSim, done: boolean) => {
      if (!vp.autoFit.current) return;
      const target = fitTarget(sim);
      if (!target) return;
      if (done || frameCtx.current.reduced) vp.setView(target);
      else vp.setView(lerpView(vp.viewRef.current, target, 0.18));
    },
    [fitTarget, vp],
  );
  const layout = useMapLayout(input, reduced, onFrame);
  const sim = layout.sim;

  // every resize re-fits (a new layout made in this same commit included: read the latest simulation, not the one
  // this render saw — fitting the old, larger cloud left the map at ~40% of the card)
  useLayoutEffect(() => {
    if (!vp.autoFit.current) return;
    const target = fitTarget(layout.getSim());
    if (target) vp.setView(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, phone]);

  const fit = useCallback(() => {
    vp.autoFit.current = true;
    const target = fitTarget(layout.getSim());
    if (target) vp.animateTo(target);
  }, [fitTarget, layout.getSim, vp]);

  // ── interaction state ──
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; visible: boolean } | null>(null);
  const [tapId, setTapId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const gestures = useMapGestures({
    svg,
    viewport: vp,
    getSim: () => layout.sim,
    dragStart: layout.dragStart,
    dragMove: layout.dragMove,
    dragEnd: layout.dragEnd,
    onHover: setHoverId,
    onDragChange: setDragId,
    onBackgroundTap: () => {
      setTapId(null);
      if (selectedEco) onSelectEco(null);
    },
    onFit: fit,
  });

  const selectedHubId = useMemo(
    () => (selectedEco ? map.nodes.find((n) => n.kind === 'ecosystem' && n.ref_id === selectedEco)?.id ?? null : null),
    [map.nodes, selectedEco],
  );
  const clusterOf = useCallback(
    (id: string | null): Set<string> | null => {
      if (!id) return null;
      const hub = byId.get(id)?.kind === 'ecosystem' ? id : hubOf.get(id);
      if (!hub) return null;
      const set = new Set<string>([hub]);
      for (const [member, h] of hubOf) if (h === hub) set.add(member);
      return set;
    },
    [byId, hubOf],
  );

  const activeId = dragId ?? hoverId ?? tapId ?? (focus?.visible ? focus.id : null);
  const matches = useMemo(() => {
    if (!query.trim()) return null;
    return new Set(map.nodes.filter((n) => matchesQuery(n, query)).map((n) => n.id));
  }, [map.nodes, query]);
  const emphasis = matches ?? clusterOf(activeId) ?? clusterOf(selectedHubId);
  const linkFocus = activeId ?? selectedHubId;

  const activate = useCallback(
    (id: string) => {
      const node = byId.get(id);
      if (!node) return;
      if (node.kind === 'ecosystem') {
        setTapId(null);
        onSelectEco(selectedEco === node.ref_id ? null : node.ref_id);
        return;
      }
      if (node.href) navigate(node.href);
    },
    [byId, navigate, onSelectEco, selectedEco],
  );

  /** pans (keeping the zoom) when the bubble is outside the canvas — on phones, outside the part above the docked card */
  const ensureVisible = (id: string) => {
    const n = layout.sim?.byId.get(id);
    if (!n) return;
    const v = vp.viewRef.current;
    const sx = n.x * v.k + v.x;
    const sy = n.y * v.k + v.y;
    const m = n.r * v.k + 12;
    const bottom = phone ? size.height * 0.5 : size.height;
    if (sx - m >= 0 && sy - m >= 0 && sx + m <= size.width && sy + m <= bottom) return;
    vp.autoFit.current = false;
    vp.animateTo({ k: v.k, x: size.width / 2 - n.x * v.k, y: (phone ? size.height * 0.3 : size.height / 2) - n.y * v.k });
  };

  // stable handlers for the memoised bubbles; they call the latest closures
  const impl = useRef({ activate, ensureVisible, tapId, gestures, onSelectEco });
  impl.current = { activate, ensureVisible, tapId, gestures, onSelectEco };
  const handlers = useMemo<BubbleHandlers>(
    () => ({
      onFocus: (id, visible) => {
        setFocus({ id, visible });
        if (visible) impl.current.ensureVisible(id);
      },
      onBlur: (id) => setFocus((f) => (f?.id === id ? null : f)),
      onKeyDown: (id, e: KeyboardEvent<SVGGElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          impl.current.activate(id);
        } else if (e.key === 'Escape') {
          setTapId(null);
          impl.current.onSelectEco(null);
        }
      },
      onClick: (id, _e: MouseEvent<SVGGElement>) => {
        const g = impl.current.gestures;
        if (g.suppressClick()) return;
        const node = byId.get(id);
        // touch: the first tap shows the card, the second one opens
        if (g.lastPointerType() === 'touch' && node && node.kind !== 'ecosystem' && impl.current.tapId !== id) {
          setTapId(id);
          impl.current.ensureVisible(id);
          return;
        }
        impl.current.activate(id);
      },
    }),
    [byId],
  );

  // A selected ecosystem hidden under its panel slides into the free part of the canvas — left of the panel from md,
  // above the docked panel on phones — zooming out only when it does not fit there. Closing the panel returns to the
  // fitted view when the map was fitted before.
  const fitBeforeSelect = useRef(false);
  useEffect(() => {
    const current = layout.getSim();
    if (!selectedHubId) {
      if (fitBeforeSelect.current) {
        fitBeforeSelect.current = false;
        fit();
      }
      return;
    }
    if (!current) return;
    const cluster = clusterOf(selectedHubId);
    if (!cluster) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const id of cluster) {
      const n = current.byId.get(id);
      if (!n) continue;
      minX = Math.min(minX, n.x - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r);
      maxY = Math.max(maxY, n.y + n.r);
    }
    if (!Number.isFinite(minX)) return;
    const free = phone
      ? { left: inset.left, top: inset.top, right: size.width - inset.right, bottom: size.height * (1 - PHONE_PANEL_SHARE) - 8 }
      : { left: inset.left, top: inset.top, right: size.width - PANEL_WIDTH - 16 - inset.right, bottom: size.height - inset.bottom };
    const v = vp.viewRef.current;
    const inside =
      minX * v.k + v.x >= free.left && maxX * v.k + v.x <= free.right && minY * v.k + v.y >= free.top && maxY * v.k + v.y <= free.bottom;
    if (inside) return;
    const fw = Math.max(40, free.right - free.left);
    const fh = Math.max(40, free.bottom - free.top);
    const k = Math.max(K_MIN, Math.min(v.k, fw / Math.max(1, maxX - minX), fh / Math.max(1, maxY - minY)));
    if (!fitBeforeSelect.current) fitBeforeSelect.current = vp.autoFit.current;
    vp.autoFit.current = false;
    vp.animateTo({
      k,
      x: (free.left + free.right) / 2 - ((minX + maxX) / 2) * k,
      y: (free.top + free.bottom) / 2 - ((minY + maxY) / 2) * k,
    });
    // also once the first layout exists (an ecosystem selected from the URL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHubId, sim !== null]);

  // a new data set drops the transient states that may point at bubbles that are gone
  useEffect(() => {
    setTapId((id) => (id && byId.has(id) ? id : null));
    setHoverId((id) => (id && byId.has(id) ? id : null));
  }, [byId]);

  const submitSearch = () => {
    const first = ordered.find((n) => matches?.has(n.id));
    if (!first) return;
    setTapId(first.id);
    ensureVisible(first.id);
  };

  const v = vp.view;
  const s = 1 / v.k;
  // the selected hub's details are in its panel already
  const tipNode = activeId && !dragId && activeId !== selectedHubId ? byId.get(activeId) : undefined;
  const tipSim = tipNode ? sim?.byId.get(tipNode.id) : undefined;
  const panelEco = selectedEco ? ecos.get(selectedEco) : undefined;
  const showPanel = Boolean(panelEco) && !(phone && tipNode);
  const summary = t('clientmap.map.label', {
    accounts: map.totals.accounts,
    leads: map.totals.leads,
    ecosystems: map.totals.ecosystems,
    value: spokenMoney(map.totals.value),
  });
  const step = gridStep(v.k);

  return (
    <div className="flex h-full w-full flex-col">
      {/* first in the Tab order: search and zoom, then the bubbles, then the panel */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-card px-3 py-2 md:gap-3 md:px-4">
        <MapSearch value={query} onChange={setQuery} onSubmit={submitSearch} className="flex-1 md:max-w-[280px]" />
        <div className="ml-auto">
          <ZoomControls
            onZoomIn={() => vp.zoomAt(size.width / 2, size.height / 2, 1.35, true)}
            onZoomOut={() => vp.zoomAt(size.width / 2, size.height / 2, 1 / 1.35, true)}
            onFit={fit}
          />
        </div>
      </div>

      <div
        ref={setContainer}
        className="relative min-h-0 flex-1 overflow-hidden bg-subtle"
        style={{
          backgroundImage: 'radial-gradient(circle, rgb(var(--border-strong) / 0.75) 1px, transparent 1.5px)',
          backgroundSize: `${step}px ${step}px`,
          backgroundPosition: `${v.x}px ${v.y}px`,
        }}
      >
        <SearchCount count={matches ? matches.size : null} />
        {size.width > 0 && sim ? (
          <svg
            ref={setSvg}
            width={size.width}
            height={size.height}
            role="group"
            aria-label={summary}
            className="block touch-none select-none"
            data-sim-state={layout.running ? 'running' : 'idle'}
            data-sim-frames={layout.frames}
            {...gestures.handlers}
          >
            <BubbleDefs id={uid} />
            <g transform={`translate(${v.x} ${v.y}) scale(${v.k})`}>
              <Territories sim={sim} hubOf={hubOf} selectedHubId={selectedHubId} emphasis={emphasis} s={s} />
              <MapLinks sim={sim} links={map.links} focusId={linkFocus} emphasis={emphasis} matches={matches} s={s} />
              {ordered.map((n) => {
                const p = sim.byId.get(n.id);
                if (!p) return null;
                return (
                  <BubbleNode
                    key={n.id}
                    node={n}
                    eco={n.kind === 'ecosystem' ? ecos.get(n.ref_id) : undefined}
                    x={p.x}
                    y={p.y}
                    r={p.r}
                    grow={p.grow}
                    k={v.k}
                    defs={uid}
                    label={nodeAriaLabel(n, n.kind === 'ecosystem' ? ecos.get(n.ref_id) : undefined)}
                    dimmed={emphasis !== null && !emphasis.has(n.id)}
                    hovered={activeId === n.id}
                    focused={focus?.visible === true && focus.id === n.id}
                    describedBy={tipNode?.id === n.id ? tooltipId : undefined}
                    selected={selectedHubId === n.id}
                    handlers={handlers}
                  />
                );
              })}
            </g>
          </svg>
        ) : null}

        {showPanel && panelEco ? (
          <EcosystemPanel
            eco={panelEco}
            docked={phone}
            titleId={`${uid}-eco`}
            className={phone ? 'max-h-[52%]' : 'w-[340px]'}
            onEdit={() => onEditEco(panelEco)}
            onClose={() => onSelectEco(null)}
          />
        ) : null}

        {tipNode && tipSim ? (
          <MapTooltip
            id={tooltipId}
            node={tipNode}
            eco={tipNode.kind === 'ecosystem' ? ecos.get(tipNode.ref_id) : undefined}
            anchor={{ x: tipSim.x * v.k + v.x, y: tipSim.y * v.k + v.y, r: tipSim.r * v.k }}
            canvas={size}
            docked={phone}
            touch={coarse || phone}
            onOpen={() => activate(tipNode.id)}
          />
        ) : null}
      </div>

      <MapLegend showLeads={showLeads} />
    </div>
  );
}
