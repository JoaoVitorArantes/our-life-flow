import {
  LayoutDashboard,
  Wallet,
  CalendarDays,
  CheckSquare,
  GraduationCap,
  Dumbbell,
  Heart,
  Target,
  StickyNote,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  emoji: string;
};

export const PRIMARY_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, emoji: "🏠" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, emoji: "💰" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, emoji: "📅" },
  { to: "/tarefas", label: "Tarefas", icon: CheckSquare, emoji: "✅" },
];

export const SECONDARY_NAV: NavItem[] = [
  { to: "/faculdade", label: "Faculdade", icon: GraduationCap, emoji: "🎓" },
  { to: "/esporte", label: "Esporte", icon: Dumbbell, emoji: "🏃" },
  { to: "/nos", label: "Nós", icon: Heart, emoji: "💜" },
  { to: "/metas", label: "Metas", icon: Target, emoji: "🎯" },
  { to: "/notas", label: "Notas", icon: StickyNote, emoji: "📝" },
];

export const FOOTER_NAV: NavItem[] = [
  { to: "/configuracoes", label: "Configurações", icon: Settings, emoji: "⚙️" },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV, ...FOOTER_NAV];
