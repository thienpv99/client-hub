// Status pills of the commercial module: quote status, payment status, director approval, effective discount.
// Built on the kit Badge (DESIGN §4): soft tint + 12px icon + word, never colour alone.
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  CalendarX,
  CircleAlert,
  CircleCheck,
  Clock,
  FileClock,
  FileText,
  MessageSquareWarning,
  Receipt,
  Send,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import type { ContractStatus } from '@/domain/types';
import type { PaymentStatus, QuoteStatus } from '@/services/contract';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';
import { fmtPct } from '../lib';

export type StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const VARIANT: Record<StatusTone, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  neutral: 'default',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export interface StatusPillProps {
  tone: StatusTone;
  icon: LucideIcon;
  children: ReactNode;
  /** 'sm' = 20px for dense tables and meta rows; default 24px */
  size?: 'default' | 'sm';
  className?: string;
  title?: string;
}

export function StatusPill({ tone, icon: Icon, children, size = 'default', className, title }: StatusPillProps) {
  return (
    <Badge variant={VARIANT[tone]} size={size} className={className} title={title}>
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}

const QUOTE_LOOK: Record<QuoteStatus, { tone: StatusTone; icon: LucideIcon }> = {
  draft: { tone: 'neutral', icon: FileText },
  pending_approval: { tone: 'warning', icon: Clock },
  sent: { tone: 'primary', icon: Send },
  accepted: { tone: 'success', icon: CircleCheck },
  changes_requested: { tone: 'warning', icon: MessageSquareWarning },
  expired: { tone: 'neutral', icon: CalendarX },
};

export function quoteStatusIcon(status: QuoteStatus): LucideIcon {
  return QUOTE_LOOK[status].icon;
}

/** internal wording from enums.quoteStatus; `audience="client"` uses the client's own point of view */
export function quoteStatusLabel(status: QuoteStatus, audience: 'internal' | 'client' = 'internal'): string {
  return audience === 'client' ? t(`commercial.quoteStatusClient.${status}`) : t(`enums.quoteStatus.${status}`);
}

export function QuoteStatusBadge({
  status,
  audience = 'internal',
  size,
  className,
}: {
  status: QuoteStatus;
  audience?: 'internal' | 'client';
  size?: 'default' | 'sm';
  className?: string;
}) {
  const look = QUOTE_LOOK[status];
  return (
    <StatusPill tone={look.tone} icon={look.icon} size={size} className={className}>
      {quoteStatusLabel(status, audience)}
    </StatusPill>
  );
}

const PAYMENT_LOOK: Record<PaymentStatus, { tone: StatusTone; icon: LucideIcon }> = {
  not_due: { tone: 'neutral', icon: CalendarClock },
  invoice_due: { tone: 'primary', icon: FileClock },
  invoiced: { tone: 'primary', icon: Receipt },
  paid: { tone: 'success', icon: CircleCheck },
  overdue: { tone: 'danger', icon: CircleAlert },
};

/** internal wording from enums.paymentStatus; `audience="client"` speaks from the client's side ("Đã thanh toán") */
export function paymentStatusLabel(status: PaymentStatus, overdueDays = 0, audience: 'internal' | 'client' = 'internal'): string {
  if (status === 'overdue' && overdueDays > 0) return t('commercial.payment.overdueDays', { days: overdueDays });
  return audience === 'client' ? t(`commercial.paymentStatusClient.${status}`) : t(`enums.paymentStatus.${status}`);
}

export function PaymentStatusBadge({
  status,
  overdueDays = 0,
  audience = 'internal',
  size,
  className,
}: {
  status: PaymentStatus;
  overdueDays?: number;
  audience?: 'internal' | 'client';
  size?: 'default' | 'sm';
  className?: string;
}) {
  const look = PAYMENT_LOOK[status];
  return (
    <StatusPill tone={look.tone} icon={look.icon} size={size} className={className}>
      {paymentStatusLabel(status, overdueDays, audience)}
    </StatusPill>
  );
}

export function ContractStatusBadge({ status, size }: { status: ContractStatus; size?: 'default' | 'sm' }) {
  const look: { tone: StatusTone; icon: LucideIcon } =
    status === 'active'
      ? { tone: 'primary', icon: FileText }
      : status === 'completed'
        ? { tone: 'success', icon: CircleCheck }
        : { tone: 'neutral', icon: FileClock };
  return (
    <StatusPill tone={look.tone} icon={look.icon} size={size}>
      {t(`enums.contractStatus.${status}`)}
    </StatusPill>
  );
}

/** "Chờ GĐ duyệt" · "GĐ đã duyệt" · "Cần GĐ duyệt" · "Không cần duyệt" (plain caption) */
export function ApprovalState({
  status,
  needsApproval,
  approved,
  size,
  quiet = false,
}: {
  status: QuoteStatus;
  needsApproval: boolean;
  approved: boolean;
  size?: 'default' | 'sm';
  /** render "Không cần duyệt" as nothing (lists where the absence speaks for itself) */
  quiet?: boolean;
}) {
  if (status === 'pending_approval') {
    return (
      <StatusPill tone="warning" icon={Clock} size={size}>
        {t('commercial.approval.pending')}
      </StatusPill>
    );
  }
  if (approved) {
    return (
      <StatusPill tone="success" icon={ShieldCheck} size={size}>
        {t('commercial.approval.approved')}
      </StatusPill>
    );
  }
  if (needsApproval && status === 'draft') {
    return (
      <StatusPill tone="warning" icon={ShieldAlert} size={size}>
        {t('commercial.approval.required')}
      </StatusPill>
    );
  }
  if (quiet) return null;
  return <span className="text-caption">{t('commercial.approval.notNeeded')}</span>;
}

/** effective discount; a warning icon + accessible text when it is above the approval threshold */
export function DiscountValue({ pct, over, className }: { pct: number; over: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 whitespace-nowrap tabular', over ? 'font-medium text-warning' : 'text-foreground', className)}
      title={over ? t('commercial.discount.overThreshold') : undefined}
    >
      {over ? <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      {fmtPct(pct)}
      {over ? <span className="sr-only">{` (${t('commercial.discount.overThreshold')})`}</span> : null}
    </span>
  );
}
