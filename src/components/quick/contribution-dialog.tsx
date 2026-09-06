import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/features/app/app-context";
import {
  addContribution,
  movementType as movementTypeOf,
  updateContribution,
  type GoalContribution,
  type GoalMovementType,
} from "@/features/planner/contributions";
import { formatCurrency, parseAmount, toDateInput } from "@/lib/format";

export function ContributionDialog({
  goalId,
  open,
  onOpenChange,
  contribution,
  mode = "add",
  /** Current net balance of the goal — used to block over-withdrawals. */
  balance = 0,
}: {
  goalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution?: GoalContribution | null;
  mode?: "add" | "withdraw";
  balance?: number;
}) {
  const { userId } = useApp();
  const queryClient = useQueryClient();
  const [type, setType] = useState<GoalMovementType>("CONTRIBUTION");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(contribution ? String(Math.abs(Number(contribution.amount))).replace(".", ",") : "");
    setDescription(contribution?.description ?? "");
    setDate(contribution?.contribution_date ?? toDateInput());
    setType(
      contribution
        ? movementTypeOf(contribution)
        : mode === "withdraw"
          ? "WITHDRAWAL"
          : "CONTRIBUTION",
    );
  }, [open, contribution, mode]);

  async function handleSubmit() {
    if (!userId) return;
    if (!goalId) {
      toast.error("Movimentação sem meta relacionada.");
      return;
    }
    const value = parseAmount(amount);
    if (!value || value <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (type === "WITHDRAWAL") {
      // Balance excluding the row being edited.
      const base =
        contribution && movementTypeOf(contribution) === "WITHDRAWAL"
          ? balance + Math.abs(Number(contribution.amount))
          : contribution
            ? balance - Math.abs(Number(contribution.amount))
            : balance;
      if (value > base) {
        toast.error(`Retirada maior que o saldo da meta (${formatCurrency(base)}).`);
        return;
      }
    }
    setSaving(true);
    try {
      if (contribution) {
        await updateContribution(contribution.id, {
          amount: value,
          movementType: type,
          contribution_date: date,
          description: description.trim() || null,
        });
      } else {
        await addContribution({
          goalId,
          userId,
          amount: value,
          movementType: type,
          contributionDate: date,
          description: description.trim() || null,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["goal-contributions"] });
      await queryClient.invalidateQueries({ queryKey: ["goal-contributions-all"] });
      toast.success(contribution ? "Movimentação atualizada." : "Movimentação registrada.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const isWithdraw = type === "WITHDRAWAL";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contribution ? "Editar movimentação" : isWithdraw ? "Retirar valor" : "Adicionar valor"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Tabs value={type} onValueChange={(value) => setType(value as GoalMovementType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="CONTRIBUTION">Adicionar</TabsTrigger>
              <TabsTrigger value="WITHDRAWAL">Retirar</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-2">
            <Label htmlFor="contribution-amount">
              {isWithdraw ? "Quanto deseja retirar?" : "Quanto deseja adicionar?"}
            </Label>
            <Input
              id="contribution-amount"
              inputMode="decimal"
              placeholder="R$ 0,00"
              className="numeric h-12 text-xl"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contribution-date">Data</Label>
            <Input
              id="contribution-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contribution-description">Descrição (opcional)</Label>
            <Input
              id="contribution-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : contribution ? "Salvar" : isWithdraw ? "Retirar" : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
