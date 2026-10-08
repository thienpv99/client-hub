// /app/commercial/:tab? — Báo giá · Hợp đồng & thanh toán · Phải thu · Bảng giá (SPEC §4.5). Tabs follow the URL and
// sit in the PageHeader's tabs slot (underline, DESIGN §3). Each tab opens with its own KPI row (the focal block).
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FilePlus2 } from 'lucide-react';
import { PAGE_TABS_BLEED, PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { COMMERCIAL_TABS, canManageCommercial, isCommercialTab, type CommercialTab } from './lib';
import { QuotesTab } from './components/QuotesTab';
import { ContractsTab } from './components/ContractsTab';
import { ReceivablesTab } from './components/ReceivablesTab';
import { PricesTab } from './components/PricesTab';

export function CommercialPage() {
  const { tab: rawTab } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const viewer = useViewer();

  if (rawTab !== undefined && !isCommercialTab(rawTab)) return <Navigate to="/app/commercial" replace />;
  const tab: CommercialTab = rawTab ?? 'quotes';
  const account = params.get('account');
  const newQuoteHref = account ? `/app/commercial/quotes/new?account=${encodeURIComponent(account)}` : '/app/commercial/quotes/new';
  // the account filter travels with the tabs (quotes / contracts share it)
  const tabHref = (next: CommercialTab) => {
    const base = next === 'quotes' ? '/app/commercial' : `/app/commercial/${next}`;
    return account && (next === 'quotes' || next === 'contracts') ? `${base}?account=${encodeURIComponent(account)}` : base;
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        if (isCommercialTab(next)) navigate(tabHref(next));
      }}
    >
      <PageHeader
        title={t('commercial.page.title')}
        description={t('commercial.page.description')}
        actionsInline
        actions={
          canManageCommercial(viewer) ? (
            <Button asChild>
              <Link to={newQuoteHref}>
                <FilePlus2 aria-hidden="true" />
                {t('commercial.page.createQuote')}
              </Link>
            </Button>
          ) : null
        }
        tabs={
          // gap-0.5 on phones: the four short labels fit 343px without a scrolling strip
          <TabsList variant="underline" aria-label={t('commercial.tabs.label')} className={`${PAGE_TABS_BLEED} gap-0.5 md:gap-2`}>
            {COMMERCIAL_TABS.map((id) => (
              <TabsTrigger key={id} value={id}>
                {t(`commercial.tabs.short.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        }
      />
      <TabsContent value="quotes" className="mt-6 md:mt-8">
        {tab === 'quotes' ? <QuotesTab /> : null}
      </TabsContent>
      <TabsContent value="contracts" className="mt-6 md:mt-8">
        {tab === 'contracts' ? <ContractsTab /> : null}
      </TabsContent>
      <TabsContent value="receivables" className="mt-6 md:mt-8">
        {tab === 'receivables' ? <ReceivablesTab /> : null}
      </TabsContent>
      <TabsContent value="prices" className="mt-6 md:mt-8">
        {tab === 'prices' ? <PricesTab /> : null}
      </TabsContent>
    </Tabs>
  );
}
