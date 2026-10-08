// Manual health override (SPEC §3: the AM may override the computed health, with a reason).
// Short required input → dialog. "Tự động" clears the override.
import { useEffect, useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import type { AccountDetail, Health } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { HealthBadge, healthLabel } from '@/components/common/health-badge';
import { HealthReasons } from './HealthReasons';

type Choice = 'auto' | Health;

const HEALTHS: Health[] = ['blocked', 'attention', 'on_track'];

function isChoice(v: string): v is Choice {
  return v === 'auto' || (HEALTHS as string[]).includes(v);
}

function OptionRow({ id, value, children }: { id: string; value: Choice; children: ReactNode }) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-tap cursor-pointer items-center gap-3 rounded-lg bg-card px-3 py-2.5 ring-1 ring-inset ring-border-strong/70 transition-[background-color,box-shadow] duration-150 hover:bg-subtle has-[[data-state=checked]]:bg-primary-soft has-[[data-state=checked]]:ring-primary-border"
    >
      <RadioGroupItem id={id} value={value} />
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">{children}</span>
    </label>
  );
}

export interface HealthOverrideDialogProps {
  account: AccountDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthOverrideDialog({ account, open, onOpenChange }: HealthOverrideDialogProps) {
  const id = useId();
  const current: Choice = account.health_override ?? 'auto';
  const currentReason = account.health.override_reason ?? '';
  const [choice, setChoice] = useState<Choice>(current);
  const [reason, setReason] = useState(currentReason);
  const { run, pending, pendingVisible } = useAction();

  useEffect(() => {
    if (open) {
      setChoice(current);
      setReason(currentReason);
    }
    // reset only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const overriding = choice !== 'auto';
  const trimmed = reason.trim();
  const changed = choice !== current || (overriding && trimmed !== currentReason.trim());
  // `ready` draws the save button (it shows its own busy look after 150 ms); `canSave` also guards a double submit
  const ready = changed && (!overriding || trimmed.length > 0);
  const canSave = ready && !pending;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;
    const health = choice === 'auto' ? null : choice;
    const result = await run(() => api.overrideHealth(account.id, health, health ? trimmed : ''), {
      success: health ? 'account.health.toastOverride' : 'account.health.toastAuto',
      successParams: health ? { health: healthLabel(health) } : undefined,
    });
    if (result) onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('account.health.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('account.health.dialogDescription', { account: account.name })}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void submit(e)} className="space-y-5">
          <div className="rounded-lg bg-subtle p-3 ring-1 ring-inset ring-border/60">
            <p className="flex flex-wrap items-center gap-2 text-caption">
              {t('account.health.autoNow')}
              <HealthBadge health={account.health.auto} size="sm" />
            </p>
            <HealthReasons reasons={account.health.reasons} max={3} className="mt-2.5" />
          </div>

          <fieldset>
            <legend className="mb-1.5 text-table font-medium text-foreground">{t('account.health.optionsLabel')}</legend>
            <RadioGroup
              value={choice}
              onValueChange={(v) => {
                if (isChoice(v)) setChoice(v);
              }}
              className="gap-2"
              disabled={pending}
            >
              <OptionRow id={`${id}-auto`} value="auto">
                <span className="inline-flex items-center gap-1.5 text-table font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {t('account.health.auto')}
                </span>
                <span className="text-caption">{t('account.health.autoHint', { health: healthLabel(account.health.auto) })}</span>
              </OptionRow>
              {HEALTHS.map((h) => (
                <OptionRow key={h} id={`${id}-${h}`} value={h}>
                  <HealthBadge health={h} size="sm" />
                  {current === h ? <span className="ml-auto text-caption">{t('account.health.currentManual')}</span> : null}
                </OptionRow>
              ))}
            </RadioGroup>
          </fieldset>

          {overriding ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-reason`}>
                {t('account.health.reasonLabel')}
                <span className="ml-0.5 text-danger" aria-hidden="true">
                  *
                </span>
              </Label>
              <Textarea
                id={`${id}-reason`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={t('account.health.reasonPlaceholder')}
                rows={3}
                required
                aria-required="true"
                aria-describedby={`${id}-reason-hint`}
                disabled={pending}
              />
              <p id={`${id}-reason-hint`} className="flex items-start gap-1.5 text-caption">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                {t('account.health.reasonHint')}
              </p>
            </div>
          ) : current !== 'auto' ? (
            <p className="text-caption">{t('account.health.clearHint')}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => (pending ? undefined : onOpenChange(false))} disabled={pendingVisible}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!ready} loading={pending}>
              {t('account.health.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
