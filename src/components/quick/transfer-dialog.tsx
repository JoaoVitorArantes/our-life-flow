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
import { useAccounts, createTransaction } from "@/features/finance/queries";
import { parseAmount, toDateInput } from "@/lib/format";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function TransferDialog({ open, onOpenChange }: Props) {
  const { workspaceId, userId } = useApp();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts(workspaceId);

  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setFrom("");
    setTo("");
    setDate(toDateInput());
    setDescription("");
  }, [open]);

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    const value = parseAmount(amount);
    if (!value) { toast.error("Informe um valor."); return; }
    if (!from || !to) { toast.error("Escolha as contas de origem e destino."); return; }
    if (from === to) { toast.error("As contas devem ser diferentes."); return; }

    setSaving(true);
    try {
      await createTransaction({
        workspaceId,
        ownerId: userId,
        type: "TRANSFER",
        amount: value,
        description: description.trim() || "Transferência",
        transactionDate: date,
        status: "PAID",
        sourceAccountId: from,
        destinationAccountId: to,
        visibility: "PRIVATE",
        isShared: false,
      });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transferência registrada.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova transferência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tr-amount">Valor</Label>
            <Input
              id="tr-amount"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="numeric h-12 text-xl"
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>De</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger>
                  <SelectValue placeholder="Origem" />
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
            <div className="space-y-2">
              <Label>Para</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Destino" />
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
              <Label htmlFor="tr-date">Data</Label>
              <Input
                id="tr-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tr-desc">Descrição</Label>
              <Input
                id="tr-desc"
                placeholder="Transferência"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>

          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Transferir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
