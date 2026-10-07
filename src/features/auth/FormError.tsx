import { CircleAlert } from 'lucide-react';

/** Inline form error: icon + sentence, announced to screen readers. */
export function FormError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-table text-danger">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
