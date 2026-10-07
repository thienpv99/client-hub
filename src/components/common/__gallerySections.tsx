// Dev-only: the "Executive Calm" variants of CommonGallery (KPI trend / progress / spark, divided cards, detail header).
import { useState } from 'react';
import { ArrowRight, Banknote, CalendarClock, CircleAlert, Handshake, Pencil, Share2, Target, Wallet } from 'lucide-react';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccountLogo } from './account-logo';
import { ForecastLabel } from './forecast-label';
import { HealthBadge } from './health-badge';
import { KpiCard } from './kpi-card';
import { Money } from './money';
import { PageHeader } from './page-header';
import { SectionCard } from './section-card';
import { SideBadge } from './side-badge';
import { UserAvatar } from './user-avatar';
import { WaitingCountsLine } from './waiting-counts-line';
import * as fx from './__galleryFixtures';

const g = (k: string, p?: Record<string, string | number>) => t(`components.gallery.${k}`, p);

export function KpiVariantsDemo() {
  const [active, setActive] = useState<'receivable' | 'overdue' | null>('overdue');
  const toggle = (k: 'receivable' | 'overdue') => setActive((v) => (v === k ? null : k));
  return (
    <SectionCard title={g('sections.kpiVariants')} description={g('kpiHint')}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label={g('kpi.collected')}
          value={<Money value={4_180_000_000} compact />}
          icon={Banknote}
          trend={{ value: '+12%', direction: 'up', label: g('kpi.vsLastMonth') }}
          sub={g('kpi.collectedSub')}
          progress={{ value: 4, max: 6, label: g('kpi.collectedProgress') }}
        />
        <KpiCard
          label={g('kpi.pipeline')}
          value={<Money value={9_850_000_000} compact />}
          icon={Handshake}
          tone="primary"
          trend={{ value: g('kpi.trendPipeline'), direction: 'up', label: g('kpi.vsLastMonth') }}
          sub={g('kpi.pipelineSub')}
          spark={[5.1, 5.8, 5.4, 6.6, 7.2, 6.9, 8.1, 8.6, 9.85]}
        />
        <KpiCard
          label={g('kpi.overdue')}
          value="5"
          icon={CalendarClock}
          tone="warning"
          trend={{ value: '−3', direction: 'down', good: true, label: g('kpi.vsLastMonth') }}
          sub={g('kpi.overdueTrendSub')}
          onClick={() => toggle('overdue')}
          active={active === 'overdue'}
        />
        <KpiCard
          label={g('kpi.receivable')}
          value={<Money value={1_250_000_000} compact />}
          icon={Wallet}
          tone="danger"
          trend={{ value: '0%', direction: 'flat' }}
          spark={[1.4, 1.3, 1.35, 1.2, 1.28, 1.25]}
          onClick={() => toggle('receivable')}
          active={active === 'receivable'}
          sub={
            <span className="font-medium text-danger">
              <CircleAlert className="-mt-0.5 mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              <Money value={312_000_000} compact /> {g('kpi.receivableOverdue')}
            </span>
          }
        />
        <KpiCard
          label={g('kpi.winRate')}
          value="42%"
          icon={Target}
          trend={{ value: g('kpi.trendWinRate'), direction: 'down', label: g('kpi.vsLastMonth') }}
          sub={g('kpi.winRateSub')}
          className="col-span-2 xl:col-span-1"
        />
      </div>
    </SectionCard>
  );
}

export function CardVariantsDemo() {
  const upcoming = fx.coXanhMilestones.filter((m) => m.status !== 'done').slice(0, 3);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard
        title={g('list.title')}
        description={g('list.description')}
        actions={
          <Button variant="ghost" size="sm">
            {g('list.viewAll')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
        divided
        footer={<span className="text-caption">{g('list.footer')}</span>}
      >
        {upcoming.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="text-table font-medium text-foreground">{m.name}</span>
            <ForecastLabel milestone={m} compact />
          </div>
        ))}
      </SectionCard>
      <SectionCard title={g('sections.counts')} divided>
        {fx.accounts.slice(0, 3).map((a, i) => (
          <div key={a.id} className="flex items-center gap-3">
            <AccountLogo account={a} size="sm" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-table font-semibold text-foreground">{a.name}</span>
                <HealthBadge health={i === 0 ? 'blocked' : i === 1 ? 'attention' : 'on_track'} size="sm" variant="dot" />
              </div>
              <WaitingCountsLine counts={fx.counts[i % fx.counts.length] ?? fx.counts[0]!} showOverdue />
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

export function DetailHeaderDemo() {
  const account = fx.accounts[0] ?? { name: '—', logo_url: null, brand_color: '' };
  return (
    <SectionCard title={g('sections.pageHeader')}>
      <PageHeader
        compact
        back={{ to: '/app/accounts', label: t('components.pageHeader.back') }}
        eyebrow={g('header.eyebrow')}
        title={
          <span className="inline-flex items-center gap-3">
            <AccountLogo account={account} size="md" />
            {g('header.title')}
          </span>
        }
        description={g('header.description')}
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {g('actionDocs')}
            </Button>
            <Button size="sm">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {g('actionNew')}
            </Button>
          </>
        }
        tabs={
          <Tabs defaultValue="overview">
            <TabsList variant="underline">
              <TabsTrigger value="overview">{g('header.tabs.overview')}</TabsTrigger>
              <TabsTrigger value="tasks">{g('header.tabs.tasks')}</TabsTrigger>
              <TabsTrigger value="roadmap">{g('header.tabs.roadmap')}</TabsTrigger>
              <TabsTrigger value="documents">{g('header.tabs.documents')}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge health="blocked" size="sm" />
          <SideBadge side="client" />
          <span className="flex -space-x-2">
            {[fx.minh, fx.lan, fx.ha, fx.tuan].map((u) => (
              <UserAvatar key={u.id} user={u} size="sm" ring />
            ))}
          </span>
        </div>
      </PageHeader>
    </SectionCard>
  );
}
