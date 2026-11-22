import { useState } from "react";
import { toast } from "sonner";
import { Archive, ArrowDown, ArrowUp, Pencil, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  moveInOrder,
  optionInputSchema,
  WED_COLORS,
  WED_COLOR_LABEL,
} from "@/features/wedding/contracts";
import {
  useWeddingMutations,
  type WeddingPriority,
  type WeddingStatus,
} from "@/features/wedding/api";
import type { WeddingData } from "@/features/wedding/use-wedding";
import { Choice, Field } from "./item-form";
import { OptionBadge, SectionTitle } from "./shell";

type Kind = "wedding_priorities" | "wedding_statuses";
type Opt = WeddingPriority | WeddingStatus;

export function OptionsEditor({ w, table, title }: { w: WeddingData; table: Kind; title: string }) {
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const all: Opt[] = table === "wedding_priorities" ? w.allPriorities : w.allStatuses;
  const active = all.filter((o) => !o.archived_at);
  const archived = all.filter((o) => o.archived_at);
  return (
    <section className="wed-card p-4 sm:p-5">
      <SectionTitle
        action={
          <OptionDialog
            w={w}
            table={table}
            trigger={
              <Button variant="outline" className="h-10">
                <Plus className="size-4" /> Adicionar
              </Button>
            }
          />
        }
      >
        {title}
      </SectionTitle>
      <ul className="divide-y divide-border">
        {active.map((o) => (
          <li key={o.id} className="flex min-w-0 flex-wrap items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1 space-y-1">
              <OptionBadge label={o.label} color={o.color} />
              {"description" in o && o.description && (
                <p className="text-xs text-muted-foreground">{o.description}</p>
              )}
              {"counts_as_bought" in o && o.counts_as_bought && (
                <p className="text-xs text-muted-foreground">Conta como comprado</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-10"
                aria-label={`Subir ${o.label}`}
                onClick={() => m.reorder.mutate({ table, rows: moveInOrder(active, o.id, -1) })}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-10"
                aria-label={`Descer ${o.label}`}
                onClick={() => m.reorder.mutate({ table, rows: moveInOrder(active, o.id, 1) })}
              >
                <ArrowDown className="size-4" />
              </Button>
              <OptionDialog
                w={w}
                table={table}
                option={o}
                trigger={
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-10"
                    aria-label={`Editar ${o.label}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                }
              />
              <Button
                size="icon"
                variant="ghost"
                className="size-10"
                aria-label={`Arquivar ${o.label}`}
                onClick={() =>
                  m.setArchived.mutate(
                    { table, id: o.id, archived: true },
                    {
                      onSuccess: () =>
                        toast.success("Arquivado. Os itens mantêm o valor até vocês trocarem."),
                    },
                  )
                }
              >
                <Archive className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {archived.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Arquivados</p>
          {archived.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2">
              <OptionBadge label={o.label} color={o.color} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => m.setArchived.mutate({ table, id: o.id, archived: false })}
              >
                <RotateCcw className="size-4" /> Restaurar
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function OptionDialog({
  w,
  table,
  option,
  trigger,
}: {
  w: WeddingData;
  table: Kind;
  option?: Opt;
  trigger: React.ReactNode;
}) {
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(option?.label ?? "");
  const [color, setColor] = useState<string>(option?.color ?? "blush");
  const [description, setDescription] = useState(
    option && "description" in option ? (option.description ?? "") : "",
  );
  const [bought, setBought] = useState(
    option && "counts_as_bought" in option ? option.counts_as_bought : false,
  );
  const isStatus = table === "wedding_statuses";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = isStatus
      ? { label, color, counts_as_bought: bought }
      : { label, color, description: description.trim() || null };
    const parsed = optionInputSchema.safeParse(input);
    if (!parsed.success) {
      toast.error("Informe um nome (até 60 caracteres).");
      return;
    }
    m.saveOption.mutate(
      { table, id: option?.id, input: parsed.data },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success("Salvo.");
        },
        onError: (er) => toast.error(er.message),
      },
    );
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md">
        <DialogHeader>
          <DialogTitle className="wed-display text-2xl">
            {option ? "Editar" : "Adicionar"} {isStatus ? "status" : "prioridade"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome" htmlFor="op-label">
            <Input
              id="op-label"
              className="h-11"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </Field>
          <Field label="Cor">
            <Choice
              value={color}
              onChange={setColor}
              options={WED_COLORS.map((c) => [c, WED_COLOR_LABEL[c]])}
            />
          </Field>
          {!isStatus && (
            <Field label="Descrição" htmlFor="op-desc">
              <Input
                id="op-desc"
                className="h-11"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          )}
          {isStatus && (
            <label className="flex items-center justify-between gap-3 text-sm">
              Conta como comprado nos totais
              <Switch checked={bought} onCheckedChange={setBought} />
            </label>
          )}
          <OptionBadge label={label || "Prévia"} color={color} />
          <Button type="submit" className="h-11 w-full" disabled={m.saveOption.isPending}>
            Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
