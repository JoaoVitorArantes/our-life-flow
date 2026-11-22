import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Confirm } from "@/components/wedding/confirm";
import { Bar } from "@/components/wedding/shell";
import { itemTotals, parseMoney, STATUS_LABEL, type BudgetStatus } from "@/features/wedding/budget";
import type { WBudgetPayment, WeddingBudgetMutations } from "@/features/wedding/budget-api";
import { formatCurrency } from "@/lib/format";
import type { EditableItem } from "./item-dialog";
import { fieldCls, fmtDate } from "./ui-utils";
import { DueTag, PayTag } from "./tags";

const today = () => new Date().toISOString().slice(0, 10);

export function ItemSheet({
  item,
  payments,
  categoryName,
  supplierName,
  people,
  personName,
  m,
  onClose,
  onEdit,
  meta,
}: {
  item: EditableItem | null;
  payments: (WBudgetPayment & { amount: number })[];
  categoryName: string;
  supplierName: string | null;
  people: { id: string; name: string }[];
  personName: (id: string | null) => string;
  m: WeddingBudgetMutations;
  onClose: () => void;
  onEdit: () => void;
  meta: { created_at: string; updated_at: string; created_by: string } | null;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const mine = item ? payments.filter((p) => p.item_id === item.id) : [];
  const t = item ? itemTotals(item, payments) : null;

  function pay() {
    if (!item) return;
    const v = parseMoney(amount);
    if (v == null || Number.isNaN(v) || v <= 0)
      return void toast.error("Informe um valor maior que zero.");
    if (!date) return void toast.error("Informe a data do pagamento.");
    m.addPayment.mutate(
      {
        item_id: item.id,
        amount: v,
        paid_on: date,
        paid_by_user_id: who || null,
        note: note.trim() ? note.trim().slice(0, 500) : null,
      },
      {
        onSuccess: () => {
          setAmount("");
          setNote("");
          toast.success("Pagamento registrado.");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {item && t ? (
          <div className="space-y-5">
            <SheetHeader className="text-left">
              <SheetTitle className="wed-display break-words text-2xl">{item.name}</SheetTitle>
              <SheetDescription>
                {categoryName} · {STATUS_LABEL[item.status as BudgetStatus] ?? item.status}
                {supplierName ? ` · ${supplierName}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-wrap gap-2">
              <PayTag state={t.payState} cancelled={item.status === "cancelled"} />
              <DueTag state={t.due} date={item.due_date} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Value label="Previsto" value={t.planned} />
              <Value label="Contratado" value={t.contracted} />
              <Value label="Pago" value={t.paid} />
              <Value
                label="Falta pagar"
                value={t.pending}
                empty={item.status === "cancelled" ? "—" : "Informe o contratado"}
              />
            </dl>
            {t.contracted && t.contracted > 0 ? (
              <Bar value={Math.round((t.paid / t.contracted) * 100)} />
            ) : null}
            {t.payState === "over" ? (
              <p className="text-sm text-destructive">
                Pagaram {formatCurrency(t.paid - (t.contracted ?? 0))} a mais que o contratado.
                Confira os valores.
              </p>
            ) : null}
            {item.due_date ? (
              <p className="text-sm text-muted-foreground">Vencimento: {fmtDate(item.due_date)}</p>
            ) : null}
            {item.notes ? (
              <p className="whitespace-pre-wrap break-words rounded-xl bg-muted/50 p-3 text-sm">
                {item.notes}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onEdit}>
                <Pencil className="mr-1 size-4" /> Editar
              </Button>
              <Confirm
                trigger={
                  <Button variant="outline" className="flex-1 text-destructive">
                    <Trash2 className="mr-1 size-4" /> Excluir
                  </Button>
                }
                title="Excluir este item?"
                description={`“${item.name}” e ${mine.length} pagamento(s) registrado(s) nele serão apagados. Isso não pode ser desfeito.`}
                confirmLabel="Excluir"
                onConfirm={() =>
                  m.deleteItem.mutate(item.id, {
                    onSuccess: () => {
                      toast.success("Item excluído.");
                      onClose();
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
              />
            </div>

            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="wed-display text-lg">Registrar pagamento</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-amount">Valor</Label>
                  <Input
                    id="pay-amount"
                    className="h-11"
                    inputMode="decimal"
                    placeholder={t.pending ? formatCurrency(t.pending) : "R$ 0,00"}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-date">Data</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    className="h-11"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-who">Quem pagou</Label>
                  <select
                    id="pay-who"
                    className={fieldCls}
                    value={who}
                    onChange={(e) => setWho(e.target.value)}
                  >
                    <option value="">Não informar</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-note">Observação</Label>
                  <Input
                    id="pay-note"
                    className="h-11"
                    maxLength={500}
                    placeholder="Ex.: sinal, 2ª parcela"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
              <Button className="w-full" disabled={m.addPayment.isPending} onClick={pay}>
                Registrar pagamento
              </Button>
              {t.pending && t.pending > 0 ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setAmount(String(t.pending).replace(".", ","))}
                >
                  Preencher com o que falta ({formatCurrency(t.pending)})
                </button>
              ) : null}
            </section>

            <section className="space-y-2 border-t border-border pt-4">
              <h3 className="wed-display text-lg">Histórico</h3>
              <ul className="divide-y divide-border text-sm">
                {[...mine]
                  .sort((a, b) => b.paid_on.localeCompare(a.paid_on))
                  .map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="tabular-nums font-medium">{formatCurrency(p.amount)}</p>
                        <p className="break-words text-xs text-muted-foreground">
                          {fmtDate(p.paid_on)}
                          {p.paid_by_user_id ? ` · ${personName(p.paid_by_user_id)}` : ""}
                          {p.note ? ` · ${p.note}` : ""}
                        </p>
                      </div>
                      <Confirm
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-9 shrink-0"
                            aria-label={`Excluir pagamento de ${formatCurrency(p.amount)}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                        title="Excluir este pagamento?"
                        description={`${formatCurrency(p.amount)} em ${fmtDate(p.paid_on)} deixa de contar como pago.`}
                        confirmLabel="Excluir"
                        onConfirm={() =>
                          m.deletePayment.mutate(p.id, {
                            onSuccess: () => toast.success("Pagamento excluído."),
                            onError: (e) => toast.error(e.message),
                          })
                        }
                      />
                    </li>
                  ))}
                {meta ? (
                  <li className="py-2 text-xs text-muted-foreground">
                    Criado em {fmtDate(meta.created_at)} por {personName(meta.created_by)}
                    {meta.updated_at.slice(0, 16) !== meta.created_at.slice(0, 16)
                      ? ` · editado em ${fmtDate(meta.updated_at)}`
                      : ""}
                  </li>
                ) : null}
              </ul>
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Value({
  label,
  value,
  empty = "Não informado",
}: {
  label: string;
  value: number | null;
  empty?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 tabular-nums font-semibold">
        {value == null ? (
          <span className="font-normal text-muted-foreground">{empty}</span>
        ) : (
          formatCurrency(value)
        )}
      </dd>
    </div>
  );
}
