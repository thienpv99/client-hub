// Account detail (SPEC §4.2): /app/accounts/:accountId/:tab? — sticky header + URL-synced tabs.
// The browser tab title ("Cỏ Xanh Retail · Client Hub") comes from InternalLayout (breadcrumb leaf).
import { useLayoutEffect, useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { AccountDetail, ApiErrorCode } from '@/services/contract';
import type { AccountCareView } from '@/services/careContract';
import { api } from '@/services/api';
import { useAccountCare } from '@/hooks/useAccountCare';
import { useQuery, type QueryResult } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { CardSkeleton } from '@/components/common/skeletons';
import { AccountTasksTab } from '@/features/tasks/AccountTasksTab';
import { RoadmapTab } from '@/features/roadmap/RoadmapTab';
import { AccountCommercialTab } from '@/features/commercial/AccountCommercialTab';
import { AccountSalesTab } from '@/features/crm/AccountSalesTab';
import { accountAccess } from './accountAccess';
import type { AccountAccess } from './accountAccess';
import { ACCOUNT_TABS, LEGACY_ACCOUNT_TABS, accountTabPath, isAccountTab } from './accountTabs';
import type { AccountTab } from './accountTabs';
import { AccountHeader, keepTabsInView } from './AccountHeader';
import { ActivityTab } from './tabs/ActivityTab';
import { DeliveryTab } from './tabs/DeliveryTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { ExpansionTab } from './tabs/ExpansionTab';
import { OverviewTab } from './tabs/OverviewTab';
import { RelationshipsTab } from './tabs/RelationshipsTab';

function errorCode(error: unknown): ApiErrorCode | null {
  const code: unknown = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' ? (code as ApiErrorCode) : null;
}

/** permission / missing errors replace the page even when older data is still in memory */
function isFinalError(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'forbidden' || code === 'not_found' || code === 'unauthenticated';
}

/** Same frame as the page: identity row, badges, facts, tabs, then the overview's 2/3 + 1/3 columns. */
function AccountPageSkeleton() {
  return (
    // skeleton-reveal: the whole frame (tab hairline included) waits 120 ms, then fades in as one (DESIGN §8.2)
    <div role="status" aria-busy="true" className="skeleton-reveal">
      <span className="sr-only">{t('common.a11y.loading')}</span>
      <div className="flex h-14 items-center gap-3 md:gap-4">
        <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
        <Skeleton className="h-6 w-56 max-w-[60%]" />
        <Skeleton className="ml-auto h-10 w-11 rounded-lg sm:w-44" />
      </div>
      <div className="sm:pl-[52px] md:pl-14">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 md:flex md:gap-x-10">
          {['w-32', 'w-24', 'w-56'].map((w, i) => (
            <div key={w} className={i === 2 ? 'col-span-2 space-y-2' : 'space-y-2'}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className={`h-5 ${w} max-w-full`} />
            </div>
          ))}
        </div>
      </div>
      <div className="-mx-4 mt-5 flex h-11 items-center gap-6 px-4 shadow-[inset_0_-1px_0_0_rgb(var(--border))] md:-mx-6 md:px-6 xl:-mx-8 xl:px-8">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-14 shrink-0" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:mt-8 md:gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 md:space-y-6 xl:col-span-2">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={4} />
        </div>
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}

/** forbidden / not found: the top bar still leads back ("Khách hàng"); the card offers the list as the next step */
function AccountErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <SectionCard>
      <ErrorState error={error} onRetry={onRetry} titleAs="h1" />
      {isFinalError(error) ? (
        <div className="-mt-6 flex justify-center pb-6">
          <Button asChild variant="secondary">
            <Link to="/app/accounts">{t('account.page.backToList')}</Link>
          </Button>
        </div>
      ) : null}
    </SectionCard>
  );
}

interface TabBodyProps {
  tab: AccountTab;
  account: AccountDetail;
  access: AccountAccess;
  /** getAccountCare — one query for the page, shared by the care tabs (refetches after every mutation) */
  care: QueryResult<AccountCareView>;
}

function TabBody({ tab, account, access, care }: TabBodyProps) {
  switch (tab) {
    case 'overview':
      return <OverviewTab account={account} care={care} />;
    case 'delivery':
      return <DeliveryTab account={account} access={access} care={care} />;
    case 'tasks':
      return <AccountTasksTab account={account} />;
    case 'roadmap':
      return <RoadmapTab account={account} />;
    case 'expansion':
      return <ExpansionTab account={account} access={access} care={care} />;
    case 'relationships':
      return <RelationshipsTab account={account} access={access} care={care} />;
    case 'sales':
      return <AccountSalesTab account={account} />;
    case 'commercial':
      return <AccountCommercialTab account={account} />;
    case 'documents':
      return <DocumentsTab account={account} />;
    case 'activity':
      return <ActivityTab account={account} />;
  }
}

/** which tabs this viewer gets (the api refuses the data of the others anyway) */
function visibleTabs(access: AccountAccess): AccountTab[] {
  return ACCOUNT_TABS.filter((tab) => {
    if (tab === 'commercial') return access.commercial;
    if (tab === 'sales') return access.sales;
    // the expansion map is director / AM data (members get no departments, SPEC-CARE §5)
    if (tab === 'expansion') return access.care;
    return true;
  });
}

export function AccountDetailPage() {
  const params = useParams<{ accountId: string; tab?: string }>();
  const accountId = params.accountId ?? '';
  const navigate = useNavigate();
  const location = useLocation();
  const viewer = useViewer();
  const query = useQuery(() => api.getAccount(accountId), [accountId], { enabled: accountId !== '' });
  const account = query.data;
  // internal viewers only (view-as is a client session and never reaches /app); the tabs show its own loading state
  const care = useAccountCare(accountId, { enabled: accountId !== '' && !!viewer && viewer.org_type === 'internal' && !viewer.read_only });
  // a tab switch while scrolled down keeps the tab bar where it is — measured AFTER the new tab committed (the phone
  // header changes height with compactFacts; the panel's min height keeps the anchor reachable while it loads)
  const keepTabs = useRef(false);
  useLayoutEffect(() => {
    if (!keepTabs.current) return;
    keepTabs.current = false;
    keepTabsInView();
  }, [params.tab]);

  if (query.error && (!account || isFinalError(query.error))) {
    return <AccountErrorState error={query.error} onRetry={query.refetch} />;
  }
  if (!account) return <AccountPageSkeleton />;

  const access = accountAccess(viewer, account);
  const tabs = visibleTabs(access);
  const requested = params.tab;
  // old paths keep working ("Liên hệ" → "Quan hệ"), with their query string
  const legacy = requested !== undefined ? LEGACY_ACCOUNT_TABS[requested] : undefined;
  if (legacy) {
    return <Navigate to={`${accountTabPath(account.id, legacy)}${location.search}`} replace />;
  }
  if (requested !== undefined && (!isAccountTab(requested) || !tabs.includes(requested))) {
    return <Navigate to={accountTabPath(account.id)} replace />;
  }
  const current: AccountTab = isAccountTab(requested) ? requested : 'overview';

  function selectTab(value: string) {
    if (!isAccountTab(value) || value === current || !account) return;
    keepTabs.current = true;
    navigate(accountTabPath(account.id, value));
  }

  // "Việc" carries the overdue count (both sides, blocked tasks excluded — same rule as the counters); "Triển khai"
  // carries the delivery-debt count (requests promised without owner / plan, or past their date)
  const overdue = account.counts.overdue_client + account.counts.overdue_internal;
  const debt = care.data?.requests.debt ?? 0;
  const dangerCount = (tab: AccountTab): { count: number; label: string } | null => {
    if (tab === 'tasks' && overdue > 0) return { count: overdue, label: t('account.tabs.overdueCount', { count: overdue }) };
    if (tab === 'delivery' && debt > 0) return { count: debt, label: t('account.tabs.debtCount', { count: debt }) };
    return null;
  };
  // a member's "Quan hệ" holds the contact list only (no relationship map, SPEC-CARE §5): it keeps its plain name
  const tabLabel = (tab: AccountTab): string =>
    tab === 'relationships' && !access.care ? t('account.tabs.contacts') : t(`account.tabs.${tab}`);
  // tab list: 4px between tabs up to xl, so all nine fit at 1024 beside the open sidebar (they scroll below that)

  return (
    <Tabs value={current} onValueChange={selectTab} activationMode="manual">
      <AccountHeader
        account={account}
        access={access}
        compactFacts={current !== 'overview'}
        group={care.data?.account.ecosystem ?? null}
        tabs={
          <TabsList
            variant="underline"
            aria-label={t('account.tabs.label')}
            className="-mx-4 w-auto max-w-none px-4 md:-mx-6 md:gap-1 md:px-6 xl:-mx-8 xl:gap-2 xl:px-8"
          >
            {tabs.map((tab) => {
              const flagged = dangerCount(tab);
              return flagged ? (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  count={flagged.count}
                  countTone="danger"
                  countLabel={flagged.label}
                  title={flagged.label}
                >
                  {tabLabel(tab)}
                </TabsTrigger>
              ) : (
                <TabsTrigger key={tab} value={tab}>
                  {tabLabel(tab)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        }
      />
      {tabs.map((tab) => (
        // min height = the viewport under the sticky rows (112px = AccountHeader STICK_TOP): a tab that first shows a
        // short loading state never makes the page too short to keep the tab bar pinned on a switch
        <TabsContent key={tab} value={tab} className="mt-6 min-h-[calc(100dvh-112px)] focus-visible:ring-offset-background md:mt-8">
          <TabBody tab={tab} account={account} access={access} care={care} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
