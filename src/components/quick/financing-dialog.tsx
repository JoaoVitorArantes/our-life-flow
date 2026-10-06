import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/features/app/app-context";
import { useAccounts, useCategories } from "@/features/finance/queries";
import { createFinancing } from "@/features/finance/mutations";
import { formatCurrency, parseAmount, toDateInput } from "@/lib/format";
import { ContextSelect, NO_CONTEXT } from "./context-select";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function FinancingDialog({ open, onOpenChange }: Props) {
  const { workspaceId, userId, activeContextId } = useApp();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: allCategories = [] } = useCategories(workspaceId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [financed, setFinanced] = useState("");
  const [count, setCount] = useState("48");
  const [installment, setInstallment] = useState("");
  const [interest, setInterest] = useState("");
  const [startDate, setStartDate] = useState(toDateInput());
  const [paidCount, setPaidCount] = useState("0");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // Arquivadas não aparecem em novos lançamentos, mas continuam no registro que já as usa.
  const categories = allCategories.filter((c) => !c.archived_at || c.id === categoryId);
  const [contextId, setContextId] = useState<string>(NO_CONTEXT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setFinanced("");
    setCount("48");
    setInstallment("");
    setInterest("");
    setStartDate(toDateInput());
    setPaidCount("0");
    setAccountId("");
    setCategoryId("");
    setContextId(activeContextId ?? NO_CONTEXT);
  }, [open, activeContextId]);

  const parcels = Math.max(1, Math.min(480, Number(count) || 1));
  const installmentValue = parseAmount(installment);
  const paid = Math.max(0, Math.min(parcels, Number(paidCount) || 0));

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!name.trim()) { toast.error("Informe o nome."); return; }
    if (!installmentValue) { toast.error("Informe o valor da parcela."); return; }

    setSaving(true);
    try {
      await createFinancing({
        workspaceId,
        ownerId: userId,
        name: name.trim(),
        description: description.trim() || null,
        financedAmount: parseAmount(financed),
        totalInstallments: parcels,
        installmentAmount: installmentValue,
        interestRate: interest ? parseAmount(interest) : null,
        startDate,
        dueDay: Number(startDate.split("-")[2]),
        accountId: accountId || null,
        categoryId: categoryId || null,
        contextId: contextId === NO_CONTEXT ? null : contextId,
        visibility:  "SHARED",
        paidInstallments: paid,
      });
      await queryClient.invalidateQueries({ queryKey: ["financings"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Financiamento registrado.");
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
          <DialogTitle>Novo financiamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fn-name">Nome</Label>
            <Input
              id="fn-name"
              placeholder="Financiamento do carro"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fn-desc">Descrição (opcional)</Label>
            <Input
              id="fn-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fn-total">Valor financiado</Label>
              <Input
                id="fn-total"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={financed}
                onChange={(event) => setFinanced(event.target.value)}
                className="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn-inst">Valor da parcela</Label>
              <Input
                id="fn-inst"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={installment}
                onChange={(event) => setInstallment(event.target.value)}
                className="numeric"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="fn-count">Parcelas</Label>
              <Input
                id="fn-count"
                inputMode="numeric"
                value={count}
                onChange={(event) => setCount(event.target.value)}
                className="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn-paid">Já pagas</Label>
              <Input
                id="fn-paid"
                inputMode="numeric"
                value={paidCount}
                onChange={(event) => setPaidCount(event.target.value)}
                className="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn-interest">Juros % (opcional)</Label>
              <Input
                id="fn-interest"
                inputMode="decimal"
                value={interest}
                onChange={(event) => setInterest(event.target.value)}
                className="numeric"
              />
            </div>
          </div>

          {installmentValue ? (
            <p className="numeric rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              {parcels}x {formatCurrency(installmentValue)} · {paid} pagas ·{" "}
              {parcels - paid} restantes
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fn-date">Primeira parcela</Label>
              <Input
                id="fn-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Conta de débito</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
            <ContextSelect value={contextId} onChange={setContextId} />
          </div>


          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Salvar financiamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
