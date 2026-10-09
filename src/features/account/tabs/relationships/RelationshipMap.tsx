// The relationship map (SPEC-CARE §6.4 "Quan hệ" — "highlight các mối quan hệ"): New Era people on the left, the
// client's people grouped by department in the middle, sister companies of the business group on the right.
//   · a line from a New Era person to a client person = who holds that relationship; colour + weight = how close
//     (Thân thiết green, Khá tốt amber, Còn xa grey dashed) — always repeated in words in the legend and the list;
//   · each client person shows the role in the decision (icon) and the attitude to New Era (icon + word);
//   · dotted arcs on the right edge = who reports to whom inside the client;
//   · blue dashed lines to "Trong tập đoàn" chips = people in sister companies (the chip opens that account).
// Edges are SVG; nodes are HTML on top (real text, truncation, focus rings). Hover / focus a node to light up its
// connections and quiet the rest. Layout: mapLayout.ts (fixed columns, barycentre placement).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Link2, Megaphone, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Influence } from '@/domain/careTypes';
import type { StakeholderView } from '@/services/careContract';
import { addressName } from '@/domain/naming';
import { useArrivalMotion } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { StanceBadge } from '@/components/care/badges';
import { AccountLogo } from '@/components/common/account-logo';
import { UserAvatar } from '@/components/common/user-avatar';
import { shortPersonName } from '@/features/dashboard/portfolioModel';
import { accountTabPath } from '../../accountTabs';
import { layoutMap, PERSON_H_TALL } from './mapLayout';
import type { ChipNode, MapEdge, MapInput, NeNode, NeRole, PersonNode } from './mapLayout';

/** column header row above the drawing */
const HEAD = 28;

const INFLUENCE_ICONS: Partial<Record<Influence, LucideIcon>> = {
  decision_maker: Crown,
  influencer: Megaphone,
  gatekeeper: Shield,
};

/** literal class names per edge style (the standalone build precompiles CSS from literal tokens) */
function edgeClass(e: MapEdge): string {
  if (e.kind === 'hold') {
    return e.strength === 'strong' ? 'stroke-success' : e.strength === 'warm' ? 'stroke-warning' : 'stroke-caption';
  }
  if (e.kind === 'cross') return 'stroke-chart-2';
  if (e.kind === 'peer') return 'stroke-chart-3';
  return 'stroke-caption';
}

function edgeWidth(e: MapEdge): number {
  if (e.kind === 'hold') return e.strength === 'strong' ? 2.5 : e.strength === 'warm' ? 2 : 1.5;
  if (e.kind === 'cross') return 1.75;
  return 1.25;
}

function edgeDash(e: MapEdge): string | undefined {
  if (e.kind === 'hold') return e.strength === 'cold' ? '5 4' : undefined;
  if (e.kind === 'cross' || e.kind === 'peer') return '6 4';
  return '2 3';
}

function roleLabel(role: NeRole, user: NeNode['user']): string {
  if (role === 'am') return t('careAccount.relationships.map.am');
  if (role === 'director') return t('careAccount.relationships.map.director');
  return user.title ?? '';
}

/** the chip's relation phrase, from the remote person's side ("đã giới thiệu", "là cấp trên", …) */
function crossPhrase(chip: ChipNode): string {
  const kinds = [...new Set(chip.relations.map((r) => r.kind))];
  return kinds
    .map((k) => {
      if (k === 'introduced') return t(chip.remoteIsFrom ? 'careAccount.relationships.map.cross.introducedFrom' : 'careAccount.relationships.map.cross.introducedTo');
      if (k === 'reports_to') return t(chip.remoteIsFrom ? 'careAccount.relationships.map.cross.reportsFrom' : 'careAccount.relationships.map.cross.reportsTo');
      return t(`careAccount.relationships.map.cross.${k}`);
    })
    .join(', ');
}

export interface RelationshipMapProps {
  accountId: string;
  accountShortName: string;
  input: MapInput;
  /** a client person was chosen (open the relationship sheet) */
  onSelectPerson?: (contactId: string) => void;
}

export function RelationshipMap({ accountId, accountShortName, input, onSelectPerson }: RelationshipMapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const arrival = useArrivalMotion();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => layoutMap(input, width), [input, width]);
  // the layout narrows its nodes for a small shortfall: a real sideways scroll is a phone-sized one
  const scrolls = width > 0 && layout.width > width + 1;

  // phones: open the map on the client's people (what the director came for), not on the New Era column
  const placed = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !scrolls || placed.current) return;
    placed.current = true;
    el.scrollLeft = Math.max(0, layout.columns.client.x - 48);
  }, [scrolls, layout.columns.client.x]);

  // what lights up with the focused node: its edges and the nodes at their other ends
  const lit = useMemo(() => {
    if (!focus) return null;
    const keys = new Set<string>([focus]);
    for (const e of layout.edges) {
      if (e.a === focus || e.b === focus) {
        keys.add(e.key);
        keys.add(e.a);
        keys.add(e.b);
      }
    }
    return keys;
  }, [focus, layout.edges]);
  const dim = (key: string): boolean => !!lit && !lit.has(key);

  const people = new Map(input.people.map((p) => [p.contact_id, p]));
  const focusHandlers = (key: string) => ({
    onPointerEnter: () => setFocus(key),
    onPointerLeave: () => setFocus((f) => (f === key ? null : f)),
    // keyboard focus lights the node up; focus given back by a closing sheet after a click does not keep it lit
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(':focus-visible')) setFocus(key);
    },
    onBlur: () => setFocus((f) => (f === key ? null : f)),
  });

  function personAria(p: StakeholderView): string {
    const manager = p.reports_to_contact_id ? people.get(p.reports_to_contact_id) : undefined;
    const holder = p.ne_owner
      ? t('careAccount.relationships.map.holderAria', { name: p.ne_owner.full_name, strength: p.strength_label })
      : t('careAccount.relationships.map.noHolderAria');
    const base = t('careAccount.relationships.map.personAria', {
      name: p.contact.full_name,
      title: p.contact.title,
      influence: p.influence_label,
      stance: p.stance_label,
      holder,
    });
    return manager ? `${base} ${t('careAccount.relationships.map.reportsAria', { name: manager.contact.full_name })}` : base;
  }

  return (
    <div>
      {/* above the map: on a phone the map is taller than the screen, a hint under it would come too late */}
      {scrolls ? <p className="mb-2 text-micro text-muted-foreground">{t('careAccount.relationships.map.scrollHint')}</p> : null}
      <div ref={scrollRef} className="no-scrollbar overflow-x-auto overscroll-x-contain" role="group" aria-label={t('careAccount.relationships.map.aria', { account: accountShortName })}>
        <div className="relative" style={{ width: layout.width, height: layout.height + HEAD }}>
          {/* column headers */}
          <p className="absolute top-0 text-micro font-medium text-muted-foreground" style={{ left: layout.columns.ne.x }}>
            {t('careAccount.relationships.map.columnNewEra')}
          </p>
          <p className="absolute top-0 truncate text-micro font-medium text-muted-foreground" style={{ left: layout.columns.client.x + 8, width: layout.columns.client.w - 16 }}>
            {t('careAccount.relationships.map.columnClient', { account: accountShortName })}
          </p>
          {layout.columns.cross ? (
            <p className="absolute top-0 text-micro font-medium text-muted-foreground" style={{ left: layout.columns.cross.x }}>
              {t('careAccount.relationships.map.columnGroup')}
            </p>
          ) : null}

          <div className="absolute inset-x-0 bottom-0" style={{ top: HEAD }}>
            {/* department groups (behind everything) */}
            {layout.groups.map((g) => (
              <div
                key={g.key}
                className="absolute rounded-xl bg-subtle ring-1 ring-inset ring-border/60"
                style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
              >
                <p className="flex h-7 items-center gap-1.5 px-2.5 text-micro font-medium text-muted-foreground">
                  <span className="truncate">{g.department ? t(`care.department.${g.department}`) : t('careAccount.relationships.map.noDepartment')}</span>
                  <span className="tabular">· {g.count}</span>
                </p>
              </div>
            ))}

            {/* edges */}
            <svg
              aria-hidden="true"
              width={layout.width}
              height={layout.height}
              className={cn('pointer-events-none absolute left-0 top-0 overflow-visible', arrival && 'animate-fade-in')}
            >
              {layout.edges.map((e) => (
                <g key={e.key} className={cn('transition-opacity duration-150 ease-out-quart', dim(e.key) ? 'opacity-10' : 'opacity-90')}>
                  <path d={e.d} fill="none" className={edgeClass(e)} strokeWidth={edgeWidth(e)} strokeDasharray={edgeDash(e)} strokeLinecap="round" />
                  {e.arrow ? <path d={e.arrow} fill="none" className={edgeClass(e)} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /> : null}
                  {e.dot ? <circle cx={e.dot.x} cy={e.dot.y} r={2.25} className={cn(edgeClass(e), 'fill-card')} strokeWidth={1.25} /> : null}
                </g>
              ))}
            </svg>

            {/* New Era people */}
            {layout.ne.map((n) => (
              <button
                key={n.key}
                type="button"
                {...focusHandlers(n.key)}
                aria-label={t('careAccount.relationships.map.neAria', { name: n.user.full_name, role: roleLabel(n.role, n.user), count: n.holds })}
                className={cn(
                  'absolute flex items-center gap-2 rounded-lg border px-2.5 text-left shadow-xs transition-opacity duration-150 ease-out-quart',
                  n.holds > 0 ? 'border-border/80 bg-card' : 'border-dashed border-border-strong bg-subtle',
                  dim(n.key) ? 'opacity-30' : 'opacity-100',
                )}
                style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
              >
                <UserAvatar user={n.user} size="sm" />
                {/* short name ("Thu Hà") so it fits the compact column; the full name and role are in the tooltip and label */}
                <span className="min-w-0 flex-1" title={`${n.user.full_name} · ${roleLabel(n.role, n.user)}`}>
                  <span className="block truncate text-[13px] font-semibold leading-[18px] text-ink">{shortPersonName(n.user.full_name)}</span>
                  {/* the role may take two lines in the compact column ("Phân tích nghiệp vụ (BA)") */}
                  <span className="line-clamp-2 break-words text-micro leading-4 text-muted-foreground">{roleLabel(n.role, n.user)}</span>
                </span>
                <span
                  aria-hidden="true"
                  title={n.holds > 0 ? t('careAccount.relationships.map.holds', { count: n.holds }) : t('careAccount.relationships.map.holdsNone')}
                  className={cn(
                    'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-micro font-semibold tabular',
                    n.holds > 0 ? 'bg-muted text-foreground' : 'bg-card text-muted-foreground ring-1 ring-inset ring-border-strong',
                  )}
                >
                  {n.holds}
                </span>
              </button>
            ))}

            {/* client people */}
            {layout.people.map((node: PersonNode) => {
              const p = node.person;
              const Icon = INFLUENCE_ICONS[p.influence];
              return (
                <button
                  key={node.key}
                  type="button"
                  {...focusHandlers(node.key)}
                  onClick={onSelectPerson ? () => onSelectPerson(p.contact_id) : undefined}
                  aria-label={personAria(p)}
                  className={cn(
                    'absolute flex items-start gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left shadow-xs transition-[opacity,box-shadow] duration-150 ease-out-quart hover:shadow-card-hover',
                    p.ne_owner ? 'border-border/80' : 'border-dashed border-warning/60',
                    dim(node.key) ? 'opacity-30' : 'opacity-100',
                  )}
                  style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
                >
                  <UserAvatar user={{ full_name: p.contact.full_name, avatar_url: null, org_type: 'client' }} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1">
                      <span className="truncate text-[13px] font-semibold leading-[18px] text-ink" title={p.contact.full_name}>
                        {p.contact.full_name}
                      </span>
                      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" /> : null}
                    </span>
                    {/* a narrow column (node.h = PERSON_H_TALL) gives the job title two lines instead of an ellipsis */}
                    <span
                      className={cn('block break-words text-micro text-muted-foreground', node.h >= PERSON_H_TALL ? 'line-clamp-2' : 'truncate')}
                      title={p.contact.title}
                    >
                      {p.contact.title || p.influence_label}
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5">
                      <StanceBadge stance={p.stance} />
                      {p.ne_owner ? null : <span className="truncate text-micro font-medium text-warning">{t('careAccount.relationships.map.noHolder')}</span>}
                    </span>
                  </span>
                </button>
              );
            })}

            {/* sister companies */}
            {layout.chips.map((c) => {
              const name = c.end.full_name;
              const sentence = c.relations.map((r) => r.sentence).join(' · ');
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    {/* the person's name is never cut: two lines when the column is narrow */}
                    <span className="flex min-w-0 items-start gap-1">
                      <span className="line-clamp-2 break-words text-[13px] font-semibold leading-[18px] text-ink">{name}</span>
                      {c.end.accessible ? <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> : null}
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-micro text-foreground">
                      <AccountLogo account={c.end.account} size="xs" />
                      <span className="truncate">{c.end.account.short_name || c.end.account.name}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 break-words text-micro text-muted-foreground" title={crossPhrase(c)}>
                      {crossPhrase(c)}
                    </span>
                  </span>
                </>
              );
              const className = cn(
                'absolute flex items-center gap-2 rounded-lg border border-chart-3 bg-card px-2.5 text-left shadow-xs transition-[opacity,box-shadow] duration-150 ease-out-quart',
                dim(c.key) ? 'opacity-30' : 'opacity-100',
              );
              const style = { left: c.x, top: c.y, width: c.w, height: c.h };
              return c.end.accessible ? (
                <Link
                  key={c.key}
                  to={accountTabPath(c.end.account.id, 'relationships')}
                  {...focusHandlers(c.key)}
                  aria-label={`${sentence}. ${t('careAccount.relationships.map.openAccount', { account: c.end.account.name })}`}
                  title={sentence}
                  className={cn(className, 'hover:shadow-card-hover')}
                  style={style}
                >
                  {body}
                </Link>
              ) : (
                <div key={c.key} {...focusHandlers(c.key)} tabIndex={0} role="note" aria-label={sentence} title={sentence} className={className} style={style}>
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Legend hasCross={!!layout.columns.cross} hasReports={layout.edges.some((e) => e.kind === 'reports')} />
    </div>
  );
}

function LineSample({ className, width, dash }: { className: string; width: number; dash?: string }) {
  return (
    <svg aria-hidden="true" width="28" height="8" className="shrink-0">
      <path d="M 1 4 L 27 4" className={className} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Legend({ hasCross, hasReports }: { hasCross: boolean; hasReports: boolean }) {
  const item = 'inline-flex items-center gap-1.5 whitespace-nowrap';
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-micro text-muted-foreground">
      <span className={item}>
        <LineSample className="stroke-success" width={2.5} />
        {t('careAccount.relationships.map.legend.strong')}
      </span>
      <span className={item}>
        <LineSample className="stroke-warning" width={2} />
        {t('careAccount.relationships.map.legend.warm')}
      </span>
      <span className={item}>
        <LineSample className="stroke-caption" width={1.5} dash="5 4" />
        {t('careAccount.relationships.map.legend.cold')}
      </span>
      {hasReports ? (
        <span className={item}>
          <LineSample className="stroke-caption" width={1.25} dash="2 3" />
          {t('careAccount.relationships.map.legend.reports')}
        </span>
      ) : null}
      {hasCross ? (
        <span className={item}>
          <LineSample className="stroke-chart-2" width={1.75} dash="6 4" />
          {t('careAccount.relationships.map.legend.group')}
        </span>
      ) : null}
      <span className={item}>
        <Crown className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
        {t('careAccount.relationships.map.legend.decisionMaker')}
      </span>
      <span className={item}>
        <Megaphone className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
        {t('careAccount.relationships.map.legend.influencer')}
      </span>
      <span className={item}>
        <Shield className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
        {t('careAccount.relationships.map.legend.gatekeeper')}
      </span>
    </div>
  );
}

/** "chị Lan" — how a client person is named in sentences */
export function personAddress(p: StakeholderView): string {
  return addressName(p.contact.salutation, p.contact.full_name);
}
