// "08/10 → 14/10 [lùi 6 ngày]" with the reason on its own caption line ("Do chờ duyệt thiết kế … 6 ngày"), so a
// narrow column never wraps the sentence after a dangling "·" (SPEC 5.4: lý do nếu lùi).
import type { MilestoneView } from '@/services/contract';
import { capitalize } from '@/i18n';
import { cn } from '@/lib/utils';
import { ForecastLabel, forecastReasonText } from '@/components/common/forecast-label';

export function ForecastWithReason({ milestone, className }: { milestone: MilestoneView; className?: string }) {
  const reason = milestone.status === 'done' ? null : forecastReasonText(milestone);
  return (
    <div className={cn('min-w-0', className)}>
      <ForecastLabel milestone={milestone} showReason={false} />
      {reason ? <p className="mt-1 break-words text-caption">{capitalize(reason)}</p> : null}
    </div>
  );
}
