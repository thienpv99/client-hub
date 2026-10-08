// "Nội bộ" / "Chia sẻ với khách" for one file version. Managers switch it (5-second undo); others see a badge.
import { useEffect, useState } from 'react';
import { Lock, Users } from 'lucide-react';
import type { FileView, Visibility } from '@/services/contract';
import { api } from '@/services/api';
import { toastApiError, useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { toastSuccess } from '@/lib/toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SharedBadge } from '@/components/common/file-list';
import { InternalOnlyBadge } from '@/components/common/internal-only-badge';
import { enumLabel } from '@/components/common/labels';

function isVisibility(v: string): v is Visibility {
  return v === 'internal' || v === 'shared';
}

export interface VisibilityControlProps {
  file: FileView;
  canEdit: boolean;
  /** version label for the accessible name ("v2") */
  versionLabel?: string;
}

export function VisibilityControl({ file, canEdit, versionLabel }: VisibilityControlProps) {
  const { run, pending, pendingVisible } = useAction();
  // optimistic: the segment indicator glides to the new side at once; the refetched file then takes over
  // (a refused change snaps back — useAction toasts why)
  const [optimistic, setOptimistic] = useState<Visibility | null>(null);
  useEffect(() => {
    if (optimistic !== null && file.visibility === optimistic) setOptimistic(null);
  }, [file.visibility, optimistic]);
  if (!canEdit) return file.visibility === 'internal' ? <InternalOnlyBadge /> : <SharedBadge />;
  const shown = optimistic ?? file.visibility;

  async function change(next: Visibility) {
    if (pending || next === shown) return;
    const previous = file.visibility;
    setOptimistic(next);
    const result = await run(() => api.setFileVisibility(file.id, next));
    if (!result) {
      setOptimistic(null);
      return;
    }
    toastSuccess(t(next === 'shared' ? 'account.documents.sharedToast' : 'account.documents.internalToast', { name: file.name }), {
      onUndo: async () => {
        try {
          await api.setFileVisibility(file.id, previous);
          toastSuccess(t('common.toast.undone'));
        } catch (err) {
          toastApiError(err);
        }
      },
    });
  }

  const name = versionLabel ? `${file.name} (${versionLabel})` : file.name;
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      size="sm"
      value={shown}
      onValueChange={(v) => {
        if (isVisibility(v)) void change(v);
      }}
      disabled={pendingVisible}
      aria-busy={pending || undefined}
      aria-label={t('account.documents.visibilityLabel', { name })}
      className="shrink-0"
    >
      <ToggleGroupItem value="internal">
        <Lock aria-hidden="true" />
        {enumLabel('visibility', 'internal')}
      </ToggleGroupItem>
      {/* phones: short label so the switch fits beside the row's icons; the full label stays the accessible name */}
      <ToggleGroupItem value="shared" aria-label={enumLabel('visibility', 'shared')}>
        <Users aria-hidden="true" />
        <span className="sm:hidden">{t('account.documents.sharedShort')}</span>
        <span className="hidden sm:inline">{enumLabel('visibility', 'shared')}</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
