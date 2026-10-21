import {
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  Code2,
  Compass,
  Dumbbell,
  GraduationCap,
  Headphones,
  Heart,
  Home,
  Megaphone,
  Music,
  Palette,
  PenTool,
  Plane,
  Rocket,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trophy,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cx } from '../util'

/** Iconos disponibles para `icon` en config.json (nombre en minúsculas). */
export const PROJECT_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  store: Store,
  rocket: Rocket,
  megaphone: Megaphone,
  compass: Compass,
  trophy: Trophy,
  headphones: Headphones,
  music: Music,
  book: BookOpen,
  code: Code2,
  cart: ShoppingCart,
  building: Building2,
  palette: Palette,
  pen: PenTool,
  plane: Plane,
  home: Home,
  heart: Heart,
  wallet: Wallet,
  shield: ShieldCheck,
  fitness: Dumbbell,
  study: GraduationCap,
  bot: Bot,
}

// Compatibilidad con configs antiguas que usaban emojis.
const EMOJI: Record<string, string> = {
  '💼': 'briefcase',
  '🏪': 'store',
  '🚀': 'rocket',
  '📣': 'megaphone',
  '🧭': 'compass',
  '⚽': 'trophy',
  '🎧': 'headphones',
  '📚': 'book',
  '🛒': 'cart',
  '🤖': 'bot',
}

const SIZES = {
  xs: { box: 'h-4 w-4 rounded', icon: 10 },
  sm: { box: 'h-5 w-5 rounded-md', icon: 12 },
  md: { box: 'h-8 w-8 rounded-lg', icon: 16 },
  lg: { box: 'h-11 w-11 rounded-xl', icon: 22 },
}

export function ProjectIcon({
  icon,
  color,
  size = 'md',
  className,
}: {
  icon: string
  color: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const s = SIZES[size]
  const Icon = PROJECT_ICONS[icon.toLowerCase()] ?? PROJECT_ICONS[EMOJI[icon] ?? ''] ?? Bot
  return (
    <span
      className={cx('inline-grid shrink-0 place-items-center', s.box, className)}
      style={{
        color,
        background: `linear-gradient(145deg, ${color}2e, ${color}12)`,
        boxShadow: `inset 0 0 0 1px ${color}40, inset 0 1px 0 ${color}30`,
      }}
    >
      <Icon size={s.icon} strokeWidth={2.1} />
    </span>
  )
}

/** Marca de The Brain. */
export function BrainMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#0f1426" stroke="url(#bm-g)" strokeOpacity="0.55" />
      <path d="M16 6.5 24.2 11.2v9.6L16 25.5l-8.2-4.7v-9.6Z" fill="none" stroke="url(#bm-g)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 6.5v9.5m0 0 8.2 4.8M16 16l-8.2 4.8" stroke="url(#bm-g)" strokeWidth="1.2" strokeOpacity="0.6" />
      <circle cx="16" cy="16" r="2.6" fill="url(#bm-g)" />
    </svg>
  )
}
