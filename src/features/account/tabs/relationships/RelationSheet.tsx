// Add / edit a person-to-person link (drawer): two people of this company or of the same business group, the kind of
// relation and a note; shows the sentence it will read as. → api.saveRelationLink / deleteRelationLink (director, an
// AM managing at least one end). Sister-company people come from the group the viewer may read (getGroupMatrix units).
import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { RelationKind } from '@/domain/careTypes';
import { RELATION_KINDS } from '@/domain/careTypes';
import type { AccountDetail, AccountRef } from '@/services/contract';
import type { RelationLinkInput, RelationView } from '@/services/careContract';
import { api } from '@/services/api';
import { addressName } from '@/domain/naming';
import type { Salutation } from '@/domain/types';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { capitalize, t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/common/confirm-dialog';

interface Person {
  id: string;
  full_name: string;
  title: string;
  salutation: Salutation;
  account: Pick<AccountRef, 'id' | 'name' | 'short_name'>;
}

interface Draft {
  from: string;
  to: string;
  kind: RelationKind;
  note: string;
}

export interface RelationSheetProps {
  account: AccountDetail;
  ecosystemId: string | null;
  /** null = a new link (`fromContactId` preselects the first person) */
  relation: RelationView | null;
  fromContactId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RelationSheet({ account, ecosystemId, relation, fromContactId, open, onOpenChange }: RelationSheetProps) {
  const uid = useId();
  const { run, pending, pendingVisible } = useAction();
  const [draft, setDraft] = useState<Draft>({ from: '', to: '', kind: 'works_with', note: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  // people of the sister companies the viewer may read (the director: all; an AM: her own companies of the group)
  const sisters = useQuery(
    async () => {
      if (!ecosystemId) return [];
      const matrix = await api.getGroupMatrix(ecosystemId);
      const others = matrix.units.filter((u) => u.account.id !== account.id);
      const lists = await Promise.all(
        others.map(async (u) => {
          try {
            return { account: u.account, contacts: await api.listContacts(u.account.id) };
          } catch {
            return null;
          }
        }),
      );
      return lists.filter((x): x is NonNullable<typeof x> => x !== null);
    },
    [ecosystemId, account.id],
    { enabled: open && !!ecosystemId },
  );

  const groups = useMemo(() => {
    const mine: Person[] = account.contacts.map((c) => ({ id: c.id, full_name: c.full_name, title: c.title, salutation: c.salutation, account }));
    const out: { account: Person['account']; people: Person[] }[] = [{ account, people: mine }];
    for (const s of sisters.data ?? []) {
      out.push({
        account: s.account,
        people: s.contacts.map((c) => ({ id: c.id, full_name: c.full_name, title: c.title, salutation: c.salutation, account: s.account })),
      });
    }
    // a link being edited may name someone outside these lists: keep both ends selectable
    if (relation) {
      for (const end of [relation.from, relation.to]) {
        if (!out.some((g) => g.people.some((p) => p.id === end.contact_id))) {
          out.push({
            account: end.account,
            people: [{ id: end.contact_id, full_name: end.full_name, title: end.title, salutation: end.salutation, account: end.account }],
          });
        }
      }
    }
    return out;
  }, [account, sisters.data, relation]);
  const byId = useMemo(() => new Map(groups.flatMap((g) => g.people.map((p) => [p.id, p] as const))), [groups]);

  useEffect(() => {
    if (!open) return;
    setDraft(
      relation
        ? { from: relation.from.contact_id, to: relation.to.contact_id, kind: relation.kind, note: relation.note ?? '' }
        : { from: fromContactId ?? '', to: '', kind: 'works_with', note: '' },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, relation?.id, fromContactId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const from = byId.get(draft.from);
  const to = byId.get(draft.to);
  const sameError = draft.from && draft.from === draft.to ? t('care.errors.relationSelf') : null;
  const preview =
    from && to && !sameError
      ? from.account.id === to.account.id
        ? t('care.relationSentence.same', {
            from: capitalize(addressName(from.salutation, from.full_name)),
            verb: t(`care.relationVerb.${draft.kind}`),
            to: addressName(to.salutation, to.full_name),
          })
        : t('care.relationSentence.cross', {
            from: capitalize(addressName(from.salutation, from.full_name)),
            fromAccount: from.account.short_name || from.account.name,
            verb: t(`care.relationVerb.${draft.kind}`),
            to: addressName(to.salutation, to.full_name),
            toAccount: to.account.short_name || to.account.name,
          })
      : null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !draft.from || !draft.to || sameError) return;
    const input: RelationLinkInput = {
      ...(relation ? { id: relation.id } : {}),
      from_contact_id: draft.from,
      to_contact_id: draft.to,
      kind: draft.kind,
      note: draft.note.trim() || null,
    };
    const saved = await run(() => api.saveRelationLink(input));
    if (!saved) return;
    toastSuccess(t('careAccount.relationships.relation.saved'));
    onOpenChange(false);
  }

  async function remove() {
    if (!relation) return false;
    const ok = await run(async () => {
      await api.deleteRelationLink(relation.id);
      return true;
    });
    if (!ok) return false;
    toastSuccess(t('careAccount.relationships.relation.deleted'));
    onOpenChange(false);
    return true;
  }

  const ids = { from: `${uid}-from`, kind: `${uid}-kind`, to: `${uid}-to`, note: `${uid}-note` };
  const options = groups.map((g) => (
    <optgroup
      key={g.account.id}
      label={g.account.id === account.id ? t('careAccount.relationships.relation.toGroupThis', { account: g.account.short_name || g.account.name }) : g.account.name}
    >
      {g.people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title ? `${p.full_name} · ${p.title}` : p.full_name}
        </option>
      ))}
    </optgroup>
  ));

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
        <SheetContent side="right" mobileFullScreen className="md:max-w-lg lg:max-w-lg">
          <SheetHeader className="border-b border-border/70">
            <SheetTitle>{relation ? t('careAccount.relationships.relation.editTitle') : t('careAccount.relationships.relation.addTitle')}</SheetTitle>
            <SheetDescription>{t('careAccount.relationships.relation.description')}</SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-1 flex-col" noValidate>
            <SheetBody className="space-y-5 pt-5 md:pt-6">
              <FormField label={t('careAccount.relationships.relation.from')} htmlFor={ids.from} required>
                <NativeSelect id={ids.from} value={draft.from} placeholder={t('careAccount.relationships.relation.pick')} onChange={(e) => set('from', e.target.value)}>
                  {options}
                </NativeSelect>
              </FormField>
              <FormField label={t('careAccount.relationships.relation.kind')} htmlFor={ids.kind}>
                <NativeSelect id={ids.kind} value={draft.kind} onChange={(e) => set('kind', e.target.value as RelationKind)}>
                  {RELATION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`care.relationKind.${k}`)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label={t('careAccount.relationships.relation.to')} htmlFor={ids.to} required error={sameError}>
                <NativeSelect id={ids.to} value={draft.to} placeholder={t('careAccount.relationships.relation.pick')} onChange={(e) => set('to', e.target.value)}>
                  {options}
                </NativeSelect>
              </FormField>
              {preview ? (
                <p className="rounded-lg bg-subtle p-3 text-pretty text-table text-foreground ring-1 ring-inset ring-border/60">
                  {t('careAccount.relationships.relation.preview', { sentence: preview })}
                </p>
              ) : null}
              <FormField label={t('careAccount.relationships.relation.note')} htmlFor={ids.note} hint={t('careAccount.common.internalOnly')}>
                <Textarea
                  id={ids.note}
                  rows={3}
                  maxLength={400}
                  className="bg-note"
                  value={draft.note}
                  placeholder={t('careAccount.relationships.relation.notePlaceholder')}
                  onChange={(e) => set('note', e.target.value)}
                />
              </FormField>
            </SheetBody>
            <SheetFooter className={cn(relation && 'sm:justify-between')}>
              {relation ? (
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pendingVisible} className="text-danger hover:text-danger">
                  <Trash2 aria-hidden="true" />
                  {t('careAccount.relationships.relation.delete')}
                </Button>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={pending} spinnerOverlay disabled={!draft.from || !draft.to || !!sameError}>
                  {t('common.save')}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      {relation ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t('careAccount.relationships.relation.deleteTitle')}
          description={t('careAccount.relationships.relation.deleteDescription', { sentence: relation.sentence })}
          confirmLabel={t('common.delete')}
          destructive
          onConfirm={remove}
        />
      ) : null}
    </>
  );
}
