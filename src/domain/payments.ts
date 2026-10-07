// Payment installment rules. 'overdue' is always re-derived from the stored status and the due date.
import type { ISODate, PaymentSchedule, PaymentStatus } from './types';
import { diffDays } from './dates';

/**
 * Effective status for display and money totals:
 * - paid stays paid; not_due / invoice_due are unchanged;
 * - invoiced or stored overdue with today > due_date → 'overdue';
 * - stored 'overdue' whose due date is not passed any more (e.g. due date moved) → 'invoiced'.
 */
export function effectivePaymentStatus(p: PaymentSchedule, today: ISODate): PaymentStatus {
  switch (p.status) {
    case 'paid':
    case 'not_due':
    case 'invoice_due':
      return p.status;
    case 'invoiced':
    case 'overdue':
      return today > p.due_date ? 'overdue' : 'invoiced';
    default: {
      const never: never = p.status;
      return never;
    }
  }
}

/** Whole days past due_date when the installment is effectively overdue, else 0. */
export function paymentOverdueDays(p: PaymentSchedule, today: ISODate): number {
  if (effectivePaymentStatus(p, today) !== 'overdue') return 0;
  return Math.max(0, diffDays(today, p.due_date));
}

/** Money the client owes now: invoiced (not yet due) or overdue. */
export function isReceivable(status: PaymentStatus): boolean {
  return status === 'invoiced' || status === 'overdue';
}
