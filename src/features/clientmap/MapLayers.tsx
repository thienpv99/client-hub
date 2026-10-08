// SVG layers under the bubbles: the ground of each ecosystem (selected one outlined) and the links hub ↔ member.
// Both follow the bubbles' entrance (mapModel.introScale): the ground grows and fades with its bubble, the links
// fade in as the bubbles land.
import type { ClientMapLink } from '@/services/crmContract';
import { cn } from '@/components/ui/cn';
import type { ForceSim } from './forceSim';
import { introScale } from './mapModel';

export interface MapLinksProps {
  sim: ForceSim;
  links: ClientMapLink[];
  /** hovered / focused / selected bubble: its links turn primary, the others fade */
  focusId: string | null;
  /** bubbles in the highlighted cluster (or search matches) */
  emphasis: Set<string> | null;
  /** search matches: links between two matches stay, the others fade */
  matches: Set<string> | null;
  /** 1 / zoom: constant on-screen stroke at any zoom */
  s: number;
}

/** links fade in with the entrance: the mean entrance progress of the bubbles (1 once they have all landed) */
function linksFade(sim: ForceSim): number {
  if (sim.nodes.length === 0) return 1;
  let sum = 0;
  for (const n of sim.nodes) sum += Math.max(0, Math.min(1, n.grow));
  return sum / sim.nodes.length;
}

export function MapLinks({ sim, links, focusId, emphasis, matches, s }: MapLinksProps) {
  const fade = linksFade(sim);
  return (
    // the fade sits on the group (the lines transition their own opacity on hover / search)
    <g aria-hidden="true" opacity={fade < 1 ? fade * fade : undefined}>
      {links.map((l) => {
        const a = sim.byId.get(l.source);
        const b = sim.byId.get(l.target);
        if (!a || !b) return null;
        const inCluster = focusId !== null && emphasis !== null && emphasis.has(l.source) && emphasis.has(l.target);
        const lit = inCluster || focusId === l.source || focusId === l.target;
        return (
          <line
            key={`${l.source}>${l.target}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            strokeWidth={(lit ? 2 : 1.5) * s}
            strokeLinecap="round"
            className={cn(
              'transition-opacity duration-200',
              // at rest a quiet blue stem between hub and member (primary-border alone vanished on the dotted canvas)
              lit ? 'stroke-primary' : 'stroke-primary/40',
              focusId !== null && !lit && 'opacity-30',
              matches && !(matches.has(l.source) && matches.has(l.target)) && 'opacity-30',
            )}
          />
        );
      })}
    </g>
  );
}

export interface TerritoriesProps {
  sim: ForceSim;
  /** member node id → hub node id */
  hubOf: Map<string, string>;
  /** the selected ecosystem's hub: its ground turns solid with a hairline outline */
  selectedHubId: string | null;
  /** highlighted bubbles (hovered cluster, search): the other groups' ground fades */
  emphasis: Set<string> | null;
  /** 1 / zoom */
  s: number;
}

/**
 * The ground of each ecosystem: every member and its hub drawn again a little larger in one soft blue, so a group
 * reads as one connected shape under its bubbles (members hug their hub, so the links alone are short stems).
 * One group = one opacity layer, so overlapping discs do not stack into darker patches.
 */
export function Territories({ sim, hubOf, selectedHubId, emphasis, s }: TerritoriesProps) {
  const groups = new Map<string, string[]>();
  for (const [member, hub] of hubOf) {
    const list = groups.get(hub) ?? [hub];
    list.push(member);
    groups.set(hub, list);
  }
  const discs = (ids: string[], pad: number, cls: string, strokeWidth?: number) =>
    ids.map((id) => {
      const n = sim.byId.get(id);
      if (!n) return null;
      const entering = n.grow < 1;
      return (
        <circle
          key={id}
          cx={n.x}
          cy={n.y}
          r={(n.r + pad) * (entering ? introScale(n.grow) : 1)}
          opacity={entering ? Math.max(0, n.grow) : undefined}
          className={cls}
          strokeWidth={strokeWidth}
        />
      );
    });
  return (
    <g aria-hidden="true">
      {[...groups.values()].map((ids) => {
        const hub = ids[0];
        if (hub === selectedHubId) {
          // outline of the union: every disc stroked, then the same discs filled (opaque) over the inner halves
          return (
            <g key={hub}>
              {discs(ids, 14 * s, 'fill-none stroke-primary/45', 3 * s)}
              {discs(ids, 14 * s, 'fill-primary-soft')}
            </g>
          );
        }
        const faded = emphasis !== null && !emphasis.has(hub);
        return (
          // primary-soft alone vanishes on the subtle canvas: a 7% wash of the primary reads as a quiet blue ground
          <g key={hub} opacity={faded ? 0.025 : 0.07} className="transition-opacity duration-200">
            {discs(ids, 10 * s, 'fill-primary')}
          </g>
        );
      })}
    </g>
  );
}
