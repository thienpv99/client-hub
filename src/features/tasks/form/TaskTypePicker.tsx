// Client task type as radio cards: icon, type name and a preview of the client's main button.
// Phones: two compact columns (radio + name) and the chosen type's button once under the grid; from 640px every card
// carries its icon tile and button preview.
import type { ClientTaskType } from '@/services/contract';
import { actionForType } from '@/domain/taskRules';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TaskTypeIcon } from '@/components/common/task-type-icon';
import { taskActionLabel, taskTypeLabel } from '@/components/common/taskLabels';
import { CLIENT_TYPES } from './taskFormModel';

export interface TaskTypePickerProps {
  value: ClientTaskType;
  onChange: (type: ClientTaskType) => void;
  labelledBy: string;
}

function actionHint(type: ClientTaskType): string {
  return t('tasks.form.type.action', { action: taskActionLabel(actionForType(type)) });
}

export function TaskTypePicker({ value, onChange, labelledBy }: TaskTypePickerProps) {
  return (
    <div className="space-y-2">
      <RadioGroup
        value={value}
        onValueChange={(v) => {
          const type = CLIENT_TYPES.find((x) => x === v);
          if (type) onChange(type);
        }}
        aria-labelledby={labelledBy}
        className="grid grid-cols-2 gap-2"
      >
        {CLIENT_TYPES.map((type) => {
          const id = `task-type-${type}`;
          const on = value === type;
          return (
            <label
              key={type}
              htmlFor={id}
              title={actionHint(type)}
              className={cn(
                'flex min-h-tap cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors duration-150 ease-out-quart sm:gap-3 sm:py-2.5',
                on ? 'border-primary-border bg-primary-soft' : 'border-border bg-card hover:border-border-strong hover:bg-subtle',
              )}
            >
              <RadioGroupItem id={id} value={type} />
              <span
                className={cn(
                  'hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset sm:inline-flex',
                  on ? 'bg-card text-primary ring-primary-border/70' : 'bg-subtle text-muted-foreground ring-border/70',
                )}
              >
                <TaskTypeIcon type={type} />
              </span>
              <span className="min-w-0">
                <span className="block text-table font-medium leading-5 text-foreground">{taskTypeLabel(type)}</span>
                <span className="hidden text-micro text-muted-foreground sm:block">{actionHint(type)}</span>
              </span>
            </label>
          );
        })}
      </RadioGroup>
      <p className="text-caption sm:hidden" aria-live="polite">
        {actionHint(value)}
      </p>
    </div>
  );
}
