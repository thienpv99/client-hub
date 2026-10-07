// Roadmap: project templates, projects, milestones, forecast overrides, milestone completion.
// Managers only (director, or the AM of the account).

import type { Account, ID, ISODate, Milestone, Project, ProjectTemplate } from '@/domain/types';
import { ApiError, type Api } from '@/services/contract';
import { nowISO } from '@/domain/clock';
import { addDays, isValidISODate, maxDate } from '@/domain/dates';
import { initials } from '@/domain/naming';
import { newId } from '@/lib/utils';
import { onMilestoneCompleted } from '@/services/commercialEffects';
import { assertInternal, assertManagerOf, assertWritable, requireViewer } from '@/services/context';
import { db } from '@/services/db';
import { logActivity } from '@/services/effects';
import { invalidateViewCache, milestoneView, projectView } from '@/services/views';

const invalid = (key: string): ApiError => new ApiError('validation', key);
const notFound = (): ApiError => new ApiError('not_found', 'errors.not_found');

/** live milestones of a project straight from the db (safe inside a batch) */
function milestonesOf(projectId: ID): Milestone[] {
  return db
    .rows('milestones')
    .filter((m) => m.project_id === projectId)
    .sort((a, b) => a.order_no - b.order_no);
}

function accountOfProjectRow(project: Project): Account {
  const account = db.find('accounts', project.account_id);
  if (!account) throw notFound();
  return account;
}

function findTemplate(templateId: ID): ProjectTemplate {
  const template = db.rows('templates').find((x) => x.id === templateId);
  if (!template) throw invalid('errors.invalid_template');
  return template;
}

/** Append a template's milestones to a project (call inside db.batch). */
export function insertTemplateMilestones(project: Project, template: ProjectTemplate, start: ISODate): Milestone[] {
  let order = milestonesOf(project.id).reduce((max, m) => Math.max(max, m.order_no), 0);
  const created = template.milestones.map((tm) => {
    order += 1;
    const row: Milestone = {
      id: newId('ms'),
      project_id: project.id,
      name: tm.name,
      order_no: order,
      planned_date: addDays(start, tm.offset_days),
      forecast_override_date: null,
      forecast_override_reason: null,
      status: 'upcoming',
      completed_at: null,
      client_visible: tm.client_visible,
      description: null,
      deleted_at: null,
    };
    return db.insert('milestones', row);
  });
  const current = db.get('projects', project.id);
  const end = created.reduce((d, m) => maxDate(d, m.planned_date), current.end_date);
  if (end !== current.end_date) db.update('projects', project.id, { end_date: end });
  return created;
}

/** Create a project (+ template milestones) and log it (call inside db.batch). */
export function insertProject(account: Account, input: { name: string; start_date: ISODate; template_id: ID | null }, actorId: ID): Project {
  const name = (input.name ?? '').trim();
  if (!name) throw invalid('errors.name_required');
  if (!isValidISODate(input.start_date)) throw invalid('errors.invalid_date');
  const template = input.template_id ? findTemplate(input.template_id) : null;
  const count = db.allRows('projects').filter((p) => p.account_id === account.id).length;
  const project: Project = {
    id: newId('prj'),
    account_id: account.id,
    name,
    code: `${initials(account.short_name || account.name)}-${String(count + 1).padStart(2, '0')}`,
    start_date: input.start_date,
    end_date: addDays(input.start_date, 90),
    status: 'active',
    deleted_at: null,
  };
  db.insert('projects', project);
  if (template) insertTemplateMilestones(project, template, input.start_date);
  invalidateViewCache();
  logActivity({
    account_id: account.id,
    actor_id: actorId,
    action: 'project.created',
    target_type: 'project',
    target_id: project.id,
    params: { project: project.name },
    visibility: 'shared',
  });
  return db.get('projects', project.id);
}

function loadMilestone(id: ID): { milestone: Milestone; project: Project; account: Account } {
  const milestone = db.find('milestones', id);
  if (!milestone) throw notFound();
  const project = db.find('projects', milestone.project_id);
  if (!project) throw notFound();
  return { milestone, project, account: accountOfProjectRow(project) };
}

export const roadmapApi: Pick<
  Api,
  'listTemplates' | 'createProject' | 'applyTemplate' | 'createMilestone' | 'updateMilestone' | 'overrideForecast' | 'completeMilestone'
> = {
  async listTemplates() {
    const v = requireViewer();
    assertInternal(v);
    return db.rows('templates').map((x) => ({ ...x, milestones: x.milestones.map((m) => ({ ...m })) }));
  },

  async createProject(accountId, input) {
    const v = requireViewer();
    assertWritable(v);
    const account = db.find('accounts', accountId);
    if (!account) throw notFound();
    assertManagerOf(v, accountId);
    const { result } = db.batch(() => insertProject(account, input, v.user.id));
    return projectView(db.get('projects', result.id), v);
  },

  async applyTemplate(projectId, templateId, startDate) {
    const v = requireViewer();
    assertWritable(v);
    const project = db.find('projects', projectId);
    if (!project) throw notFound();
    const account = accountOfProjectRow(project);
    assertManagerOf(v, account.id);
    const template = findTemplate(templateId);
    if (!isValidISODate(startDate)) throw invalid('errors.invalid_date');
    db.batch(() => {
      const created = insertTemplateMilestones(project, template, startDate);
      for (const m of created) {
        logActivity({
          account_id: account.id,
          actor_id: v.user.id,
          action: 'milestone.created',
          target_type: 'milestone',
          target_id: m.id,
          params: { milestone: m.name, project: project.name },
          visibility: 'internal',
        });
      }
    });
    return projectView(db.get('projects', projectId), v);
  },

  async createMilestone(projectId, input) {
    const v = requireViewer();
    assertWritable(v);
    const project = db.find('projects', projectId);
    if (!project) throw notFound();
    const account = accountOfProjectRow(project);
    assertManagerOf(v, account.id);
    const name = (input.name ?? '').trim();
    if (!name) throw invalid('errors.name_required');
    if (!isValidISODate(input.planned_date)) throw invalid('errors.invalid_date');
    const { result } = db.batch(() => {
      const order = milestonesOf(projectId).reduce((max, m) => Math.max(max, m.order_no), 0) + 1;
      const row: Milestone = {
        id: newId('ms'),
        project_id: projectId,
        name,
        order_no: order,
        planned_date: input.planned_date,
        forecast_override_date: null,
        forecast_override_reason: null,
        status: 'upcoming',
        completed_at: null,
        client_visible: !!input.client_visible,
        description: input.description?.trim() || null,
        deleted_at: null,
      };
      db.insert('milestones', row);
      if (row.planned_date > project.end_date) db.update('projects', projectId, { end_date: row.planned_date });
      logActivity({
        account_id: account.id,
        actor_id: v.user.id,
        action: 'milestone.created',
        target_type: 'milestone',
        target_id: row.id,
        params: { milestone: row.name, project: project.name },
        visibility: row.client_visible ? 'shared' : 'internal',
      });
      return row;
    });
    return milestoneView(db.get('milestones', result.id), v);
  },

  async updateMilestone(id, patch) {
    const v = requireViewer();
    assertWritable(v);
    const { milestone, project, account } = loadMilestone(id);
    assertManagerOf(v, account.id);
    const fields: Partial<Milestone> = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw invalid('errors.name_required');
      if (name !== milestone.name) fields.name = name;
    }
    if (patch.planned_date !== undefined) {
      if (!isValidISODate(patch.planned_date)) throw invalid('errors.invalid_date');
      if (patch.planned_date !== milestone.planned_date) fields.planned_date = patch.planned_date;
    }
    if (patch.client_visible !== undefined && patch.client_visible !== milestone.client_visible) fields.client_visible = patch.client_visible;
    if (patch.description !== undefined) {
      const description = patch.description?.trim() || null;
      if (description !== milestone.description) fields.description = description;
    }
    let reorder: Milestone[] | null = null;
    if (patch.order_no !== undefined && patch.order_no !== milestone.order_no) {
      if (!Number.isInteger(patch.order_no) || patch.order_no < 1) throw invalid('errors.invalid_order');
      const others = milestonesOf(project.id).filter((m) => m.id !== id);
      const index = Math.min(patch.order_no - 1, others.length);
      reorder = [...others.slice(0, index), milestone, ...others.slice(index)];
    }
    if (Object.keys(fields).length === 0 && !reorder) return milestoneView(milestone, v);
    db.batch(() => {
      if (Object.keys(fields).length) db.update('milestones', id, fields);
      if (reorder) {
        reorder.forEach((m, i) => {
          if (db.get('milestones', m.id).order_no !== i + 1) db.update('milestones', m.id, { order_no: i + 1 });
        });
      }
      const current = db.get('milestones', id);
      if (current.planned_date > project.end_date) db.update('projects', project.id, { end_date: current.planned_date });
      logActivity({
        account_id: account.id,
        actor_id: v.user.id,
        action: 'milestone.updated',
        target_type: 'milestone',
        target_id: id,
        params: { milestone: current.name, project: project.name },
        visibility: current.client_visible ? 'shared' : 'internal',
      });
    });
    return milestoneView(db.get('milestones', id), v);
  },

  async overrideForecast(id, date, reason) {
    const v = requireViewer();
    assertWritable(v);
    const { milestone, account } = loadMilestone(id);
    assertManagerOf(v, account.id);
    const why = (reason ?? '').trim();
    if (date !== null) {
      if (!isValidISODate(date)) throw invalid('errors.invalid_date');
      if (!why) throw invalid('errors.reason_required');
    }
    db.batch(() => {
      db.update('milestones', id, {
        forecast_override_date: date,
        forecast_override_reason: date === null ? null : why,
      });
      logActivity({
        account_id: account.id,
        actor_id: v.user.id,
        action: 'milestone.forecast_overridden',
        target_type: 'milestone',
        target_id: id,
        params: date === null ? { milestone: milestone.name, cleared: 1 } : { milestone: milestone.name, date, reason: why },
        visibility: 'internal',
      });
    });
    return milestoneView(db.get('milestones', id), v);
  },

  async completeMilestone(id) {
    const v = requireViewer();
    assertWritable(v);
    const { milestone, project, account } = loadMilestone(id);
    assertManagerOf(v, account.id);
    if (milestone.status === 'done') throw invalid('errors.already_done');
    const at = nowISO();
    db.batch(() => {
      db.update('milestones', id, { status: 'done', completed_at: at });
      // the next milestone of the project becomes the current one
      const rest = milestonesOf(project.id);
      const next = rest.find((m) => m.status === 'upcoming' && m.order_no > milestone.order_no);
      if (next && !rest.some((m) => m.status === 'in_progress')) db.update('milestones', next.id, { status: 'in_progress' });
      invalidateViewCache();
      onMilestoneCompleted(id, v.user.id);
      logActivity({
        account_id: account.id,
        actor_id: v.user.id,
        action: 'milestone.completed',
        target_type: 'milestone',
        target_id: id,
        params: { milestone: milestone.name, project: project.name },
        visibility: milestone.client_visible ? 'shared' : 'internal',
      });
    });
    return milestoneView(db.get('milestones', id), v);
  },
};
