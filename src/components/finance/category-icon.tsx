import {
  Baby,
  Bike,
  BookOpen,
  Briefcase,
  Car,
  CircleDot,
  Coffee,
  Dog,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  HeartPulse,
  Home,
  LineChart,
  Plane,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  TrendingDown,
  Utensils,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Allowed icon names for categories (stored as text in categories.icon). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  coffee: Coffee,
  car: Car,
  bike: Bike,
  plane: Plane,
  home: Home,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  heart: Heart,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  briefcase: Briefcase,
  wallet: Wallet,
  "line-chart": LineChart,
  "trending-down": TrendingDown,
  sparkles: Sparkles,
  "gamepad-2": Gamepad2,
  gift: Gift,
  shirt: Shirt,
  baby: Baby,
  dog: Dog,
  "circle-dot": CircleDot,
};

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = name ? CATEGORY_ICONS[name] : undefined;
  if (Icon) return <Icon className={cn("size-4", className)} aria-hidden />;
  // Legacy/emoji values still render as text.
  if (name && name.length <= 4) return <span aria-hidden>{name}</span>;
  return <CircleDot className={cn("size-4", className)} aria-hidden />;
}
