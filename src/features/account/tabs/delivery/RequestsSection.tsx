// "Yêu cầu của khách" (SPEC-CARE §6.4 Triển khai): every change request of the account with its flags and their
// reason, filter chips (Tất cả · Chưa xử lý > 7 ngày · Nợ triển khai · Đang làm · Đã xong · Từ chối), "Thêm yêu cầu",
// and the triage sheet. A notification link `?cr=<id>` opens that request; `?filter=` picks a chip (dashboard links).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, Inbox, Plus } from 'lucide-react';
import type { ChangeRequestView } from '@/services/careContract';
import { api } from '@/services/api';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { formatDate, formatDateShort } from '@/lib/format';
import { toastInfo } from '@/lib/toast';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { CrFlags, CrStatusChip, hasCrFlag } from '@/components/care/badges';
import { CrFormDialog } from '@/components/care/CrFormDialog';
import { CrTriageSheet } from '@/components/care/CrTriageSheet';
import { ChipFilter } from '@/components/common/chip-filter';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { SectionCard } from '@/components/common/section-card';
import { ListSkeleton } from '@/components/common/skeletons';
import { UserAvatar } from '@/components/common/user-avatar';
import { CHIP_TOUCH } from '../../styles';

export const REQUEST_FILTERS = ['all', 'untriaged', 'debt', 'in_progress', 'done', 'declined'] as const;
export type RequestFilter = (typeof REQUEST_FILTERS)[number];

export function isRequestFilter(v: string | null | undefined): v is RequestFilter {
  return !!v && (REQUEST_FILTERS as readonly string[]).includes(v);
}

function matches(r: ChangeRequestView, f: RequestFilter): boolean {
  switch (f) {
    case 'all':
      return true;
    case 'untriaged':
      return r.flags.untriaged;
    case 'debt':
      return r.flags.debt;
    case 'in_progress':
      return r.status === 'in_progress';
    case 'done':
      return r.status === 'done';
    case 'declined':
      return r.status === 'declined';
  }
}

const OPEN = new Set(['new', 'triaged', 'planned', 'in_progress']);

/** one meta item of a wrapping row: the "·" stays with the item after it (DESIGN §8.8) */
function Meta({ first, children, className }: { first?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap', className)}>
      {first ? null : (
        <span aria-hidden="true" className="mr-1.5 text-muted-foreground">
          ·
        </span>
      )}
      {children}
    </span>
  );
}

function RequestRow({ request: r, onOpen }: { request: ChangeRequestView; onOpen: (r: ChangeRequestView) => void }) {
  const open = OPEN.has(r.status);
  const promisedLate = open && r.flags.debt_reasons.includes('date_passed');
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(r)}
        aria-label={`${t('careAccount.delivery.requests.open', { code: r.code })}: ${r.title}`}
        className="group flex w-full min-w-0 items-start gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-subtle/80 focus-visible:bg-subtle sm:px-5"
      >
        {/* fixed width: every title starts at the same x whatever the digits */}
        <span className="mt-px inline-flex h-6 min-w-[3.5rem] shrink-0 items-center justify-center rounded-md bg-muted px-1.5 text-micro font-semibold tabular text-muted-foreground">
          {r.code}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <span className="line-clamp-2 min-w-0 text-table font-medium text-ink">{r.title}</span>
            <CrStatusChip status={r.status} className="shrink-0" />
          </span>
          {hasCrFlag(r.flags) ? <CrFlags flags={r.flags} className="mt-1.5" /> : null}
          <span className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-micro text-muted-foreground">
            <Meta first>
              <span className="tabular" title={formatDate(r.received_at)}>
                {t('careAccount.delivery.requests.received', { date: formatDateShort(r.received_at) })}
              </span>
            </Meta>
            <Meta>{r.source_label}</Meta>
            {r.requested_by ? <Meta>{r.requested_by.name}</Meta> : null}
            {r.promised_date && r.status !== 'done' && r.status !== 'declined' ? (
              <Meta className={promisedLate ? 'font-medium text-danger' : undefined}>
                <span className="tabular" title={formatDate(r.promised_date)}>
                  {promisedLate
                    ? t('careAccount.delivery.requests.promisedPassed', { date: formatDateShort(r.promised_date) })
                    : t('careAccount.delivery.requests.promised', { date: formatDateShort(r.promised_date) })}
                </span>
              </Meta>
            ) : null}
            {r.done_at && r.status === 'done' ? (
              <Meta>
                <span className="tabular">{t('careAccount.delivery.requests.doneAt', { date: formatDateShort(r.done_at) })}</span>
              </Meta>
            ) : null}
            {open ? (
              r.owner ? (
                <Meta>
                  <span className="inline-flex items-center gap-1 align-bottom">
                    <UserAvatar user={r.owner} size="xs" />
                    {r.owner.full_name}
                  </span>
                </Meta>
              ) : (
                <Meta>{t('careAccount.delivery.requests.noOwner')}</Meta>
              )
            ) : null}
            {open && r.plan_ref ? <Meta>{t('careAccount.delivery.requests.plan', { plan: r.plan_ref })}</Meta> : null}
            {open && !r.plan_ref && r.task ? (
              <Meta className="max-w-full truncate">{t('careAccount.delivery.requests.task', { task: r.task.title })}</Meta>
            ) : null}
          </span>
        </span>
        <ChevronRight
          className="mt-1 h-4 w-4 shrink-0 text-caption transition-transform duration-150 ease-out-quart group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

export interface RequestsSectionProps {
  accountId: string;
  /** New Era staff with write access may log a request (internal, any role with account access) */
  canCreate: boolean;
  filter: RequestFilter;
  onFilterChange: (f: RequestFilter) => void;
  /** request to open (notification link), null = none */
  openId: string | null;
  onOpenIdChange: (id: string | null) => void;
}

export function RequestsSection({ accountId, canCreate, filter, onFilterChange, openId, onOpenIdChange }: RequestsSectionProps) {
  const q = useQuery(() => api.listChangeRequests({ accountId }), [accountId]);
  const list = q.data;
  const [creating, setCreating] = useState(false);
  // keep the last request while the sheet slides out
  const last = useRef<ChangeRequestView | null>(null);
  const selected = openId && list ? (list.find((r) => r.id === openId) ?? null) : null;
  if (selected) last.current = selected;

  // a link to a request that is gone: say so once and drop the parameter
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (openId && list && !list.some((r) => r.id === openId)) {
      if (reported.current !== openId) toastInfo(t('careAccount.delivery.requests.notFound'));
      reported.current = openId;
      onOpenIdChange(null);
    }
  }, [openId, list, onOpenIdChange]);

  const counts = useMemo(() => {
    const out = {} as Record<RequestFilter, number>;
    for (const f of REQUEST_FILTERS) out[f] = (list ?? []).filter((r) => matches(r, f)).length;
    return out;
  }, [list]);
  const shown = (list ?? []).filter((r) => matches(r, filter));
  const filterLabel = t(`careAccount.delivery.requests.filters.${filter}`);

  const addButton = canCreate ? (
    <Button type="button" variant="secondary" size="sm" onClick={() => setCreating(true)}>
      <Plus aria-hidden="true" />
      {t('careAccount.delivery.requests.add')}
    </Button>
  ) : null;

  return (
    <section aria-labelledby="account-requests-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="account-requests-title" className="flex items-center gap-2 text-heading font-semibold tracking-tightish text-ink">
            {t('careAccount.delivery.requests.title')}
            {list ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-micro font-medium tabular text-muted-foreground">
                {list.length}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 max-w-reading text-pretty text-caption">{t('careAccount.delivery.requests.description')}</p>
        </div>
        {addButton ? <div className="shrink-0">{addButton}</div> : null}
      </div>

      <ChipFilter
        className={CHIP_TOUCH}
        ariaLabel={t('careAccount.delivery.requests.filterLabel')}
        allowDeselect={false}
        value={filter}
        onChange={(v) => onFilterChange(v ?? 'all')}
        options={REQUEST_FILTERS.map((f) => ({
          value: f,
          label: t(`careAccount.delivery.requests.filters.${f}`),
          count: list ? counts[f] : undefined,
        }))}
      />

      {!list && q.error ? (
        <SectionCard>
          <ErrorState error={q.error} onRetry={q.refetch} compact />
        </SectionCard>
      ) : !list ? (
        <ListSkeleton rows={4} />
      ) : list.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Inbox} title={t('careAccount.delivery.requests.empty')} description={t('careAccount.delivery.requests.emptyHint')} />
        </SectionCard>
      ) : shown.length === 0 ? (
        <SectionCard>
          <EmptyState compact icon={Inbox} title={t('careAccount.delivery.requests.filteredEmpty', { filter: filterLabel })} />
        </SectionCard>
      ) : (
        <SectionCard flush className="overflow-hidden">
          <ul className="divide-y divide-border/60">
            {shown.map((r) => (
              <RequestRow key={r.id} request={r} onOpen={(x) => onOpenIdChange(x.id)} />
            ))}
          </ul>
        </SectionCard>
      )}

      <CrTriageSheet
        request={selected ?? last.current}
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) onOpenIdChange(null);
        }}
      />
      {canCreate ? <CrFormDialog open={creating} onOpenChange={setCreating} accountId={accountId} /> : null}
    </section>
  );
}
