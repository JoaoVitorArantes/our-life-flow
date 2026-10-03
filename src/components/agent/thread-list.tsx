import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/app/app-context";
import { createConversation, deleteConversation, useConversations } from "@/features/agent/conversations";
import { cn } from "@/lib/utils";

export function useStartConversation() {
  const { workspaceId } = useApp();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  return {
    pending,
    start: async (q?: string) => {
      if (!workspaceId || pending) return;
      setPending(true);
      try {
        const id = await createConversation(workspaceId);
        void qc.invalidateQueries({ queryKey: ["ai_conversations"] });
        await navigate({ to: "/inbox/$threadId", params: { threadId: id }, search: q ? { q } : {} });
      } catch {
        toast.error("Não consegui abrir uma conversa agora.");
      } finally {
        setPending(false);
      }
    },
  };
}

export function ThreadList({ activeId }: { activeId?: string }) {
  const { workspaceId, memberProfiles } = useApp();
  const { data = [], isLoading } = useConversations(workspaceId);
  const { start, pending } = useStartConversation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const first = (id: string) => memberProfiles.find((p) => p.id === id)?.name.split(" ")[0];

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <Button onClick={() => void start()} disabled={pending} className="min-h-11 justify-start gap-2">
        <Plus className="size-4" /> Nova conversa
      </Button>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {isLoading ? <p className="px-2 text-sm text-muted-foreground">Carregando…</p> : null}
        {!isLoading && data.length === 0 ? <p className="px-2 text-sm text-muted-foreground">Nenhuma conversa ainda.</p> : null}
        {data.map((c) => (
          <div key={c.id} className={cn("group flex items-center rounded-lg", c.id === activeId ? "bg-primary/10" : "hover:bg-muted")}>
            <Link to="/inbox/$threadId" params={{ threadId: c.id }} search={{}} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center px-3 py-1.5">
              <span className={cn("truncate text-sm", c.id === activeId && "font-medium text-primary")}>{c.title}</span>
              <span className="text-[11px] text-muted-foreground">
                {first(c.created_by) ?? ""} · {new Date(c.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </span>
            </Link>
            <button
              type="button"
              aria-label="Excluir conversa"
              className="mr-1 grid size-9 place-items-center rounded-md text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"
              onClick={async () => {
                if (!confirm("Excluir esta conversa?")) return;
                try {
                  await deleteConversation(c.id);
                  await qc.invalidateQueries({ queryKey: ["ai_conversations"] });
                  if (c.id === activeId) await navigate({ to: "/inbox" });
                } catch {
                  toast.error("Não consegui excluir.");
                }
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
