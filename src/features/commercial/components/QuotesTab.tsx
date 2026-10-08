// "Báo giá" tab: KPI row of the four workflow states (clickable = status filter, the focal block), a toolbar
// (search · account · status · all versions) and the list: table from xl, cards below. Account / status / versions
// live in the URL so links and "Tạo báo giá" keep the account.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, CircleCheck, Clock, FilePlus2, FileText, MessageSquareWarning, Search, Send } from 'lucide-react';
import type { QuoteStatus, QuoteSummary } from '@/services/contract';
import { AccountLogo } from '@/components/common/account-logo';
import { DateText } from '@/components/common/date-text';
import { EmptyState, SearchEmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { KpiCard } from '@/components/common/kpi-card';
import { Money } from '@/components/common/money';
import { KpiSkeleton, TableSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBreakpoint } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { normalizeText } from '@/lib/utils';
import { api } from '@/services/api';
import { canManageCommercial } from '../lib';
import { QuoteCard, quoteHref } from './QuoteCard';
import { ApprovalState, DiscountValue, QuoteStatusBadge } from './status';

const STATUS_ORDER: QuoteStatus[] = ['draft', 'pending_approval', 'sent', 'changes_requested', 'accepted', 'expired'];

/** the four states somebody has to act on or watch; draft / expired stay in the status select */
const KPI_STATUSES: { status: QuoteStatus; icon: typeof Clock; tone: 'warning' | 'neutral' | 'success' }[] = [
  { status: 'pending_approval', icon: Clock, tone: 'warning' },
  { status: 'sent', icon: Send, tone: 'neutral' },
  { status: 'changes_requested', icon: MessageSquareWarning, tone: 'warning' },
  { status: 'accepted', icon: CircleCheck, tone: 'success' },
];

function isQuoteStatus(x: string | null): x is QuoteStatus {
  return !!x && (STATUS_ORDER as string[]).includes(x);
}

function QuoteKpis({
  quotes,
  status,
  onPick,
}: {
  quotes: QuoteSummary[];
  status: QuoteStatus | null;
  onPick: (s: QuoteStatus | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {KPI_STATUSES.map(({ status: s, icon, tone }) => {
        const list = quotes.filter((q) => q.status === s);
        const value = list.reduce((sum, q) => sum + q.grand_total, 0);
        return (
          <KpiCard
            key={s}
            label={
              s === 'pending_approval' ? (
                // a tile too narrow for "Chờ Giám đốc duyệt" on one line (2-up phones, 4-up iPad: < 168px inside) says
                // "Chờ GĐ duyệt" instead of leaving "duyệt" alone on line 2 (container query on the card)
                <>
                  <span className="[@container_(max-width:167px)]:hidden">{t('commercial.quotes.kpi.pending_approval')}</span>
                  <span className="hidden [@container_(max-width:167px)]:inline">{t('commercial.quotes.kpi.pending_approvalShort')}</span>
                </>
              ) : (
                t(`commercial.quotes.kpi.${s}`)
              )
            }
            value={list.length}
            icon={icon}
            tone={list.length > 0 ? tone : 'neutral'}
            sub={list.length > 0 ? t('commercial.quotes.kpi.value', { value: formatMoneyCompact(value) }) : t(`commercial.quotes.kpi.none`)}
            onClick={() => onPick(status === s ? null : s)}
            active={status === s}
          />
        );
      })}
    </div>
  );
}

export function QuotesTab() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const viewer = useViewer();
  const breakpoint = useBreakpoint();
  const [search, setSearch] = useState('');
  const showAll = params.get('versions') === 'all';
  const rawStatus = params.get('status');
  const status = isQuoteStatus(rawStatus) ? rawStatus : null;
  const accountId = params.get('account');

  const query = useQuery(() => api.listQuotes({ latestOnly: !showAll }), [showAll], { keepPreviousData: true });
  const quotes = useMemo(() => query.data ?? [], [query.data]);

  const accounts = useMemo(() => {
    const seen = new Map<string, QuoteSummary['account']>();
    for (const q of quotes) if (!seen.has(q.account.id)) seen.set(q.account.id, q.account);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [quotes]);

  const byAccount = useMemo(() => (accountId ? quotes.filter((q) => q.account.id === accountId) : quotes), [quotes, accountId]);
  const needle = normalizeText(search);
  const visible = byAccount.filter(
    (q) =>
      (!status || q.status === status) &&
      (!needle || normalizeText(`${q.title} ${q.code} ${q.account.name}`).includes(needle)),
  );
  const counts = useMemo(() => {
    const c = new Map<QuoteStatus, number>();
    for (const q of byAccount) c.set(q.status, (c.get(q.status) ?? 0) + 1);
    return c;
  }, [byAccount]);

  const setParam = (name: string, value: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  };
  const clearFilters = () => {
    setSearch('');
    setParams(new URLSearchParams(), { replace: true });
  };

  const manage = canManageCommercial(viewer);
  const newHref = accountId ? `/app/commercial/quotes/new?account=${encodeURIComponent(accountId)}` : '/app/commercial/quotes/new';
  const filtered = !!status || !!accountId || !!needle;

  if (query.loading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <KpiSkeleton count={4} className="grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" />
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }
  if (query.error && !query.data) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Card>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <QuoteKpis quotes={byAccount} status={status} onPick={(s) => setParam('status', s)} />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <Input
            type="search"
            icon={<Search />}
            inputSize="sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('commercial.quotes.search')}
            aria-label={t('commercial.quotes.search')}
            wrapperClassName="w-full sm:w-[280px]"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <NativeSelect
              size="sm"
              aria-label={t('commercial.quotes.accountFilter')}
              value={accountId ?? ''}
              onChange={(e) => setParam('account', e.target.value || null)}
              wrapperClassName="sm:w-52"
            >
              <option value="">{t('commercial.quotes.allAccounts')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              size="sm"
              aria-label={t('commercial.quotes.statusFilter')}
              value={status ?? ''}
              onChange={(e) => setParam('status', e.target.value || null)}
              wrapperClassName="sm:w-48"
            >
              <option value="">{t('commercial.quotes.allStatuses')}</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {t('commercial.quotes.statusOption', { status: t(`enums.quoteStatus.${s}`), count: counts.get(s) ?? 0 })}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-caption" aria-live="polite">
            {filtered
              ? t('commercial.quotes.resultFiltered', { count: visible.length, total: quotes.length })
              : t('commercial.quotes.result', { count: visible.length })}
          </p>
          <label className="touch-tap flex min-h-tap cursor-pointer items-center gap-2.5 text-table text-muted-foreground md:min-h-0">
            <Switch checked={showAll} onCheckedChange={(on) => setParam('versions', on ? 'all' : null)} />
            {t('commercial.quotes.showAllVersions')}
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          {filtered ? (
            <SearchEmptyState entity="quote" query={search} icon={FileText} onClear={clearFilters} />
          ) : (
            <EmptyState
              icon={FileText}
              title={t('commercial.quotes.empty')}
              description={t('commercial.quotes.emptyHint')}
              action={
                manage ? (
                  <Button variant="secondary" asChild>
                    <Link to={newHref}>
                      <FilePlus2 aria-hidden="true" />
                      {t('commercial.page.createQuote')}
                    </Link>
                  </Button>
                ) : null
              }
            />
          )}
        </Card>
      ) : breakpoint === 'desktop' ? (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('commercial.quotes.col.quote')}</TableHead>
                <TableHead>{t('commercial.quotes.col.status')}</TableHead>
                <TableHead className="text-right">{t('commercial.quotes.col.discount')}</TableHead>
                <TableHead className="text-right">{t('commercial.quotes.col.total')}</TableHead>
                <TableHead>{t('commercial.quotes.col.updated')}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t('commercial.quotes.open')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((q) => (
                <TableRow key={q.id} className="group cursor-pointer" onClick={() => navigate(quoteHref(q.id))}>
                  <TableCell className="max-w-[380px]">
                    <div className="flex items-center gap-3">
                      <AccountLogo account={q.account} size="sm" />
                      <div className="min-w-0">
                        <Link
                          to={quoteHref(q.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate font-semibold text-ink hover:text-primary"
                        >
                          {q.title}
                        </Link>
                        <p className="truncate text-caption">
                          {q.account.name}
                          <span className="tabular">{` · ${t('commercial.quote.codeVersion', { code: q.code, version: q.version })}`}</span>
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <QuoteStatusBadge status={q.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <DiscountValue pct={q.effective_discount_pct} over={q.needs_approval} />
                      {q.status === 'draft' ? (
                        <ApprovalState status={q.status} needsApproval={q.needs_approval} approved={q.approved} size="sm" quiet />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-ink">
                    <Money value={q.grand_total} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <DateText value={q.updated_at} relative />
                  </TableCell>
                  <TableCell className="text-right">
                    <ChevronRight
                      className="ml-auto h-4 w-4 text-caption opacity-60 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {visible.map((q) => (
            <li key={q.id} className="min-w-0">
              <QuoteCard quote={q} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
