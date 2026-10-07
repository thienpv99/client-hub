import { Building2 } from 'lucide-react';
import type { TaskSide } from '@/services/contract';
import { cx } from './cx';
import { sideLabel } from './labels';
import { NewEraMark } from './new-era-logo';

export interface SideBadgeProps {
  side: TaskSide;
  className?: string;
}

/** Who is responsible: "Khách hàng" / "New Era". Neutral pill (side is not a status). */
export function SideBadge({ side, className }: SideBadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted pl-1.5 pr-2 text-micro font-medium text-muted-foreground',
        className,
      )}
    >
      {side === 'client' ? (
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <NewEraMark className="h-3.5 w-3.5" />
      )}
      {sideLabel(side)}
    </span>
  );
}
