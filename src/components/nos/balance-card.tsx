import { Link } from "@tanstack/react-router";
import { Heart, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/app/app-context";
import { netBalance, useSettlements } from "@/features/nos/settlements";
import { formatCurrency } from "@/lib/format";

/** Saldo consolidado entre as duas pessoas do espaço Nós. */
export function BalanceCard({ compact = false }: { compact?: boolean }) {
  const { workspaceId, userId, memberProfiles } = useApp();
  const { data: settlements = [] } = useSettlements(workspaceId);
  const balance = netBalance(settlements, userId);

  const nameOf = (id: string) =>
    id === userId
      ? "Você"
      : (memberProfiles.find((profile) => profile.id === id)?.name ?? "Parceiro(a)");

  const transfer = balance.transfers[0] ?? null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {transfer ? (
          <Heart className="size-3.5 text-primary" />
        ) : (
          <HeartHandshake className="size-3.5 text-success" />
        )}
        Acertos
      </div>

      {transfer ? (
        <>
          <p className="text-sm text-muted-foreground">
            {nameOf(transfer.fromUserId)} deve passar para {nameOf(transfer.toUserId)}
          </p>
          <p className="numeric mt-1 text-2xl font-semibold text-primary">
            {formatCurrency(transfer.amount)}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          💚 Tudo certo entre vocês. Nenhum acerto pendente.
        </p>
      )}

      {!compact ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <p className="flex flex-col">
            <span className="text-xs text-muted-foreground">Você deve</span>
            <span className="numeric">{formatCurrency(balance.owedByMe)}</span>
          </p>
          <p className="flex flex-col">
            <span className="text-xs text-muted-foreground">Devem para você</span>
            <span className="numeric">{formatCurrency(balance.owedToMe)}</span>
          </p>
        </div>
      ) : null}

      <Button asChild size="sm" variant="outline" className="mt-3 w-full">
        <Link to="/nos">Ver acertos</Link>
      </Button>
    </div>
  );
}
