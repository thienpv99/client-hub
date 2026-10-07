// "Chuyển giai đoạn…" — the keyboard / touch way to move a deal (drag & drop is mouse-only), plus win / lose.
import { useRef } from 'react';
import type { Ref } from 'react';
import { ArrowRightLeft, ChevronDown, CircleCheck, CircleX } from 'lucide-react';
import type { OpportunityStage } from '@/domain/crmTypes';
import { t } from '@/i18n';
import { cn } from '@/components/ui/cn';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OPEN_STAGES, stageLabel } from '@/components/crm/crmLabels';
import type { OpenStage } from '@/components/crm/crmLabels';

export interface StageMenuProps {
  name: string;
  current: OpportunityStage;
  onMove: (to: OpenStage) => void;
  onWin: () => void;
  onLose: () => void;
  /** 'icon' on cards, 'button' ("Chuyển giai đoạn") on the opportunity page */
  trigger?: 'icon' | 'button';
  className?: string;
  triggerRef?: Ref<HTMLButtonElement>;
  disabled?: boolean;
}

export function StageMenu({ name, current, onMove, onWin, onLose, trigger = 'icon', className, triggerRef, disabled }: StageMenuProps) {
  const moved = useRef(false);
  const targets = OPEN_STAGES.filter((s) => s !== current);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {trigger === 'icon' ? (
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn('relative z-10 h-8 w-8', className)}
            aria-label={t('crm.stageMenu.aria', { name })}
            title={t('crm.stageMenu.label')}
          >
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button ref={triggerRef} type="button" variant="secondary" className={className}>
            <ArrowRightLeft aria-hidden="true" />
            {t('crm.stageMenu.label')}
            <ChevronDown className="text-muted-foreground" aria-hidden="true" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64"
        onCloseAutoFocus={(e) => {
          // a moved card re-mounts in its new column and takes the focus itself
          if (!moved.current) return;
          moved.current = false;
          e.preventDefault();
        }}
      >
        <DropdownMenuLabel>{t('crm.stageMenu.moveTo')}</DropdownMenuLabel>
        {targets.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => {
              moved.current = true;
              onMove(s);
            }}
          >
            <span className="tabular text-muted-foreground" aria-hidden="true">
              {OPEN_STAGES.indexOf(s) + 1}
            </span>
            {stageLabel(s)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onWin}>
          <CircleCheck className="text-success" aria-hidden="true" />
          {t('crm.stageMenu.win')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLose}>
          <CircleX aria-hidden="true" />
          {t('crm.stageMenu.lose')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
