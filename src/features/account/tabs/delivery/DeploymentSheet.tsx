// Add / edit a solution the client uses (drawer — a long form, DESIGN §3). Client-visible fields first (name, group,
// status, summary, project, go-live, departments, users), then the internal block (value, how much it is used,
// notes, owner). → api.saveDeployment; "Xóa giải pháp" (soft delete) behind a confirm dialog.
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Lock, OctagonX, Trash2 } from 'lucide-react';
import type { Adoption, DepartmentKey, DeploymentStatus, SolutionCategory } from '@/domain/careTypes';
import { ADOPTIONS, DEPARTMENT_KEYS, DEPLOYMENT_STATUSES, SOLUTION_CATEGORIES } from '@/domain/careTypes';
import { isActiveDeployment } from '@/domain/care';
import type { AccountDetail } from '@/services/contract';
import type { AccountCareView, DeploymentInput, DeploymentView } from '@/services/careContract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { millionsPreview, millionsToVnd, parseCount, personOption, useInternalPeople, vndToMillions } from '../../care/careParts';

interface Draft {
  name: string;
  category: SolutionCategory;
  status: DeploymentStatus;
  summary: string;
  projectId: string;
  goLive: string;
  departments: DepartmentKey[];
  users: string;
  value: string;
  adoption: Adoption | '';
  notes: string;
  ownerId: string;
}

function draftOf(d: DeploymentView | null, defaultOwner: string): Draft {
  return {
    name: d?.name ?? '',
    category: d?.category ?? 'mobile_app',
    status: d?.status ?? 'rolling_out',
    summary: d?.summary ?? '',
    projectId: d?.project?.id ?? '',
    goLive: d?.go_live_date ?? '',
    departments: d ? [...d.departments] : [],
    users: d?.active_users !== null && d?.active_users !== undefined ? String(d.active_users) : '',
    value: vndToMillions(d?.contract_value ?? null),
    adoption: d?.adoption ?? '',
    notes: d?.notes ?? '',
    ownerId: d?.owner?.id ?? defaultOwner,
  };
}

export interface DeploymentSheetProps {
  account: AccountDetail;
  /** the account's care view: delivery debt + the departments New Era already works with (the expansion gate) */
  care: AccountCareView;
  /** null = a new solution */
  deployment: DeploymentView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the viewer may see / set the contract value (director / AM: the api returns it) */
  showValue: boolean;
  /** director: may pass the expansion gate with a logged reason */
  canOverride: boolean;
}

/**
 * Departments an active solution would newly put in use while the account has delivery debt (SPEC-CARE §3 gate, the
 * same rule as api.saveDeployment): not used by another active solution, not used by this one before, not engaged.
 */
function gatedDepartments(care: AccountCareView, deployment: DeploymentView | null, draft: Draft): DepartmentKey[] {
  if (care.requests.debt === 0 || !isActiveDeployment({ status: draft.status })) return [];
  const others = care.deployments.filter((d) => d.id !== deployment?.id && isActiveDeployment(d));
  const before = new Set<DepartmentKey>(others.flatMap((d) => d.departments));
  if (deployment && isActiveDeployment(deployment)) for (const k of deployment.departments) before.add(k);
  const engaged = new Set((care.departments ?? []).filter((d) => d.status === 'engaged').map((d) => d.department));
  return draft.departments.filter((k) => !before.has(k) && !engaged.has(k));
}

export function DeploymentSheet({ account, care, deployment, open, onOpenChange, showValue, canOverride }: DeploymentSheetProps) {
  const uid = useId();
  const { run, pending, pendingVisible } = useAction();
  const [draft, setDraft] = useState<Draft>(() => draftOf(deployment, account.am.id));
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const people = useInternalPeople(open);

  useEffect(() => {
    if (open) {
      setDraft(draftOf(deployment, account.am.id));
      setTouched(false);
      setOverrideReason('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deployment?.id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleDepartment = (k: DepartmentKey, on: boolean) =>
    setDraft((d) => ({ ...d, departments: on ? DEPARTMENT_KEYS.filter((x) => x === k || d.departments.includes(x)) : d.departments.filter((x) => x !== k) }));

  const users = parseCount(draft.users);
  const value = millionsToVnd(draft.value);
  const nameError = touched && !draft.name.trim() ? t('careAccount.delivery.form.nameRequired') : null;
  const usersError = touched && users === undefined ? t('errors.validation') : null;
  const valueError = touched && value === undefined ? t('errors.validation') : null;
  const gated = gatedDepartments(care, deployment, draft);
  const blockedForMe = gated.length > 0 && !canOverride;
  const reasonError = touched && gated.length > 0 && canOverride && !overrideReason.trim() ? t('careAccount.expansion.sheet.overrideRequired') : null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (pending || !draft.name.trim() || users === undefined || value === undefined || blockedForMe) return;
    if (gated.length > 0 && !overrideReason.trim()) return;
    const input: DeploymentInput = {
      ...(deployment ? { id: deployment.id } : {}),
      account_id: account.id,
      project_id: draft.projectId || null,
      name: draft.name.trim(),
      category: draft.category,
      summary: draft.summary.trim(),
      status: draft.status,
      go_live_date: draft.goLive || null,
      departments: draft.departments,
      active_users: users,
      // the value field shows only when the api returned the value (director / AM); otherwise keep the stored one
      contract_value: showValue ? value : (deployment?.contract_value ?? null),
      adoption: draft.adoption || null,
      notes: draft.notes.trim() || null,
      owner_id: draft.ownerId || null,
      ...(gated.length > 0 ? { override_reason: overrideReason.trim() } : {}),
    };
    const saved = await run(() => api.saveDeployment(input));
    if (!saved) return;
    toastSuccess(t(deployment ? 'careAccount.delivery.form.saved' : 'careAccount.delivery.form.added', { name: saved.name }));
    onOpenChange(false);
  }

  async function remove() {
    if (!deployment) return false;
    const ok = await run(async () => {
      await api.deleteDeployment(deployment.id);
      return true;
    });
    if (!ok) return false;
    toastSuccess(t('careAccount.delivery.form.deleted', { name: deployment.name }));
    onOpenChange(false);
    return true;
  }

  const ids = {
    name: `${uid}-name`,
    category: `${uid}-category`,
    status: `${uid}-status`,
    summary: `${uid}-summary`,
    project: `${uid}-project`,
    goLive: `${uid}-golive`,
    departments: `${uid}-departments`,
    users: `${uid}-users`,
    value: `${uid}-value`,
    adoption: `${uid}-adoption`,
    notes: `${uid}-notes`,
    owner: `${uid}-owner`,
    reason: `${uid}-reason`,
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
        <SheetContent side="right" mobileFullScreen className="md:max-w-lg lg:max-w-xl">
          <SheetHeader className="border-b border-border/70">
            <SheetTitle>{deployment ? t('careAccount.delivery.form.editTitle') : t('careAccount.delivery.form.addTitle')}</SheetTitle>
            <SheetDescription>{t('careAccount.delivery.form.description', { account: account.name })}</SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col" noValidate>
            <SheetBody className="space-y-5 pt-5 md:pt-6">
              <FormField label={t('careAccount.delivery.form.name')} htmlFor={ids.name} required error={nameError}>
                <Input
                  id={ids.name}
                  value={draft.name}
                  maxLength={200}
                  autoComplete="off"
                  placeholder={t('careAccount.delivery.form.namePlaceholder')}
                  onChange={(e) => set('name', e.target.value)}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t('careAccount.delivery.form.category')} htmlFor={ids.category}>
                  <NativeSelect id={ids.category} value={draft.category} onChange={(e) => set('category', e.target.value as SolutionCategory)}>
                    {SOLUTION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`care.category.${c}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label={t('careAccount.delivery.form.status')} htmlFor={ids.status}>
                  <NativeSelect id={ids.status} value={draft.status} onChange={(e) => set('status', e.target.value as DeploymentStatus)}>
                    {DEPLOYMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`care.deploymentStatus.${s}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </div>
              <FormField label={t('careAccount.delivery.form.summary')} htmlFor={ids.summary} hint={t('careAccount.common.clientSees')}>
                <Textarea
                  id={ids.summary}
                  rows={2}
                  maxLength={400}
                  value={draft.summary}
                  placeholder={t('careAccount.delivery.form.summaryPlaceholder')}
                  onChange={(e) => set('summary', e.target.value)}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t('careAccount.delivery.form.project')} htmlFor={ids.project}>
                  <NativeSelect id={ids.project} value={draft.projectId} placeholder={t('careAccount.common.none')} onChange={(e) => set('projectId', e.target.value)}>
                    {account.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label={t('careAccount.delivery.form.goLive')} htmlFor={ids.goLive} hint={t('careAccount.delivery.form.goLiveHint')}>
                  <Input id={ids.goLive} type="date" className="tabular" value={draft.goLive} onChange={(e) => set('goLive', e.target.value)} />
                </FormField>
              </div>
              <fieldset>
                <legend id={ids.departments} className="mb-2 text-table font-medium text-foreground">
                  {t('careAccount.delivery.form.departments')}
                </legend>
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  {DEPARTMENT_KEYS.map((k) => {
                    const checked = draft.departments.includes(k);
                    return (
                      <label key={k} className="flex min-h-tap cursor-pointer items-center gap-3 rounded-md text-table text-foreground md:min-h-9">
                        <Checkbox checked={checked} onCheckedChange={(v) => toggleDepartment(k, v === true)} />
                        {t(`care.department.${k}`)}
                      </label>
                    );
                  })}
                </div>
                {/* the expansion gate: a solution may not carry New Era into a new department while promises are owed */}
                {gated.length > 0 ? (
                  <div role="status" className="mt-3 space-y-3 rounded-lg bg-danger-soft p-3 ring-1 ring-inset ring-danger/15">
                    <p className="flex items-start gap-2 text-table">
                      <OctagonX className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-semibold text-danger">{t('careAccount.expansion.sheet.gateTitle')}</span>
                        <span className="mt-0.5 block text-pretty text-foreground">
                          {canOverride
                            ? t('careAccount.delivery.form.gateDirector', { count: care.requests.debt })
                            : t('careAccount.delivery.form.gateAm', { count: care.requests.debt })}{' '}
                          {t('careAccount.delivery.form.gateNew', { list: gated.map((k) => t(`care.department.${k}`)).join(', ') })}
                        </span>
                      </span>
                    </p>
                    {canOverride ? (
                      <FormField label={t('careAccount.expansion.sheet.overrideReason')} htmlFor={ids.reason} required error={reasonError}>
                        <Textarea
                          id={ids.reason}
                          rows={2}
                          maxLength={1000}
                          value={overrideReason}
                          placeholder={t('careAccount.expansion.sheet.overridePlaceholder')}
                          onChange={(e) => setOverrideReason(e.target.value)}
                        />
                      </FormField>
                    ) : null}
                  </div>
                ) : null}
              </fieldset>
              <FormField label={t('careAccount.delivery.form.users')} htmlFor={ids.users} error={usersError}>
                <Input
                  id={ids.users}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="tabular sm:max-w-[12rem]"
                  value={draft.users}
                  onChange={(e) => set('users', e.target.value)}
                />
              </FormField>

              {/* the internal block: a section under a hairline (DESIGN: never a box in a drawer) */}
              <fieldset className="border-t border-border/60 pt-5">
                <legend className="float-left mb-4 flex w-full items-center gap-1.5 text-table font-semibold text-ink">
                  {t('careAccount.delivery.form.internal')}
                  <Lock className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                  <span className="sr-only">{t('careAccount.common.internalOnly')}</span>
                </legend>
                <div className="clear-both space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {showValue ? (
                      <FormField
                        label={t('careAccount.delivery.form.value')}
                        htmlFor={ids.value}
                        hint={millionsPreview(draft.value) ?? `${t('careAccount.common.millionsHint')} ${t('careAccount.delivery.form.valueHint')}`}
                        error={valueError}
                      >
                        <div className="relative">
                          <Input
                            id={ids.value}
                            inputMode="decimal"
                            className="pr-16 tabular"
                            value={draft.value}
                            onChange={(e) => set('value', e.target.value)}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-table text-muted-foreground">
                            {t('careAccount.common.millionsSuffix')}
                          </span>
                        </div>
                      </FormField>
                    ) : null}
                    <FormField label={t('careAccount.delivery.form.adoption')} htmlFor={ids.adoption}>
                      <NativeSelect
                        id={ids.adoption}
                        value={draft.adoption}
                        placeholder={t('careAccount.delivery.solutions.noAdoption')}
                        onChange={(e) => set('adoption', e.target.value as Adoption | '')}
                      >
                        {ADOPTIONS.map((a) => (
                          <option key={a} value={a}>
                            {t(`care.adoption.${a}`)}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                  </div>
                  <FormField label={t('careAccount.delivery.form.owner')} htmlFor={ids.owner}>
                    <NativeSelect id={ids.owner} value={draft.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
                      {deployment?.owner && !people.some((u) => u.id === deployment.owner?.id) ? (
                        <option value={deployment.owner.id}>{deployment.owner.full_name}</option>
                      ) : null}
                      {!deployment && !people.some((u) => u.id === account.am.id) ? <option value={account.am.id}>{account.am.full_name}</option> : null}
                      {people.map((u) => (
                        <option key={u.id} value={u.id}>
                          {personOption(u)}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormField>
                  <FormField label={t('careAccount.delivery.form.notes')} htmlFor={ids.notes} hint={t('careAccount.common.internalOnly')}>
                    <Textarea
                      id={ids.notes}
                      rows={3}
                      maxLength={1000}
                      className="bg-note"
                      value={draft.notes}
                      placeholder={t('careAccount.delivery.form.notesPlaceholder')}
                      onChange={(e) => set('notes', e.target.value)}
                    />
                  </FormField>
                </div>
              </fieldset>
            </SheetBody>
            <SheetFooter className={cn(deployment && 'sm:justify-between')}>
              {deployment ? (
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pendingVisible} className="text-danger hover:text-danger">
                  <Trash2 aria-hidden="true" />
                  {t('careAccount.delivery.form.delete')}
                </Button>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={pending} spinnerOverlay disabled={blockedForMe}>
                  {deployment ? t('common.save') : t('careAccount.delivery.solutions.add')}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      {deployment ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t('careAccount.delivery.form.deleteTitle', { name: deployment.name })}
          description={t('careAccount.delivery.form.deleteDescription')}
          confirmLabel={t('common.delete')}
          destructive
          onConfirm={remove}
        />
      ) : null}
    </>
  );
}
