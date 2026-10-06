import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApp } from "@/features/app/app-context";
import { useCategories, type Category } from "@/features/finance/queries";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { LoadingState } from "@/components/common/states";

export const Route = createFileRoute("/_authenticated/configuracoes/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Life OS" },
      { name: "description", content: "Crie, edite e arquive as categorias do Financeiro." },
      { property: "og:title", content: "Categorias — Life OS" },
      { property: "og:description", content: "Categorias financeiras do seu espaço." },
    ],
  }),
  component: Categorias,
});

type CategoryType = Enums<"category_type">;
const TYPE_LABEL: Record<CategoryType, string> = { EXPENSE: "Despesa", INCOME: "Receita", BOTH: "Ambos" };
const COLORS = ["#7C5CFC", "#3B82F6", "#14B8A6", "#22C55E", "#F59E0B", "#F97316", "#F43F5E", "#EC4899", "#64748B"];

type Draft = { id?: string; name: string; icon: string; color: string; type: CategoryType };

function Categorias() {
  const { workspaceId } = useApp();
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading } = useCategories(workspaceId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<{ category: Category; usage: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["categories"] });
  const active = categories.filter((c) => !c.archived_at);
  const archived = categories.filter((c) => c.archived_at);

  async function save() {
    if (!draft || !workspaceId) return;
    const name = draft.name.trim();
    if (!name) return void toast.error("Dê um nome à categoria.");
    if (categories.some((c) => c.id !== draft.id && c.name.toLowerCase() === name.toLowerCase()))
      return void toast.error("Já existe uma categoria com esse nome.");
    setBusy(true);
    const values = { name, icon: draft.icon.trim() || null, color: draft.color, type: draft.type };
    const { error } = draft.id
      ? await supabase.from("categories").update(values).eq("id", draft.id)
      : await supabase.from("categories").insert({ ...values, workspace_id: workspaceId });
    setBusy(false);
    if (error) return void toast.error(error.message);
    await refresh();
    setDraft(null);
    toast.success(draft.id ? "Categoria atualizada." : "Categoria criada.");
  }

  async function setArchived(category: Category, archived: boolean) {
    const { error } = await supabase
      .from("categories")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", category.id);
    if (error) return void toast.error(error.message);
    await refresh();
    toast.success(archived ? "Categoria arquivada. O histórico continua igual." : "Categoria reativada.");
  }

  async function askDelete(category: Category) {
    const { data, error } = await supabase.rpc("category_usage", { _category_id: category.id });
    if (error) return void toast.error(error.message);
    setToDelete({ category, usage: data ?? 0 });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    if (toDelete.usage > 0) {
      await setArchived(toDelete.category, true);
      setToDelete(null);
      return;
    }
    const { error } = await supabase.rpc("delete_category_safe", { _category_id: toDelete.category.id });
    if (error) return void toast.error(error.message);
    await refresh();
    setToDelete(null);
    toast.success("Categoria excluída.");
  }

  if (isLoading) return <LoadingState />;

  const row = (category: Category) => (
    <li key={category.id} className="flex items-center gap-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ background: `${category.color ?? "#64748B"}26` }}>
        {category.icon || "•"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{category.name}</span>
        <span className="block text-xs text-muted-foreground">{TYPE_LABEL[category.type]}</span>
      </span>
      {category.archived_at ? (
        <Button size="icon" variant="ghost" className="size-9" aria-label={`Reativar ${category.name}`} onClick={() => void setArchived(category, false)}>
          <ArchiveRestore className="size-4" />
        </Button>
      ) : (
        <>
          <Button size="icon" variant="ghost" className="size-9" aria-label={`Editar ${category.name}`} onClick={() => setDraft({ id: category.id, name: category.name, icon: category.icon ?? "", color: category.color ?? COLORS[0]!, type: category.type })}>
            <Pencil className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-9" aria-label={`Arquivar ${category.name}`} onClick={() => void setArchived(category, true)}>
            <Archive className="size-4" />
          </Button>
        </>
      )}
      <Button size="icon" variant="ghost" className="size-9" aria-label={`Excluir ${category.name}`} onClick={() => void askDelete(category)}>
        <Trash2 className="size-4" />
      </Button>
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias"
        subtitle="Valem para todos do espaço e aparecem no Financeiro."
        action={<Button size="sm" onClick={() => setDraft({ name: "", icon: "", color: COLORS[0]!, type: "EXPENSE" })}><Plus className="size-4" /> Nova categoria</Button>}
      />
      <Panel>
        <PanelTitle>Em uso ({active.length})</PanelTitle>
        {active.length ? <ul className="divide-y divide-border">{active.map(row)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma categoria ativa ainda.</p>}
      </Panel>
      {archived.length ? (
        <Panel>
          <PanelTitle>Arquivadas ({archived.length})</PanelTitle>
          <p className="mb-2 text-xs text-muted-foreground">Não aparecem em novos lançamentos, mas continuam no histórico.</p>
          <ul className="divide-y divide-border">{archived.map(row)}</ul>
        </Panel>
      ) : null}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>A mudança vale para os lançamentos antigos e novos.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <div className="grid grid-cols-[80px_1fr] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cat-icon">Ícone</Label>
                  <Input id="cat-icon" value={draft.icon} maxLength={4} placeholder="🛒" onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-name">Nome</Label>
                  <Input id="cat-name" value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={draft.type} onValueChange={(type) => setDraft({ ...draft, type: type as CategoryType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABEL) as CategoryType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button key={color} type="button" aria-label={color} aria-pressed={draft.color === color} onClick={() => setDraft({ ...draft, color })} className={`size-8 rounded-full ring-offset-2 ring-offset-background ${draft.color === color ? "ring-2 ring-foreground" : ""}`} style={{ background: color }} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toDelete?.usage ? "Esta categoria está em uso" : `Excluir “${toDelete?.category.name}”?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.usage
                ? `Ela aparece em ${toDelete.usage} registro(s). Excluir apagaria a classificação deles, então o Life OS arquiva em vez disso: some dos novos lançamentos e o histórico fica intacto.`
                : "Nenhum registro usa esta categoria. A exclusão é definitiva."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>{toDelete?.usage ? "Arquivar" : "Excluir definitivamente"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
