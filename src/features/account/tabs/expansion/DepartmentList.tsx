// "Theo phòng ban" (SPEC-CARE §6.4 Mở rộng): one row per department on the map — effective status (icon + word), the
// solutions used there, the client person and the New Era owner, the need, what could be sold (+ value) and the next
// step (+ due). "Thêm phòng ban" lists the departments not on the map yet.
import type { ReactNode } from 'react';
import { ChevronDown, Pencil, Plus } from 'lucide-react';
import type { DepartmentKey } from '@/domain/careTypes';
import type { DepartmentView, ExpansionInfo } from '@/services/careContract';
import { t } from '@/i18n';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DepartmentStatusChip } from '@/components/care/badges';
import { EmptyState } from '@/components/common/empty-state';
import { SectionCard } from '@/components/common/section-card';
import { UserAvatar } from '@/components/common/user-avatar';
import { CareDue } from '../../care/careParts';

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-pretty break-words text-table text-foreground">{children}</dd>
    </div>
  );
}

function DepartmentRow({ dept: d, canEdit, onEdit }: { dept: DepartmentView; canEdit: boolean; onEdit: (d: DepartmentView) => void }) {
  const notFit = d.effective === 'not_fit';
  return (
    <li className="flex min-w-0 items-start gap-3 px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <h3 className="text-table font-semibold text-ink">{d.label}</h3>
          <DepartmentStatusChip status={d.effective} />
          {d.est_value ? (
            <span className="text-table font-semibold tabular text-ink" title={formatMoney(d.est_value)}>
              {formatMoneyCompact(d.est_value)}
            </span>
          ) : null}
        </div>
        {notFit ? (
          d.need_note ? <p className="mt-1 text-pretty text-caption">{d.need_note}</p> : null
        ) : (
          <dl className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
            <Field label={t('careAccount.expansion.map.using')}>
              {d.deployments.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {/* the solution and its own status: a department "has a solution" while it is still being rolled out */}
                  {d.deployments.map((x) => (
                    <Badge key={x.id} variant="outline" size="sm" className="max-w-full">
                      <span className="truncate">
                        {x.name} · {t(`care.deploymentStatus.${x.status}`)}
                      </span>
                    </Badge>
                  ))}
                </span>
              ) : (
                <span className="text-muted-foreground">{t('careAccount.expansion.map.noSolution')}</span>
              )}
            </Field>
            {d.need_note ? <Field label={t('careAccount.expansion.map.need')}>{d.need_note}</Field> : null}
            {d.opportunity_note ? (
              <Field label={t('careAccount.expansion.map.opportunity')}>
                <span className="font-medium text-ink">{d.opportunity_note}</span>
                {d.opportunity_category_label ? <span className="text-muted-foreground"> · {d.opportunity_category_label}</span> : null}
              </Field>
            ) : null}
            {d.next_step ? (
              <Field label={t('careAccount.expansion.map.next')}>
                {d.next_step}
                {d.next_step_due ? (
                  <span className="mt-0.5 block text-micro">
                    <CareDue date={d.next_step_due} className={d.next_step_overdue ? undefined : 'text-muted-foreground'} />
                  </span>
                ) : null}
              </Field>
            ) : null}
          </dl>
        )}
        {!notFit && (d.contact || d.ne_owner) ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-muted-foreground">
            {d.contact ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {t('careAccount.expansion.map.client')}:
                <span className="truncate font-medium text-foreground" title={d.contact.title}>
                  {d.contact.full_name}
                </span>
              </span>
            ) : null}
            {d.ne_owner ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {t('careAccount.expansion.map.owner')}:
                <UserAvatar user={d.ne_owner} size="xs" />
                <span className="truncate font-medium text-foreground">{d.ne_owner.full_name}</span>
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      {canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit(d)}
          aria-label={t('careAccount.expansion.map.edit', { department: d.label })}
          title={t('common.edit')}
          className="-mr-1.5 -mt-1"
        >
          <Pencil aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}

export interface DepartmentListProps {
  departments: DepartmentView[];
  expansion: ExpansionInfo;
  canEdit: boolean;
  onEdit: (d: DepartmentView) => void;
  onAdd: (department: DepartmentKey) => void;
}

export function DepartmentList({ departments, expansion, canEdit, onEdit, onAdd }: DepartmentListProps) {
  const missing = expansion.missing_departments;
  const add =
    canEdit && missing.length > 0 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" size="sm">
            <Plus aria-hidden="true" />
            {t('careAccount.expansion.map.add')}
            <ChevronDown className="opacity-70" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          <DropdownMenuLabel>{t('careAccount.expansion.map.addMenu')}</DropdownMenuLabel>
          {missing.map((m) => (
            <DropdownMenuItem key={m.department} onSelect={() => onAdd(m.department)}>
              {m.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <SectionCard
      className="overflow-hidden"
      title={t('careAccount.expansion.map.title')}
      description={departments.length > 0 ? t('careAccount.expansion.map.description') : undefined}
      actions={departments.length > 0 ? add : null}
      flush
    >
      {departments.length === 0 ? (
        <EmptyState compact title={t('careAccount.expansion.map.empty')} description={t('careAccount.expansion.map.emptyHint')} action={add} />
      ) : (
        <ul className="mt-1 divide-y divide-border/60 border-t border-border/60">
          {departments.map((d) => (
            <DepartmentRow key={d.id} dept={d} canEdit={canEdit} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
