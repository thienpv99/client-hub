// Add / update one department of the expansion map (drawer). Status (Đang trao đổi · Chưa tiếp cận · Không phù hợp —
// "Đang dùng" is derived from the solutions), need, opportunity (+ group, value), client person, New Era owner, next
// step (+ due). The delivery-debt gate (SPEC-CARE §3): while the account has delivery debt, moving a department into
// "Đang trao đổi" is refused — an AM sees why and cannot save that move; the director may with a logged reason.
// → api.saveDepartment.
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { OctagonX } from 'lucide-react';
import type { DepartmentKey, DepartmentStatus, SolutionCategory } from '@/domain/careTypes';
import { DEPARTMENT_STATUSES, SOLUTION_CATEGORIES } from '@/domain/careTypes';
import type { AccountDetail } from '@/services/contract';
import type { DepartmentInput, DepartmentView, ExpansionInfo } from '@/services/careContract';
import { api } from '@/services/api';
import { isExpansionMove } from '@/domain/care';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetMeta, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DepartmentStatusChip } from '@/components/care/badges';
import { millionsPreview, millionsToVnd, personOption, useInternalPeople, vndToMillions } from '../../care/careParts';

interface Draft {
  department: DepartmentKey | '';
  status: DepartmentStatus;
  need: string;
  opportunity: string;
  category: SolutionCategory | '';
  value: string;
  contactId: string;
  ownerId: string;
  nextStep: string;
  nextStepDue: string;
  overrideReason: string;
}

function draftOf(d: DepartmentView | null, department: DepartmentKey | null, defaultOwner: string): Draft {
  return {
    department: d?.department ?? department ?? '',
    status: d?.status ?? 'untouched',
    need: d?.need_note ?? '',
    opportunity: d?.opportunity_note ?? '',
    category: d?.opportunity_category ?? '',
    value: vndToMillions(d?.est_value ?? null),
    contactId: d?.contact?.id ?? '',
    ownerId: d ? (d.ne_owner?.id ?? '') : defaultOwner,
    nextStep: d?.next_step ?? '',
    nextStepDue: d?.next_step_due ?? '',
    overrideReason: '',
  };
}

export interface DepartmentSheetProps {
  account: AccountDetail;
  expansion: ExpansionInfo;
  /** the department to update, or null to add one (`department` preselects it) */
  dept: DepartmentView | null;
  department: DepartmentKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** director: may pass the gate with a logged reason */
  canOverride: boolean;
}

export function DepartmentSheet({ account, expansion, dept, department, open, onOpenChange, canOverride }: DepartmentSheetProps) {
  const uid = useId();
  const { run, pending, pendingVisible } = useAction();
  const [draft, setDraft] = useState<Draft>(() => draftOf(dept, department, account.am.id));
  const [touched, setTouched] = useState(false);
  const people = useInternalPeople(open);

  useEffect(() => {
    if (open) {
      setDraft(draftOf(dept, department, account.am.id));
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dept?.id, department]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const from = dept ? dept.effective : null;
  const gated = expansion.blocked && isExpansionMove(from, draft.status);
  const value = millionsToVnd(draft.value);
  const reasonError = touched && gated && canOverride && !draft.overrideReason.trim() ? t('careAccount.expansion.sheet.overrideRequired') : null;
  const departmentError = touched && !draft.department ? t('errors.validation') : null;
  const blockedForMe = gated && !canOverride;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (pending || !draft.department || value === undefined || blockedForMe) return;
    if (gated && !draft.overrideReason.trim()) return;
    const input: DepartmentInput = {
      account_id: account.id,
      department: draft.department,
      status: draft.status,
      need_note: draft.need.trim() || null,
      opportunity_note: draft.opportunity.trim() || null,
      opportunity_category: draft.category || null,
      est_value: value,
      contact_id: draft.contactId || null,
      ne_owner_id: draft.ownerId || null,
      next_step: draft.nextStep.trim() || null,
      next_step_due: draft.nextStepDue || null,
      ...(gated ? { override_reason: draft.overrideReason.trim() } : {}),
    };
    const saved = await run(() => api.saveDepartment(input));
    if (!saved) return;
    toastSuccess(t('careAccount.expansion.sheet.saved', { department: saved.label }));
    onOpenChange(false);
  }

  const ids = {
    department: `${uid}-department`,
    status: `${uid}-status`,
    need: `${uid}-need`,
    opportunity: `${uid}-opportunity`,
    category: `${uid}-category`,
    value: `${uid}-value`,
    contact: `${uid}-contact`,
    owner: `${uid}-owner`,
    next: `${uid}-next`,
    due: `${uid}-due`,
    reason: `${uid}-reason`,
  };
  const addChoices = expansion.missing_departments;

  return (
    <Sheet open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <SheetContent side="right" mobileFullScreen className="md:max-w-lg lg:max-w-xl">
        <SheetHeader className="border-b border-border/70">
          <SheetTitle>{dept ? t('careAccount.expansion.sheet.editTitle', { department: dept.label }) : t('careAccount.expansion.sheet.addTitle')}</SheetTitle>
          <SheetDescription>{t('careAccount.expansion.sheet.description')}</SheetDescription>
          {dept ? (
            <SheetMeta>
              <DepartmentStatusChip status={dept.effective} size="md" />
            </SheetMeta>
          ) : null}
        </SheetHeader>
        <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetBody className="space-y-5 pt-5 md:pt-6">
            {!dept ? (
              <FormField label={t('careAccount.expansion.sheet.department')} htmlFor={ids.department} required error={departmentError}>
                <NativeSelect
                  id={ids.department}
                  value={draft.department}
                  placeholder={t('common.select')}
                  onChange={(e) => set('department', e.target.value as DepartmentKey | '')}
                >
                  {addChoices.map((m) => (
                    <option key={m.department} value={m.department}>
                      {m.label}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            ) : null}

            {dept && dept.effective === 'using' ? (
              <p className="rounded-lg bg-subtle p-3 text-pretty text-[13px] leading-[18px] text-muted-foreground ring-1 ring-inset ring-border/60">
                {t('careAccount.expansion.sheet.usingNote', { solutions: dept.deployments.map((x) => x.name).join(', ') })}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label id={ids.status}>{t('careAccount.expansion.sheet.status')}</Label>
              <ToggleGroup
                type="single"
                variant="segmented"
                value={draft.status}
                onValueChange={(v) => {
                  if (v) set('status', v as DepartmentStatus);
                }}
                aria-labelledby={ids.status}
                className="grid w-full grid-cols-3"
              >
                {DEPARTMENT_STATUSES.map((s) => (
                  <ToggleGroupItem key={s} value={s} className="w-full px-2">
                    <span className="truncate">{t(`care.departmentStatus.${s}`)}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {gated ? (
              <div role="status" className="space-y-3 rounded-lg bg-danger-soft p-3 ring-1 ring-inset ring-danger/15">
                <p className="flex items-start gap-2 text-table">
                  <OctagonX className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-danger">{t('careAccount.expansion.sheet.gateTitle')}</span>
                    <span className="mt-0.5 block text-pretty text-foreground">
                      {canOverride
                        ? t('careAccount.expansion.sheet.gateDirector', { count: expansion.debt_count })
                        : t('careAccount.expansion.sheet.gateAm', { count: expansion.debt_count })}
                    </span>
                  </span>
                </p>
                {canOverride ? (
                  <FormField label={t('careAccount.expansion.sheet.overrideReason')} htmlFor={ids.reason} required error={reasonError}>
                    <Textarea
                      id={ids.reason}
                      rows={2}
                      maxLength={1000}
                      value={draft.overrideReason}
                      placeholder={t('careAccount.expansion.sheet.overridePlaceholder')}
                      onChange={(e) => set('overrideReason', e.target.value)}
                    />
                  </FormField>
                ) : null}
              </div>
            ) : null}

            <FormField label={t('careAccount.expansion.sheet.need')} htmlFor={ids.need}>
              <Textarea
                id={ids.need}
                rows={2}
                maxLength={1000}
                value={draft.need}
                placeholder={t('careAccount.expansion.sheet.needPlaceholder')}
                onChange={(e) => set('need', e.target.value)}
              />
            </FormField>
            <FormField label={t('careAccount.expansion.sheet.opportunity')} htmlFor={ids.opportunity}>
              <Input
                id={ids.opportunity}
                value={draft.opportunity}
                maxLength={300}
                placeholder={t('careAccount.expansion.sheet.opportunityPlaceholder')}
                onChange={(e) => set('opportunity', e.target.value)}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('careAccount.expansion.sheet.category')} htmlFor={ids.category}>
                <NativeSelect
                  id={ids.category}
                  value={draft.category}
                  placeholder={t('careAccount.common.none')}
                  onChange={(e) => set('category', e.target.value as SolutionCategory | '')}
                >
                  {SOLUTION_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`care.category.${c}`)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField
                label={t('careAccount.expansion.sheet.value')}
                htmlFor={ids.value}
                hint={millionsPreview(draft.value) ?? t('careAccount.common.millionsHint')}
                error={touched && value === undefined ? t('errors.validation') : null}
              >
                <div className="relative">
                  <Input id={ids.value} inputMode="decimal" className="pr-16 tabular" value={draft.value} onChange={(e) => set('value', e.target.value)} />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-table text-muted-foreground">
                    {t('careAccount.common.millionsSuffix')}
                  </span>
                </div>
              </FormField>
              <FormField label={t('careAccount.expansion.sheet.contact')} htmlFor={ids.contact}>
                <NativeSelect id={ids.contact} value={draft.contactId} placeholder={t('careAccount.common.none')} onChange={(e) => set('contactId', e.target.value)}>
                  {account.contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title ? `${c.full_name} · ${c.title}` : c.full_name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label={t('careAccount.expansion.sheet.owner')} htmlFor={ids.owner}>
                <NativeSelect id={ids.owner} value={draft.ownerId} placeholder={t('careAccount.common.none')} onChange={(e) => set('ownerId', e.target.value)}>
                  {dept?.ne_owner && !people.some((u) => u.id === dept.ne_owner?.id) ? <option value={dept.ne_owner.id}>{dept.ne_owner.full_name}</option> : null}
                  {!dept && !people.some((u) => u.id === account.am.id) ? <option value={account.am.id}>{account.am.full_name}</option> : null}
                  {people.map((u) => (
                    <option key={u.id} value={u.id}>
                      {personOption(u)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <FormField label={t('careAccount.expansion.sheet.nextStep')} htmlFor={ids.next}>
                <Input
                  id={ids.next}
                  value={draft.nextStep}
                  maxLength={300}
                  placeholder={t('careAccount.expansion.sheet.nextStepPlaceholder')}
                  onChange={(e) => set('nextStep', e.target.value)}
                />
              </FormField>
              <FormField label={t('careAccount.expansion.sheet.nextStepDue')} htmlFor={ids.due}>
                <Input id={ids.due} type="date" className="tabular" value={draft.nextStepDue} onChange={(e) => set('nextStepDue', e.target.value)} />
              </FormField>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} spinnerOverlay disabled={blockedForMe}>
              {t('common.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
