import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LoadingState } from "@/components/common/states";
import { WeddingShell } from "@/components/wedding/shell";
import { RowList } from "@/components/wedding/row-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWeddingMutations } from "@/features/wedding/api";
import { useWeddingData } from "@/features/wedding/use-wedding";

export const Route = createFileRoute("/_authenticated/casamento/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores do casamento — Life OS" },
      { name: "description", content: "Lojas e prestadores do casamento e da casa nova." },
      { property: "og:title", content: "Fornecedores do casamento — Life OS" },
      { property: "og:description", content: "Lojas e prestadores do casal." },
    ],
  }),
  component: Suppliers,
});

function Suppliers() {
  const w = useWeddingData();
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const [f, setF] = useState({ name: "", category: "", contact: "", url: "" });
  if (w.loading) return <LoadingState />;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <WeddingShell title="Fornecedores" subtitle="Lojas e prestadores que vocês estão considerando.">
      <section className="wed-card grid gap-2 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[2fr_1fr_1fr_1.5fr_auto]">
        <Input
          aria-label="Nome"
          className="h-11"
          placeholder="Loja ou prestador"
          value={f.name}
          onChange={set("name")}
        />
        <Input
          aria-label="Categoria"
          className="h-11"
          placeholder="Categoria"
          value={f.category}
          onChange={set("category")}
        />
        <Input
          aria-label="Contato"
          className="h-11"
          placeholder="Contato"
          value={f.contact}
          onChange={set("contact")}
        />
        <Input
          aria-label="Site"
          className="h-11"
          placeholder="https://"
          value={f.url}
          onChange={set("url")}
        />
        <Button
          className="h-11"
          disabled={!f.name.trim()}
          onClick={() =>
            m.addSupplier.mutate(
              {
                name: f.name.trim(),
                category: f.category.trim() || null,
                contact: f.contact.trim() || null,
                url: f.url.trim() || null,
              },
              {
                onSuccess: () => setF({ name: "", category: "", contact: "", url: "" }),
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          Adicionar
        </Button>
      </section>
      <RowList
        title="Fornecedores"
        rows={w.suppliers.map((s) => ({
          id: s.id,
          main: s.name,
          sub: [s.category, s.contact, s.url].filter(Boolean).join(" · ") || "Sem detalhes",
        }))}
        onDelete={(id) => m.deleteRow.mutate({ table: "wedding_suppliers", id })}
      />
    </WeddingShell>
  );
}
