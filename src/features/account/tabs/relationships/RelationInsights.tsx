// "Điểm cần chú ý" above the relationship map: the few sentences a director needs before reading the map — how close
// New Era is to the decision maker, whether there is a champion, who is sceptical, who nobody at New Era holds, and
// whether one person holds too many of the relationships. Plus the strength split (n thân thiết · n khá tốt · n còn xa).
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StakeholderView } from '@/services/careContract';
import { dateOf, todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { capitalize, t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { SectionCard } from '@/components/common/section-card';
import { personAddress } from './RelationshipMap';

type Tone = 'warn' | 'ok' | 'info';

interface Insight {
  key: string;
  tone: Tone;
  text: string;
}

const TONES: Record<Tone, { icon: LucideIcon; text: string; soft: string }> = {
  warn: { icon: TriangleAlert, text: 'text-warning', soft: 'bg-warning-soft' },
  ok: { icon: CircleCheck, text: 'text-success', soft: 'bg-success-soft' },
  info: { icon: Info, text: 'text-muted-foreground', soft: 'bg-muted' },
};

const MAX_NAMES = 3;

function names(list: StakeholderView[], withDepartment = false): string {
  const shown = list.slice(0, MAX_NAMES).map((p) => (withDepartment && p.department_label ? `${personAddress(p)} (${p.department_label})` : personAddress(p)));
  const rest = list.length - shown.length;
  return rest > 0 ? t('careAccount.relationships.summary.andMore', { names: shown.join(', '), count: rest }) : shown.join(', ');
}

/** whole days since the person was last touched (null = never) */
function daysSince(p: StakeholderView, today: string): number | null {
  return p.last_touch_at ? Math.max(0, diffDays(today, dateOf(p.last_touch_at))) : null;
}

/**
 * `cadenceDays` (the account's care rhythm): the people who weigh on the decision — decision makers, influencers,
 * sceptics — not touched for longer than that are named ("Lâu chưa liên hệ: anh Đạt (63 ngày)").
 */
export function relationInsights(people: StakeholderView[], decisionMaker: StakeholderView | null, cadenceDays: number | null = null, today = todayISO()): Insight[] {
  const out: Insight[] = [];
  // every decision maker counts — the riskiest relationship is often the second one (a chairman nobody calls)
  const deciders = [...(decisionMaker ? [decisionMaker] : []), ...people.filter((p) => p.influence === 'decision_maker' && p.contact_id !== decisionMaker?.contact_id)];
  if (deciders.length === 0) out.push({ key: 'dm', tone: 'warn', text: t('careAccount.relationships.summary.dmMissing') });
  else {
    if (deciders.length > 1) out.push({ key: 'dm-many', tone: 'info', text: t('careAccount.relationships.summary.dmMany', { count: deciders.length, names: names(deciders) }) });
    for (const dm of deciders) {
      if (dm.strength === 'cold') out.push({ key: `dm-${dm.contact_id}`, tone: 'warn', text: t('careAccount.relationships.summary.dmCold', { name: capitalize(personAddress(dm)) }) });
    }
    const main = deciders[0];
    if (main && main.strength === 'warm') out.push({ key: 'dm', tone: 'info', text: t('careAccount.relationships.summary.dmWarm', { name: personAddress(main) }) });
    else if (main && main.strength === 'strong') out.push({ key: 'dm', tone: 'ok', text: t('careAccount.relationships.summary.dmStrong', { name: personAddress(main) }) });
  }
  if (cadenceDays !== null) {
    const weighty = people.filter((p) => p.influence === 'decision_maker' || p.influence === 'influencer' || p.stance === 'skeptic' || p.stance === 'blocker');
    const stale = weighty
      .map((p) => ({ p, days: daysSince(p, today) }))
      .filter((x) => x.days === null || x.days > cadenceDays)
      .sort((a, b) => (b.days ?? 10_000) - (a.days ?? 10_000));
    if (stale.length > 0) {
      const shown = stale.slice(0, MAX_NAMES).map((x) => (x.days === null ? personAddress(x.p) : t('careAccount.relationships.summary.staleItem', { name: personAddress(x.p), days: x.days })));
      const rest = stale.length - shown.length;
      const list = rest > 0 ? t('careAccount.relationships.summary.andMore', { names: shown.join(', '), count: rest }) : shown.join(', ');
      out.push({ key: 'stale', tone: 'warn', text: t('careAccount.relationships.summary.stale', { names: list }) });
    }
  }
  const champions = people.filter((p) => p.stance === 'champion');
  if (champions.length === 0) out.push({ key: 'champion', tone: 'warn', text: t('careAccount.relationships.summary.noChampion') });
  else out.push({ key: 'champion', tone: 'ok', text: t('careAccount.relationships.summary.champions', { names: names(champions) }) });
  const doubters = people.filter((p) => p.stance === 'skeptic' || p.stance === 'blocker');
  if (doubters.length > 0) out.push({ key: 'skeptic', tone: 'warn', text: t('careAccount.relationships.summary.skeptics', { names: names(doubters, true) }) });
  const orphans = people.filter((p) => !p.ne_owner);
  if (orphans.length > 0) out.push({ key: 'owner', tone: 'warn', text: t('careAccount.relationships.summary.noOwner', { names: names(orphans) }) });
  // one person holding most relationships is a risk (holiday, leaving)
  const held = people.filter((p) => p.ne_owner);
  if (held.length >= 4) {
    const counts = new Map<string, { name: string; count: number }>();
    for (const p of held) {
      const owner = p.ne_owner;
      if (!owner) continue;
      const c = counts.get(owner.id) ?? { name: owner.full_name, count: 0 };
      c.count += 1;
      counts.set(owner.id, c);
    }
    const top = [...counts.values()].sort((a, b) => b.count - a.count)[0];
    if (top && top.count / people.length >= 0.7) {
      out.push({ key: 'concentration', tone: 'info', text: t('careAccount.relationships.summary.concentration', { name: top.name, count: top.count, total: people.length }) });
    }
  }
  const order: Record<Tone, number> = { warn: 0, info: 1, ok: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

export function RelationInsights({
  people,
  decisionMaker,
  cadenceDays = null,
  className,
}: {
  people: StakeholderView[];
  decisionMaker: StakeholderView | null;
  /** the account's care rhythm (days): weighty people not touched for longer are named */
  cadenceDays?: number | null;
  className?: string;
}) {
  const items = relationInsights(people, decisionMaker, cadenceDays);
  const strong = people.filter((p) => p.strength === 'strong').length;
  const warm = people.filter((p) => p.strength === 'warm').length;
  const cold = people.filter((p) => p.strength === 'cold').length;
  const warnings = items.filter((i) => i.tone === 'warn').length;
  return (
    <SectionCard
      className={className}
      title={t('careAccount.relationships.summary.title')}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="whitespace-nowrap">{t('careAccount.relationships.summary.people', { count: people.length })}</span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
            {t('careAccount.relationships.summary.strong', { count: strong })}
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />
            {t('careAccount.relationships.summary.warm', { count: warm })}
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-caption" />
            {t('careAccount.relationships.summary.cold', { count: cold })}
          </span>
        </span>
      }
    >
      <ul className="space-y-2.5">
        {warnings === 0 ? (
          <li className="flex items-start gap-2.5 text-table text-foreground">
            <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft">
              <CircleCheck className="h-3.5 w-3.5 text-success" />
            </span>
            <span className="min-w-0 text-pretty">{t('careAccount.relationships.summary.allGood')}</span>
          </li>
        ) : null}
        {items.map((i) => {
          const tone = TONES[i.tone];
          const Icon = tone.icon;
          return (
            <li key={i.key} className="flex items-start gap-2.5 text-table text-foreground">
              <span aria-hidden="true" className={cn('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full', tone.soft)}>
                <Icon className={cn('h-3.5 w-3.5', tone.text)} />
              </span>
              <span className="min-w-0 text-pretty">{i.text}</span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
