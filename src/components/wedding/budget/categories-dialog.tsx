import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Confirm } from "@/components/wedding/confirm";
import type { WBudgetCategory, WeddingBudgetMutations } from "@/features/wedding/budget-api";

export function CategoriesDialog({
  open,
  onOpenChange,
  categories,
  usage,
  m,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: WBudgetCategory[];
  usage: (id: string) => number;
  m: WeddingBudgetMutations;
}) {
  const [name, setName] = useState("");
  const add = () => {
    const v = name.trim();
    if (!v) return;
    m.saveCategory.mutate(
      { name: v.slice(0, 60), sort_order: categories.length + 1 },
      { onSuccess: () => setName(""), onError: (e) => toast.error(e.message) },
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="wed-display text-2xl">Categorias</DialogTitle>
          <DialogDescription>
            Renomeie, crie ou apague. Só valem para o orçamento do casamento.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <Input
                aria-label={`Nome da categoria ${c.name}`}
                className="h-10"
                defaultValue={c.name}
                maxLength={60}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.name)
                    m.saveCategory.mutate(
                      { id: c.id, name: v },
                      {
                        onSuccess: () => toast.success("Categoria renomeada."),
                        onError: (er) => {
                          e.target.value = c.name;
                          toast.error(er.message);
                        },
                      },
                    );
                }}
              />
              <Confirm
                trigger={
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-10 shrink-0"
                    aria-label={`Apagar categoria ${c.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
                title={`Apagar “${c.name}”?`}
                description={
                  usage(c.id)
                    ? `${usage(c.id)} item(ns) ficam em “Sem categoria”. Nenhum item ou pagamento é apagado.`
                    : "A categoria não tem itens."
                }
                confirmLabel="Apagar"
                onConfirm={() =>
                  m.deleteCategory.mutate(c.id, { onError: (e) => toast.error(e.message) })
                }
              />
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            aria-label="Nova categoria"
            className="h-11"
            placeholder="Nova categoria"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button
            className="h-11"
            disabled={!name.trim() || m.saveCategory.isPending}
            onClick={add}
          >
            Criar
          </Button>
        </div>
        <Button
          variant="outline"
          disabled={m.addSuggested.isPending}
          onClick={() =>
            m.addSuggested.mutate(
              categories.map((c) => c.name),
              {
                onSuccess: () => toast.success("Sugestões que faltavam foram adicionadas."),
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          Adicionar sugestões que faltam
        </Button>
      </DialogContent>
    </Dialog>
  );
}
