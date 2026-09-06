import { useEffect, useMemo, useState } from "react";
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
import { useAccounts } from "@/features/finance/queries";
import { createLoan } from "@/features/finance/mutations";
import { splitInstallments } from "@/features/finance/calc";
import { LOAN_TYPES, type LoanType } from "@/features/finance/constants";
import { formatCurrency, parseAmount, toDateInput } from "@/lib/format";
import { ContextSelect, NO_CONTEXT } from "./context-select";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function LoanDialog({ open, onOpenChange }: Props) {
  const { workspaceId, userId, activeContextId } = useApp();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts(workspaceId);

  const [type, setType] = useState<LoanType>("LENT");
  const [person, setPerson] = useState("");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [count, setCount] = useState("1");
  const [startDate, setStartDate] = useState(toDateInput());
  const [accountId, setAccountId] = useState("");
  const [contextId, setContextId] = useState<string>(NO_CONTEXT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("LENT");
    setPerson("");
    setDescription("");
    setTotal("");
    setCount("1");
    setStartDate(toDateInput());
    setAccountId("");
    setContextId(activeContextId ?? NO_CONTEXT);
  }, [open, activeContextId]);

  const totalValue = parseAmount(total);
  const parcels = Math.max(1, Math.min(120, Number(count) || 1));
  const preview = useMemo(
    () => (totalValue ? splitInstallments(totalValue, parcels) : []),
    [totalValue, parcels],
  );

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!person.trim()) { toast.error("Informe a pessoa."); return; }
    if (!totalValue) { toast.error("Informe o valor."); return; }

    setSaving(true);
    try {
      await createLoan({
        workspaceId,
        ownerId: userId,
        type,
        personName: person.trim(),
        description: description.trim() || null,
        totalAmount: totalValue,
        totalInstallments: parcels,
        startDate,
        dueDay: Number(startDate.split("-")[2]),
        accountId: accountId || null,
        contextId: contextId === NO_CONTEXT ? null : contextId,
        visibility:  "SHARED",
      });
      await queryClient.invalidateQueries({ queryKey: ["loans"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Empréstimo registrado.");
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
          <DialogTitle>Novo empréstimo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            {LOAN_TYPES.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={type === item.value ? "default" : "outline"}
                className="flex-1"
                onClick={() => setType(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ln-person">Pessoa</Label>
            <Input
              id="ln-person"
              placeholder="Pedro"
              value={person}
              onChange={(event) => setPerson(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ln-desc">Descrição (opcional)</Label>
            <Input
              id="ln-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ln-total">Valor total</Label>
              <Input
                id="ln-total"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                className="numeric h-12 text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ln-count">Parcelas</Label>
              <Input
                id="ln-count"
                inputMode="numeric"
                value={count}
                onChange={(event) => setCount(event.target.value)}
                className="numeric h-12 text-lg"
              />
            </div>
          </div>

          {preview.length ? (
            <p className="numeric rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              {parcels}x {formatCurrency(preview[0] ?? 0)}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ln-date">Primeira parcela</Label>
              <Input
                id="ln-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
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

          <ContextSelect value={contextId} onChange={setContextId} />


          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Salvar empréstimo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
