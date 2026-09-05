import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarPlus,
  CheckSquare,
  Dumbbell,
  StickyNote,
  Compass,
  Target,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useApp, type QuickActionKind } from "@/features/app/app-context";

const OPTIONS: { kind: QuickActionKind; label: string; icon: typeof ArrowUpRight }[] = [
  { kind: "expense", label: "Nova despesa", icon: ArrowUpRight },
  { kind: "income", label: "Nova receita", icon: ArrowDownLeft },
  { kind: "event", label: "Novo evento", icon: CalendarPlus },
  { kind: "task", label: "Nova tarefa", icon: CheckSquare },
  { kind: "goal", label: "Nova meta", icon: Target },
  { kind: "note", label: "Nova nota", icon: StickyNote },
  { kind: "context", label: "Novo contexto", icon: Compass },
  { kind: "workout", label: "Novo treino", icon: Dumbbell },
];

export function QuickActionMenu() {
  const { quickMenuOpen, setQuickMenuOpen, openQuickAction } = useApp();

  return (
    <Drawer open={quickMenuOpen} onOpenChange={setQuickMenuOpen}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Criação rápida</DrawerTitle>
        </DrawerHeader>
        <div className="grid grid-cols-2 gap-2 px-4 pb-8 sm:grid-cols-3">
          {OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              onClick={() => openQuickAction(option.kind)}
              className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left text-sm transition-colors hover:border-ring/50"
            >
              <option.icon className="size-4 text-primary" />
              {option.label}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
