// Lightweight force simulation for the client map — d3-force semantics (velocity Verlet with alpha decay), written
// here so no new package is needed. Forces: link spring (hub ↔ member), weak many-body repulsion, centering
// (stretched to the canvas aspect), a pull of members toward their hub, and collision (r + 2). The result is a
// tightly packed cloud ("crypto bubbles"): members hug their hub, clusters and single companies pack around them.
// World coordinates are centred on (0, 0); the view transform maps them onto the canvas.

export const ALPHA_MIN = 0.001;
const ALPHA_DECAY = 1 - Math.pow(ALPHA_MIN, 1 / 300);
/** 1 − velocity decay (d3 default 0.4) */
const VELOCITY_KEEP = 0.6;
/** room between two bubbles (world px); keep in step with mapModel PAD */
export const COLLIDE_PAD = 4;
/** gap between a hub and its members: the link stays visible as a short stem */
export const LINK_GAP = 12;
const COLLIDE_STRENGTH = 0.85;
const CENTER_STRENGTH = 0.2;
const HUB_PULL = 0.12;
/** many-body repulsion is only a nudge (bubbles pack tightly); short range */
const CHARGE_PER_R = 0.08;
const CHARGE_MAX_DIST2 = 400 * 400;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface SimNode {
  id: string;
  /** current radius (tweened by the caller when the metric changes) */
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** fixed position while dragged */
  fx: number | null;
  fy: number | null;
  /** id of the ecosystem hub this node hangs off (members only) */
  hubId: string | null;
  isHub: boolean;
  /** ordering weight for the initial spiral (value) */
  weight: number;
  /** drawn size 0…1 (entrance animation); the forces and the fit always use `r` */
  grow: number;
}

interface SimLink {
  s: SimNode;
  t: SimNode;
  strength: number;
  bias: number;
}

export class ForceSim {
  readonly nodes: SimNode[];
  readonly byId: Map<string, SimNode>;
  alpha = 1;
  alphaTarget = 0;
  private readonly links: SimLink[];
  private sx = CENTER_STRENGTH;
  private sy = CENTER_STRENGTH;
  private seed = 7;

  constructor(nodes: SimNode[], links: { source: string; target: string }[], aspect: number) {
    this.nodes = nodes;
    this.byId = new Map(nodes.map((n) => [n.id, n]));
    const count = new Map<string, number>();
    const pairs: [SimNode, SimNode][] = [];
    for (const l of links) {
      const s = this.byId.get(l.source);
      const t = this.byId.get(l.target);
      if (!s || !t || s === t) continue;
      pairs.push([s, t]);
      count.set(s.id, (count.get(s.id) ?? 0) + 1);
      count.set(t.id, (count.get(t.id) ?? 0) + 1);
    }
    this.links = pairs.map(([s, t]) => {
      const cs = count.get(s.id) ?? 1;
      const ct = count.get(t.id) ?? 1;
      return { s, t, strength: 0.8 / Math.min(cs, ct), bias: cs / (cs + ct) };
    });
    this.setAspect(aspect);
  }

  /**
   * A wide canvas pulls less horizontally so the bubbles spread to its shape. The cubed ratio lets the cloud grow a
   * little wider than the canvas within the 300 ticks; `reshape` then presses it back, which packs it tightly
   * (measured with the demo data: ~0.5 of the canvas covered at 1440×900, iPad and phone sizes).
   */
  setAspect(aspect: number): void {
    const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    this.sx = CENTER_STRENGTH * Math.min(1, 1 / a) ** 3;
    this.sy = CENTER_STRENGTH * Math.min(1, a) ** 3;
  }

  get settled(): boolean {
    return this.alpha < ALPHA_MIN && this.alphaTarget === 0;
  }

  /** deterministic tiny offset for coincident points (keeps layouts reproducible) */
  private jiggle(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return ((this.seed / 2147483647) - 0.5) * 1e-6;
  }

  /** runs `n` ticks synchronously (first paint, reduced motion) */
  run(n: number): void {
    for (let i = 0; i < n && !this.settled; i++) this.tick();
  }

  /**
   * Gives a settled cloud the proportions of the canvas (`aspect` = width / height) so the fitted map fills it:
   * a smooth area-preserving stretch about the centre (clusters stay whole), then a short cool-down resolves the
   * overlaps it made. Deterministic; a few passes at most.
   */
  reshape(aspect: number, passes = 3): void {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    for (let p = 0; p < passes; p++) {
      const b = boundsOf(this.nodes);
      if (!b) return;
      const ratio = aspect / Math.max(0.01, (b.maxX - b.minX) / Math.max(1, b.maxY - b.minY));
      if (ratio > 0.92 && ratio < 1.08) break;
      const f = Math.sqrt(Math.min(1.8, Math.max(1 / 1.8, ratio)));
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      for (const n of this.nodes) {
        n.x = cx + (n.x - cx) * f;
        n.y = cy + (n.y - cy) / f;
        n.vx = 0;
        n.vy = 0;
      }
      this.alpha = 0.3;
      this.run(160);
    }
    this.alpha = 0;
  }

  /** one step; returns the largest node speed (px per tick) */
  tick(): number {
    this.alpha += (this.alphaTarget - this.alpha) * ALPHA_DECAY;
    const a = this.alpha;
    this.forceLinks(a);
    this.forceCharge(a);
    this.forceCenter(a);
    this.forceCollide();
    let max = 0;
    for (const n of this.nodes) {
      if (n.fx !== null && n.fy !== null) {
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
        continue;
      }
      n.vx *= VELOCITY_KEEP;
      n.vy *= VELOCITY_KEEP;
      n.x += n.vx;
      n.y += n.vy;
      max = Math.max(max, Math.abs(n.vx) + Math.abs(n.vy));
    }
    return max;
  }

  private forceLinks(alpha: number): void {
    for (const { s, t, strength, bias } of this.links) {
      let x = t.x + t.vx - s.x - s.vx || this.jiggle();
      let y = t.y + t.vy - s.y - s.vy || this.jiggle();
      let l = Math.sqrt(x * x + y * y);
      const distance = s.r + t.r + LINK_GAP;
      l = ((l - distance) / l) * alpha * strength;
      x *= l;
      y *= l;
      t.vx -= x * bias;
      t.vy -= y * bias;
      s.vx += x * (1 - bias);
      s.vy += y * (1 - bias);
    }
  }

  private forceCharge(alpha: number): void {
    const nodes = this.nodes;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const qa = -(1 + a.r * CHARGE_PER_R);
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x || this.jiggle();
        const dy = b.y - a.y || this.jiggle();
        let d2 = dx * dx + dy * dy;
        if (d2 > CHARGE_MAX_DIST2) continue;
        if (d2 < 1) d2 = 1;
        const qb = -(1 + b.r * CHARGE_PER_R);
        const fa = (qb * alpha) / d2;
        a.vx += dx * fa;
        a.vy += dy * fa;
        const fb = (qa * alpha) / d2;
        b.vx -= dx * fb;
        b.vy -= dy * fb;
      }
    }
  }

  private forceCenter(alpha: number): void {
    for (const n of this.nodes) {
      const hub = n.hubId ? this.byId.get(n.hubId) : undefined;
      // members follow their hub; the hub carries the cluster toward the centre
      const k = hub ? 0.1 : 1;
      n.vx -= n.x * this.sx * k * alpha;
      n.vy -= n.y * this.sy * k * alpha;
      if (hub) {
        n.vx += (hub.x - n.x) * HUB_PULL * alpha;
        n.vy += (hub.y - n.y) * HUB_PULL * alpha;
      }
    }
  }

  private forceCollide(): void {
    const nodes = this.nodes;
    const strength = COLLIDE_STRENGTH;
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const ra = a.r + COLLIDE_PAD / 2;
        const ra2 = ra * ra;
        const xi = a.x + a.vx;
        const yi = a.y + a.vy;
        const aFixed = a.fx !== null;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const rb = b.r + COLLIDE_PAD / 2;
          const rr = ra + rb;
          let x = xi - b.x - b.vx;
          let y = yi - b.y - b.vy;
          let l = x * x + y * y;
          if (l >= rr * rr) continue;
          if (x === 0) {
            x = this.jiggle();
            l += x * x;
          }
          if (y === 0) {
            y = this.jiggle();
            l += y * y;
          }
          l = Math.sqrt(l);
          l = ((rr - l) / l) * strength;
          x *= l;
          y *= l;
          const rb2 = rb * rb;
          // a dragged node is an immovable obstacle: the other one takes the whole push
          const bFixed = b.fx !== null;
          const shareA = bFixed ? 1 : aFixed ? 0 : rb2 / (ra2 + rb2);
          const shareB = aFixed ? 1 : bFixed ? 0 : 1 - rb2 / (ra2 + rb2);
          a.vx += x * shareA;
          a.vy += y * shareA;
          b.vx -= x * shareB;
          b.vy -= y * shareB;
        }
      }
    }
  }
}

/**
 * Deterministic starting positions: units (hubs with their members, and companies outside any ecosystem) on a
 * sunflower in value order — each one just outside the area the bigger ones already take, so no two clusters start
 * on top of each other — widened along the canvas' long side (`aspect` = width / height); members on a ring around
 * their hub. Nodes found in `prev` keep their previous position.
 */
export function seedLayout(nodes: SimNode[], prev: Map<string, { x: number; y: number }> | null, aspect = 1): void {
  const stretch = Number.isFinite(aspect) && aspect > 0 ? Math.sqrt(aspect) : 1;
  const sxSeed = Math.max(1, stretch);
  const sySeed = Math.max(1, 1 / stretch);
  const membersOf = new Map<string, SimNode[]>();
  for (const n of nodes) {
    if (!n.hubId) continue;
    const list = membersOf.get(n.hubId) ?? [];
    list.push(n);
    membersOf.set(n.hubId, list);
  }
  const byWeight = (a: SimNode, b: SimNode) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const units = nodes.filter((n) => !n.hubId).sort(byWeight);
  const footprint = (u: SimNode): number => {
    const members = membersOf.get(u.id) ?? [];
    const widest = members.reduce((m, x) => Math.max(m, x.r), 0);
    return (members.length > 0 ? u.r + 2 * widest + LINK_GAP : u.r) + COLLIDE_PAD;
  };

  let taken = 0;
  units.forEach((u, i) => {
    const fp = footprint(u);
    const radius = i === 0 ? 0 : Math.sqrt(taken / 0.6) + fp * 0.8;
    taken += fp * fp;
    const p = prev?.get(u.id);
    if (p) {
      u.x = p.x;
      u.y = p.y;
      return;
    }
    const angle = i * GOLDEN_ANGLE;
    u.x = Math.cos(angle) * radius * sxSeed;
    u.y = Math.sin(angle) * radius * sySeed;
  });

  units.forEach((hub, hubIndex) => {
    const members = (membersOf.get(hub.id) ?? []).sort(byWeight);
    members.forEach((m, j) => {
      const p = prev?.get(m.id);
      if (p) {
        m.x = p.x;
        m.y = p.y;
        return;
      }
      const angle = hubIndex * GOLDEN_ANGLE + (j * 2 * Math.PI) / Math.max(1, members.length);
      const d = hub.r + m.r + LINK_GAP;
      m.x = hub.x + Math.cos(angle) * d;
      m.y = hub.y + Math.sin(angle) * d;
    });
  });
}

/** bounding box of the bubbles (world units) */
export function boundsOf(nodes: SimNode[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.r);
    minY = Math.min(minY, n.y - n.r);
    maxX = Math.max(maxX, n.x + n.r);
    maxY = Math.max(maxY, n.y + n.r);
  }
  return { minX, minY, maxX, maxY };
}
