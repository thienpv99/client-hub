// "Gửi yêu cầu mới" (SPEC-CARE §6.7): the client asks New Era for a change — what (required), details, project,
// how urgent. Short input → a dialog (phones: bottom sheet). → api.submitRequest; the request starts "Đã gửi, chờ
// New Era tiếp nhận" and the AM is told. The draft survives an accidental close; it is cleared once sent.
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { CrPriority } from '@/domain/careTypes';
import { CR_PRIORITIES } from '@/domain/careTypes';
import type { ClientChangeRequestView } from '@/services/careContract';
import { api } from '@/services/api';
import { t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';
import { useAction } from '@/hooks/useAction';
import { usePortalProject } from '@/hooks/usePortalProject';
import { useQuery } from '@/hooks/useQuery';
import { useViewer } from '@/hooks/useViewer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { saluteOf } from './portalText';

export interface RequestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: (request: ClientChangeRequestView) => void;
}

interface Draft {
  title: string;
  description: string;
  /** '' = company-wide */
  projectId: string;
  priority: CrPriority;
}

const EMPTY: Draft = { title: '', description: '', projectId: '', priority: 'normal' };

export function RequestFormDialog({ open, onOpenChange, onSent }: RequestFormDialogProps) {
  const uid = useId();
  const viewer = useViewer();
  const salute = saluteOf(viewer);
  const { projectId, projects } = usePortalProject();
  const { run, pending, pendingVisible } = useAction();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);
  // who receives it: the AM named in the dialog ("đến thẳng chị Hà")
  const home = useQuery(() => api.getPortalHome(), [viewer?.user.id], { enabled: open && !!viewer });
  const am = home.data?.am ?? null;

  // a fresh draft follows the page's project (or the only project); a draft in progress is kept as it is
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setDraft((d) => {
      if (d.title || d.description) return d;
      const fallback = projectId ?? (projects.length === 1 ? (projects[0]?.id ?? '') : '');
      return { ...d, projectId: fallback };
    });
  }, [open, projectId, projects]);

  const ids = {
    title: `${uid}-title`,
    details: `${uid}-details`,
    project: `${uid}-project`,
    priority: `${uid}-priority`,
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const titleMissing = draft.title.trim() === '';
  const titleError = touched && titleMissing ? t('carePortal.form.titleRequired', { you: salute.you }) : null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (pending) return;
    if (titleMissing) {
      document.getElementById(ids.title)?.focus();
      return;
    }
    const sent = await run(() =>
      api.submitRequest({
        title: draft.title.trim(),
        description: draft.description.trim(),
        project_id: draft.projectId || null,
        priority: draft.priority,
      }),
    );
    if (!sent) return;
    toastSuccess(t('carePortal.form.sent', { code: sent.code, you: salute.you }));
    setDraft(EMPTY);
    setTouched(false);
    onOpenChange(false);
    onSent?.(sent);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('carePortal.form.title')}</DialogTitle>
          <DialogDescription>
            {am ? t('carePortal.form.description', { am: am.full_name, you: salute.you }) : t('carePortal.form.descriptionNoAm', { you: salute.you })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-5" noValidate>
          <FormField label={t('carePortal.form.requestTitle', { You: salute.You })} htmlFor={ids.title} required error={titleError}>
            <Input
              id={ids.title}
              value={draft.title}
              maxLength={200}
              autoComplete="off"
              placeholder={t('carePortal.form.requestTitlePlaceholder')}
              onChange={(e) => set('title', e.target.value)}
            />
          </FormField>

          <FormField label={t('carePortal.form.details')} htmlFor={ids.details} hint={t('carePortal.form.detailsHint')}>
            <Textarea id={ids.details} rows={4} value={draft.description} maxLength={4000} onChange={(e) => set('description', e.target.value)} />
          </FormField>

          {projects.length > 0 ? (
            <FormField label={t('carePortal.form.project')} htmlFor={ids.project}>
              <NativeSelect id={ids.project} value={draft.projectId} onChange={(e) => set('projectId', e.target.value)}>
                <option value="">{t('carePortal.form.projectNone')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}

          <div className="space-y-2">
            <Label id={ids.priority}>{t('carePortal.form.priority')}</Label>
            <ToggleGroup
              type="single"
              variant="segmented"
              value={draft.priority}
              onValueChange={(v) => {
                if (v) set('priority', v as CrPriority);
              }}
              aria-labelledby={ids.priority}
              className="grid w-full grid-cols-3"
            >
              {CR_PRIORITIES.map((p) => (
                <ToggleGroupItem key={p} value={p} className="w-full px-2">
                  <span className="truncate">{t(`care.crPriority.${p}`)}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => !pending && onOpenChange(false)} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending} spinnerOverlay>
              {t('carePortal.form.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
