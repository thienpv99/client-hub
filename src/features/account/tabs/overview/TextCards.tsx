// Exec summary (AM writes, client sees it too) and internal notes (New Era only) on the account overview.
import { useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import type { AccountDetail } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { InternalOnlyBadge } from '@/components/common/internal-only-badge';
import { SectionCard } from '@/components/common/section-card';
import { InlineTextEditor } from './InlineTextEditor';

const SUMMARY_MAX_LINES = 3;

function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} aria-label={label}>
      <Pencil aria-hidden="true" />
      {t('common.edit')}
    </Button>
  );
}

export function ExecSummaryCard({ account, canEdit, className }: { account: AccountDetail; canEdit: boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  const { run } = useAction();
  const lines = account.exec_summary
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  async function save(value: string): Promise<boolean> {
    const result = await run(() => api.updateAccount(account.id, { exec_summary: value }), {
      success: 'account.overview.summary.saved',
    });
    if (result) setEditing(false);
    return result !== undefined;
  }

  return (
    <SectionCard
      className={className}
      title={t('account.overview.summary.title')}
      description={
        // phones: the date wraps under the first part without a dangling "·"
        <span className="inline-flex flex-wrap items-center gap-x-3 sm:gap-x-1.5">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('account.overview.summary.clientSees')}
          </span>
          {account.exec_summary_updated_at && lines.length > 0 ? (
            <>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="tabular">{t('account.overview.summary.updated', { date: formatDate(account.exec_summary_updated_at) })}</span>
            </>
          ) : null}
        </span>
      }
      actions={canEdit && !editing && lines.length > 0 ? <EditButton onClick={() => setEditing(true)} label={t('account.overview.summary.edit')} /> : null}
    >
      {editing ? (
        <InlineTextEditor
          initialValue={lines.join('\n')}
          label={t('account.overview.summary.title')}
          placeholder={t('account.overview.summary.placeholder')}
          rows={4}
          maxLines={SUMMARY_MAX_LINES}
          hint={t('account.overview.summary.editorHint')}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : lines.length > 0 ? (
        <ul className="space-y-2">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-3 text-body text-foreground">
              <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-caption/50" aria-hidden="true" />
              <span className="min-w-0 break-words">{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          className="py-6"
          title={t('account.overview.summary.empty')}
          description={canEdit ? t('account.overview.summary.emptyHint') : undefined}
          action={
            canEdit ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                {t('account.overview.summary.write')}
              </Button>
            ) : undefined
          }
        />
      )}
    </SectionCard>
  );
}

export function InternalNotesCard({ account, canEdit, className }: { account: AccountDetail; canEdit: boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  const { run } = useAction();
  const notes = (account.internal_notes ?? '').trim();

  async function save(value: string): Promise<boolean> {
    const result = await run(() => api.updateAccount(account.id, { internal_notes: value }), {
      success: 'account.overview.notes.saved',
    });
    if (result) setEditing(false);
    return result !== undefined;
  }

  return (
    <SectionCard
      className={className}
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          {t('account.overview.notes.title')}
          <InternalOnlyBadge />
        </span>
      }
      actions={canEdit && !editing ? <EditButton onClick={() => setEditing(true)} label={t('account.overview.notes.edit')} /> : null}
    >
      {editing ? (
        <InlineTextEditor
          initialValue={notes}
          label={t('account.overview.notes.title')}
          placeholder={t('account.overview.notes.placeholder')}
          rows={4}
          hint={t('account.overview.notes.editorHint')}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : notes ? (
        <p className="whitespace-pre-line break-words text-table text-foreground">{notes}</p>
      ) : (
        <p className="text-table text-muted-foreground">{t('account.overview.notes.empty')}</p>
      )}
    </SectionCard>
  );
}
