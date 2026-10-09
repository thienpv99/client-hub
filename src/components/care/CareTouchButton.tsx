// "Ghi lần chăm sóc" (SPEC-CARE §6.4): opens the CRM LogInteractionDialog in care mode, preset to the account (and
// contact) — a care touch is an ordinary interaction (api.logInteraction), so the account's last touch and care status
// update at once; the dialog also moves the care plan's next action on (components/care/CareNextStep).
// Director / AM only (logging touches is theirs); renders nothing for other viewers and in "Xem như khách hàng".
import { useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import type { ID } from '@/domain/types';
import type { InteractionKind } from '@/domain/crmTypes';
import type { InteractionView } from '@/services/crmContract';
import { LogInteractionDialog } from '@/components/crm/LogInteractionDialog';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useViewer } from '@/hooks/useViewer';
import { t } from '@/i18n';

export interface CareTouchButtonProps {
  accountId: ID;
  /** preset the person the touch was with */
  contactId?: ID | null;
  /** default 'call' */
  kind?: InteractionKind;
  /** default "Chăm sóc định kỳ" */
  subject?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  /** default "Ghi lần chăm sóc" */
  label?: string;
  /** icon only (the label becomes the aria-label) */
  iconOnly?: boolean;
  className?: string;
  onLogged?: (interaction: InteractionView) => void;
}

export function CareTouchButton({
  accountId,
  contactId = null,
  kind = 'call',
  subject,
  variant = 'secondary',
  size = 'sm',
  label,
  iconOnly = false,
  className,
  onLogged,
}: CareTouchButtonProps) {
  const viewer = useViewer();
  const [open, setOpen] = useState(false);
  const allowed = !!viewer && viewer.org_type === 'internal' && !viewer.read_only && (viewer.role === 'director' || viewer.role === 'am');
  if (!allowed) return null;
  const text = label ?? t('care.kit.logTouch');
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? 'icon-sm' : size}
        className={className}
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? text : undefined}
        title={iconOnly ? text : undefined}
      >
        <HeartHandshake aria-hidden="true" />
        {iconOnly ? null : text}
      </Button>
      <LogInteractionDialog
        open={open}
        onOpenChange={setOpen}
        defaults={{ account_id: accountId, contact_id: contactId, kind, subject: subject ?? t('care.kit.touch.subjectDefault') }}
        onLogged={onLogged}
        care
      />
    </>
  );
}
