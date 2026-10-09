import type { ReactNode } from 'react';
import type { ActivityView } from '@/services/contract';
import { hasKey, t } from '@/i18n';
import { cx } from './cx';
import { DateText } from './date-text';
import { UserAvatar } from './user-avatar';

function actorName(item: ActivityView): string {
  return item.actor?.full_name ?? t('components.activity.system');
}

/** "{actor} đã duyệt “…”" from activity.<action>; a generic sentence when the key or a parameter is missing. */
export function activitySentence(item: ActivityView): string {
  const actor = actorName(item);
  const key = `activity.${item.action}`;
  if (hasKey(key)) {
    // request codes ("YC-09") never break at their hyphen: a non-breaking hyphen (U+2011) in the sentence
    const params =
      item.action.startsWith('change_request.') && typeof item.params.code === 'string'
        ? { ...item.params, code: item.params.code.replace(/-/g, '‑') }
        : item.params;
    const sentence = t(key, { ...params, actor });
    if (!/\{\w+\}/.test(sentence)) return sentence;
  }
  return t('components.activity.generic', { actor });
}

/** Bold the actor when the sentence starts with their name. */
function renderSentence(sentence: string, actor: string): ReactNode {
  if (!actor || !sentence.startsWith(actor)) return sentence;
  return (
    <>
      <span className="font-semibold text-ink">{actor}</span>
      {sentence.slice(actor.length)}
    </>
  );
}

export interface ActivityFeedProps {
  items: ActivityView[];
  /** smaller avatars (side columns, drawers) */
  compact?: boolean;
  emptyText?: string;
  className?: string;
}

/**
 * "Cập nhật mới" / history as a quiet timeline: avatar on a thin connector, sentence, relative time
 * (absolute date in the tooltip).
 */
export function ActivityFeed({ items, compact = false, emptyText, className }: ActivityFeedProps) {
  if (items.length === 0) {
    return <p className={cx('text-table text-muted-foreground', className)}>{emptyText ?? t('components.activity.empty')}</p>;
  }
  // connector x = avatar centre (xs 20px → 10px, sm 28px → 14px), starting under the avatar
  const rail = compact ? 'left-[9.5px] top-6' : 'left-[13.5px] top-8';
  return (
    <ol className={cx('relative', className)}>
      {items.map((item, i) => {
        const actor = actorName(item);
        const sentence = activitySentence(item);
        const last = i === items.length - 1;
        return (
          <li key={item.id} className={cx('relative flex gap-3', last ? '' : compact ? 'pb-4' : 'pb-5')}>
            {last ? null : <span aria-hidden="true" className={cx('absolute bottom-1 w-px bg-border', rail)} />}
            <span className="relative shrink-0" aria-hidden="true">
              <UserAvatar user={item.actor} size={compact ? 'xs' : 'sm'} />
            </span>
            <div className={cx('min-w-0 flex-1', compact ? '' : 'pt-0.5')}>
              <p className="break-words text-table text-foreground">{renderSentence(sentence, actor)}</p>
              <DateText value={item.created_at} relative time className="mt-0.5 inline-block text-micro text-muted-foreground" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
