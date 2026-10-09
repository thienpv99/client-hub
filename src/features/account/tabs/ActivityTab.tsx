// Account log (SPEC §4.2 "Tab Nhật ký"): every change, approval and rejection — who, when (date + time), what —
// grouped by day, with quick filters. Entries the client cannot see carry "Chỉ nội bộ".
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight, History, Lock } from 'lucide-react';
import type { ActivityAction } from '@/domain/types';
import { isFeatureOn } from '@/config/features';
import type { AccountDetail, ActivityView } from '@/services/contract';
import { api } from '@/services/api';
import { dateOf, todayISO } from '@/domain/clock';
import { diffDays } from '@/domain/dates';
import { useQuery } from '@/hooks/useQuery';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { t } from '@/i18n';
import { formatDate, formatDateTime, formatWeekday } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { activitySentence } from '@/components/common/activity-feed';
import { ChipFilter } from '@/components/common/chip-filter';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { InternalOnlyBadge } from '@/components/common/internal-only-badge';
import { enumLabel } from '@/components/common/labels';
import { SectionCard } from '@/components/common/section-card';
import { ListSkeleton } from '@/components/common/skeletons';
import { UserAvatar } from '@/components/common/user-avatar';
import { useAccountAccess } from '../accountAccess';
import { CHIP_TOUCH } from '../styles';

const LIMIT = 300;

type Category = 'all' | 'approvals' | 'tasks' | 'care' | 'commercial' | 'system';

function categoryOf(action: ActivityAction): 'tasks' | 'care' | 'commercial' | 'system' {
  // client care (SPEC-CARE): solutions, departments, relationships, care plan, requests and care touches (interactions)
  const care = ['deployment.', 'department.', 'stakeholder.', 'relation.', 'care_plan.', 'change_request.', 'interaction.'];
  if (care.some((prefix) => action.startsWith(prefix))) return 'care';
  // CRM (§13: deals, leads — director / AM only) belongs with the commercial history
  const commercial = ['quote.', 'contract.', 'payment.', 'opportunity.', 'lead.'];
  if (commercial.some((prefix) => action.startsWith(prefix))) return 'commercial';
  if (
    action.startsWith('task.') ||
    action.startsWith('comment.') ||
    action.startsWith('milestone.') ||
    action.startsWith('project.') ||
    action.startsWith('file.')
  ) {
    return 'tasks';
  }
  return 'system';
}

/** lines of a module switched off (SPEC-CARE §1): deals without `sales`, target companies without `targets` */
function hiddenByFlags(action: ActivityAction): boolean {
  return (!isFeatureOn('sales') && action.startsWith('opportunity.')) || (!isFeatureOn('targets') && action.startsWith('lead.'));
}

/** the task an entry is about, when it can still be opened */
function taskIdOf(item: ActivityView): string | null {
  if (item.action === 'task.deleted') return null;
  if (item.target_type === 'task') return item.target_id;
  const id = item.params.task_id;
  return typeof id === 'string' ? id : null;
}

function dayHeading(day: string): string {
  const diff = diffDays(todayISO(), day);
  const date = formatDate(day);
  if (diff === 0) return t('account.activity.today', { date });
  if (diff === 1) return t('account.activity.yesterday', { date });
  return t('account.activity.day', { weekday: formatWeekday(day), date });
}

function actorLine(item: ActivityView, account: AccountDetail): string {
  const a = item.actor;
  if (!a) return t('components.activity.system');
  if (a.org_type === 'internal') return `${t('common.companyName')} · ${a.title || enumLabel('role', a.role)}`;
  return `${account.short_name || account.name} · ${a.title || enumLabel('role', a.role)}`;
}

function Sentence({ item }: { item: ActivityView }) {
  const sentence = activitySentence(item);
  const actor = item.actor?.full_name ?? '';
  let body: ReactNode = sentence;
  if (actor && sentence.startsWith(actor)) {
    body = (
      <>
        <span className="font-semibold text-ink">{actor}</span>
        {sentence.slice(actor.length)}
      </>
    );
  }
  return <p className="break-words text-table text-foreground">{body}</p>;
}

function Entry({ item, account }: { item: ActivityView; account: AccountDetail }) {
  const drawer = useTaskDrawer();
  const taskId = taskIdOf(item);
  const taskTitle = typeof item.params.task === 'string' ? item.params.task : null;
  const time = formatDateTime(item.created_at).slice(-5);
  return (
    <li
      className={cn(
        'relative flex gap-3 px-4 py-3 sm:px-5',
        taskId && 'group transition-colors duration-150 hover:bg-subtle',
      )}
    >
      <span className="shrink-0 pt-0.5">
        <UserAvatar user={item.actor} size="sm" />
      </span>
      <div className="min-w-0 flex-1">
        <Sentence item={item} />
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-micro text-muted-foreground">
          <time dateTime={item.created_at} title={formatDateTime(item.created_at)} className="font-medium tabular text-foreground">
            {time}
          </time>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 break-words">{actorLine(item, account)}</span>
          {item.visibility === 'internal' ? <InternalOnlyBadge className="ml-0.5 h-5" /> : null}
        </p>
      </div>
      {taskId ? (
        // the whole entry opens the task (a large tap target on phones, where only the arrow shows)
        <button
          type="button"
          onClick={() => drawer.open(taskId)}
          aria-label={taskTitle ? t('account.activity.openTaskNamed', { task: taskTitle }) : undefined}
          className={cn(
            'touch-tap -my-1 -mr-1.5 inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-md px-1.5 text-table font-medium text-muted-foreground transition-colors duration-150',
            "after:absolute after:inset-0 after:content-[''] group-hover:text-foreground sm:-mr-2 sm:px-2",
          )}
        >
          <span className="sr-only sm:not-sr-only">{t('account.activity.openTask')}</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </li>
  );
}

export interface ActivityTabProps {
  account: AccountDetail;
}

export function ActivityTab({ account }: ActivityTabProps) {
  const access = useAccountAccess(account);
  const allQ = useQuery(() => api.listActivities({ accountId: account.id, limit: LIMIT }), [account.id]);
  const approvalsQ = useQuery(() => api.listActivities({ accountId: account.id, approvalsOnly: true, limit: LIMIT }), [account.id]);
  const [category, setCategory] = useState<Category>('all');
  // with sales / targets switched off (SPEC-CARE §1) the deal and lead history stays out of the feed: those screens
  // cannot be opened, and "cơ hội" now means a department's opportunity to sell more
  const all = { ...allQ, data: useMemo(() => allQ.data?.filter((x) => !hiddenByFlags(x.action)), [allQ.data]) };
  const approvals = { ...approvalsQ, data: useMemo(() => approvalsQ.data?.filter((x) => !hiddenByFlags(x.action)), [approvalsQ.data]) };

  const counts = useMemo(() => {
    const list = all.data ?? [];
    const by = { tasks: 0, care: 0, commercial: 0, system: 0 };
    for (const item of list) by[categoryOf(item.action)] += 1;
    return { all: list.length, approvals: approvals.data?.length, ...by };
  }, [all.data, approvals.data]);

  const items: ActivityView[] | undefined =
    category === 'approvals'
      ? approvals.data
      : category === 'all'
        ? all.data
        : all.data?.filter((x) => categoryOf(x.action) === category);

  const groups = useMemo(() => {
    const out: { day: string; items: ActivityView[] }[] = [];
    for (const item of items ?? []) {
      const day = dateOf(item.created_at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(item);
      else out.push({ day, items: [item] });
    }
    return out;
  }, [items]);

  const options: { value: Category; label: string; count?: number }[] = [
    { value: 'all', label: t('common.all'), count: all.data ? counts.all : undefined },
    { value: 'approvals', label: t('account.activity.filters.approvals'), count: counts.approvals },
    { value: 'tasks', label: t('account.activity.filters.tasks'), count: all.data ? counts.tasks : undefined },
  ];
  if (counts.care > 0) options.push({ value: 'care', label: t('careAccount.activityFilter'), count: counts.care });
  if (access.commercial) {
    options.push({ value: 'commercial', label: t('account.activity.filters.commercial'), count: all.data ? counts.commercial : undefined });
  }
  options.push({ value: 'system', label: t('account.activity.filters.system'), count: all.data ? counts.system : undefined });
  const activeLabel = options.find((o) => o.value === category)?.label ?? '';
  const error = category === 'approvals' ? approvals.error : all.error;

  return (
    <div className="space-y-4">
      <ChipFilter
        className={CHIP_TOUCH}
        ariaLabel={t('account.activity.filterLabel')}
        allowDeselect={false}
        value={category}
        onChange={(v) => setCategory(v ?? 'all')}
        options={options}
      />

      {!items && error ? (
        <SectionCard>
          <ErrorState error={error} onRetry={category === 'approvals' ? approvals.refetch : all.refetch} />
        </SectionCard>
      ) : !items ? (
        <ListSkeleton rows={6} />
      ) : items.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={History}
            title={category === 'all' ? t('account.activity.empty') : t('account.activity.filteredEmpty', { filter: activeLabel })}
            description={category === 'all' ? t('account.activity.emptyHint') : undefined}
          />
        </SectionCard>
      ) : (
        <SectionCard
          className="overflow-hidden"
          flush
          footer={
            <p className="flex flex-wrap items-center gap-x-1.5 text-caption">
              <Lock className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
              {t('account.activity.legend')}
              {items.length >= LIMIT ? (
                <>
                  <span aria-hidden="true">·</span>
                  {t('account.activity.limited', { count: LIMIT })}
                </>
              ) : null}
            </p>
          }
        >
          {groups.map((g, i) => (
            <section key={g.day} aria-labelledby={`day-${g.day}`}>
              {/* day band like a table header: quiet tint, hairlines */}
              <h3
                id={`day-${g.day}`}
                className={cn(
                  'flex h-9 items-center border-b border-border/60 bg-subtle px-4 text-micro font-medium text-muted-foreground sm:px-5',
                  i > 0 && 'border-t',
                )}
              >
                {dayHeading(g.day)}
              </h3>
              <ol className="divide-y divide-border/60">
                {g.items.map((item) => (
                  <Entry key={item.id} item={item} account={account} />
                ))}
              </ol>
            </section>
          ))}
        </SectionCard>
      )}
    </div>
  );
}
