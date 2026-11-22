import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseMoney, STATUS_LABEL, STATUSES, type BudgetStatus } from "@/features/wedding/budget";
import type {
  WBudgetCategory,
  WeddingBudgetMutations,
  ItemInput,
} from "@/features/wedding/budget-api";
import type { WeddingSupplier } from "@/features/wedding/api";
import { cn } from "@/lib/utils";
import { fieldCls } from "./ui-utils";

export type EditableItem = {
  id: string;
  name: string;
  category_id: string | null;
  supplier_id: string | null;
  planned_amount: number | null;
  contracted_amount: number | null;
  status: string;
  due_date: string | null;
  notes: string | null;
};

const money = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
const NEW = "__new__";

export function ItemDialog({
  open,
  onOpenChange,
  item,
  defaultCategory,
  categories,
  suppliers,
  m,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: EditableItem | null;
  defaultCategory?: string | null;
  categories: WBudgetCategory[];
  suppliers: WeddingSupplier[];
  m: WeddingBudgetMutations;
  onSaved?: (id: string) => void;
}) {
  const [f, setF] = useState(() => init(item, defaultCategory));
  const [key, setKey] = useState<string | null>(null);
  const k = `${open}-${item?.id ?? "new"}-${defaultCategory ?? ""}`;
  if (key !== k) {
    setKey(k);
    setF(init(item, defaultCategory));
  }
  const set = <K extends keyof typeof f>(name: K, v: (typeof f)[K]) =>
    setF((s) => ({ ...s, [name]: v }));
  const busy = m.saveItem.isPending || m.saveCategory.isPending;

  async function save() {
    const name = f.name.trim();
    if (!name) return void toast.error("Dê um nome ao item.");
    const planned = parseMoney(f.planned);
    const contracted = parseMoney(f.contracted);
    if (Number.isNaN(planned) || Number.isNaN(contracted))
      return void toast.error("Confira os valores: use números, ex.: 1.500,00.");
    let categoryId: string | null = f.category || null;
    try {
      if (f.category === NEW) {
        const cname = f.newCategory.trim();
        if (!cname) return void toast.error("Digite o nome da nova categoria.");
        categoryId = await m.saveCategory.mutateAsync({
          name: cname.slice(0, 60),
          sort_order: categories.length + 1,
        });
      }
      const input: ItemInput = {
        name: name.slice(0, 120),
        category_id: categoryId,
        supplier_id: f.supplier || null,
        planned_amount: planned,
        contracted_amount: contracted,
        status: f.status,
        due_date: f.due || null,
        notes: f.notes.trim() ? f.notes.trim().slice(0, 2000) : null,
      };
      const id = await m.saveItem.mutateAsync({ id: item?.id, input });
      toast.success(item ? "Item atualizado." : "Item adicionado.");
      onOpenChange(false);
      onSaved?.(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="wed-display text-2xl">
            {item ? "Editar item" : "Novo item do orçamento"}
          </DialogTitle>
          <DialogDescription>
            Só o nome é obrigatório. Deixe em branco o que ainda não sabem.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bi-name">Nome</Label>
            <Input
              id="bi-name"
              className="h-11"
              placeholder="Ex.: buffet, fotógrafo, vestido"
              value={f.name}
              maxLength={120}
              autoFocus
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bi-cat">Categoria</Label>
              <select
                id="bi-cat"
                className={fieldCls}
                value={f.category}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NEW}>+ Nova categoria…</option>
              </select>
              {f.category === NEW ? (
                <Input
                  aria-label="Nome da nova categoria"
                  className="h-11"
                  placeholder="Nome da categoria"
                  maxLength={60}
                  value={f.newCategory}
                  onChange={(e) => set("newCategory", e.target.value)}
                />
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bi-sup">Fornecedor (opcional)</Label>
              <select
                id="bi-sup"
                className={fieldCls}
                value={f.supplier}
                onChange={(e) => set("supplier", e.target.value)}
              >
                <option value="">Nenhum</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bi-planned">Previsto</Label>
              <Input
                id="bi-planned"
                className="h-11"
                inputMode="decimal"
                placeholder="R$ —"
                value={f.planned}
                onChange={(e) => set("planned", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bi-contracted">Contratado</Label>
              <Input
                id="bi-contracted"
                className="h-11"
                inputMode="decimal"
                placeholder="R$ —"
                value={f.contracted}
                onChange={(e) => set("contracted", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Situação</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Situação">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={f.status === s}
                  onClick={() => set("status", s)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-sm transition",
                    f.status === s
                      ? "border-primary bg-accent font-medium text-accent-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bi-due">Vencimento (opcional)</Label>
            <Input
              id="bi-due"
              type="date"
              className="h-11"
              value={f.due}
              onChange={(e) => set("due", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bi-notes">Observações</Label>
            <Textarea
              id="bi-notes"
              rows={3}
              maxLength={2000}
              placeholder="Condições, o que está incluso, contato…"
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {item ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function init(item: EditableItem | null, defaultCategory?: string | null) {
  return {
    name: item?.name ?? "",
    category: item?.category_id ?? defaultCategory ?? "",
    newCategory: "",
    supplier: item?.supplier_id ?? "",
    planned: money(item?.planned_amount ?? null),
    contracted: money(item?.contracted_amount ?? null),
    status: ((item?.status as BudgetStatus) ?? "planned") as BudgetStatus,
    due: item?.due_date ?? "",
    notes: item?.notes ?? "",
  };
}
