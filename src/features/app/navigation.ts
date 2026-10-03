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
  Compass,
  ShoppingBag,
  Settings,
  Sun,
  Repeat,
  type LucideIcon, MessageSquareText } from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  emoji: string;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { to: "/meu-dia", label: "Meu Dia", icon: Sun, emoji: "☀️" },
      { to: "/inbox", label: "Falar com o Life OS", icon: MessageSquareText, emoji: "💬" },
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, emoji: "🏠" },
      { to: "/nos", label: "Leitura de Nós", icon: Heart, emoji: "💜" },
    ],
  },
  {
    label: "Vida",
    items: [
      { to: "/agenda", label: "Agenda", icon: CalendarDays, emoji: "📅" },
      { to: "/tarefas", label: "Tarefas", icon: CheckSquare, emoji: "✅" },
      { to: "/rotinas", label: "Rotinas & Hábitos", icon: Repeat, emoji: "🌱" },
      { to: "/contextos", label: "Contextos", icon: Compass, emoji: "🧭" },
    ],
  },
  {
    label: "Dinheiro",
    items: [
      { to: "/financeiro", label: "Financeiro", icon: Wallet, emoji: "💰" },
      { to: "/compras", label: "Compras", icon: ShoppingBag, emoji: "🛍️" },
    ],
  },
  {
    label: "Desenvolvimento",
    items: [
      { to: "/faculdade", label: "Faculdade", icon: GraduationCap, emoji: "🎓" },
      { to: "/esporte", label: "Esporte & Atividades", icon: Dumbbell, emoji: "🏃" },

      { to: "/metas", label: "Metas", icon: Target, emoji: "🎯" },
    ],
  },
  { label: "Registros", items: [{ to: "/notas", label: "Notas", icon: StickyNote, emoji: "📝" }] },
];

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
  { to: "/contextos", label: "Contextos", icon: Compass, emoji: "🧭" },
  { to: "/compras", label: "Compras", icon: ShoppingBag, emoji: "🛍️" },
];

export const FOOTER_NAV: NavItem[] = [
  { to: "/configuracoes", label: "Configurações", icon: Settings, emoji: "⚙️" },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV, ...FOOTER_NAV];
