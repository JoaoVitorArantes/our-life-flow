import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ImagePlus, RotateCcw, Trash2, X } from "lucide-react";
import { LoadingState } from "@/components/common/states";
import { SectionTitle, WeddingShell } from "@/components/wedding/shell";
import { Choice, Field } from "@/components/wedding/item-form";
import { OptionsEditor } from "@/components/wedding/options-editor";
import { Confirm } from "@/components/wedding/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PLAN, planInputSchema, type PlanInput } from "@/features/wedding/contracts";
import {
  uploadWeddingImage,
  useSavePlan,
  useWeddingImage,
  useWeddingMutations,
} from "@/features/wedding/api";
import { useWeddingData } from "@/features/wedding/use-wedding";

export const Route = createFileRoute("/_authenticated/casamento/configuracoes")({
  head: () => ({
    meta: [
      { title: "Ajustes do casamento — Life OS" },
      {
        name: "description",
        content: "Identidade, datas, prioridades, status e lixeira do casamento.",
      },
      { property: "og:title", content: "Ajustes do casamento — Life OS" },
      { property: "og:description", content: "Personalização do planejamento do casal." },
    ],
  }),
  component: WeddingSettings,
});

const THEMES: [string, string][] = [
  ["champagne", "Champagne & Blush"],
  ["lavender", "Lavanda & Ameixa"],
  ["ivory", "Marfim & Dourado"],
];

function WeddingSettings() {
  const w = useWeddingData();
  const save = useSavePlan(w.workspaceId, w.userId);
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const [form, setForm] = useState<PlanInput>(DEFAULT_PLAN);
  const [identity, setIdentity] = useState({
    couple_names: "",
    message: "",
    theme: "champagne",
    cover_path: null as string | null,
  });
  const [uploading, setUploading] = useState(false);
  const cover = useWeddingImage(identity.cover_path);
  useEffect(() => {
    if (!w.plan) return;
    setForm({
      wedding_date: w.plan.wedding_date,
      move_in_date: w.plan.move_in_date,
      total_budget: w.plan.total_budget == null ? null : Number(w.plan.total_budget),
      housing: w.plan.housing as PlanInput["housing"],
      bedrooms: w.plan.bedrooms,
      standard: w.plan.standard as PlanInput["standard"],
      savings_start: w.plan.savings_start,
      notes: w.plan.notes,
    });
    setIdentity({
      couple_names: w.plan.couple_names ?? "",
      message: w.plan.message ?? "",
      theme: w.plan.theme,
      cover_path: w.plan.cover_path,
    });
  }, [w.plan]);
  if (w.loading) return <LoadingState />;
  const set = <K extends keyof PlanInput>(k: K, v: PlanInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    const parsed = planInputSchema.safeParse(form);
    if (!parsed.success) {
      toast.error("Confira datas e valores.");
      return;
    }
    const names = identity.couple_names.trim().slice(0, 80) || null;
    const message = identity.message.trim().slice(0, 600) || null;
    save.mutate(
      {
        ...parsed.data,
        couple_names: names,
        message,
        theme: identity.theme,
        cover_path: identity.cover_path,
      },
      {
        onSuccess: () => toast.success("Ajustes salvos."),
        onError: (e) => toast.error(e.message),
      },
    );
  };
  const upload = async (file?: File) => {
    if (!file || !w.workspaceId) return;
    setUploading(true);
    try {
      const path = await uploadWeddingImage(w.workspaceId, file);
      setIdentity((s) => ({ ...s, cover_path: path }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <WeddingShell
      title="Ajustes"
      subtitle="Campos vazios ficam como “não informado”. Nada é presumido."
    >
      <section className="wed-card grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2">
          <SectionTitle>Identidade do casal</SectionTitle>
        </div>
        <Field label="Nomes como devem aparecer" htmlFor="cs-names">
          <Input
            id="cs-names"
            className="h-11"
            maxLength={80}
            placeholder="Ex.: João & Renifer"
            value={identity.couple_names}
            onChange={(e) => setIdentity((s) => ({ ...s, couple_names: e.target.value }))}
          />
        </Field>
        <Field label="Tema visual">
          <Choice
            value={identity.theme}
            onChange={(v) => setIdentity((s) => ({ ...s, theme: v }))}
            options={THEMES}
          />
        </Field>
        <Field label="Mensagem do casal" wide htmlFor="cs-msg">
          <Textarea
            id="cs-msg"
            maxLength={600}
            value={identity.message}
            onChange={(e) => setIdentity((s) => ({ ...s, message: e.target.value }))}
          />
        </Field>
        <Field label="Foto de capa" wide>
          <div className="flex flex-wrap items-center gap-3">
            {cover.data && (
              <img src={cover.data} alt="Capa" className="h-20 w-32 rounded-xl object-cover" />
            )}
            <Button type="button" variant="outline" asChild disabled={uploading}>
              <label className="cursor-pointer">
                <ImagePlus className="size-4" /> {uploading ? "Enviando…" : "Escolher foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => void upload(e.target.files?.[0])}
                />
              </label>
            </Button>
            {identity.cover_path && (
              <Button
                variant="ghost"
                onClick={() => setIdentity((s) => ({ ...s, cover_path: null }))}
              >
                <X className="size-4" /> Remover
              </Button>
            )}
          </div>
        </Field>

        <div className="sm:col-span-2">
          <SectionTitle>Datas e premissas</SectionTitle>
        </div>
        <Field label="Data do casamento" htmlFor="cs-wd">
          <Input
            id="cs-wd"
            className="h-11"
            type="date"
            value={form.wedding_date ?? ""}
            onChange={(e) => set("wedding_date", e.target.value || null)}
          />
        </Field>
        <Field label="Data da mudança" htmlFor="cs-md">
          <Input
            id="cs-md"
            className="h-11"
            type="date"
            value={form.move_in_date ?? ""}
            onChange={(e) => set("move_in_date", e.target.value || null)}
          />
        </Field>
        <Field label="Orçamento total (R$)" htmlFor="cs-b">
          <Input
            id="cs-b"
            className="h-11"
            type="number"
            min={0}
            value={form.total_budget ?? ""}
            onChange={(e) =>
              set("total_budget", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Início da economia" htmlFor="cs-s">
          <Input
            id="cs-s"
            className="h-11"
            type="date"
            value={form.savings_start ?? ""}
            onChange={(e) => set("savings_start", e.target.value || null)}
          />
        </Field>
        <Field label="Moradia">
          <Choice
            value={form.housing}
            onChange={(v) => set("housing", v as PlanInput["housing"])}
            options={[
              ["rent", "Alugada"],
              ["own", "Própria"],
              ["other", "Outra"],
            ]}
          />
        </Field>
        <Field label="Quartos" htmlFor="cs-q">
          <Input
            id="cs-q"
            className="h-11"
            type="number"
            min={0}
            value={form.bedrooms ?? ""}
            onChange={(e) => set("bedrooms", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>
        <Field label="Padrão das aquisições">
          <Choice
            value={form.standard}
            onChange={(v) => set("standard", v as PlanInput["standard"])}
            options={[
              ["economy", "Econômico"],
              ["intermediate", "Intermediário"],
              ["premium", "Premium"],
            ]}
          />
        </Field>
        <Field label="Observações" wide htmlFor="cs-n">
          <Textarea
            id="cs-n"
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button className="h-11 w-full sm:w-auto" onClick={submit} disabled={save.isPending}>
            Salvar ajustes
          </Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <OptionsEditor w={w} table="wedding_priorities" title="Prioridades" />
        <OptionsEditor w={w} table="wedding_statuses" title="Status" />
      </div>

      <section className="wed-card p-4 sm:p-5">
        <SectionTitle>Lixeira</SectionTitle>
        {w.archivedRooms.length + w.archivedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">A lixeira está vazia.</p>
        ) : (
          <ul className="divide-y divide-border">
            {w.archivedRooms.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <p className="min-w-0 flex-1 break-words">
                  <span className="text-xs text-muted-foreground">Cômodo · </span>
                  {r.name}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    m.setArchived.mutate(
                      { table: "wedding_rooms", id: r.id, archived: false },
                      { onSuccess: () => toast.success("Cômodo restaurado.") },
                    )
                  }
                >
                  <RotateCcw className="size-4" /> Restaurar
                </Button>
                <Confirm
                  title="Excluir cômodo definitivamente?"
                  description="Todos os itens dele também serão excluídos. Não pode ser desfeito."
                  confirmLabel="Excluir"
                  onConfirm={() => m.deleteRow.mutate({ table: "wedding_rooms", id: r.id })}
                  trigger={
                    <Button size="sm" variant="ghost">
                      <Trash2 className="size-4" /> Excluir
                    </Button>
                  }
                />
              </li>
            ))}
            {w.archivedItems.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <Link
                  to="/casamento/casa/item/$itemId"
                  params={{ itemId: i.id }}
                  className="min-w-0 flex-1 break-words hover:underline"
                >
                  <span className="text-xs text-muted-foreground">Item · </span>
                  {i.name}
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    m.setArchived.mutate(
                      { table: "wedding_items", id: i.id, archived: false },
                      { onSuccess: () => toast.success("Item restaurado.") },
                    )
                  }
                >
                  <RotateCcw className="size-4" /> Restaurar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WeddingShell>
  );
}
