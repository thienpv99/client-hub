// /app/projects/:tab? — project portfolio (Danh mục · Dòng thời gian · Tải việc), director, AM and member (read-only).
// Header + underline tabs; each tab has its own focal block (portfolio: KPI filters over the list, timeline: the
// cross-project Gantt, workload: the heat map). The tab follows the URL, portfolio filters live in ?query.
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { PAGE_TABS_BLEED, PageHeader } from '@/components/common/page-header';
import { useEntryView } from '@/components/crm/useEntryView';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { PortfolioTab } from './PortfolioTab';
import { TimelineTab } from './TimelineTab';
import { WorkloadTab } from './WorkloadTab';
import { isProjectTab, PROJECT_TABS, projectsTabPath, type ProjectTab } from './projectsModel';
import { useProjectParams } from './useProjectParams';

export function ProjectsPage() {
  const { tab: rawTab } = useParams();
  const navigate = useNavigate();
  const viewer = useViewer();
  const params = useProjectParams();
  const portfolio = useQuery(() => api.listProjectPortfolio(), [viewer?.user.id]);
  // the focal list staggers in on the tab the page was opened on only (a tab switch just fades, DESIGN §8.3)
  const stagger = useEntryView(rawTab ?? 'portfolio');

  if (rawTab !== undefined && !isProjectTab(rawTab)) return <Navigate to="/app/projects" replace />;
  const tab: ProjectTab = rawTab ?? 'portfolio';
  const rows = portfolio.data;

  const description = rows
    ? rows.length === 0
      ? t('projects.page.descriptionEmpty')
      : t('projects.page.description', { total: rows.length, accounts: new Set(rows.map((p) => p.account.id)).size })
    : portfolio.loading
      ? <Skeleton className="mt-1.5 h-4 w-56 max-w-full" />
      : undefined;

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        if (isProjectTab(next) && next !== tab) navigate(projectsTabPath(next));
      }}
    >
      <PageHeader
        title={t('projects.page.title')}
        description={description}
        tabs={
          <TabsList
            variant="underline"
            aria-label={t('projects.tabs.label')}
            className={PAGE_TABS_BLEED}
          >
            {PROJECT_TABS.map((id) => (
              <TabsTrigger key={id} value={id}>
                {t(`projects.tabs.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        }
      />
      <TabsContent value="portfolio" className="mt-6 focus-visible:ring-offset-background md:mt-8">
        {tab === 'portfolio' ? (
          <PortfolioTab rows={rows} loading={portfolio.loading} error={portfolio.error} onRetry={portfolio.refetch} params={params} stagger={stagger} />
        ) : null}
      </TabsContent>
      <TabsContent value="timeline" className="mt-6 focus-visible:ring-offset-background md:mt-8">
        {tab === 'timeline' ? (
          <TimelineTab rows={rows} loading={portfolio.loading} error={portfolio.error} onRetry={portfolio.refetch} />
        ) : null}
      </TabsContent>
      <TabsContent value="workload" className="mt-6 focus-visible:ring-offset-background md:mt-8">
        {tab === 'workload' ? <WorkloadTab stagger={stagger} /> : null}
      </TabsContent>
    </Tabs>
  );
}
