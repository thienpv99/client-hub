// Documents: upload (versioned by doc_key) and visibility. Upload helpers are shared with task actions.

import type { FileItem, FileKind, ID, Visibility } from '@/domain/types';
import { ApiError, type Api, type UploadInput } from '@/services/contract';
import { nowISO } from '@/domain/clock';
import { newId, normalizeText } from '@/lib/utils';
import { assertWritable, isManagerOf, noAccess, requireViewer } from '@/services/context';
import { db } from '@/services/db';
import { logActivity } from '@/services/effects';
import { accessibleIds, canViewTask, fileView, invalidateViewCache, rememberSessionFile } from '@/services/views';

/** data: URLs up to this size are stored in the db (localStorage); bigger uploads live in this tab only */
const MAX_INLINE_CHARS = 400 * 1024;

const FILE_KINDS: readonly FileKind[] = ['design', 'document', 'contract', 'proof', 'data', 'report', 'other'];

/** storage_path for an upload: the data: URL itself when small, else 'session:<key>' (in-memory blob map) */
export function storeUpload(upload: UploadInput): string {
  if (upload.url.startsWith('data:') && upload.url.length <= MAX_INLINE_CHARS) return upload.url;
  const key = newId('upl');
  rememberSessionFile(key, upload.url);
  return `session:${key}`;
}

/** stable doc_key from a file name ('Thiết kế Đặt hàng v2.pdf' → 'thiet-ke-dat-hang-v2'), optionally scoped */
export function docKeyFor(name: string, scope: string | null): string {
  const base =
    normalizeText(name.replace(/\.[^./\\]+$/, ''))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'file';
  return scope ? `${scope}:${base}` : base;
}

/** best-effort kind for an uploaded file */
export function kindForUpload(mime: string, fallback: FileKind = 'document'): FileKind {
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'design';
  if (m.includes('spreadsheet') || m.includes('excel') || m.includes('csv')) return 'data';
  return fallback;
}

export function assertUpload(upload: UploadInput | null | undefined): asserts upload is UploadInput {
  if (!upload || typeof upload.name !== 'string' || !upload.name.trim() || typeof upload.url !== 'string' || !upload.url) {
    throw new ApiError('validation', 'errors.invalid_file');
  }
}

/** user is a client login of this account */
function isClientOf(userId: ID, accountId: ID): boolean {
  const u = db.allRows('users').find((x) => x.id === userId);
  return !!u && u.org_type === 'client' && u.account_id === accountId;
}

/**
 * doc_key for a file uploaded by a CLIENT. A client may only add versions to a document group made entirely of
 * shared files from its own company: never over a New Era document (shared or internal), and the version number
 * must not reveal hidden versions. Any other group → a fresh key of the client's own.
 */
function clientDocKey(accountId: ID, wanted: string): string {
  const group = db.allRows('files').filter((f) => f.account_id === accountId && f.doc_key === wanted);
  if (group.every((f) => f.visibility === 'shared' && isClientOf(f.uploaded_by, accountId))) return wanted;
  return newId('client');
}

/** Insert a file row (call inside db.batch). version = max version of the doc_key in the account + 1. */
export function insertFile(input: {
  account_id: ID;
  project_id: ID | null;
  task_id: ID | null;
  upload: UploadInput;
  visibility: Visibility;
  kind: FileKind;
  uploaded_by: ID;
  note: string | null;
  doc_key?: string;
}): FileItem {
  const wanted = input.doc_key && input.doc_key.trim() ? input.doc_key.trim() : docKeyFor(input.upload.name, input.task_id);
  const docKey = isClientOf(input.uploaded_by, input.account_id) ? clientDocKey(input.account_id, wanted) : wanted;
  const version =
    db
      .allRows('files')
      .filter((f) => f.account_id === input.account_id && f.doc_key === docKey)
      .reduce((max, f) => Math.max(max, f.version), 0) + 1;
  const row: FileItem = {
    id: newId('file'),
    account_id: input.account_id,
    project_id: input.project_id,
    task_id: input.task_id,
    name: input.upload.name.trim(),
    doc_key: docKey,
    version,
    mime: input.upload.mime || 'application/octet-stream',
    size: Number.isFinite(input.upload.size) && input.upload.size > 0 ? input.upload.size : 0,
    storage_path: storeUpload(input.upload),
    visibility: input.visibility,
    kind: input.kind,
    uploaded_by: input.uploaded_by,
    uploaded_at: nowISO(),
    note: input.note,
    deleted_at: null,
  };
  return db.insert('files', row);
}

export const filesApi: Pick<Api, 'uploadFile' | 'setFileVisibility'> = {
  async uploadFile(accountId, input) {
    const v = requireViewer();
    assertWritable(v);
    if (!db.find('accounts', accountId)) throw new ApiError('not_found', 'errors.not_found');
    if (!accessibleIds(v).has(accountId)) throw noAccess(v);
    assertUpload(input);
    const client = v.org_type === 'client';
    if (input.visibility !== 'internal' && input.visibility !== 'shared') throw new ApiError('validation', 'errors.invalid_visibility');
    // clients can only share with New Era; they never create internal documents
    if (client && input.visibility !== 'shared') throw new ApiError('forbidden', 'errors.forbidden');
    if (!FILE_KINDS.includes(input.kind)) throw new ApiError('validation', 'errors.invalid_file');

    let projectId: ID | null = input.project_id ?? null;
    const taskId: ID | null = input.task_id ?? null;
    let assignedToMe = false;
    if (taskId) {
      const task = db.find('tasks', taskId);
      const project = task ? db.find('projects', task.project_id) : undefined;
      if (!task || !project || project.account_id !== accountId || !canViewTask(task, v)) {
        throw new ApiError('validation', 'errors.invalid_task');
      }
      projectId = projectId ?? task.project_id;
      assignedToMe = task.assignee_id === v.user.id;
    }
    // sharing a document with the client is the AM's call; a member shares only on a task assigned to them
    if (!client && input.visibility === 'shared' && !isManagerOf(v, accountId) && !assignedToMe) {
      throw new ApiError('forbidden', 'errors.forbidden');
    }
    if (projectId) {
      const project = db.find('projects', projectId);
      if (!project || project.account_id !== accountId) throw new ApiError('validation', 'errors.invalid_project');
    }

    const { result } = db.batch(() => {
      const file = insertFile({
        account_id: accountId,
        project_id: projectId,
        task_id: taskId,
        upload: input,
        visibility: input.visibility,
        kind: input.kind,
        uploaded_by: v.user.id,
        note: input.note?.trim() || null,
        doc_key: input.doc_key,
      });
      invalidateViewCache();
      logActivity({
        account_id: accountId,
        actor_id: v.user.id,
        action: 'file.uploaded',
        target_type: 'file',
        target_id: file.id,
        params: taskId ? { file: file.name, version: file.version, task_id: taskId } : { file: file.name, version: file.version },
        visibility: file.visibility,
      });
      return file;
    });
    const view = fileView(result, v);
    if (!view) throw new ApiError('not_found', 'errors.not_found');
    return view;
  },

  async setFileVisibility(id, visibility) {
    const v = requireViewer();
    assertWritable(v);
    const file = db.find('files', id);
    if (!file) throw new ApiError('not_found', 'errors.not_found');
    if (!isManagerOf(v, file.account_id)) throw new ApiError('forbidden', 'errors.forbidden');
    if (visibility !== 'internal' && visibility !== 'shared') throw new ApiError('validation', 'errors.invalid_visibility');
    if (file.visibility !== visibility) {
      db.batch(() => {
        db.update('files', id, { visibility });
        logActivity({
          account_id: file.account_id,
          actor_id: v.user.id,
          action: 'file.visibility_changed',
          target_type: 'file',
          target_id: id,
          params: { file: file.name, visibility },
          visibility: 'internal',
        });
      });
    }
    const view = fileView(db.get('files', id), v);
    if (!view) throw new ApiError('not_found', 'errors.not_found');
    return view;
  },
};
