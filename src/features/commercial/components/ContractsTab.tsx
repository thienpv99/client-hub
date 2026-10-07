// "Hợp đồng & thanh toán" tab: KPI row (contract value with collected progress · installments to act on ·
// overdue installments — the last two filter the list), an account filter, then one card per contract.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleAlert, FileSignature, ListTodo, SearchX } from 'lucide-react';
import type { ContractView, PaymentStatus, PaymentView } from '@/services/contract';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { KpiCard } from '@/components/common/kpi-card';
import { CardSkeleton, KpiSkeleton } from '@/components/common/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { formatMoneyCompact } from '@/lib/format';
import { api } from '@/services/api';
import { canManageCommercial } from '../lib';
import { ContractCard } from './ContractCard';

type Focus = 'action' | 'overdue';

/** installments New Era should act on: invoice due, or invoiced / overdue and not yet collected */
const ACTION_STATUSES: PaymentStatus[] = ['invoice_due', 'invoiced', 'overdue'];

function inFocus(p: PaymentView, focus: Focus): boolean {
  return focus === 'overdue' ? p.status === 'overdue' : ACTION_STATUSES.includes(p.status);
}

function matches(c: ContractView, focus: Focus | null): boolean {
  return !focus || c.payments.some((p) => inFocus(p, focus));
}

function sum(list: PaymentView[]): number {
  return list.reduce((s, p) => s + p.amount, 0);
}

export function ContractsTab() {
  const [params, setParams] = useSearchParams();
  const viewer = useViewer();
  const manage = canManageCommercial(viewer);
  const accountId = params.get('account');
  const rawFocus = params.get('focus');
  const focus: Focus | null = rawFocus === 'action' || rawFocus === 'overdue' ? rawFocus : null;

  const query = useQuery(() => api.listContracts(), []);
  const contracts = useMemo(() => query.data ?? [], [query.data]);
  const accounts = useMemo(() => {
    const seen = new Map<string, ContractView['account']>();
    for (const c of contracts) if (!seen.has(c.account.id)) seen.set(c.account.id, c.account);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [contracts]);
  const byAccount = accountId ? contracts.filter((c) => c.account.id === accountId) : contracts;
  const visible = byAccount.filter((c) => matches(c, focus));

  const setParam = (name: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );

  if (query.loading) {
    return (
      <div className="space-y-6 md:space-y-8">
        <KpiSkeleton count={3} className="grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3" itemClassName={(i) => (i === 0 ? 'col-span-2 xl:col-span-1' : undefined)} labelLines={1} />
        <CardSkeleton lines={5} />
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

  const value = byAccount.reduce((s, c) => s + c.value, 0);
  const collected = byAccount.reduce((s, c) => s + c.collected, 0);
  const payments = byAccount.flatMap((c) => c.payments);
  const action = payments.filter((p) => inFocus(p, 'action'));
  const overdue = payments.filter((p) => inFocus(p, 'overdue'));
  const pick = (f: Focus) => setParam('focus', focus === f ? null : f);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <KpiCard
          className="col-span-2 xl:col-span-1"
          label={t('commercial.contracts.kpi.value')}
          value={formatMoneyCompact(value)}
          icon={FileSignature}
          sub={t('commercial.contracts.kpi.valueSub', { count: byAccount.length })}
          progress={{ value: collected, max: value, label: t('commercial.contracts.kpi.collected', { value: formatMoneyCompact(collected) }) }}
        />
        <KpiCard
          labelLines={1}
          label={t('commercial.contracts.kpi.action')}
          value={action.length}
          icon={ListTodo}
          sub={action.length > 0 ? formatMoneyCompact(sum(action)) : t('commercial.contracts.kpi.actionNone')}
          onClick={() => pick('action')}
          active={focus === 'action'}
        />
        <KpiCard
          labelLines={1}
          label={t('commercial.contracts.kpi.overdue')}
          value={overdue.length}
          icon={CircleAlert}
          tone={overdue.length > 0 ? 'danger' : 'neutral'}
          sub={overdue.length > 0 ? formatMoneyCompact(sum(overdue)) : t('commercial.contracts.kpi.overdueNone')}
          onClick={() => pick('overdue')}
          active={focus === 'overdue'}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <NativeSelect
          size="sm"
          aria-label={t('commercial.quotes.accountFilter')}
          value={accountId ?? ''}
          onChange={(e) => setParam('account', e.target.value || null)}
          wrapperClassName="sm:w-64"
        >
          <option value="">{t('commercial.quotes.allAccounts')}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <p className="text-caption" aria-live="polite">
          {focus
            ? t('commercial.contracts.resultFocus', { count: visible.length, focus: t(`commercial.contracts.focus.${focus}`) })
            : t('commercial.contracts.result', { count: visible.length })}
        </p>
      </div>

      {visible.length === 0 ? (
        <Card>
          {accountId || focus ? (
            <EmptyState
              icon={SearchX}
              title={t('commercial.contracts.emptyFiltered')}
              action={
                <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  {t('common.clearFilters')}
                </Button>
              }
            />
          ) : (
            <EmptyState icon={FileSignature} title={t('commercial.contracts.empty')} description={t('commercial.contracts.emptyHint')} />
          )}
        </Card>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {visible.map((c) => (
            <ContractCard key={c.id} contract={c} showAccount manage={manage} />
          ))}
        </div>
      )}
    </div>
  );
}
