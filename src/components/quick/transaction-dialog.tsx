import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/features/app/app-context";
import { useAccounts, useCards, useCategories, createTransaction } from "@/features/finance/queries";
import { SPLIT_PRESETS } from "@/features/finance/constants";
import { parseAmount, toDateInput, formatCurrency } from "@/lib/format";

type Props = { kind: "expense" | "income"; open: boolean; onOpenChange: (open: boolean) => void };

export function TransactionDialog({ kind, open, onOpenChange }: Props) {
  const { workspaceId, userId, memberProfiles } = useApp();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: cards = [] } = useCards(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [payment, setPayment] = useState<string>("");
  const [date, setDate] = useState(toDateInput());
  const [shared, setShared] = useState(false);
  const [splitPreset, setSplitPreset] = useState<number>(50);
  const [ownerShare, setOwnerShare] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isExpense = kind === "expense";
  const value = parseAmount(amount);
  const others = memberProfiles.filter((profile) => profile.id !== userId);

  const splitAmounts = useMemo(() => {
    if (!shared || !value) return null;
    if (splitPreset === -1) {
      const mine = parseAmount(ownerShare);
      return { mine, theirs: Math.max(value - mine, 0) };
    }
    const mine = (value * splitPreset) / 100;
    return { mine, theirs: value - mine };
  }, [shared, value, splitPreset, ownerShare]);

  function reset() {
    setAmount("");
    setDescription("");
    setCategoryId("");
    setPayment("");
    setDate(toDateInput());
    setShared(false);
    setSplitPreset(50);
    setOwnerShare("");
    setNotes("");
  }

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!value) {
      toast.error("Informe um valor.");
      return;
    }
    if (!description.trim()) {
      toast.error("Informe uma descrição.");
      return;
    }

    setSaving(true);
    try {
      const [source, id] = payment ? payment.split(":") : ["", ""];
      const splits =
        shared && splitAmounts
          ? [
              { userId, amount: splitAmounts.mine, percentage: value ? (splitAmounts.mine / value) * 100 : 0 },
              ...others.map((profile) => ({
                userId: profile.id,
                amount: others.length ? splitAmounts.theirs / others.length : 0,
                percentage: value ? (splitAmounts.theirs / others.length / value) * 100 : 0,
              })),
            ]
          : undefined;

      await createTransaction({
        workspaceId,
        ownerId: userId,
        type: isExpense ? "EXPENSE" : "INCOME",
        amount: value,
        description: description.trim(),
        transactionDate: date,
        categoryId: categoryId || null,
        accountId: source === "account" ? id : null,
        cardId: source === "card" ? id : null,
        visibility: shared ? "SHARED" : "PRIVATE",
        isShared: shared,
        notes: notes.trim() || null,
        splits,
      });

      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(isExpense ? "Despesa registrada." : "Receita registrada.");
      reset();
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
          <DialogTitle>{isExpense ? "Nova despesa" : "Nova receita"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Valor</Label>
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="numeric h-12 text-xl"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder={isExpense ? "Almoço" : "Salário"}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
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
                    .filter((category) =>
                      category.type === "BOTH"
                        ? true
                        : category.type === (isExpense ? "EXPENSE" : "INCOME"),
                    )
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

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
                  {isExpense
                    ? cards.map((card) => (
                        <SelectItem key={card.id} value={`card:${card.id}`}>
                          {card.name} (cartão)
                        </SelectItem>
                      ))
                    : null}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
            <div>
              <p className="text-sm font-medium">Compartilhada</p>
              <p className="text-xs text-muted-foreground">Visível para o workspace e dividida</p>
            </div>
            <Switch checked={shared} onCheckedChange={setShared} />
          </div>

          {shared ? (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap gap-2">
                {SPLIT_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    size="sm"
                    variant={splitPreset === preset.value ? "default" : "outline"}
                    onClick={() => setSplitPreset(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              {splitPreset === -1 ? (
                <div className="space-y-2">
                  <Label htmlFor="ownerShare">Sua parte</Label>
                  <Input
                    id="ownerShare"
                    inputMode="decimal"
                    placeholder="R$ 0,00"
                    value={ownerShare}
                    onChange={(event) => setOwnerShare(event.target.value)}
                  />
                </div>
              ) : null}
              {splitAmounts ? (
                <div className="space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Você</span>
                    <span className="numeric">{formatCurrency(splitAmounts.mine)}</span>
                  </p>
                  {others.map((profile) => (
                    <p key={profile.id} className="flex justify-between">
                      <span className="text-muted-foreground">{profile.name || profile.email}</span>
                      <span className="numeric">
                        {formatCurrency(splitAmounts.theirs / others.length)}
                      </span>
                    </p>
                  ))}
                  {others.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Convide outra pessoa para o workspace para dividir os valores.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
