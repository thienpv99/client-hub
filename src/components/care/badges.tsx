// Shared care badges (SPEC-CARE §6; DESIGN §4 badge recipe): status = icon (or dot) + word + soft tint, never colour
// alone. Steps and kinds stay neutral; only real states use the status tints (in use / done → success, waiting too
// long / care due soon → warning, delivery debt / care overdue → danger). Literal class names only.
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  Ban,
  Boxes,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleHelp,
  CircleX,
  Clock,
  Crown,
  FlaskConical,
  Globe,
  Handshake,
  Inbox,
  Megaphone,
  Minus,
  OctagonX,
  Pause,
  Play,
  Plug,
  Rocket,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  TriangleAlert,
  User,
  Wrench,
} from 'lucide-react';
import type { CrStatus, DepartmentEffective, DeploymentStatus, Influence, SolutionCategory, Stance, Strength } from '@/domain/careTypes';
import type { CareStatus, CrFlags as CrFlagsInfo } from '@/services/careContract';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/cn';
import { t } from '@/i18n';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'outline' | 'note';

interface Tone {
  icon: LucideIcon;
  variant: BadgeVariant;
}

export interface CareBadgeProps {
  /** sm 20px (rows, cards, tables) · md 24px (headers, drawers) */
  size?: 'sm' | 'md';
  className?: string;
}

function Pill({ tone, label, size = 'sm', className, title }: { tone: Tone; label: string; title?: string } & CareBadgeProps) {
  const Icon = tone.icon;
  return (
    <Badge variant={tone.variant} size={size === 'sm' ? 'sm' : 'default'} className={className} title={title}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}

// ───────────────────────────── solutions ─────────────────────────────

const DEPLOYMENT_TONES: Record<DeploymentStatus, Tone> = {
  live: { icon: CircleCheck, variant: 'success' },
  rolling_out: { icon: Rocket, variant: 'default' },
  pilot: { icon: FlaskConical, variant: 'default' },
  paused: { icon: Pause, variant: 'warning' },
  retired: { icon: Archive, variant: 'outline' },
};

/** "Đang dùng" · "Đang triển khai" · "Chạy thử" · "Tạm dừng" · "Đã ngừng" (client wording with audience="client") */
export function DeploymentStatusChip({ status, audience = 'internal', ...rest }: { status: DeploymentStatus; audience?: 'internal' | 'client' } & CareBadgeProps) {
  const label = t(audience === 'client' ? `care.deploymentStatusClient.${status}` : `care.deploymentStatus.${status}`);
  return <Pill tone={DEPLOYMENT_TONES[status]} label={label} {...rest} />;
}

export const CATEGORY_ICONS: Record<SolutionCategory, LucideIcon> = {
  mobile_app: Smartphone,
  web_portal: Globe,
  crm_erp: Boxes,
  data_bi: TrendingUp,
  ai_automation: Sparkles,
  integration: Plug,
  support: Wrench,
};

/** solution category as icon + words (neutral text, not a status) */
export function CategoryLabel({ category, short = false, className }: { category: SolutionCategory; short?: boolean; className?: string }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-table text-muted-foreground', className)}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{t(short ? `care.categoryShort.${category}` : `care.category.${category}`)}</span>
    </span>
  );
}

// ───────────────────────────── expansion map ─────────────────────────────

const DEPARTMENT_TONES: Record<DepartmentEffective, Tone> = {
  using: { icon: CircleCheck, variant: 'success' },
  engaged: { icon: Handshake, variant: 'default' },
  untouched: { icon: CircleDashed, variant: 'outline' },
  not_fit: { icon: Ban, variant: 'outline' },
};

/** effective department status: "Đã có giải pháp" · "Đang trao đổi" · "Chưa tiếp cận" · "Không phù hợp" */
export function DepartmentStatusChip({ status, ...rest }: { status: DepartmentEffective } & CareBadgeProps) {
  return <Pill tone={DEPARTMENT_TONES[status]} label={t(`care.departmentStatus.${status}`)} {...rest} />;
}

/**
 * "Tạm dừng mở rộng" — the expansion gate is closed by delivery debt (a danger, not a mere warning): one look on every
 * screen (overview, client list, account, matrix)
 */
export function ExpansionBlockedChip({ title, ...rest }: CareBadgeProps & { title?: string }) {
  return <Pill tone={{ icon: OctagonX, variant: 'danger' }} label={t('care.gate.blockedBadge')} title={title} {...rest} />;
}

// ───────────────────────────── change requests ─────────────────────────────

const CR_TONES: Record<CrStatus, Tone> = {
  new: { icon: Inbox, variant: 'default' },
  triaged: { icon: CircleDot, variant: 'default' },
  planned: { icon: CalendarCheck, variant: 'default' },
  in_progress: { icon: Play, variant: 'default' },
  done: { icon: CircleCheck, variant: 'success' },
  declined: { icon: CircleX, variant: 'outline' },
};

/** request status — New Era wording, or the client's ("Đã gửi, chờ New Era tiếp nhận"…) with audience="client" */
export function CrStatusChip({ status, audience = 'internal', ...rest }: { status: CrStatus; audience?: 'internal' | 'client' } & CareBadgeProps) {
  const label = t(audience === 'client' ? `care.crStatusClient.${status}` : `care.crStatus.${status}`);
  return <Pill tone={CR_TONES[status]} label={label} {...rest} />;
}

/** the request carries a flag CrFlags shows (debt · waiting > 7 days · taken in > 14 days without a date) */
export function hasCrFlag(flags: CrFlagsInfo): boolean {
  return flags.debt || flags.untriaged || flags.undated;
}

/**
 * Flags of a request (internal only): "Chưa xử lý 11 ngày" (warning), "Tiếp nhận 54 ngày, chưa hẹn ngày" (warning) and
 * "Nợ triển khai · Quá ngày hẹn" (danger, with the main reason; every reason in the tooltip). Renders nothing when the
 * request carries no flag.
 */
export function CrFlags({
  flags,
  showReason = true,
  wrap = false,
  size = 'sm',
  className,
}: {
  flags: CrFlagsInfo;
  showReason?: boolean;
  /** narrow places (board cards): a long pill wraps onto a second line instead of overflowing */
  wrap?: boolean;
} & CareBadgeProps) {
  if (!hasCrFlag(flags)) return null;
  const reasons = flags.debt_reasons.map((r) => t(`care.debtReason.${r}`)).join(' · ');
  const pill = wrap ? 'h-auto min-h-5 max-w-full whitespace-normal rounded-md py-0.5 leading-4' : undefined;
  return (
    <span className={cn('inline-flex max-w-full flex-wrap items-center gap-1.5', className)}>
      {flags.debt ? (
        <Pill
          tone={{ icon: TriangleAlert, variant: 'danger' }}
          label={showReason && flags.debt_reason ? `${t('care.flags.debt')} · ${t(`care.debtReasonShort.${flags.debt_reason}`)}` : t('care.flags.debt')}
          title={reasons}
          size={size}
          className={pill}
        />
      ) : null}
      {flags.untriaged ? (
        <Pill tone={{ icon: Clock, variant: 'warning' }} label={t('care.flags.untriagedDays', { days: flags.days_waiting })} size={size} className={pill} />
      ) : null}
      {flags.undated ? (
        <Pill
          tone={{ icon: CalendarClock, variant: 'warning' }}
          label={t('care.flags.undatedDays', { days: flags.days_since_triage })}
          title={t('care.flags.undatedHint', { days: flags.days_since_triage })}
          size={size}
          className={pill}
        />
      ) : null}
    </span>
  );
}

// ───────────────────────────── people ─────────────────────────────

const STRENGTH_DOT: Record<Strength, string> = {
  strong: 'bg-success',
  warm: 'bg-warning',
  cold: 'bg-caption',
};

/** how close New Era is to the person: dot + word ("Thân thiết" · "Khá tốt" · "Còn xa") */
export function StrengthBadge({ strength, size = 'sm', className }: { strength: Strength } & CareBadgeProps) {
  return (
    <Badge variant={strength === 'strong' ? 'success' : 'default'} size={size === 'sm' ? 'sm' : 'default'} className={className}>
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STRENGTH_DOT[strength])} />
      {t(`care.strength.${strength}`)}
    </Badge>
  );
}

const STANCE_TONES: Record<Stance, Tone> = {
  champion: { icon: Star, variant: 'success' },
  supporter: { icon: ThumbsUp, variant: 'default' },
  neutral: { icon: Minus, variant: 'outline' },
  skeptic: { icon: CircleHelp, variant: 'warning' },
  blocker: { icon: Ban, variant: 'danger' },
};

/** "Người ủng hộ mạnh" · "Ủng hộ" · "Trung lập" · "Còn nghi ngại" · "Phản đối" */
export function StanceBadge({ stance, ...rest }: { stance: Stance } & CareBadgeProps) {
  return <Pill tone={STANCE_TONES[stance]} label={t(`care.stance.${stance}`)} {...rest} />;
}

const INFLUENCE_ICONS: Record<Influence, LucideIcon> = {
  decision_maker: Crown,
  influencer: Megaphone,
  user: User,
  gatekeeper: Shield,
};

/** role in the decision (neutral): "Người quyết định" · "Người có ảnh hưởng" · "Người sử dụng" · "Người giữ cửa" */
export function InfluenceBadge({ influence, ...rest }: { influence: Influence } & CareBadgeProps) {
  return <Pill tone={{ icon: INFLUENCE_ICONS[influence], variant: 'outline' }} label={t(`care.influence.${influence}`)} {...rest} />;
}

// ───────────────────────────── care ─────────────────────────────

const CARE_TONES: Record<CareStatus, Tone> = {
  ok: { icon: CircleCheck, variant: 'success' },
  due_soon: { icon: Clock, variant: 'warning' },
  overdue: { icon: CalendarX, variant: 'danger' },
};

/** "Đúng nhịp" · "Sắp đến hạn" · "Quá hạn" (short) or the full "… chăm sóc" words */
export function CareStatusBadge({ status, short = true, ...rest }: { status: CareStatus; short?: boolean } & CareBadgeProps) {
  return <Pill tone={CARE_TONES[status]} label={t(short ? `care.careStatusShort.${status}` : `care.careStatus.${status}`)} {...rest} />;
}
