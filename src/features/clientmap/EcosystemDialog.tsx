// "Tạo / sửa tập đoàn": name, short name (shown on the hub bubble), industry, description and the member
// companies (customers + target companies). A company belongs to one ecosystem at a time.
import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Search } from 'lucide-react';
import { isFeatureOn } from '@/config/features';
import { api } from '@/services/api';
import type { EcosystemView } from '@/services/crmContract';
import { AccountLogo } from '@/components/common/account-logo';
import { SMALL } from '@/components/common/cx';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { normalizeText } from '@/lib/utils';
import { SHORT_NAME_MAX } from './mapModel';

export interface EcosystemDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** null = create */
  eco: EcosystemView | null;
  /** every ecosystem (to tell when a company moves from another one) */
  ecosystems: EcosystemView[];
  onSaved?(eco: EcosystemView): void;
}

interface Option {
  key: string;
  kind: 'account' | 'lead';
  id: string;
  name: string;
  sub: string;
  logo: { name: string; logo_url: string | null; brand_color: string };
}

const keyOf = (kind: 'account' | 'lead', id: string) => `${kind}:${id}`;

function useOptions(enabled: boolean) {
  return useQuery(
    async () => {
      const [accounts, leads] = await Promise.all([api.listAccounts(), api.listLeads({})]);
      const options: Option[] = [
        ...accounts.map<Option>((a) => ({
          key: keyOf('account', a.id),
          kind: 'account',
          id: a.id,
          name: a.name,
          sub: a.industry,
          logo: { name: a.short_name || a.name, logo_url: a.logo_url, brand_color: a.brand_color },
        })),
        ...leads
          // only open targets can join a group (a converted lead is its account, a disqualified one is off the map)
          .filter((l) => l.status !== 'converted' && l.status !== 'disqualified')
          .map<Option>((l) => ({
            key: keyOf('lead', l.id),
            kind: 'lead',
            id: l.id,
            name: l.company_name,
            sub: l.industry,
            logo: { name: l.company_name, logo_url: null, brand_color: '' },
          })),
      ];
      return options.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    },
    [],
    { enabled },
  );
}

export function EcosystemDialog({ open, onOpenChange, eco, ecosystems, onSaved }: EcosystemDialogProps) {
  const uid = useId();
  const { run, pending } = useAction();
  const options = useOptions(open);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [tried, setTried] = useState(false);

  // fresh form on every open
  useEffect(() => {
    if (!open) return;
    setName(eco?.name ?? '');
    setShortName(eco?.short_name ?? '');
    setIndustry(eco?.industry ?? '');
    setDescription(eco?.description ?? '');
    setSelected(new Set((eco?.members ?? []).map((m) => keyOf(m.kind, m.id))));
    setQuery('');
    setTried(false);
  }, [open, eco]);

  const otherOwner = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of ecosystems) {
      if (e.id === eco?.id) continue;
      for (const x of e.members) m.set(keyOf(x.kind, x.id), e.short_name || e.name);
    }
    return m;
  }, [ecosystems, eco]);

  const nameError = tried && !name.trim() ? t('clientmap.dialog.errors.name') : null;
  const shortError =
    tried && !shortName.trim()
      ? t('clientmap.dialog.errors.shortName')
      : shortName.trim().length > SHORT_NAME_MAX
        ? t('clientmap.dialog.errors.shortNameLong', { max: SHORT_NAME_MAX })
        : null;

  const leadsOn = isFeatureOn('targets');
  const q = normalizeText(query.trim());
  const visible = (options.data ?? []).filter((o) => !q || normalizeText(`${o.name} ${o.sub}`).includes(q));
  const groups: { kind: 'account' | 'lead'; title: string; items: Option[] }[] = [
    { kind: 'account', title: t('clientmap.dialog.accounts'), items: visible.filter((o) => o.kind === 'account') },
    // without the targets module (SPEC-CARE §1) target companies are not offered; a group's existing ones are kept
    ...(leadsOn ? [{ kind: 'lead' as const, title: t('clientmap.dialog.leads'), items: visible.filter((o) => o.kind === 'lead') }] : []),
  ];

  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!name.trim() || !shortName.trim() || shortName.trim().length > SHORT_NAME_MAX) return;
    const ids = (kind: 'account' | 'lead') =>
      [...selected].filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1));
    const saved = await run(
      () =>
        api.saveEcosystem({
          id: eco?.id,
          name: name.trim(),
          short_name: shortName.trim(),
          description: description.trim(),
          industry: industry.trim() || null,
          account_ids: ids('account'),
          lead_ids: ids('lead'),
        }),
      { success: 'clientmap.dialog.saved', successParams: { name: name.trim() } },
    );
    if (saved) {
      onOpenChange(false);
      onSaved?.(saved);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/* header and the Save bar stay in view; the fields scroll between them (short screens, phone bottom sheet) */}
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle className="text-title font-semibold tracking-tightish text-ink">
              {eco ? t('clientmap.dialog.editTitle') : t('clientmap.dialog.createTitle')}
            </DialogTitle>
            <DialogDescription className="text-table text-muted-foreground">{t('clientmap.dialog.description')}</DialogDescription>
          </DialogHeader>

          {/* px/py room keeps the focus rings of the fields inside the scroll area */}
          <div className="relative -mx-1.5 -my-1.5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1.5 py-1.5">
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <FormField label={t('clientmap.dialog.name')} htmlFor={`${uid}-name`} required error={nameError}>
                <Input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('clientmap.dialog.namePlaceholder')} autoComplete="off" />
              </FormField>
              <FormField
                label={t('clientmap.dialog.shortName')}
                htmlFor={`${uid}-short`}
                required
                error={shortError}
                hint={shortError ? undefined : t('clientmap.dialog.shortNameHint', { max: SHORT_NAME_MAX })}
              >
                <Input
                  id={`${uid}-short`}
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder={t('clientmap.dialog.shortNamePlaceholder')}
                  autoComplete="off"
                />
              </FormField>
            </div>
            <FormField label={t('clientmap.dialog.industry')} htmlFor={`${uid}-industry`}>
              <Input id={`${uid}-industry`} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder={t('clientmap.dialog.industryPlaceholder')} autoComplete="off" />
            </FormField>
            <FormField label={t('clientmap.dialog.descriptionLabel')} htmlFor={`${uid}-desc`}>
              <Textarea id={`${uid}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('clientmap.dialog.descriptionPlaceholder')} rows={2} />
            </FormField>

            <div role="group" aria-labelledby={`${uid}-members`} className="min-w-0 space-y-2">
              <div className="flex items-end justify-between gap-3">
                <p id={`${uid}-members`} className="text-table font-medium text-foreground">
                  {t('clientmap.dialog.members')}
                </p>
                <span className="text-caption tabular" aria-live="polite">
                  {t('clientmap.dialog.selected', { count: selected.size })}
                </span>
              </div>
              <p className="text-caption">{leadsOn ? t('clientmap.dialog.membersHint') : t('clientmap.dialog.membersHintCare')}</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('clientmap.dialog.searchMembers')}
                  aria-label={t('clientmap.dialog.searchMembers')}
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
              {/* relative: the checkboxes' hidden form inputs (absolute) stay clipped here, not in the dialog's scroll */}
              <div className="relative max-h-64 overflow-y-auto rounded-lg border border-border-strong">
                {options.loading ? (
                  <div role="status" className="space-y-3 p-3">
                    <span className="sr-only">{t('clientmap.dialog.loading')}</span>
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-5 w-3/4" />
                  </div>
                ) : visible.length === 0 ? (
                  <p className="p-4 text-caption">{t('clientmap.dialog.noOptions')}</p>
                ) : (
                  groups.map((g) =>
                    g.items.length === 0 ? null : (
                      <div key={g.kind} role="group" aria-label={g.title}>
                        <p className="sticky top-0 z-10 border-b border-border/60 bg-subtle px-3 py-1.5 text-micro font-medium text-muted-foreground">{g.title}</p>
                        <ul className="divide-y divide-border/60">
                          {g.items.map((o) => {
                            const id = `${uid}-${o.key}`;
                            const other = otherOwner.get(o.key);
                            const checked = selected.has(o.key);
                            return (
                              <li key={o.key}>
                                <label htmlFor={id} className="flex min-h-tap cursor-pointer items-center gap-3 px-3 py-2 transition-colors duration-150 hover:bg-subtle">
                                  <Checkbox id={id} checked={checked} onCheckedChange={(v) => toggle(o.key, v === true)} />
                                  <AccountLogo account={o.logo} size="xs" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-table font-medium text-foreground">{o.name}</span>
                                    <span className={cn('block truncate text-muted-foreground', SMALL)}>
                                      {checked && other ? t('clientmap.dialog.inOther', { name: other }) : other ? `${o.sub} · ${other}` : o.sub}
                                    </span>
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ),
                  )
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border/60 pt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('clientmap.dialog.cancel')}
            </Button>
            <Button type="submit" loading={pending}>
              {t('clientmap.dialog.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
