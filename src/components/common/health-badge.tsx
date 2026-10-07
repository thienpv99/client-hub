import { CircleCheck, OctagonX, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Health } from '@/services/contract';
import { cx, SMALL } from './cx';
import { enumLabel } from './labels';

interface ToneStyle {
  icon: LucideIcon;
  /** soft background + text + hairline inset ring */
  pill: string;
  /** icon/text colour only */
  text: string;
  /** soft background only */
  soft: string;
  /** solid fill for 6px dots */
  dot: string;
  /** inset hairline in the status colour (soft panels) */
  ring: string;
}

/** Status colours — used only for status, always with icon + text (SPEC §7). */
export const HEALTH_TONES: Record<Health, ToneStyle> = {
  blocked: {
    icon: OctagonX,
    pill: 'bg-danger-soft text-danger ring-1 ring-inset ring-danger/15',
    text: 'text-danger',
    soft: 'bg-danger-soft',
    dot: 'bg-danger',
    ring: 'ring-danger/15',
  },
  attention: {
    icon: TriangleAlert,
    pill: 'bg-warning-soft text-warning ring-1 ring-inset ring-warning/20',
    text: 'text-warning',
    soft: 'bg-warning-soft',
    dot: 'bg-warning',
    ring: 'ring-warning/20',
  },
  on_track: {
    icon: CircleCheck,
    pill: 'bg-success-soft text-success ring-1 ring-inset ring-success/15',
    text: 'text-success',
    soft: 'bg-success-soft',
    dot: 'bg-success',
    ring: 'ring-success/15',
  },
};

/** "Đang bị chặn" / "Cần chú ý" / "Đúng kế hoạch" */
export function healthLabel(health: Health): string {
  return enumLabel('health', health);
}

export interface HealthBadgeProps {
  health: Health;
  size?: 'sm' | 'md';
  /** false → icon only (label kept for screen readers and as tooltip) */
  showLabel?: boolean;
  /** 'dot' = 6px dot instead of the icon, for dense tables (the word stays) */
  variant?: 'icon' | 'dot';
  className?: string;
}

export function HealthBadge({ health, size = 'md', showLabel = true, variant = 'icon', className }: HealthBadgeProps) {
  const tone = HEALTH_TONES[health];
  const Icon = tone.icon;
  const label = healthLabel(health);
  const small = size === 'sm';
  // a dot without its word would be colour only: icon-only badges always keep the icon
  const dot = variant === 'dot' && showLabel;
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-medium',
        small ? 'h-6 gap-1 px-2 text-micro' : `h-7 gap-1.5 px-2.5 ${SMALL}`,
        dot && (small ? 'gap-1.5 pl-1.5' : 'gap-2 pl-2'),
        !showLabel && (small ? 'w-6 justify-center px-0' : 'w-7 justify-center px-0'),
        tone.pill,
        className,
      )}
      title={showLabel ? undefined : label}
      role={showLabel ? undefined : 'img'}
      aria-label={showLabel ? undefined : label}
    >
      {dot ? (
        <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} aria-hidden="true" />
      ) : (
        <Icon className={small ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0'} strokeWidth={2.25} aria-hidden="true" />
      )}
      {showLabel ? <span>{label}</span> : null}
    </span>
  );
}
