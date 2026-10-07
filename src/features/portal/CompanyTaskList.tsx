// Tab "Cả công ty" of /portal/tasks (decision maker): every open task waiting on the company side — the list behind
// "Đang chờ phía anh N · X quá hạn", colleagues' tasks New Era assigned directly included — with who holds it and its
// due state, most urgent first (SPEC §3 order). One card, full-bleed hairline rows (DESIGN §4).
import { CircleAlert } from 'lucide-react';
import type { TaskView } from '@/services/contract';
import { t } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/common/section-card';
import { UserAvatar } from '@/components/common/user-avatar';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import type { Salute } from './portalText';
import { personName } from './portalText';
import { CARD_LIST } from './styles';
import { ClientRowStatus, CompactTaskRow } from './TaskRows';

export interface CompanyTaskListProps {
  /** open, unblocked client-side tasks waiting on the company (same set as WaitingCounts.waiting_client) */
  tasks: TaskView[];
  /** id of the signed-in decision maker */
  meId: string;
  /** short company name for the title ('' → generic wording) */
  company: string;
  salute: Salute;
  showProject: boolean;
  /** task open in the drawer (row highlighted) */
  highlightId?: string | null;
}

/** "Việc của anh" · "Chị Lan, do anh giao" · "Anh Khoa" */
function holderText(task: TaskView, meId: string, you: string): string {
  // an unassigned company task waits on the decision maker (views.clientShouldAct)
  if (!task.assignee || task.assignee.id === meId) return t('portal.tasks.company.yours', { you });
  const name = personName(task.assignee);
  return task.delegated_by?.id === meId ? t('portal.tasks.company.delegated', { name, you }) : name;
}

export function CompanyTaskList({ tasks, meId, company, salute, showProject, highlightId = null }: CompanyTaskListProps) {
  const { open } = useTaskDrawer();
  const overdue = tasks.filter((x) => x.due.overdue).length;
  return (
    <SectionCard
      title={company ? t('portal.tasks.company.title', { company }) : t('portal.tasks.company.titleNoCompany')}
      description={t('portal.tasks.company.description', { you: salute.you })}
      actions={
        overdue > 0 ? (
          <Badge variant="danger">
            <CircleAlert aria-hidden="true" />
            <span className="tabular">{t('portal.tasks.company.overdue', { count: overdue })}</span>
          </Badge>
        ) : null
      }
      className="overflow-hidden"
      flush
    >
      <ul className={CARD_LIST}>
        {tasks.map((task) => (
          <CompactTaskRow
            key={task.id}
            task={task}
            onOpen={open}
            showProject={showProject}
            current={task.id === highlightId}
            leading={<UserAvatar user={task.assignee} size="sm" />}
            meta={
              <>
                <span className="font-medium text-foreground">{holderText(task, meId, salute.you)}</span>
                <ClientRowStatus task={task} />
              </>
            }
          />
        ))}
      </ul>
    </SectionCard>
  );
}
