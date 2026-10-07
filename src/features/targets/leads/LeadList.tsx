// The lead list: a table in a card from 1280px, cards below (phones and iPad). Rows/cards open the lead drawer; the
// company name is the keyboard target, the whole row/card is clickable for mouse and touch users. Converted leads
// cannot be selected (nothing left to assign or move).
import type { MouseEvent } from 'react';
import type { ISODate } from '@/domain/types';
import type { LeadView } from '@/services/crmContract';
import { FitScoreBadge } from '@/components/crm/FitScoreBadge';
import { DateText } from '@/components/common/date-text';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/components/ui/cn';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { t } from '@/i18n';
import { isOpenLead, revenueLabel, sizeLabel } from '../targetLabels';
import { FollowUpLabel, LeadStatusBadge, OwnerLabel } from '../TargetBits';
import { isSelectable } from './leadModel';

export interface LeadListProps {
  leads: LeadView[];
  today: ISODate;
  selected: ReadonlySet<string>;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpen: (id: string) => void;
}

/** clicks on links/buttons/checkboxes inside a row, or a text selection, do not open the drawer */
function ignoreClick(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target as HTMLElement | null;
  if (target?.closest('a,button,[role="button"],[role="checkbox"],input,select,textarea,label')) return true;
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  return Boolean(selection && selection.toString().length > 0);
}

export function selectionState(leads: LeadView[], selected: ReadonlySet<string>): boolean | 'indeterminate' {
  const selectable = leads.filter((l) => isSelectable(l.status));
  const n = selectable.filter((l) => selected.has(l.id)).length;
  if (n === 0) return false;
  return n === selectable.length ? true : 'indeterminate';
}

function LastContact({ lead }: { lead: LeadView }) {
  return lead.last_contacted_at ? (
    <DateText value={lead.last_contacted_at} relative />
  ) : (
    <span className="text-muted-foreground">{t('targets.leads.neverContacted')}</span>
  );
}

function CompanyButton({ lead, onOpen, className }: { lead: LeadView; onOpen: (id: string) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(lead.id)}
      aria-label={t('targets.leads.open', { name: lead.company_name })}
      className={cn('rounded-sm text-left font-semibold text-ink underline-offset-4 hover:underline', className)}
    >
      {lead.company_name}
    </button>
  );
}

export function LeadTable({ leads, today, selected, onToggle, onToggleAll, onOpen }: LeadListProps) {
  const all = selectionState(leads, selected);
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableCaption className="sr-only">{t('targets.leads.tableCaption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={all}
                onCheckedChange={(v) => onToggleAll(v === true)}
                aria-label={t('targets.leads.selectAll', { count: leads.length })}
              />
            </TableHead>
            <TableHead>{t('targets.leads.columns.company')}</TableHead>
            {/* 8 columns must fit the 968px content width at 1280: size + revenue share one two-line cell */}
            <TableHead>{t('targets.leads.columns.sizeRevenue')}</TableHead>
            <TableHead>{t('targets.leads.columns.fit')}</TableHead>
            <TableHead>{t('targets.leads.columns.status')}</TableHead>
            <TableHead>{t('targets.leads.columns.owner')}</TableHead>
            <TableHead>{t('targets.leads.columns.next')}</TableHead>
            <TableHead>{t('targets.leads.columns.last')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((l) => {
            const checked = selected.has(l.id);
            return (
              <TableRow
                key={l.id}
                data-state={checked ? 'selected' : undefined}
                className="cursor-pointer"
                onClick={(e) => {
                  if (!ignoreClick(e)) onOpen(l.id);
                }}
              >
                <TableCell>
                  <Checkbox
                    checked={checked}
                    disabled={!isSelectable(l.status)}
                    onCheckedChange={(v) => onToggle(l.id, v === true)}
                    aria-label={t('targets.leads.selectOne', { name: l.company_name })}
                  />
                </TableCell>
                <TableCell>
                  <div className="min-w-[9rem] max-w-[16rem]">
                    <CompanyButton lead={l} onOpen={onOpen} className="line-clamp-1 break-words" />
                    {/* w-0 + min-w-full: the cut line does not widen the column (the 8 columns fit at 1280) */}
                    <p className="w-0 min-w-full truncate text-caption" title={`${l.industry}${t('common.separator')}${l.province}`}>
                      {l.industry}
                      {t('common.separator')}
                      {l.province}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <span className="sr-only">{t('targets.leads.columns.size')}: </span>
                  {sizeLabel(l.size)}
                  <span className="block text-micro">
                    <span className="sr-only">{t('targets.leads.columns.revenue')}: </span>
                    {revenueLabel(l.revenue_band)}
                  </span>
                </TableCell>
                <TableCell>
                  <FitScoreBadge fit={l.fit} />
                </TableCell>
                <TableCell>
                  <LeadStatusBadge status={l.status} size="sm" />
                </TableCell>
                <TableCell className="max-w-[9rem] text-muted-foreground">
                  <OwnerLabel owner={l.owner} short />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <FollowUpLabel date={l.next_follow_up_date} today={today} open={isOpenLead(l.status)} relative />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <LastContact lead={l} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

export function LeadCards({ leads, today, selected, onToggle, onToggleAll, onOpen }: LeadListProps) {
  const all = selectionState(leads, selected);
  const anySelectable = leads.some((l) => isSelectable(l.status));
  return (
    <div className="space-y-2">
      {anySelectable ? (
        <label className="inline-flex min-h-tap cursor-pointer items-center gap-3 px-1 text-table text-muted-foreground">
          <Checkbox
            checked={all}
            onCheckedChange={(v) => onToggleAll(v === true)}
            aria-label={t('targets.leads.selectAll', { count: leads.length })}
          />
          <span aria-hidden="true">{t('targets.leads.selectAllShort')}</span>
        </label>
      ) : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {leads.map((l) => {
          const checked = selected.has(l.id);
          const open = isOpenLead(l.status);
          return (
            <li key={l.id} className="min-w-0">
              <Card
                interactive
                onClick={(e) => {
                  if (!ignoreClick(e)) onOpen(l.id);
                }}
                className={cn('relative flex h-full flex-col gap-3 p-4', checked && 'border-primary-border bg-primary-soft/40 hover:border-primary-border')}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={checked}
                    disabled={!isSelectable(l.status)}
                    onCheckedChange={(v) => onToggle(l.id, v === true)}
                    aria-label={t('targets.leads.selectOne', { name: l.company_name })}
                    className="relative z-10 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    {/* the name stretches over the card: one big touch target, the checkbox sits above it */}
                    <CompanyButton
                      lead={l}
                      onOpen={onOpen}
                      className="line-clamp-2 break-words text-table leading-5 after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary"
                    />
                    <p className="truncate text-caption">
                      {l.industry}
                      {t('common.separator')}
                      {l.province}
                    </p>
                  </div>
                  <FitScoreBadge fit={l.fit} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-8">
                  <LeadStatusBadge status={l.status} size="sm" />
                  <OwnerLabel owner={l.owner} short className="text-micro text-muted-foreground" />
                </div>
                <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-border/60 pt-3 text-micro">
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">{t('targets.leads.nextLabel')}</dt>
                    <dd className="mt-0.5 text-table">
                      <FollowUpLabel date={l.next_follow_up_date} today={today} open={open} relative />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">{t('targets.leads.lastLabel')}</dt>
                    <dd className="mt-0.5 text-table text-muted-foreground">
                      <LastContact lead={l} />
                    </dd>
                  </div>
                </dl>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
