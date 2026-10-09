// Account header (SPEC §4.2, DESIGN §5 detail page): logo 40 + name, badges row (health, tier, stage), key facts
// inline (AM, contract value, next milestone), "Xem như khách hàng", underline tabs.
// Two stacked sticky rows (DESIGN §7.2): the identity row (logo, name, "Xem như khách hàng") sticks under the app
// top bar (top-14) and the tab bar under it (top-[112px]). Once the badges row has scrolled under the identity row,
// the identity row repeats the key facts compactly (SPEC §4.2 fixed header: health, tier, stage, AM, contract value):
// one line from md (stage on iPad, tier · stage and the AM's name from xl), a second line under the name on phones
// (health, AM, value). Sticky rows never change height, so nothing below them jumps while scrolling.
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Network, Pencil } from 'lucide-react';
import type { AccountDetail } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { jumpScrollTo } from '@/hooks/useMotion';
import { t } from '@/i18n';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AccountLogo } from '@/components/common/account-logo';
import { ForecastLabel } from '@/components/common/forecast-label';
import { HealthBadge, healthLabel } from '@/components/common/health-badge';
import { enumLabel } from '@/components/common/labels';
import { Money } from '@/components/common/money';
import { UserAvatar } from '@/components/common/user-avatar';
import { shortPersonName } from '@/features/dashboard/portfolioModel';
import { matrixHref } from '@/features/clientmap/matrixModel';
import type { AccountAccess } from './accountAccess';
import { AmMenu } from './AmMenu';
import { HealthOverrideDialog } from './HealthOverrideDialog';

/** InternalLayout top bar (h-14) */
const APP_BAR = 56;
/** sticky identity row (h-14) */
const IDENTITY = 56;
/** where the tab bar sticks — keep in step with the `top-[112px]` class below */
const STICK_TOP = APP_BAR + IDENTITY;
const ANCHOR_ID = 'account-tabs-anchor';

/** full-bleed sticky band on the page background (DESIGN §7.2) */
const STICKY_BAND =
  'sticky z-20 -mx-4 bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 md:-mx-6 md:px-6 xl:-mx-8 xl:px-8';

/** After switching tabs while scrolled down: keep the tab bar where it is and show the new tab from its top. */
export function keepTabsInView(): void {
  const anchor = document.getElementById(ANCHOR_ID);
  if (!anchor) return;
  const top = anchor.getBoundingClientRect().top;
  // a jump, not a glide (html has smooth anchor scrolling): the tab bar must not drift while the new tab fades in
  if (top < STICK_TOP) jumpScrollTo(window.scrollY + top - STICK_TOP + 1);
}

/** true once the element has scrolled up under the sticky rows (its bottom above `offset` px from the viewport top) */
function useScrolledUnder(ref: RefObject<HTMLElement | null>, offset: number): boolean {
  const [under, setUnder] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setUnder(!entry.isIntersecting && entry.boundingClientRect.bottom <= offset);
      },
      { rootMargin: `-${offset}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, offset]);
  return under;
}

/**
 * The key facts repeated in the pinned identity row once the badges and facts have scrolled away. Visual only
 * (aria-hidden): the same facts stay in the header above for screen readers; tooltips name each one.
 */
function PinnedFacts({ account, access, className }: { account: AccountDetail; access: AccountAccess; className?: string }) {
  const value = access.commercial && account.contract_value > 0 ? account.contract_value : null;
  const tier = enumLabel('tier', account.tier);
  const stage = enumLabel('stage', account.stage);
  return (
    // fades in as it takes over from the scrolled-away facts (opacity only: the sticky row never changes height)
    <div aria-hidden="true" className={cn('min-w-0 animate-fade-in items-center gap-x-3', className)}>
      <HealthBadge health={account.health.value} size="sm" />
      {/* iPad: the stage alone; from xl: tier · stage */}
      <span
        className="hidden whitespace-nowrap text-caption md:inline"
        title={`${t('account.header.tier')}: ${tier} · ${t('account.header.stageTitle')}: ${stage}`}
      >
        <span className="hidden xl:inline">{tier} · </span>
        {stage}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5" title={`${t('account.header.am')}: ${account.am.full_name}`}>
        <UserAvatar user={account.am} size="xs" className="bg-card" />
        <span className="hidden whitespace-nowrap text-table text-foreground xl:inline">{shortPersonName(account.am.full_name)}</span>
      </span>
      {value !== null ? (
        <span
          className="whitespace-nowrap text-table font-semibold tabular text-ink"
          title={`${t('account.header.contractValue')}: ${formatMoney(value)}`}
        >
          {formatMoneyCompact(value)}
        </span>
      ) : null}
    </div>
  );
}

function Fact({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-caption">{label}</dt>
      <dd className="mt-0.5 flex min-h-8 min-w-0 items-center text-table text-foreground">{children}</dd>
    </div>
  );
}

function HealthControl({ account, canEdit }: { account: AccountDetail; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const health = account.health.value;
  const content = (
    <>
      <HealthBadge health={health} size="sm" />
      {account.health.overridden ? <span className="text-micro text-muted-foreground">{t('account.header.manual')}</span> : null}
    </>
  );
  if (!canEdit) return <span className="inline-flex items-center gap-1.5">{content}</span>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t('account.header.editHealth', { health: healthLabel(health) })}
        title={t('account.header.editHealthHint')}
        className="touch-tap group -my-1 -ml-1 inline-flex h-8 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors duration-150 ease-out-quart hover:bg-muted"
      >
        {content}
        <Pencil
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          aria-hidden="true"
        />
      </button>
      <HealthOverrideDialog account={account} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ViewAsButton({ accountId, pinned }: { accountId: string; pinned: boolean }) {
  const navigate = useNavigate();
  const { run, pending } = useAction();
  const iconRef = useRef<HTMLButtonElement>(null);
  const labelledRef = useRef<HTMLButtonElement>(null);

  // the pinned facts swap the labelled button for the icon one (below xl): keyboard focus follows to the visible one
  useEffect(() => {
    const pair = [iconRef.current, labelledRef.current];
    const active = document.activeElement;
    if (!active || !pair.includes(active as HTMLButtonElement) || (active as HTMLElement).offsetParent !== null) return;
    pair.find((b) => b && b !== active && b.offsetParent !== null)?.focus({ preventScroll: true });
  }, [pinned]);

  async function start() {
    const viewer = await run(() => api.startViewAsClient(accountId));
    if (viewer) navigate('/portal');
  }

  return (
    <>
      {/* phones (and below xl while the key facts are pinned): the icon alone keeps the name readable; the label
          stays the accessible name and tooltip */}
      <Button
        ref={iconRef}
        variant="secondary"
        size="icon"
        onClick={() => void start()}
        loading={pending}
        aria-label={t('account.header.viewAs')}
        title={t('account.header.viewAsTitle')}
        className={pinned ? 'xl:hidden' : 'sm:hidden'}
      >
        <Eye aria-hidden="true" />
      </Button>
      <Button
        ref={labelledRef}
        variant="secondary"
        onClick={() => void start()}
        loading={pending}
        title={t('account.header.viewAsTitle')}
        className={pinned ? 'hidden xl:inline-flex' : 'hidden sm:inline-flex'}
      >
        {/* the Button swaps the icon for its spinner itself (after 150 ms) */}
        <Eye aria-hidden="true" />
        {t('account.header.viewAs')}
      </Button>
    </>
  );
}

function NextMilestoneFact({ account }: { account: AccountDetail }) {
  const m = account.next_milestone;
  if (!m) return <span className="text-muted-foreground">{t('account.header.noMilestone')}</span>;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="min-w-0 font-medium">
        {m.name}
        {account.projects.length > 1 ? <span className="font-normal text-muted-foreground"> · {m.project_name}</span> : null}
      </span>
      <ForecastLabel milestone={m} compact />
    </span>
  );
}

export interface AccountHeaderProps {
  account: AccountDetail;
  access: AccountAccess;
  /** the tab bar (TabsList), kept in the sticky band */
  tabs: ReactNode;
  /**
   * phones only: leave out the key facts (AM, contract value, next milestone — ~150px) so a work tab (Việc, Lộ trình…)
   * starts above the fold; the overview tab keeps them. From sm they always show.
   */
  compactFacts?: boolean;
  /** the business group (director / AM: from the care view) — a chip to the group's matrix */
  group?: { id: string; name: string; short_name: string } | null;
}

export function AccountHeader({ account, access, tabs, compactFacts = false, group = null }: AccountHeaderProps) {
  const badgesRef = useRef<HTMLDivElement>(null);
  const pinned = useScrolledUnder(badgesRef, STICK_TOP);
  // no wrapping element: a sticky row only sticks inside its parent, so both bands are children of the page root
  return (
    <>
      {/* the way back ("Khách hàng") is in the app top bar: breadcrumb from md, "‹ Khách hàng" on phones */}
      <div className={cn(STICKY_BAND, 'top-14 flex h-14 items-center gap-3 md:gap-4')}>
        <AccountLogo account={account} className="h-10 w-10 text-[14px]" />
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              'truncate text-heading font-semibold tracking-tightish text-ink',
              // pinned: on phones the name (24px) and the facts line (24px) share the 56px row; on iPad portrait the
              // facts beside it leave ~200px, so the 17px size keeps "Cơ điện Thiên Trường" whole
              pinned ? 'lg:text-title' : 'sm:text-title',
            )}
            title={account.name}
          >
            {account.name}
          </h1>
          {pinned ? <PinnedFacts account={account} access={access} className="mt-0.5 flex md:hidden" /> : null}
        </div>
        {pinned ? (
          <PinnedFacts account={account} access={access} className="hidden shrink-0 border-l border-border pl-4 md:flex" />
        ) : null}
        {access.manage ? <ViewAsButton accountId={account.id} pinned={pinned} /> : null}
      </div>

      {/* under the name from sm: logo 40 + gap 12/16 */}
      <div className="sm:pl-[52px] md:pl-14">
        <div ref={badgesRef} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <HealthControl account={account} canEdit={access.manage} />
          <Badge title={t('account.header.tier')}>{enumLabel('tier', account.tier)}</Badge>
          <Badge title={t('account.header.stageTitle')}>{enumLabel('stage', account.stage)}</Badge>
          {/* the group this client belongs to → what the whole group uses and could still buy (the matrix) */}
          {group ? (
            <Link
              to={matrixHref(group.id)}
              aria-label={t('careAccount.header.groupLabel', { name: group.name })}
              title={t('careAccount.header.groupLabel', { name: group.name })}
              className="touch-tap inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-card px-2.5 text-micro font-medium text-foreground ring-1 ring-inset ring-border-strong/80 transition-colors duration-150 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Network className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              {t('careAccount.header.group', { name: group.short_name || group.name })}
            </Link>
          ) : null}
          {/* phones: the industry would take a line of its own above the fold — the facts matter more */}
          {account.industry ? <span className="hidden text-caption sm:inline">{account.industry}</span> : null}
        </div>

        <dl
          className={cn(
            'mt-4 grid grid-cols-2 gap-x-4 gap-y-3 md:flex md:flex-wrap md:items-start md:gap-x-10',
            compactFacts && 'hidden sm:grid',
          )}
        >
          <Fact label={t('account.header.am')}>
            <AmMenu account={account} canAssign={access.assignAm} />
          </Fact>
          {access.commercial ? (
            <Fact label={t('account.header.contractValue')}>
              {account.contract_value > 0 ? (
                <Money value={account.contract_value} compact className="font-semibold text-ink" />
              ) : (
                <span className="text-muted-foreground">{t('account.header.noContract')}</span>
              )}
            </Fact>
          ) : null}
          <Fact label={t('account.header.nextMilestone')} className="col-span-2 md:min-w-0 md:flex-1">
            <NextMilestoneFact account={account} />
          </Fact>
        </dl>
      </div>

      <div id={ANCHOR_ID} aria-hidden="true" className="mt-5 h-0" />
      <div className={cn(STICKY_BAND, 'top-[112px]')}>{tabs}</div>
    </>
  );
}
