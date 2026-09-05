import { useEffect, useState } from "react";
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
import { useAccounts, useCards, useCategories, type Recurring } from "@/features/finance/queries";
import { generateRecurringOccurrences, saveRecurring } from "@/features/finance/mutations";
import { RECURRENCE_FREQUENCIES, type RecurrenceFrequency } from "@/features/finance/constants";
import { parseAmount, toDateInput } from "@/lib/format";
import { ContextSelect, NO_CONTEXT } from "./context-select";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: Recurring | null;
  defaultContextId?: string | null;
};

export function RecurringDialog({ open, onOpenChange, record, defaultContextId }: Props) {
  const { workspaceId, userId, activeContextId } = useApp();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: cards = [] } = useCards(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("MONTHLY");
  const [dueDay, setDueDay] = useState("");
  const [startDate, setStartDate] = useState(toDateInput());
  const [endDate, setEndDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [payment, setPayment] = useState("");
  const [contextId, setContextId] = useState<string>(NO_CONTEXT);
  const [shared, setShared] = useState(false);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (record) {
      setDescription(record.description);
      setAmount(String(Number(record.amount)).replace(".", ","));
      setType(record.type === "INCOME" ? "INCOME" : "EXPENSE");
      setFrequency(record.frequency as RecurrenceFrequency);
      setDueDay(record.due_day ? String(record.due_day) : "");
      setStartDate(record.start_date);
      setEndDate(record.end_date ?? "");
      setCategoryId(record.category_id ?? "");
      setPayment(
        record.account_id
          ? `account:${record.account_id}`
          : record.card_id
            ? `card:${record.card_id}`
            : "",
      );
      setContextId(record.context_id ?? NO_CONTEXT);
      setShared(record.visibility === "SHARED");
      setActive(record.is_active);
    } else {
      setDescription("");
      setAmount("");
      setType("EXPENSE");
      setFrequency("MONTHLY");
      setDueDay("");
      setStartDate(toDateInput());
      setEndDate("");
      setCategoryId("");
      setPayment("");
      setContextId(defaultContextId ?? activeContextId ?? NO_CONTEXT);
      setShared(false);
      setActive(true);
    }
  }, [open, record, defaultContextId, activeContextId]);

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    const value = parseAmount(amount);
    if (!description.trim()) { toast.error("Informe uma descrição."); return; }
    if (!value) { toast.error("Informe um valor."); return; }

    setSaving(true);
    try {
      const [source, id] = payment ? payment.split(":") : ["", ""];
      const values = {
        workspace_id: workspaceId,
        owner_id: userId,
        description: description.trim(),
        amount: value,
        type,
        frequency,
        due_day: dueDay ? Number(dueDay) : null,
        start_date: startDate,
        end_date: endDate || null,
        category_id: categoryId || null,
        account_id: source === "account" ? (id ?? null) : null,
        card_id: source === "card" ? (id ?? null) : null,
        context_id: contextId === NO_CONTEXT ? null : contextId,
        visibility: (shared ? "SHARED" : "PRIVATE") as "SHARED" | "PRIVATE",
        is_active: active,
      };
      await saveRecurring(record?.id ?? null, values);
      await queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(record ? "Recorrência atualizada." : "Recorrência criada.");
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
          <DialogTitle>{record ? "Editar recorrência" : "Nova despesa recorrente"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rc-desc">Descrição</Label>
            <Input
              id="rc-desc"
              placeholder="Internet"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rc-amount">Valor</Label>
              <Input
                id="rc-amount"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="numeric h-12 text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "EXPENSE" | "INCOME")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="INCOME">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as RecurrenceFrequency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_FREQUENCIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rc-day">Dia de cobrança</Label>
              <Input
                id="rc-day"
                inputMode="numeric"
                placeholder="10"
                value={dueDay}
                onChange={(event) => setDueDay(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rc-start">Início</Label>
              <Input
                id="rc-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rc-end">Fim (opcional)</Label>
              <Input
                id="rc-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
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
                  {categories.map((category) => (
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
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={`card:${card.id}`}>
                      {card.name} (cartão)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ContextSelect value={contextId} onChange={setContextId} />

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-sm font-medium">Ativa</p>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-sm font-medium">Compartilhada</p>
            <Switch checked={shared} onCheckedChange={setShared} />
          </div>

          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Generates the pending occurrences of a recurrence. */
export async function runGeneration(recurring: Recurring, ownerId: string) {
  return generateRecurringOccurrences(recurring, ownerId);
}
