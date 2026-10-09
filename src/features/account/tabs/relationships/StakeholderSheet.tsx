// "Quan hệ với …" (drawer): a client person's department, role in the decision, attitude to New Era, how close New
// Era is, who at New Era holds the relationship, whom they report to, and notes. Internal only. → api.saveStakeholder
// (director, the account's AM).
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { DepartmentKey, Influence, Stance, Strength } from '@/domain/careTypes';
import { DEPARTMENT_KEYS, INFLUENCES, STANCES, STRENGTHS } from '@/domain/careTypes';
import type { StakeholderInput, StakeholderView } from '@/services/careContract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetMeta, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { InfluenceBadge, StanceBadge, StrengthBadge } from '@/components/care/badges';
import { personOption, useInternalPeople } from '../../care/careParts';

interface Draft {
  department: DepartmentKey | '';
  influence: Influence;
  stance: Stance;
  strength: Strength;
  ownerId: string;
  reportsTo: string;
  notes: string;
}

function draftOf(p: StakeholderView | null): Draft {
  return {
    department: p?.department ?? '',
    influence: p?.influence ?? 'user',
    stance: p?.stance ?? 'neutral',
    strength: p?.strength ?? 'cold',
    ownerId: p?.ne_owner?.id ?? '',
    reportsTo: p?.reports_to_contact_id ?? '',
    notes: p?.notes ?? '',
  };
}

export interface StakeholderSheetProps {
  person: StakeholderView | null;
  /** everyone of the account (the "báo cáo cho" choices) */
  people: StakeholderView[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StakeholderSheet({ person, people, open, onOpenChange }: StakeholderSheetProps) {
  const uid = useId();
  const { run, pending, pendingVisible } = useAction();
  const [draft, setDraft] = useState<Draft>(() => draftOf(person));
  const staff = useInternalPeople(open);

  useEffect(() => {
    if (open) setDraft(draftOf(person));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, person?.contact_id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!person || pending) return;
    const input: StakeholderInput = {
      contact_id: person.contact_id,
      department: draft.department || null,
      influence: draft.influence,
      stance: draft.stance,
      strength: draft.strength,
      ne_owner_id: draft.ownerId || null,
      reports_to_contact_id: draft.reportsTo || null,
      notes: draft.notes.trim() || null,
    };
    const saved = await run(() => api.saveStakeholder(input));
    if (!saved) return;
    toastSuccess(t('careAccount.relationships.stakeholder.saved', { name: saved.contact.full_name }));
    onOpenChange(false);
  }

  const ids = {
    department: `${uid}-department`,
    influence: `${uid}-influence`,
    stance: `${uid}-stance`,
    strength: `${uid}-strength`,
    owner: `${uid}-owner`,
    reports: `${uid}-reports`,
    notes: `${uid}-notes`,
  };
  const others = people.filter((p) => p.contact_id !== person?.contact_id);

  return (
    <Sheet open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <SheetContent side="right" mobileFullScreen className="md:max-w-lg lg:max-w-lg">
        <SheetHeader className="border-b border-border/70">
          <SheetTitle>{person ? t('careAccount.relationships.stakeholder.title', { name: person.contact.full_name }) : ''}</SheetTitle>
          <SheetDescription>{person?.contact.title ? `${person.contact.title} · ` : ''}{t('careAccount.relationships.stakeholder.description')}</SheetDescription>
          {person ? (
            <SheetMeta>
              <InfluenceBadge influence={person.influence} size="md" />
              <StanceBadge stance={person.stance} size="md" />
              <StrengthBadge strength={person.strength} size="md" />
            </SheetMeta>
          ) : null}
        </SheetHeader>
        <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5 pt-5 md:pt-6">
            <div className="space-y-2">
              <Label id={ids.strength}>{t('careAccount.relationships.stakeholder.strength')}</Label>
              <ToggleGroup
                type="single"
                variant="segmented"
                value={draft.strength}
                onValueChange={(v) => {
                  if (v) set('strength', v as Strength);
                }}
                aria-labelledby={ids.strength}
                className="grid w-full grid-cols-3"
              >
                {STRENGTHS.map((s) => (
                  <ToggleGroupItem key={s} value={s} className="w-full px-2">
                    <span className="truncate">{t(`care.strength.${s}`)}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('careAccount.relationships.stakeholder.stance')} htmlFor={ids.stance}>
                <NativeSelect id={ids.stance} value={draft.stance} onChange={(e) => set('stance', e.target.value as Stance)}>
                  {STANCES.map((s) => (
                    <option key={s} value={s}>
                      {t(`care.stance.${s}`)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label={t('careAccount.relationships.stakeholder.influence')} htmlFor={ids.influence}>
                <NativeSelect id={ids.influence} value={draft.influence} onChange={(e) => set('influence', e.target.value as Influence)}>
                  {INFLUENCES.map((s) => (
                    <option key={s} value={s}>
                      {t(`care.influence.${s}`)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label={t('careAccount.relationships.stakeholder.owner')} htmlFor={ids.owner}>
                <NativeSelect id={ids.owner} value={draft.ownerId} placeholder={t('careAccount.common.nobody')} onChange={(e) => set('ownerId', e.target.value)}>
                  {person?.ne_owner && !staff.some((u) => u.id === person.ne_owner?.id) ? (
                    <option value={person.ne_owner.id}>{person.ne_owner.full_name}</option>
                  ) : null}
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {personOption(u)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label={t('careAccount.relationships.stakeholder.department')} htmlFor={ids.department}>
                <NativeSelect
                  id={ids.department}
                  value={draft.department}
                  placeholder={t('careAccount.relationships.stakeholder.noDepartment')}
                  onChange={(e) => set('department', e.target.value as DepartmentKey | '')}
                >
                  {DEPARTMENT_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {t(`care.department.${k}`)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <FormField label={t('careAccount.relationships.stakeholder.reportsTo')} htmlFor={ids.reports}>
              <NativeSelect id={ids.reports} value={draft.reportsTo} placeholder={t('careAccount.common.notSet')} onChange={(e) => set('reportsTo', e.target.value)}>
                {others.map((p) => (
                  <option key={p.contact_id} value={p.contact_id}>
                    {p.contact.title ? `${p.contact.full_name} · ${p.contact.title}` : p.contact.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('careAccount.relationships.stakeholder.notes')} htmlFor={ids.notes} hint={t('careAccount.common.internalOnly')}>
              <Textarea
                id={ids.notes}
                rows={3}
                maxLength={1000}
                className="bg-note"
                value={draft.notes}
                placeholder={t('careAccount.relationships.stakeholder.notesPlaceholder')}
                onChange={(e) => set('notes', e.target.value)}
              />
            </FormField>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} spinnerOverlay>
              {t('common.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
