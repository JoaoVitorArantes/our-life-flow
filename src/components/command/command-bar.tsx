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
import { contextEmoji, useContexts } from "@/features/contexts/queries";
import { useApp, type QuickActionKind } from "@/features/app/app-context";

const CREATE_ACTIONS: { kind: QuickActionKind; label: string }[] = [
  { kind: "expense", label: "Nova despesa" },
  { kind: "income", label: "Nova receita" },
  { kind: "event", label: "Novo evento" },
  { kind: "task", label: "Nova tarefa" },
  { kind: "goal", label: "Nova meta" },
  { kind: "note", label: "Nova nota" },
  { kind: "context", label: "Novo contexto" },
  { kind: "workout", label: "Registrar treino" },
];

/**
 * Global command bar. Actions are declared as data so an AI interpreter
 * can be plugged in later without touching the UI.
 */
export function CommandBar() {
  const { commandOpen, setCommandOpen, openQuickAction, workspaceId } = useApp();
  const { data: contexts = [] } = useContexts(workspaceId);
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
        {contexts.length > 0 ? (
          <CommandGroup heading="Contextos">
            {contexts.map((context) => (
              <CommandItem
                key={context.id}
                value={`contexto ${context.name}`}
                onSelect={() => {
                  setCommandOpen(false);
                  navigate({ to: "/contextos/$id", params: { id: context.id } });
                }}
              >
                <span className="mr-1">{contextEmoji(context.type)}</span>
                {context.name}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
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
