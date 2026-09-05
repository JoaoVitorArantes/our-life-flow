import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/features/app/app-context";
import {
  addContribution,
  updateContribution,
  type GoalContribution,
} from "@/features/planner/contributions";
import { parseAmount, toDateInput } from "@/lib/format";

export function ContributionDialog({
  goalId,
  open,
  onOpenChange,
  contribution,
  mode = "add",
}: {
  goalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution?: GoalContribution | null;
  /** "withdraw" flips the sign — the schema already accepts negative amounts. */
  mode?: "add" | "withdraw";
}) {
  const { userId } = useApp();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(contribution ? String(Math.abs(Number(contribution.amount))).replace(".", ",") : "");
    setDescription(contribution?.description ?? "");
    setDate(contribution?.contribution_date ?? toDateInput());
  }, [open, contribution]);

  const isWithdraw = contribution ? Number(contribution.amount) < 0 : mode === "withdraw";

  async function handleSubmit() {
    if (!userId) return;
    const value = parseAmount(amount);
    if (!value) {
      toast.error("Informe um valor.");
      return;
    }
    const signed = isWithdraw ? -Math.abs(value) : Math.abs(value);
    setSaving(true);
    try {
      if (contribution) {
        await updateContribution(contribution.id, {
          amount: signed,
          contribution_date: date,
          description: description.trim() || null,
        });
      } else {
        await addContribution({
          goalId,
          userId,
          amount: signed,
          contributionDate: date,
          description: description.trim() || null,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["goal-contributions"] });
      await queryClient.invalidateQueries({ queryKey: ["goal-contributions-all"] });
      toast.success(contribution ? "Contribuição atualizada." : "Valor adicionado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contribution
              ? "Editar contribuição"
              : isWithdraw
                ? "Retirar valor"
                : "Adicionar valor"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
            <Label htmlFor="contribution-description">Descrição (opcional)</Label>
            <Input
              id="contribution-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
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
          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : contribution ? "Salvar" : isWithdraw ? "Retirar" : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
