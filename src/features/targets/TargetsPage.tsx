// /app/targets/:tab? (leads · segments · accounts · icp) and /app/targets/leads/:leadId (lead drawer over the leads
// tab). Director + AM (the route guard sends everyone else away; the api refuses CRM data to them anyway).
// Header (title, the current tab's one primary action, underline tabs) → the tab's content.
import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { PAGE_TABS_BLEED, PageHeader } from '@/components/common/page-header';
import { useEntryView } from '@/components/crm/useEntryView';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { t } from '@/i18n';
import { TargetAccountsTab } from './accounts/TargetAccountsTab';
import { IcpTab } from './icp/IcpTab';
import { LeadDrawer } from './leads/LeadDrawer';
import { LeadFormDialog } from './leads/LeadFormDialog';
import { LeadsTab } from './leads/LeadsTab';
import { SegmentsTab } from './segments/SegmentsTab';
import { salesPeople } from './targetLabels';

const TABS = ['leads', 'segments', 'accounts', 'icp'] as const;
type TargetsTab = (typeof TABS)[number];

function isTab(v: string | undefined): v is TargetsTab {
  return v !== undefined && (TABS as readonly string[]).includes(v);
}

export function TargetsPage() {
  const { tab, leadId } = useParams<{ tab?: string; leadId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const viewer = useViewer();
  const isDirector = viewer?.role === 'director';
  const meId = viewer?.user.id ?? '';
  const users = useQuery(() => api.listUsers({ orgType: 'internal' }), [meId]);
  const people = salesPeople(users.data ?? []);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  // bumped by the header's "Tạo phân khúc": the segments tab opens its builder
  const [segmentRequest, setSegmentRequest] = useState(0);

  // the browser tab title (page, or the open lead's company) comes from InternalLayout's breadcrumbs

  const current: TargetsTab = leadId ? 'leads' : isTab(tab) ? tab : 'leads';
  // the focal list staggers in on the tab the page was opened on only (a tab switch just fades, DESIGN §8.3)
  const stagger = useEntryView(current);
  if (!leadId && tab !== undefined && !isTab(tab)) return <Navigate to="/app/targets/leads" replace />;

  function openLead(id: string) {
    navigate({ pathname: `/app/targets/leads/${id}`, search: current === 'leads' ? location.search : '' });
  }

  function closeLead() {
    navigate({ pathname: '/app/targets/leads', search: location.search });
  }

  const action =
    current === 'leads' ? (
      <Button type="button" onClick={() => setLeadFormOpen(true)}>
        <Plus aria-hidden="true" />
        {t('targets.leads.add')}
      </Button>
    ) : current === 'segments' ? (
      <Button type="button" onClick={() => setSegmentRequest((n) => n + 1)}>
        <Plus aria-hidden="true" />
        {t('targets.segments.create')}
      </Button>
    ) : null;

  return (
    <Tabs value={current} onValueChange={(v) => navigate(`/app/targets/${v}`)} className="min-w-0 space-y-6 md:space-y-8">
      <PageHeader
        title={t('targets.title')}
        description={t('targets.intro')}
        actions={action}
        actionsInline
        tabs={
          <TabsList variant="underline" aria-label={t('targets.tabsLabel')} className={PAGE_TABS_BLEED}>
            {TABS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {t(`targets.tabs.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        }
      />

      <TabsContent value="leads" className="mt-0">
        <LeadsTab people={people} isDirector={isDirector} meId={meId} onOpenLead={openLead} onAddLead={() => setLeadFormOpen(true)} stagger={stagger} />
      </TabsContent>
      <TabsContent value="segments" className="mt-0">
        <SegmentsTab isDirector={isDirector} meId={meId} onOpenLead={openLead} createRequest={segmentRequest} stagger={stagger} />
      </TabsContent>
      <TabsContent value="accounts" className="mt-0">
        <TargetAccountsTab stagger={stagger} />
      </TabsContent>
      <TabsContent value="icp" className="mt-0">
        <IcpTab isDirector={isDirector} />
      </TabsContent>

      <LeadDrawer leadId={leadId ?? null} onClose={closeLead} people={people} isDirector={isDirector} meId={meId} />
      <LeadFormDialog
        open={leadFormOpen}
        onOpenChange={setLeadFormOpen}
        lead={null}
        people={people}
        isDirector={isDirector}
        meId={meId}
        onSaved={(l) => openLead(l.id)}
      />
    </Tabs>
  );
}
