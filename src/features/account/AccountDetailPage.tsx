// Account detail (SPEC §4.2): /app/accounts/:accountId/:tab? — sticky header + URL-synced tabs.
import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { AccountDetail, ApiErrorCode } from '@/services/contract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
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
import { ACCOUNT_TABS, accountTabPath, isAccountTab } from './accountTabs';
import type { AccountTab } from './accountTabs';
import { AccountHeader, keepTabsInView } from './AccountHeader';
import { ActivityTab } from './tabs/ActivityTab';
import { ContactsTab } from './tabs/ContactsTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { OverviewTab } from './tabs/OverviewTab';

function errorCode(error: unknown): ApiErrorCode | null {
  const code: unknown = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' ? (code as ApiErrorCode) : null;
}

/** permission / missing errors replace the page even when older data is still in memory */
function isFinalError(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'forbidden' || code === 'not_found' || code === 'unauthenticated';
}

function useDocumentTitle(name: string | undefined) {
  useEffect(() => {
    if (!name) return undefined;
    const previous = document.title;
    document.title = t('account.page.documentTitle', { name });
    return () => {
      document.title = previous;
    };
  }, [name]);
}

/** Same frame as the page: identity row, badges, facts, tabs, then the overview's 2/3 + 1/3 columns. */
function AccountPageSkeleton() {
  return (
    <div role="status" aria-busy="true">
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
      <ErrorState error={error} onRetry={onRetry} />
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

function TabBody({ tab, account }: { tab: AccountTab; account: AccountDetail }) {
  switch (tab) {
    case 'overview':
      return <OverviewTab account={account} />;
    case 'tasks':
      return <AccountTasksTab account={account} />;
    case 'roadmap':
      return <RoadmapTab account={account} />;
    case 'sales':
      return <AccountSalesTab account={account} />;
    case 'commercial':
      return <AccountCommercialTab account={account} />;
    case 'documents':
      return <DocumentsTab account={account} />;
    case 'contacts':
      return <ContactsTab account={account} />;
    case 'activity':
      return <ActivityTab account={account} />;
  }
}

export function AccountDetailPage() {
  const params = useParams<{ accountId: string; tab?: string }>();
  const accountId = params.accountId ?? '';
  const navigate = useNavigate();
  const viewer = useViewer();
  const query = useQuery(() => api.getAccount(accountId), [accountId], { enabled: accountId !== '' });
  const account = query.data;
  useDocumentTitle(account?.name);

  if (query.error && (!account || isFinalError(query.error))) {
    return <AccountErrorState error={query.error} onRetry={query.refetch} />;
  }
  if (!account) return <AccountPageSkeleton />;

  const access = accountAccess(viewer, account);
  const tabs = ACCOUNT_TABS.filter((tab) => (tab !== 'commercial' || access.commercial) && (tab !== 'sales' || access.sales));
  const requested = params.tab;
  if (requested !== undefined && (!isAccountTab(requested) || !tabs.includes(requested))) {
    return <Navigate to={accountTabPath(account.id)} replace />;
  }
  const current: AccountTab = isAccountTab(requested) ? requested : 'overview';

  function selectTab(value: string) {
    if (!isAccountTab(value) || value === current || !account) return;
    navigate(accountTabPath(account.id, value));
    keepTabsInView();
  }

  // "Việc" carries the overdue count (both sides, blocked tasks excluded — same rule as the counters)
  const overdue = account.counts.overdue_client + account.counts.overdue_internal;
  // tab list: 4px between tabs up to xl, so all eight fit at 1024 beside the open sidebar (they scroll below that)

  return (
    <Tabs value={current} onValueChange={selectTab} activationMode="manual">
      <AccountHeader
        account={account}
        access={access}
        tabs={
          <TabsList
            variant="underline"
            aria-label={t('account.tabs.label')}
            className="-mx-4 w-auto max-w-none px-4 md:-mx-6 md:gap-1 md:px-6 xl:-mx-8 xl:gap-2 xl:px-8"
          >
            {tabs.map((tab) =>
              tab === 'tasks' && overdue > 0 ? (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  count={overdue}
                  countTone="danger"
                  countLabel={t('account.tabs.overdueCount', { count: overdue })}
                  title={t('account.tabs.overdueCount', { count: overdue })}
                >
                  {t(`account.tabs.${tab}`)}
                </TabsTrigger>
              ) : (
                <TabsTrigger key={tab} value={tab}>
                  {t(`account.tabs.${tab}`)}
                </TabsTrigger>
              ),
            )}
          </TabsList>
        }
      />
      {tabs.map((tab) => (
        <TabsContent key={tab} value={tab} className="mt-6 focus-visible:ring-offset-background md:mt-8">
          <TabBody tab={tab} account={account} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
