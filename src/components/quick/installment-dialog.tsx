import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/features/app/app-context";
import { useAccounts, useCards, useCategories } from "@/features/finance/queries";
import { createInstallmentPlan } from "@/features/finance/mutations";
import { splitInstallments } from "@/features/finance/calc";
import { formatCurrency, parseAmount, toDateInput } from "@/lib/format";
import { ContextSelect, NO_CONTEXT } from "./context-select";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultContextId?: string | null;
};

export function InstallmentDialog({ open, onOpenChange, defaultContextId }: Props) {
  const { workspaceId, userId, activeContextId } = useApp();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: cards = [] } = useCards(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);

  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [count, setCount] = useState("12");
  const [startDate, setStartDate] = useState(toDateInput());
  const [categoryId, setCategoryId] = useState("");
  const [payment, setPayment] = useState("");
  const [contextId, setContextId] = useState<string>(NO_CONTEXT);
  const [firstPaid, setFirstPaid] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescription("");
    setTotal("");
    setCount("12");
    setStartDate(toDateInput());
    setCategoryId("");
    setPayment("");
    setContextId(defaultContextId ?? activeContextId ?? NO_CONTEXT);
    setFirstPaid(false);
  }, [open, defaultContextId, activeContextId]);

  const totalValue = parseAmount(total);
  const parcels = Math.max(1, Math.min(120, Number(count) || 1));
  const preview = useMemo(
    () => (totalValue ? splitInstallments(totalValue, parcels) : []),
    [totalValue, parcels],
  );

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!description.trim()) { toast.error("Informe uma descrição."); return; }
    if (!totalValue) { toast.error("Informe o valor total."); return; }

    setSaving(true);
    try {
      const [source, id] = payment ? payment.split(":") : ["", ""];
      await createInstallmentPlan({
        workspaceId,
        ownerId: userId,
        description: description.trim(),
        totalAmount: totalValue,
        totalInstallments: parcels,
        startDate,
        categoryId: categoryId || null,
        accountId: source === "account" ? (id ?? null) : null,
        cardId: source === "card" ? (id ?? null) : null,
        contextId: contextId === NO_CONTEXT ? null : contextId,
        visibility:  "SHARED",
        firstPaid,
      });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["installment_plans"] });
      toast.success(`${parcels} parcelas criadas.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova despesa parcelada</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ip-desc">Descrição</Label>
            <Input
              id="ip-desc"
              placeholder="Notebook"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ip-total">Valor total</Label>
              <Input
                id="ip-total"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                className="numeric h-12 text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip-count">Parcelas</Label>
              <Input
                id="ip-count"
                inputMode="numeric"
                value={count}
                onChange={(event) => setCount(event.target.value)}
                className="numeric h-12 text-lg"
              />
            </div>
          </div>

          {preview.length ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              <span className="numeric">
                {parcels}x {formatCurrency(preview[0] ?? 0)}
              </span>{" "}
              <span className="text-muted-foreground">
                · total {formatCurrency(totalValue)}
              </span>
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ip-date">Primeira parcela</Label>
              <Input
                id="ip-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((category) => category.type !== "INCOME")
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger>
                  <SelectValue placeholder="Conta ou cartão" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={`account:${account.id}`}>
                      {account.name}
                    </SelectItem>
                  ))}
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={`card:${card.id}`}>
                      {card.name} (cartão)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ContextSelect value={contextId} onChange={setContextId} />
          </div>


          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Criando parcelas..." : "Criar parcelamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
