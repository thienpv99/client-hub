// Pieces of the lead drawer: fit explanation in words, follow-up date editor, owner control, contact block.
import { useEffect, useId, useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import type { ISODate } from '@/domain/types';
import type { FitBreakdown, LeadView } from '@/services/crmContract';
import type { UserRef } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { capitalize, t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { cn } from '@/components/ui/cn';
import { isOpenLead, revenueLabel, sizeLabel, toLeadInput } from '../targetLabels';
import { FollowUpLabel, OwnerLabel } from '../TargetBits';

type FitKey = Exclude<keyof FitBreakdown, 'score' | 'grade'>;
const FIT_KEYS: FitKey[] = ['industry', 'size', 'revenue', 'province', 'engagement'];

function fitSentence(key: FitKey, score: number, lead: LeadView): string {
  switch (key) {
    case 'industry':
      return t(score >= 100 ? 'targets.fit.industryIn' : 'targets.fit.industryOut', { value: lead.industry });
    case 'size': {
      const value = sizeLabel(lead.size).toLowerCase();
      return t(score >= 100 ? 'targets.fit.sizeIn' : score >= 60 ? 'targets.fit.sizeNear' : 'targets.fit.sizeOut', { value });
    }
    case 'revenue': {
      const value = revenueLabel(lead.revenue_band).toLowerCase();
      return t(score >= 100 ? 'targets.fit.revenueIn' : score >= 60 ? 'targets.fit.revenueNear' : 'targets.fit.revenueOut', { value });
    }
    case 'province':
      return t(score >= 100 ? 'targets.fit.provinceIn' : 'targets.fit.provinceOut', { value: lead.province });
    case 'engagement':
      if (score <= 0) return t('targets.fit.engagementNone');
      if (score >= 100) return t('targets.fit.engagementWeek');
      if (score >= 70) return t('targets.fit.engagementMonth');
      return t('targets.fit.engagementQuarter');
  }
}

/** Each fit component as a sentence + a quiet bar, e.g. "Bán lẻ thuộc nhóm ngành ưu tiên. ▮▮▮▮ 100" */
export function FitExplanation({ lead }: { lead: LeadView }) {
  return (
    <ul className="space-y-3">
      {FIT_KEYS.map((key) => {
        const score = Math.max(0, Math.min(100, Math.round(lead.fit[key])));
        return (
          <li key={key} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 sm:grid-cols-[6.5rem_minmax(0,1fr)_7rem]">
            <span className="text-caption">{t(`targets.fit.components.${key}`)}</span>
            <span className="text-table text-foreground">{fitSentence(key, score, lead)}</span>
            <span className="col-start-2 flex items-center gap-2 sm:col-start-3 sm:pt-1.5" aria-hidden="true">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-chart-2" style={{ width: `${score}%` }} />
              </span>
              <span className="w-7 text-right text-micro font-medium tabular text-muted-foreground">{score}</span>
            </span>
            <span className="sr-only">{t('targets.fit.points', { score })}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** "Liên hệ tiếp theo": the date with urgency, "Đổi ngày" → inline date input (Lưu / Bỏ hẹn / Hủy) */
export function FollowUpEditor({ lead, today }: { lead: LeadView; today: ISODate }) {
  const id = useId();
  const { run, pending, pendingVisible } = useAction();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lead.next_follow_up_date ?? '');
  useEffect(() => {
    setValue(lead.next_follow_up_date ?? '');
    setEditing(false);
  }, [lead.id, lead.next_follow_up_date]);

  async function save(date: ISODate | null) {
    if (pending) return;
    const company = lead.company_name;
    const r = await run(() => api.upsertLead(toLeadInput(lead, { next_follow_up_date: date })), {
      success: date ? t('targets.drawer.followUpSaved', { company, date: formatDate(date) }) : t('targets.drawer.followUpCleared', { company }),
    });
    if (r) setEditing(false);
  }

  // converted / disqualified leads keep their last date for the record, nothing to schedule any more
  if (!isOpenLead(lead.status)) {
    return lead.next_follow_up_date ? (
      <FollowUpLabel date={lead.next_follow_up_date} today={today} open={false} className="text-table" />
    ) : (
      <span className="text-table text-muted-foreground">{t('targets.drawer.followUpNone')}</span>
    );
  }
  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        {lead.next_follow_up_date ? (
          <FollowUpLabel date={lead.next_follow_up_date} today={today} open={isOpenLead(lead.status)} className="text-table" />
        ) : (
          <span className="text-table text-muted-foreground">{t('targets.drawer.followUpNone')}</span>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {lead.next_follow_up_date ? t('targets.drawer.followUpEdit') : t('targets.drawer.followUpSet')}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) void save(value);
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t('targets.drawer.followUpInput')}
      </label>
      <Input id={id} type="date" value={value} min={today} onChange={(e) => setValue(e.target.value)} className="w-full sm:w-44" autoFocus />
      <Button type="submit" size="sm" loading={pending} disabled={!value}>
        {t('common.save')}
      </Button>
      {lead.next_follow_up_date ? (
        <Button type="button" variant="ghost" size="sm" disabled={pendingVisible} onClick={() => void save(null)}>
          {t('targets.drawer.followUpClear')}
        </Button>
      ) : null}
      <Button type="button" variant="ghost" size="sm" disabled={pendingVisible} onClick={() => !pending && setEditing(false)}>
        {t('common.cancel')}
      </Button>
    </form>
  );
}

/** Director: any sales person or back to the pool. AM: "Nhận phụ trách" on an unassigned lead, otherwise read-only. */
export function OwnerControl({
  lead,
  people,
  isDirector,
  meId,
}: {
  lead: LeadView;
  people: UserRef[];
  isDirector: boolean;
  meId: string;
}) {
  const id = useId();
  const { run, pending, pendingVisible } = useAction();
  const company = lead.company_name;

  async function assign(ownerId: string | null) {
    if (pending) return;
    const person = people.find((p) => p.id === ownerId);
    await run(() => api.assignLeads([lead.id], ownerId), {
      success:
        ownerId === null
          ? t('targets.drawer.ownerCleared', { company })
          : ownerId === meId
            ? t('targets.drawer.taken', { company })
            : t('targets.drawer.ownerChanged', { company, name: person?.full_name ?? '' }),
    });
  }

  if (isDirector && lead.status !== 'converted') {
    return (
      <div className="w-full sm:w-64">
        <label htmlFor={id} className="sr-only">
          {t('targets.drawer.owner')}
        </label>
        <NativeSelect id={id} size="sm" value={lead.owner?.id ?? ''} disabled={pendingVisible} onChange={(e) => void assign(e.target.value || null)}>
          <option value="">{t('targets.drawer.ownerNone')}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </NativeSelect>
      </div>
    );
  }
  if (!lead.owner && isOpenLead(lead.status)) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-table text-muted-foreground">{t('targets.drawer.ownerNone')}</span>
        <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => void assign(meId)}>
          {t('targets.drawer.take')}
        </Button>
      </div>
    );
  }
  return <OwnerLabel owner={lead.owner} className="text-table text-foreground" />;
}

export function ContactBlock({ lead }: { lead: LeadView }) {
  const who = `${capitalize(lead.contact_salutation)} ${lead.contact_name}`;
  const link =
    'touch-tap inline-flex min-h-tap items-center gap-2 rounded-lg text-table text-foreground underline-offset-4 hover:text-primary hover:underline md:min-h-0';
  return (
    <div className="space-y-2">
      <div>
        <p className="text-body font-medium text-foreground">{who}</p>
        {lead.contact_title ? <p className="text-table text-muted-foreground">{lead.contact_title}</p> : null}
      </div>
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
        {lead.contact_phone ? (
          <a href={`tel:${lead.contact_phone.replace(/\s+/g, '')}`} className={link} aria-label={`${t('targets.drawer.call', { name: who })}: ${lead.contact_phone}`}>
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="tabular">{lead.contact_phone}</span>
          </a>
        ) : null}
        <a href={`mailto:${lead.contact_email}`} className={cn(link, 'min-w-0')} aria-label={`${t('targets.drawer.email', { name: who })}: ${lead.contact_email}`}>
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="break-all">{lead.contact_email}</span>
        </a>
      </div>
    </div>
  );
}
