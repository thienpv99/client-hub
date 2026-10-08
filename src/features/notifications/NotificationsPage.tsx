// /app/notifications (SPEC §6): in-app notifications · simulated outbox · notification rules.
// The active tab lives in the URL (`?tab=outbox|rules`) so it can be linked and survives the task drawer param.
// Phones hide the header description: the tab strip right under it already names the three parts.
import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { api } from '@/services/api';
import { PAGE_TABS_BLEED, PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStagger } from '@/hooks/useMotion';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { InboxTab } from './InboxTab';
import { OutboxTab } from './OutboxTab';
import { RulesTab } from './RulesTab';

type Tab = 'inbox' | 'outbox' | 'rules';
const TAB_PARAM = 'tab';

function parseTab(raw: string | null): Tab {
  return raw === 'outbox' || raw === 'rules' ? raw : 'inbox';
}

export function NotificationsPage() {
  const viewer = useViewer();
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get(TAB_PARAM));
  const notifications = useQuery(() => api.listNotifications({ limit: 100 }), [viewer?.user.id], { enabled: !!viewer });
  const unread = (notifications.data ?? []).filter((n) => !n.read_at).length;
  // held here (not in the tab): the inbox rows stagger on the page's first load only, never on a tab switch
  const rise = useStagger(!!notifications.data);

  const setTab = useCallback(
    (value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === 'inbox') next.delete(TAB_PARAM);
          else next.set(TAB_PARAM, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  if (!viewer) return null;

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6 md:space-y-8">
      <PageHeader
        title={t('notify.page.title')}
        description={<span className="hidden sm:inline">{t('notify.page.description')}</span>}
        actionsInline
        actions={
          <Button asChild variant="secondary">
            <Link to="/app/digest">
              <Newspaper aria-hidden="true" />
              {t('notify.page.digest')}
            </Link>
          </Button>
        }
        tabs={
          <TabsList
            variant="underline"
            aria-label={t('notify.page.tabsLabel')}
            className={PAGE_TABS_BLEED}
          >
            <TabsTrigger
              value="inbox"
              count={unread > 0 ? unread : null}
              countLabel={t('notify.page.unread', { count: unread })}
            >
              {t('notify.page.tabs.inbox')}
            </TabsTrigger>
            <TabsTrigger value="outbox">{t('notify.page.tabs.outbox')}</TabsTrigger>
            <TabsTrigger value="rules">{t('notify.page.tabs.rules')}</TabsTrigger>
          </TabsList>
        }
      />
      <TabsContent value="inbox" className="mt-0">
        <InboxTab query={notifications} canMarkRead={!viewer.read_only} rise={rise} />
      </TabsContent>
      <TabsContent value="outbox" className="mt-0">
        <OutboxTab viewer={viewer} />
      </TabsContent>
      <TabsContent value="rules" className="mt-0">
        <RulesTab viewer={viewer} onShowOutbox={() => setTab('outbox')} />
      </TabsContent>
    </Tabs>
  );
}
