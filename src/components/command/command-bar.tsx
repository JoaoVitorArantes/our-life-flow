import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ALL_NAV } from "@/features/app/navigation";
import { useApp, type QuickActionKind } from "@/features/app/app-context";

const CREATE_ACTIONS: { kind: QuickActionKind; label: string }[] = [
  { kind: "expense", label: "Nova despesa" },
  { kind: "income", label: "Nova receita" },
  { kind: "event", label: "Novo evento" },
  { kind: "task", label: "Nova tarefa" },
  { kind: "goal", label: "Nova meta" },
  { kind: "note", label: "Nova nota" },
  { kind: "workout", label: "Registrar treino" },
];

/**
 * Global command bar. Actions are declared as data so an AI interpreter
 * can be plugged in later without touching the UI.
 */
export function CommandBar() {
  const { commandOpen, setCommandOpen, openQuickAction } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [commandOpen, setCommandOpen]);

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>

      <CommandInput placeholder="Pesquisar ou registrar algo..." />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Criar">
          {CREATE_ACTIONS.map((action) => (
            <CommandItem
              key={action.kind}
              value={action.label}
              onSelect={() => {
                setCommandOpen(false);
                openQuickAction(action.kind);
              }}
            >
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Ir para">
          {ALL_NAV.map((item) => (
            <CommandItem
              key={item.to}
              value={item.label}
              onSelect={() => {
                setCommandOpen(false);
                navigate({ to: item.to });
              }}
            >
              <span className="mr-1">{item.emoji}</span>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
