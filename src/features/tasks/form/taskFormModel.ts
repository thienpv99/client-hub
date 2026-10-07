// Form state, validation and the "Nếu trễ thì sao" suggestion of TaskFormDialog. The service validates again.
import type { ISODate } from '@/domain/types';
import type { ClientTaskType, MilestoneView, TaskDetail, TaskInput, TaskSide, TaskType, TaskView } from '@/services/contract';
import { todayISO } from '@/domain/clock';
import { addDays, isValidISODate } from '@/domain/dates';
import { t } from '@/i18n';
import { formatDateShort } from '@/lib/format';

export const CLIENT_TYPES: readonly ClientTaskType[] = ['approval', 'upload', 'confirm', 'sign', 'payment', 'attend', 'answer'];

export interface TaskFormState {
  project_id: string;
  /** '' = no milestone */
  milestone_id: string;
  side: TaskSide;
  type: TaskType;
  title: string;
  description: string;
  /** '' = unassigned */
  assignee_id: string;
  requires_owner: boolean;
  due_date: string;
  client_visible: boolean;
  /** the AM set "Khách thấy được" by hand: stop following the milestone default */
  visibilityTouched: boolean;
  blocks_task_ids: string[];
  blocks_milestone_ids: string[];
  blocked_by_task_ids: string[];
  impact_text: string;
}

export type FormField = 'project_id' | 'title' | 'due_date' | 'impact_text';
export type FormErrors = Partial<Record<FormField, string>>;

export function initialFormState(task: TaskDetail | null | undefined, defaults: { projectId?: string; milestoneId?: string }): TaskFormState {
  if (task) {
    return {
      project_id: task.project_id,
      milestone_id: task.milestone_id ?? '',
      side: task.side,
      type: task.type,
      title: task.title,
      description: task.description,
      assignee_id: task.assignee?.id ?? '',
      requires_owner: task.requires_owner,
      due_date: task.due_date,
      client_visible: task.side === 'client' ? true : task.client_visible,
      visibilityTouched: true,
      blocks_task_ids: [...task.dependencies.blocks_task_ids],
      blocks_milestone_ids: [...task.dependencies.blocks_milestone_ids],
      blocked_by_task_ids: [...task.dependencies.blocked_by_task_ids],
      impact_text: task.impact_text,
    };
  }
  const milestone = defaults.milestoneId ?? '';
  return {
    project_id: defaults.projectId ?? '',
    milestone_id: milestone,
    side: 'client',
    type: 'approval',
    title: '',
    description: '',
    assignee_id: '',
    requires_owner: false,
    due_date: addDays(todayISO(), 7),
    client_visible: milestone !== '',
    visibilityTouched: false,
    blocks_task_ids: [],
    blocks_milestone_ids: [],
    blocked_by_task_ids: [],
    impact_text: '',
  };
}

export function impactRequired(s: TaskFormState): boolean {
  return s.side === 'client' || s.blocks_task_ids.length > 0 || s.blocks_milestone_ids.length > 0;
}

export function validate(s: TaskFormState): FormErrors {
  const errors: FormErrors = {};
  if (!s.project_id) errors.project_id = t('tasks.form.errors.project');
  if (!s.title.trim()) errors.title = t('tasks.form.errors.title');
  if (!s.due_date) errors.due_date = t('tasks.form.errors.due');
  else if (!isValidISODate(s.due_date)) errors.due_date = t('tasks.form.errors.dueInvalid');
  if (impactRequired(s) && !s.impact_text.trim()) {
    errors.impact_text = s.side === 'client' ? t('tasks.form.errors.impactClient') : t('tasks.form.errors.impactBlocking');
  }
  return errors;
}

export function toInput(s: TaskFormState): TaskInput {
  const client = s.side === 'client';
  return {
    project_id: s.project_id,
    milestone_id: s.milestone_id || null,
    title: s.title.trim(),
    description: s.description.trim(),
    side: s.side,
    type: client ? s.type : 'work',
    assignee_id: s.assignee_id || null,
    requires_owner: client && s.requires_owner,
    due_date: s.due_date,
    impact_text: s.impact_text.trim(),
    client_visible: client ? true : s.client_visible,
    blocks_task_ids: s.blocks_task_ids,
    blocks_milestone_ids: s.blocks_milestone_ids,
    blocked_by_task_ids: s.blocked_by_task_ids,
  };
}

/** concrete "Nếu trễ thì sao" sentence from the due date and what the task holds back, or null */
export function impactSuggestion(
  s: TaskFormState,
  ctx: { tasks: Map<string, TaskView>; milestones: Map<string, MilestoneView> },
): string | null {
  if (!s.due_date || !isValidISODate(s.due_date)) return null;
  const lead = t(`tasks.form.impact.lead.${s.side === 'client' ? s.type : 'work'}`, { date: formatDateShort(s.due_date) });
  const blockedTask = s.blocks_task_ids.map((id) => ctx.tasks.get(id)).find((x): x is TaskView => !!x);
  const milestone =
    s.blocks_milestone_ids.map((id) => ctx.milestones.get(id)).find((m): m is MilestoneView => !!m) ??
    (blockedTask?.milestone_id ? ctx.milestones.get(blockedTask.milestone_id) : undefined) ??
    (s.milestone_id ? ctx.milestones.get(s.milestone_id) : undefined);
  const ms = milestone ? { milestone: milestone.name, date: formatDateShort(milestone.planned_date) } : null;
  if (blockedTask) {
    const consequence =
      blockedTask.side === 'internal'
        ? t('tasks.form.impact.blocksInternal', { task: blockedTask.title })
        : t('tasks.form.impact.blocksClient', { task: blockedTask.title });
    const first = `${lead}, ${consequence}.`;
    return ms ? `${first} ${t('tasks.form.impact.milestone', ms)}` : first;
  }
  if (ms) return t('tasks.form.impact.milestoneOnly', { lead, ...ms });
  return null;
}

export function impactPlaceholder(s: TaskFormState, suggestion: string | null): string {
  if (suggestion) return t('tasks.form.impact.examplePrefix', { text: suggestion });
  const due: ISODate = s.due_date && isValidISODate(s.due_date) ? s.due_date : addDays(todayISO(), 7);
  return t('tasks.form.impact.example', { date: formatDateShort(due), date2: formatDateShort(addDays(due, 14)) });
}
