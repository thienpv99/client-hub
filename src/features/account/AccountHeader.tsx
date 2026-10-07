// Account header (SPEC §4.2, DESIGN §5 detail page): logo 40 + name, badges row (health, tier, stage), key facts
// inline (AM, contract value, next milestone), "Xem như khách hàng", underline tabs.
// Two stacked sticky rows (DESIGN §7.2): the identity row (logo, name, "Xem như khách hàng") sticks under the app
// top bar (top-14) and the tab bar under it (top-[112px]); the badges and facts in between scroll away. Sticky rows
// never change height, so nothing below them jumps while scrolling.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil } from 'lucide-react';
import type { AccountDetail } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AccountLogo } from '@/components/common/account-logo';
import { ForecastLabel } from '@/components/common/forecast-label';
import { HealthBadge, healthLabel } from '@/components/common/health-badge';
import { enumLabel } from '@/components/common/labels';
import { Money } from '@/components/common/money';
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
  if (top < STICK_TOP) window.scrollTo({ top: window.scrollY + top - STICK_TOP + 1 });
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

function ViewAsButton({ accountId }: { accountId: string }) {
  const navigate = useNavigate();
  const { run, pending } = useAction();

  async function start() {
    const viewer = await run(() => api.startViewAsClient(accountId));
    if (viewer) navigate('/portal');
  }

  return (
    <>
      {/* phones: the icon alone keeps the name readable; the label stays the accessible name and tooltip */}
      <Button
        variant="secondary"
        size="icon"
        onClick={() => void start()}
        loading={pending}
        aria-label={t('account.header.viewAs')}
        title={t('account.header.viewAsTitle')}
        className="sm:hidden"
      >
        <Eye aria-hidden="true" />
      </Button>
      <Button
        variant="secondary"
        onClick={() => void start()}
        loading={pending}
        title={t('account.header.viewAsTitle')}
        className="hidden sm:inline-flex"
      >
        {pending ? null : <Eye aria-hidden="true" />}
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
}

export function AccountHeader({ account, access, tabs }: AccountHeaderProps) {
  // no wrapping element: a sticky row only sticks inside its parent, so both bands are children of the page root
  return (
    <>
      {/* the way back ("Khách hàng") is in the app top bar: breadcrumb from md, "‹ Khách hàng" on phones */}
      <div className={cn(STICKY_BAND, 'top-14 flex h-14 items-center gap-3 md:gap-4')}>
        <AccountLogo account={account} className="h-10 w-10 text-[14px]" />
        <h1
          className="min-w-0 flex-1 truncate text-heading font-semibold tracking-tightish text-ink sm:text-title"
          title={account.name}
        >
          {account.name}
        </h1>
        {access.manage ? <ViewAsButton accountId={account.id} /> : null}
      </div>

      {/* under the name from sm: logo 40 + gap 12/16 */}
      <div className="sm:pl-[52px] md:pl-14">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <HealthControl account={account} canEdit={access.manage} />
          <Badge title={t('account.header.tier')}>{enumLabel('tier', account.tier)}</Badge>
          <Badge title={t('account.header.stageTitle')}>{enumLabel('stage', account.stage)}</Badge>
          {/* phones: the industry would take a line of its own above the fold — the facts matter more */}
          {account.industry ? <span className="hidden text-caption sm:inline">{account.industry}</span> : null}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 md:flex md:flex-wrap md:items-start md:gap-x-10">
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
