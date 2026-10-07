// "Bán thêm" tab (upsell / cross-sell): existing customers with fit, health, contract value, products they do not
// use yet and open opportunities; "Tạo cơ hội" opens the shared CreateOpportunityDialog prefilled with the account
// and its whitespace products. Toolbar (search, minimum fit, sort, count) → table in a card from 1280px, cards below.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, TrendingUp } from 'lucide-react';
import type { TargetAccountView } from '@/services/crmContract';
import { api } from '@/services/api';
import { useMediaQuery } from '@/hooks/useMedia';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { CreateOpportunityDialog } from '@/components/crm/CreateOpportunityDialog';
import { FitScoreBadge } from '@/components/crm/FitScoreBadge';
import { AccountLogo } from '@/components/common/account-logo';
import { SMALL } from '@/components/common/cx';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { HealthBadge } from '@/components/common/health-badge';
import { Money } from '@/components/common/money';
import { TableSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/components/ui/cn';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/i18n';
import { normalizeText } from '@/lib/utils';
import { shortPersonName, stageLabel, tierLabel } from '../targetLabels';
import { OwnerLabel } from '../TargetBits';

type MinFit = 0 | 50 | 75;
type AccountSort = 'fit' | 'value' | 'whitespace';
const MIN_FITS: { value: MinFit; key: 'all' | 'b' | 'a' }[] = [
  { value: 0, key: 'all' },
  { value: 50, key: 'b' },
  { value: 75, key: 'a' },
];
const SORTS: AccountSort[] = ['fit', 'value', 'whitespace'];
const WHITESPACE_SHOWN = 3;

function searchText(a: TargetAccountView): string {
  return normalizeText([a.name, a.industry, a.province, a.tags.join(' '), a.am.full_name, a.whitespace.map((w) => w.name).join(' ')].join(' '));
}

function sortAccounts(list: TargetAccountView[], sort: AccountSort): TargetAccountView[] {
  const byName = (a: TargetAccountView, b: TargetAccountView) => a.name.localeCompare(b.name, 'vi');
  const out = [...list];
  if (sort === 'value') out.sort((a, b) => b.contract_value - a.contract_value || byName(a, b));
  else if (sort === 'whitespace') out.sort((a, b) => b.whitespace.length - a.whitespace.length || b.fit.score - a.fit.score || byName(a, b));
  else out.sort((a, b) => b.fit.score - a.fit.score || byName(a, b));
  return out;
}

function Whitespace({ account: a, limit = WHITESPACE_SHOWN }: { account: TargetAccountView; limit?: number }) {
  if (a.whitespace.length === 0) return <span className="text-caption">{t('targets.accounts.whitespaceNone')}</span>;
  const shown = a.whitespace.slice(0, limit);
  const rest = a.whitespace.slice(limit);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {shown.map((w) => (
        // one line per chip: long product names are cut, the full name stays in the tooltip
        <span
          key={w.price_item_id}
          className={cn('inline-block min-w-0 max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-foreground', SMALL)}
          title={`${w.name} · ${w.code}`}
        >
          {w.name}
        </span>
      ))}
      {rest.length > 0 ? (
        <span className="rounded-md px-1 py-0.5 text-micro font-medium tabular text-muted-foreground" title={rest.map((w) => w.name).join(', ')}>
          {t('targets.accounts.whitespaceMore', { count: rest.length })}
          <span className="sr-only">
            {' '}
            {t('targets.accounts.whitespaceMoreLabel', { count: rest.length, names: rest.map((w) => w.name).join(', ') })}
          </span>
        </span>
      ) : null}
    </div>
  );
}

function CreateButton({ account, onCreate, variant, className }: { account: TargetAccountView; onCreate: (a: TargetAccountView) => void; variant: 'ghost' | 'secondary'; className?: string }) {
  return (
    <Button
      type="button"
      // neutral: the fit grade is the row's one blue accent
      variant={variant}
      size="sm"
      onClick={() => onCreate(account)}
      aria-label={t('targets.accounts.createOppFor', { name: account.name })}
      className={cn(variant === 'ghost' && 'text-foreground', className)}
    >
      <Plus aria-hidden="true" />
      {t('targets.accounts.createOpp')}
    </Button>
  );
}

function AccountsTable({ accounts, onCreate }: { accounts: TargetAccountView[]; onCreate: (a: TargetAccountView) => void }) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableCaption className="sr-only">{t('targets.accounts.tableCaption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t('targets.accounts.columns.account')}</TableHead>
            <TableHead>{t('targets.accounts.columns.health')}</TableHead>
            <TableHead>{t('targets.accounts.columns.fit')}</TableHead>
            <TableHead className="text-right">{t('targets.accounts.columns.contract')}</TableHead>
            <TableHead>{t('targets.accounts.columns.whitespace')}</TableHead>
            <TableHead className="text-right">{t('targets.accounts.columns.opportunities')}</TableHead>
            <TableHead>
              <span className="sr-only">{t('targets.accounts.createOpp')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((a) => (
            <TableRow key={a.id} className="group">
              <TableCell>
                <div className="flex min-w-[11rem] items-center gap-3">
                  <AccountLogo account={a} size="sm" />
                  <div className="min-w-0">
                    <Link to={`/app/accounts/${a.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                      {a.name}
                    </Link>
                    {/* w-0 + min-w-full: the cut line does not widen the column (the table fits at 1280) */}
                    <p className="w-0 min-w-full truncate text-caption">
                      {a.industry}
                      {t('common.separator')}
                      {shortPersonName(a.am.full_name)}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <HealthBadge health={a.health} size="sm" variant="dot" />
              </TableCell>
              <TableCell>
                <FitScoreBadge fit={a.fit} />
              </TableCell>
              <TableCell className="text-right">
                <Money value={a.contract_value} compact className="font-semibold text-ink" />
              </TableCell>
              <TableCell className="w-[13rem] max-w-[13rem]">
                <Whitespace account={a} limit={2} />
              </TableCell>
              <TableCell className="text-right tabular">
                {a.open_opportunities > 0 ? a.open_opportunities : <span className="text-muted-foreground">0</span>}
              </TableCell>
              <TableCell className="w-px text-right">
                <CreateButton
                  account={a}
                  onCreate={onCreate}
                  variant="ghost"
                  className="md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function AccountCards({ accounts, onCreate }: { accounts: TargetAccountView[]; onCreate: (a: TargetAccountView) => void }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {accounts.map((a) => (
        <li key={a.id} className="min-w-0">
          <Card className="flex h-full flex-col">
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <AccountLogo account={a} size="md" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/app/accounts/${a.id}`}
                    className="touch-tap inline-flex items-center break-words text-table font-semibold leading-5 text-ink underline-offset-4 hover:underline"
                  >
                    {a.name}
                  </Link>
                  <p className="truncate text-caption">
                    {a.industry}
                    {t('common.separator')}
                    {tierLabel(a.tier)}
                    {t('common.separator')}
                    {stageLabel(a.stage)}
                  </p>
                </div>
                <FitScoreBadge fit={a.fit} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <HealthBadge health={a.health} size="sm" variant="dot" />
                <OwnerLabel owner={a.am} short className="text-micro text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <p className="text-micro text-muted-foreground">{t('targets.accounts.columns.whitespace')}</p>
                <Whitespace account={a} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
              <dl className="flex gap-6">
                <div className="min-w-0">
                  <dt className="text-micro text-muted-foreground">{t('targets.accounts.columns.contract')}</dt>
                  <dd>
                    <Money value={a.contract_value} compact className="text-table font-semibold text-ink" />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-micro text-muted-foreground">{t('targets.accounts.columns.opportunities')}</dt>
                  <dd className="text-table font-semibold tabular text-ink">{a.open_opportunities}</dd>
                </div>
              </dl>
              <CreateButton account={a} onCreate={onCreate} variant="secondary" />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function TargetAccountsTab() {
  const viewer = useViewer();
  const wide = useMediaQuery('(min-width: 1280px)');
  const query = useQuery(() => api.listTargetAccounts(), [viewer?.user.id]);
  const [search, setSearch] = useState('');
  const [minFit, setMinFit] = useState<MinFit>(0);
  const [sort, setSort] = useState<AccountSort>('fit');
  // the account stays set after closing so the dialog can animate out
  const [createFor, setCreateFor] = useState<TargetAccountView | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const openCreate = (a: TargetAccountView) => {
    setCreateFor(a);
    setCreateOpen(true);
  };

  const all = query.data ?? [];
  const shown = useMemo(() => {
    const needle = normalizeText(search);
    const list = (query.data ?? []).filter((a) => a.fit.score >= minFit && (needle === '' || searchText(a).includes(needle)));
    return sortAccounts(list, sort);
  }, [query.data, search, minFit, sort]);
  const filtered = search.trim() !== '' || minFit > 0;

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-table text-muted-foreground">{t('targets.accounts.intro')}</p>
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
        <Input
          type="search"
          icon={<Search />}
          inputSize="sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('targets.accounts.searchPlaceholder')}
          aria-label={t('targets.accounts.searchLabel')}
          wrapperClassName="w-full md:w-[280px]"
          autoComplete="off"
          enterKeyHint="search"
        />
        <div className="flex min-w-0 items-center gap-2">
          <ToggleGroup
            type="single"
            variant="segmented"
            value={String(minFit)}
            onValueChange={(v) => {
              if (!v) return;
              const n = Number(v);
              setMinFit(n === 50 || n === 75 ? n : 0);
            }}
            aria-label={t('targets.accounts.minFitLabel')}
            className="min-w-0 flex-1 md:flex-none"
          >
            {MIN_FITS.map((m) => (
              <ToggleGroupItem key={m.value} value={String(m.value)} className="flex-1 md:flex-none">
                {t(`targets.accounts.minFit.${m.key}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <label className="flex items-center gap-2 md:ml-auto">
          <span className="shrink-0 text-caption">{t('targets.accounts.sortLabel')}</span>
          <NativeSelect
            size="sm"
            value={sort}
            onChange={(e) => {
              const v = e.target.value;
              if ((SORTS as string[]).includes(v)) setSort(v as AccountSort);
            }}
            wrapperClassName="min-w-0 flex-1 md:w-52 md:flex-none"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`targets.accounts.sort.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      {query.data ? (
        shown.length > 0 ? (
          <>
            <p className="text-caption tabular" aria-live="polite">
              {filtered ? t('targets.accounts.summary', { shown: shown.length, total: all.length }) : t('targets.accounts.count', { count: all.length })}
            </p>
            {wide ? <AccountsTable accounts={shown} onCreate={openCreate} /> : <AccountCards accounts={shown} onCreate={openCreate} />}
          </>
        ) : all.length === 0 ? (
          <Card>
            <EmptyState icon={TrendingUp} title={t('targets.accounts.empty')} description={t('targets.accounts.emptyHint')} />
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={Search}
              title={t('targets.accounts.filtered')}
              description={t('targets.accounts.filteredHint')}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setMinFit(0);
                  }}
                >
                  {t('targets.leads.clear')}
                </Button>
              }
            />
          </Card>
        )
      ) : query.loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : (
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      )}

      {createFor ? (
        <CreateOpportunityDialog
          key={createFor.id}
          open={createOpen}
          onOpenChange={setCreateOpen}
          accountId={createFor.id}
          defaults={{
            account_id: createFor.id,
            name: t('targets.accounts.oppName', { account: createFor.name }),
            price_item_ids: createFor.whitespace.map((w) => w.price_item_id),
            source: 'existing_customer',
            owner_id: createFor.am.id,
          }}
        />
      ) : null}
    </div>
  );
}
