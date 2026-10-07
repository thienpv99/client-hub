// Comments of a task (SPEC §4.2). Internal viewers write either a reply the client sees ("Trả lời khách") or an
// internal note ("Ghi chú nội bộ", pale yellow + lock). The composer defaults to the internal note — it switches to
// "Trả lời khách" only when the user clicks "Trả lời" on a client comment — and always states its audience.
// Client viewers see shared comments only and have one composer.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { CornerDownRight, Eye, Lock, Reply, Send, X } from 'lucide-react';
import type { CommentView, TaskDetail, Visibility } from '@/services/contract';
import { api } from '@/services/api';
import { useAction } from '@/hooks/useAction';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SMALL } from '@/components/common/cx';
import { DateText } from '@/components/common/date-text';
import { UserAvatar } from '@/components/common/user-avatar';
import { ReadOnlyHint } from './ClientActions';
import { salutationParams } from './taskHelpers';

function excerpt(s: string, max = 90): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

function CommentItem({ comment, parent, onReply }: { comment: CommentView; parent: CommentView | null; onReply?: () => void }) {
  const internal = comment.visibility === 'internal';
  return (
    // every item has the same inner padding (the list hangs it into the margin), so the avatars line up; an
    // internal note is a pale-yellow inset with a lock (SPEC §4.2)
    <li className={cn('flex gap-3 rounded-lg px-3 py-2.5', internal && 'bg-note ring-1 ring-inset ring-note-border')}>
      <span className="shrink-0 pt-0.5">
        <UserAvatar user={comment.author} size="sm" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-table font-semibold text-ink">{comment.author.full_name}</span>
          <DateText value={comment.created_at} relative time className="text-micro text-muted-foreground" />
          {internal ? (
            <span className="inline-flex items-center gap-1 text-micro font-medium text-muted-foreground">
              <Lock className="h-3 w-3 shrink-0 text-warning" strokeWidth={2.25} aria-hidden="true" />
              {t('task.comments.internalTag')}
            </span>
          ) : null}
        </p>
        {parent ? (
          <p className={cn('mt-1 flex items-start gap-1.5 border-l-2 border-border pl-2 text-muted-foreground', SMALL)}>
            <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              <span className="font-medium">{t('task.comments.replyTo', { name: parent.author.full_name })}</span>: {excerpt(parent.body)}
            </span>
          </p>
        ) : null}
        <p className="mt-1 whitespace-pre-wrap break-words text-table text-foreground">{comment.body}</p>
        {onReply ? (
          <Button type="button" variant="link" size="sm" onClick={onReply} className="mt-0.5 gap-1 text-[13px] leading-[18px]">
            <Reply aria-hidden="true" />
            {t('task.comments.reply')}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export interface CommentsPanelProps {
  task: TaskDetail;
  className?: string;
}

export function CommentsPanel({ task, className }: CommentsPanelProps) {
  const viewer = useViewer();
  const internalViewer = viewer?.org_type === 'internal';
  const readOnly = !!viewer?.read_only;
  const sal = salutationParams(viewer);
  const { run, pending } = useAction();
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canShared = task.can.comment_shared;
  const canInternal = internalViewer && task.can.comment_internal;
  const defaultTab: Visibility = canInternal ? 'internal' : 'shared';

  const [tab, setTab] = useState<Visibility>(defaultTab);
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [draft, setDraft] = useState('');
  // set by "Trả lời": the "Trả lời khách" composer takes the focus as soon as its panel has mounted it
  const focusOnMount = useRef(false);
  const setTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    if (el && focusOnMount.current) {
      focusOnMount.current = false;
      el.focus();
    }
  }, []);

  // another task in the same drawer → start over
  useEffect(() => {
    setTab(defaultTab);
    setReplyTo(null);
    setDraft('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const byId = useMemo(() => new Map(task.comments.map((c) => [c.id, c])), [task.comments]);
  const audience: Visibility = internalViewer ? tab : 'shared';
  const asNote = internalViewer && audience === 'internal';
  const canWrite = !readOnly && (audience === 'internal' ? canInternal : canShared);
  const showComposer = readOnly || canShared || canInternal;

  function startReply(c: CommentView) {
    setReplyTo(c);
    if (tab === 'shared' && textareaRef.current) {
      textareaRef.current.focus();
      return;
    }
    focusOnMount.current = true;
    setTab('shared');
  }

  async function send() {
    const body = draft.trim();
    if (!body || !canWrite) return;
    const result = await run(() => api.addComment(task.id, body, audience, audience === 'shared' ? replyTo?.id : undefined));
    if (result === undefined) return;
    setDraft('');
    setReplyTo(null);
    // back to the safe default after a reply to the client
    if (internalViewer) setTab(defaultTab);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send();
    }
  }

  const emptyText = internalViewer ? t('task.comments.empty') : t('task.comments.emptyClient', sal);
  const placeholder = !internalViewer
    ? t('task.comments.placeholderClient')
    : asNote
      ? t('task.comments.placeholderInternal')
      : t('task.comments.placeholderShared');
  const audienceText = !internalViewer
    ? t('task.comments.audienceClient')
    : asNote
      ? t('task.comments.audienceInternal')
      : t('task.comments.audienceShared');

  const composer = (
    <div className="space-y-2">
      {audience === 'shared' && replyTo ? (
        <div className={cn('flex items-center gap-2 rounded-lg bg-muted py-1 pl-3 pr-1 text-muted-foreground', SMALL)}>
          <CornerDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">{t('task.comments.replyingTo', { name: replyTo.author.full_name })}</span>: {excerpt(replyTo.body, 60)}
          </span>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label={t('task.comments.cancelReply')}
            className="touch-tap-square inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-card"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <label htmlFor={`${id}-comment`} className="sr-only">
        {t('task.comments.label')}
      </label>
      <Textarea
        id={`${id}-comment`}
        ref={setTextarea}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={3}
        disabled={!canWrite || pending}
        aria-describedby={`${id}-audience`}
        className={cn(asNote && 'border-note-border bg-note focus:border-warning focus:shadow-[0_0_0_3px_rgb(var(--warning)/0.15)]')}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          id={`${id}-audience`}
          className={cn(
            'inline-flex min-h-7 items-center gap-1.5 rounded-md px-2 py-1 font-medium',
            SMALL,
            asNote ? 'bg-note text-foreground ring-1 ring-inset ring-note-border' : 'bg-muted text-muted-foreground',
          )}
        >
          {asNote ? (
            <Lock className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          ) : (
            <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          {audienceText}
        </p>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-caption lg:inline">{t('task.comments.shortcut')}</span>
          <Button
            type="button"
            size="sm"
            onClick={() => void send()}
            disabled={!canWrite || !draft.trim()}
            loading={pending}
            variant={asNote ? 'secondary' : 'default'}
          >
            {!pending && <Send aria-hidden="true" />}
            {asNote ? t('task.comments.saveNote') : t('task.comments.send')}
          </Button>
        </div>
      </div>
      {readOnly ? <ReadOnlyHint /> : null}
    </div>
  );

  return (
    <div className={cn('space-y-4', className)}>
      {task.comments.length === 0 ? (
        <p className="text-table text-muted-foreground">{emptyText}</p>
      ) : (
        <ol className="-mx-3 space-y-1">
          {task.comments.map((c) => {
            const parent = c.reply_to_id ? (byId.get(c.reply_to_id) ?? null) : null;
            const replyable = internalViewer && !readOnly && canShared && c.visibility === 'shared' && c.author.org_type === 'client';
            return <CommentItem key={c.id} comment={c} parent={parent} onReply={replyable ? () => startReply(c) : undefined} />;
          })}
        </ol>
      )}

      {showComposer ? (
        internalViewer ? (
          <Tabs value={tab} onValueChange={(v) => (v === 'shared' || v === 'internal' ? setTab(v) : undefined)}>
            <TabsList aria-label={t('task.comments.tabs')} className="w-full sm:w-auto">
              <TabsTrigger value="internal" className="flex-1 sm:flex-none" disabled={!canInternal}>
                <Lock aria-hidden="true" />
                {t('task.comments.tabInternal')}
              </TabsTrigger>
              <TabsTrigger value="shared" className="flex-1 sm:flex-none" disabled={!canShared}>
                <Eye aria-hidden="true" />
                {t('task.comments.tabShared')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="internal" className="mt-3">
              {composer}
              {!canShared && !readOnly ? <p className="mt-2 text-caption">{t('task.comments.sharedDisabled')}</p> : null}
            </TabsContent>
            <TabsContent value="shared" className="mt-3">
              {composer}
            </TabsContent>
          </Tabs>
        ) : (
          composer
        )
      ) : null}
    </div>
  );
}
