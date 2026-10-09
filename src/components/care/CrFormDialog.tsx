// "Thêm yêu cầu" (SPEC-CARE §6.4): New Era logs a change request heard at a meeting, by email or chat (internal;
// client requests come from the portal). Short required input → a dialog (DESIGN §3). → api.createChangeRequest,
// the request starts as 'new'; triage happens in CrTriageSheet.
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2 } from 'lucide-react';
import type { ID } from '@/domain/types';
import type { CrPriority, CrSource } from '@/domain/careTypes';
import { CR_PRIORITIES } from '@/domain/careTypes';
import type { ChangeRequestInput, ChangeRequestView } from '@/services/careContract';
import { api } from '@/services/api';
import { todayISO } from '@/domain/clock';
import { useAction } from '@/hooks/useAction';
import { useDelayedFlag } from '@/hooks/useMotion';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type InternalSource = Exclude<CrSource, 'client_portal'>;
const SOURCES: InternalSource[] = ['meeting', 'email', 'chat', 'internal'];

export interface CrFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** fixed account (account page); omitted → an account picker (requests board) */
  accountId?: ID | null;
  /** prefilled fields (project, deployment, requester…) */
  defaults?: Partial<Omit<ChangeRequestInput, 'account_id'>>;
  onCreated?: (request: ChangeRequestView) => void;
}

interface Draft {
  accountId: string;
  title: string;
  description: string;
  source: InternalSource;
  receivedDate: string;
  contactId: string;
  projectId: string;
  deploymentId: string;
  priority: CrPriority;
}

function draftOf(accountId: ID | null | undefined, d: CrFormDialogProps['defaults']): Draft {
  return {
    accountId: accountId ?? '',
    title: d?.title ?? '',
    description: d?.description ?? '',
    source: d?.source ?? 'meeting',
    receivedDate: typeof d?.received_at === 'string' ? d.received_at.slice(0, 10) : todayISO(),
    contactId: d?.requested_by_contact_id ?? '',
    projectId: d?.project_id ?? '',
    deploymentId: d?.deployment_id ?? '',
    priority: d?.priority ?? 'normal',
  };
}

export function CrFormDialog({ open, onOpenChange, accountId, defaults, onCreated }: CrFormDialogProps) {
  const uid = useId();
  const { run, pending, pendingVisible } = useAction();
  const [draft, setDraft] = useState<Draft>(() => draftOf(accountId, defaults));
  const [touched, setTouched] = useState(false);
  const fixedAccount = !!accountId;

  const defaultsKey = JSON.stringify(defaults ?? {});
  useEffect(() => {
    if (open) {
      setDraft(draftOf(accountId, defaults));
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId, defaultsKey]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const account = draft.accountId;
  const accountsQ = useQuery(() => api.listAccounts(), [], { enabled: open });
  const contactsQ = useQuery(() => api.listContacts(account), [account], { enabled: open && account !== '' });
  const projectsQ = useQuery(() => api.listProjects(account), [account], { enabled: open && account !== '' });
  const careQ = useQuery(() => api.getAccountCare(account), [account], { enabled: open && account !== '' });
  const loadingVisible = useDelayedFlag(accountsQ.loading);
  const accountName = accountsQ.data?.find((a) => a.id === account)?.name ?? null;

  const titleError = touched && draft.title.trim() === '' ? t('care.kit.requestForm.titleRequired') : null;
  const accountError = touched && account === '' ? t('care.kit.requestForm.accountRequired') : null;
  const today = todayISO();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (pending || draft.title.trim() === '' || account === '') return;
    const input: ChangeRequestInput = {
      account_id: account,
      title: draft.title.trim(),
      description: draft.description.trim(),
      source: draft.source,
      received_at: draft.receivedDate || null,
      // New Era's own proposal: nobody on the client side asked (it stays internal)
      requested_by_contact_id: draft.source === 'internal' ? null : draft.contactId || null,
      project_id: draft.projectId || null,
      deployment_id: draft.deploymentId || null,
      priority: draft.priority,
      ...(defaults?.owner_id !== undefined ? { owner_id: defaults.owner_id } : {}),
    };
    const created = await run(() => api.createChangeRequest(input));
    if (!created) return;
    toastSuccess(t('care.kit.requestForm.created', { code: created.code }));
    onCreated?.(created);
    onOpenChange(false);
  }

  const ids = {
    account: `${uid}-account`,
    title: `${uid}-title`,
    details: `${uid}-details`,
    source: `${uid}-source`,
    received: `${uid}-received`,
    contact: `${uid}-contact`,
    project: `${uid}-project`,
    deployment: `${uid}-deployment`,
    priority: `${uid}-priority`,
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('care.kit.requestForm.title')}</DialogTitle>
          <DialogDescription>{t('care.kit.requestForm.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          {fixedAccount ? (
            <div className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg bg-subtle px-3 py-2 ring-1 ring-inset ring-border/60">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="shrink-0 text-[13px] leading-[18px] text-muted-foreground">{t('care.kit.requestForm.account')}</span>
              <span className="min-w-0 truncate text-table font-medium text-ink">{accountName ?? t('common.loading')}</span>
            </div>
          ) : (
            <FormField label={t('care.kit.requestForm.account')} htmlFor={ids.account} required error={accountError}>
              <NativeSelect
                id={ids.account}
                value={draft.accountId}
                placeholder={loadingVisible ? t('common.loading') : t('care.kit.requestForm.accountPlaceholder')}
                onChange={(e) => setDraft((d) => ({ ...d, accountId: e.target.value, contactId: '', projectId: '', deploymentId: '' }))}
              >
                {(accountsQ.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}

          <FormField label={t('care.kit.requestForm.requestTitle')} htmlFor={ids.title} required error={titleError}>
            <Input
              id={ids.title}
              value={draft.title}
              maxLength={200}
              placeholder={t('care.kit.requestForm.requestTitlePlaceholder')}
              onChange={(e) => set('title', e.target.value)}
            />
          </FormField>

          <FormField
            label={t('care.kit.requestForm.details')}
            htmlFor={ids.details}
            hint={draft.source === 'internal' ? t('care.kit.requestForm.internalOnly') : t('care.kit.requestForm.clientSees')}
          >
            <Textarea
              id={ids.details}
              rows={3}
              value={draft.description}
              maxLength={4000}
              placeholder={t('care.kit.requestForm.detailsPlaceholder')}
              onChange={(e) => set('description', e.target.value)}
            />
          </FormField>

          <div className="space-y-2">
            <Label id={ids.source}>{t('care.kit.requestForm.source')}</Label>
            <ToggleGroup
              type="single"
              variant="segmented"
              value={draft.source}
              onValueChange={(v) => {
                if (v) set('source', v as InternalSource);
              }}
              aria-labelledby={ids.source}
              className="grid w-full grid-cols-2"
            >
              {/* 2 × 2 at every width: "Qua Zalo / tin nhắn" and "New Era đề xuất" never break inside a segment */}
              {SOURCES.map((s) => (
                <ToggleGroupItem key={s} value={s} className="w-full px-2">
                  <span className="whitespace-nowrap">{t(`care.crSource.${s}`)}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('care.kit.requestForm.receivedAt')} htmlFor={ids.received}>
              <Input id={ids.received} type="date" className="tabular" value={draft.receivedDate} max={today} onChange={(e) => set('receivedDate', e.target.value)} />
            </FormField>
            <FormField label={t('care.kit.requestForm.requestedBy')} htmlFor={ids.contact}>
              <NativeSelect
                id={ids.contact}
                value={draft.source === 'internal' ? '' : draft.contactId}
                placeholder={t('care.kit.requestForm.requestedByNone')}
                disabled={account === '' || draft.source === 'internal'}
                onChange={(e) => set('contactId', e.target.value)}
              >
                {(contactsQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title ? `${c.full_name} · ${c.title}` : c.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('care.kit.requestForm.project')} htmlFor={ids.project}>
              <NativeSelect
                id={ids.project}
                value={draft.projectId}
                placeholder={t('care.kit.requestForm.none')}
                disabled={account === ''}
                onChange={(e) => set('projectId', e.target.value)}
              >
                {(projectsQ.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label={t('care.kit.requestForm.deployment')} htmlFor={ids.deployment}>
              <NativeSelect
                id={ids.deployment}
                value={draft.deploymentId}
                placeholder={t('care.kit.requestForm.none')}
                disabled={account === ''}
                onChange={(e) => set('deploymentId', e.target.value)}
              >
                {(careQ.data?.deployments ?? [])
                  .filter((d) => d.status !== 'retired')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </NativeSelect>
            </FormField>
          </div>

          <div className="space-y-2">
            <Label id={ids.priority}>{t('care.kit.requestForm.priority')}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={draft.priority}
              onValueChange={(v) => {
                if (v) set('priority', v as CrPriority);
              }}
              aria-labelledby={ids.priority}
              className="flex w-full flex-wrap"
            >
              {CR_PRIORITIES.map((p) => (
                <ToggleGroupItem key={p} value={p} className="flex-1">
                  {t(`care.crPriority.${p}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => !pending && onOpenChange(false)} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} spinnerOverlay>
              {t('care.kit.requestForm.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
