import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gift, Plus, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingState } from "@/components/common/states";
import { OptionBadge, SectionTitle, Stat, WeddingShell } from "@/components/wedding/shell";
import { GiftFormDialog } from "@/components/wedding/gift-form";
import { GiftSettingsDialog } from "@/components/wedding/gift-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/features/app/app-context";
import { useGiftMutations, useGiftsData } from "@/features/wedding/gifts";
import {
  GIFT_KIND_LABEL,
  availability,
  summarizePledges,
  type GiftKind,
} from "@/features/wedding/gift-contracts";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/casamento/presentes/")({
  head: () => ({
    meta: [
      { title: "Presentes do casamento — Life OS" },
      {
        name: "description",
        content: "Lista de presentes, fundos e cotas do casal, com reservas e confirmação manual.",
      },
      { property: "og:title", content: "Presentes do casamento — Life OS" },
      { property: "og:description", content: "Presentes físicos, fundos e cotas do casal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GiftsPage,
});

const KIND_COLOR: Record<GiftKind, string> = { physical: "sage", fund: "lavender", quota: "blush" };
type Filter = "all" | GiftKind | "hidden" | "archived";

function GiftsPage() {
  const { workspaceId, userId } = useApp();
  const d = useGiftsData(workspaceId);
  const m = useGiftMutations(workspaceId, userId);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const sum = summarizePledges(d.pledges);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return d.gifts.filter((g) => {
      if (filter === "archived") {
        if (!g.archived_at) return false;
      } else if (g.archived_at) return false;
      if (filter === "hidden" && g.is_visible) return false;
      if ((filter === "physical" || filter === "fund" || filter === "quota") && g.kind !== filter)
        return false;
      return !t || g.title.toLowerCase().includes(t) || g.description?.toLowerCase().includes(t);
    });
  }, [d.gifts, q, filter]);

  if (d.loading || !workspaceId) return <LoadingState />;
  const enabled = d.settings?.portal_enabled ?? false;

  return (
    <WeddingShell
      title="🎁 Presentes"
      subtitle="Presentes físicos, fundos e cotas. Reservas são confirmadas manualmente por vocês."
      action={
        <>
          <GiftSettingsDialog
            settings={d.settings}
            onSave={(v) => m.saveSettings.mutateAsync(v)}
            trigger={
              <Button variant="outline" className="h-11">
                <Settings2 className="size-4" /> Ajustes
              </Button>
            }
          />
          <GiftFormDialog
            workspaceId={workspaceId}
            onSave={async (v) => {
              await m.createGift.mutateAsync({ ...v, sort_order: d.gifts.length });
              toast.success("Presente adicionado.");
            }}
            trigger={
              <Button className="h-11">
                <Plus className="size-4" /> Novo presente
              </Button>
            }
          />
        </>
      }
    >
      <div role="status" className={`wed-card p-4 text-sm ${enabled ? "" : "border-dashed"}`}>
        {enabled
          ? "A seção de presentes está visível no portal dos convidados."
          : "A seção de presentes está desligada no portal. Ative em Ajustes quando a lista estiver pronta."}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Presentes ativos"
          value={String(d.gifts.filter((g) => !g.archived_at).length)}
        />
        <Stat label="Aguardando confirmação" value={String(sum.pending)} />
        <Stat label="Recebidos" value={String(sum.confirmed)} />
        <Stat
          label="Valor recebido"
          value={formatCurrency(sum.confirmedAmount)}
          hint="Só confirmados por vocês"
        />
      </div>

      <section className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar presentes"
              className="h-11 pl-9"
              placeholder="Buscar presente"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar presentes">
            {(
              [
                ["all", "Todos"],
                ["physical", "Físicos"],
                ["fund", "Fundos"],
                ["quota", "Cotas"],
                ["hidden", "Ocultos"],
                ["archived", "Arquivados"],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={filter === k ? "default" : "outline"}
                aria-pressed={filter === k}
                className="h-9"
                onClick={() => setFilter(k)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <SectionTitle>Lista</SectionTitle>
        {list.length === 0 ? (
          <EmptyState
            icon={Gift}
            title={d.gifts.length ? "Nenhum presente neste filtro" : "Nenhum presente ainda"}
            description={
              d.gifts.length
                ? "Ajuste a busca ou o filtro."
                : "Cadastrem os presentes, fundos e cotas com os valores que vocês escolherem."
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((g) => {
              const kind = g.kind as GiftKind;
              const avail = availability(g, d.pledges);
              const gp = d.pledges.filter((p) => p.gift_id === g.id);
              const s = summarizePledges(gp);
              const total = g.quantity_total ?? g.quota_total;
              return (
                <li key={g.id}>
                  <Link
                    to="/casamento/presentes/$giftId"
                    params={{ giftId: g.id }}
                    className="wed-card flex h-full min-w-0 flex-col gap-2 p-4 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <OptionBadge label={GIFT_KIND_LABEL[kind]} color={KIND_COLOR[kind]} />
                      {!g.is_visible && <OptionBadge label="Oculto" color="stone" />}
                      {g.archived_at && <OptionBadge label="Arquivado" color="stone" />}
                    </div>
                    <p className="break-words font-medium leading-snug">{g.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {kind === "physical" && `${avail} de ${total} disponíveis`}
                      {kind === "quota" &&
                        `${formatCurrency(Number(g.quota_amount))} por cota · ${avail} de ${total} disponíveis`}
                      {kind === "fund" &&
                        (g.suggested_amount
                          ? `Sugestão ${formatCurrency(Number(g.suggested_amount))}`
                          : "Valor livre")}
                    </p>
                    <p className="mt-auto text-xs text-muted-foreground">
                      {s.pending} aguardando · {s.confirmed} recebido(s)
                      {kind === "fund" && g.goal_amount
                        ? ` · meta ${formatCurrency(Number(g.goal_amount))}`
                        : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </WeddingShell>
  );
}
