import { useRouterState } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Banknote,
  CalendarPlus,
  CheckSquare,
  CreditCard,
  Dumbbell,
  Landmark,
  Repeat,
  StickyNote,
  Compass,
  Target,
  MessageSquareText,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useApp, type QuickActionKind } from "@/features/app/app-context";

type Option = { kind: QuickActionKind; label: string; icon: typeof ArrowUpRight };

const GENERAL: Option[] = [
  { kind: "expense", label: "Nova despesa", icon: ArrowUpRight },
  { kind: "income", label: "Nova receita", icon: ArrowDownLeft },
  { kind: "event", label: "Novo evento", icon: CalendarPlus },
  { kind: "task", label: "Nova tarefa", icon: CheckSquare },
  { kind: "goal", label: "Nova meta", icon: Target },
  { kind: "note", label: "Nova nota", icon: StickyNote },
  { kind: "context", label: "Novo contexto", icon: Compass },
  { kind: "workout", label: "Novo treino", icon: Dumbbell },
];

const FINANCE: Option[] = [
  { kind: "expense", label: "Nova despesa", icon: ArrowUpRight },
  { kind: "income", label: "Nova receita", icon: ArrowDownLeft },
  { kind: "installment", label: "Despesa parcelada", icon: CreditCard },
  { kind: "transfer", label: "Transferência", icon: ArrowLeftRight },
  { kind: "recurring", label: "Nova recorrência", icon: Repeat },
  { kind: "loan", label: "Novo empréstimo", icon: Banknote },
  { kind: "financing", label: "Novo financiamento", icon: Landmark },
];

export function QuickActionMenu() {
  const { quickMenuOpen, setQuickMenuOpen, openQuickAction } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const options = pathname.startsWith("/financeiro") ? FINANCE : GENERAL;

  return (
    <Drawer open={quickMenuOpen} onOpenChange={setQuickMenuOpen}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Criação rápida</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => openQuickAction("inbox")}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-left text-sm font-medium transition-colors hover:bg-primary/15"
          >
            <MessageSquareText className="size-5 text-primary" />
            <span className="flex-1">
              Falar com o Life OS
              <span className="block text-xs font-normal text-muted-foreground">“Gastei 38,90 de Uber no Nubank”</span>
            </span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-8 sm:grid-cols-3">
          {options.map((option) => (
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
