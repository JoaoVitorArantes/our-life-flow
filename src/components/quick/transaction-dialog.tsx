import { useEffect, useMemo, useState } from "react";
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
import {
  useAccounts,
  useCards,
  useCategories,
  createTransaction,
  type Transaction,
} from "@/features/finance/queries";
import { updateTransaction } from "@/features/finance/mutations";
import { SPLIT_PRESETS, PAYMENT_STATUSES, type PaymentStatus } from "@/features/finance/constants";
import {
  computeTransfer,
  useTransactionDivision,
  type Party,
} from "@/features/nos/settlements";
import { clearDivision, saveDivision } from "@/features/nos/mutations";
import { parseAmount, toDateInput, formatCurrency } from "@/lib/format";
import { ContextSelect, NO_CONTEXT } from "./context-select";

type Props = {
  kind: "expense" | "income";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  defaultContextId?: string | null;
};

export function TransactionDialog({
  kind,
  open,
  onOpenChange,
  transaction,
  defaultContextId,
}: Props) {
  const { workspaceId, userId, memberProfiles, activeContextId } = useApp();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: cards = [] } = useCards(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);
  const division = useTransactionDivision(transaction?.id, open && !!transaction);


  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [payment, setPayment] = useState<string>("");
  const [contextId, setContextId] = useState<string>(NO_CONTEXT);
  const [date, setDate] = useState(toDateInput());
  const [status, setStatus] = useState<PaymentStatus>("PAID");
  const [shared, setShared] = useState(false);
  const [splitPreset, setSplitPreset] = useState<number>(50);
  const [ownerShare, setOwnerShare] = useState("");
  const [payerMode, setPayerMode] = useState<"me" | "other" | "both">("me");
  const [myPaid, setMyPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);


  const isEditing = !!transaction;
  const isExpense = transaction ? transaction.type !== "INCOME" : kind === "expense";
  const value = parseAmount(amount);
  const others = memberProfiles.filter((profile) => profile.id !== userId);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setAmount(String(Number(transaction.amount)).replace(".", ","));
      setDescription(transaction.description ?? "");
      setCategoryId(transaction.category_id ?? "");
      setPayment(
        transaction.account_id
          ? `account:${transaction.account_id}`
          : transaction.card_id
            ? `card:${transaction.card_id}`
            : "",
      );
      setContextId(transaction.context_id ?? NO_CONTEXT);
      setDate(transaction.transaction_date);
      setStatus(transaction.status);
      setShared(!!transaction.is_shared);
      setNotes(transaction.notes ?? "");
    } else {
      setAmount("");
      setDescription("");
      setCategoryId("");
      setPayment("");
      setContextId(defaultContextId ?? activeContextId ?? NO_CONTEXT);
      setDate(toDateInput());
      setStatus("PAID");
      setShared(false);
      setSplitPreset(50);
      setOwnerShare("");
      setPayerMode("me");
      setMyPaid("");
      setNotes("");
    }
  }, [open, transaction, defaultContextId, activeContextId]);

  // Carrega a divisão e o pagamento já registrados ao editar uma despesa.
  useEffect(() => {
    if (!open || !transaction || !division.data || !userId) return;
    const total = Number(transaction.amount) || 0;
    const mineShare = division.data.splits.find((split) => split.user_id === userId);
    if (mineShare) {
      const mine = Number(mineShare.amount);
      const percentage = total ? Math.round((mine / total) * 100) : 50;
      setSplitPreset(percentage === 50 || percentage === 70 ? percentage : -1);
      setOwnerShare(String(mine).replace(".", ","));
    }
    const payers = division.data.payers;
    if (payers.length === 1) {
      setPayerMode(payers[0]!.user_id === userId ? "me" : "other");
    } else if (payers.length > 1) {
      setPayerMode("both");
      const mine = payers.find((payer) => payer.user_id === userId);
      setMyPaid(String(Number(mine?.amount ?? 0)).replace(".", ","));
    }
  }, [open, transaction, division.data, userId]);

  const splitAmounts = useMemo(() => {
    if (!shared || !value) return null;
    if (splitPreset === -1) {
      const mine = parseAmount(ownerShare);
      return { mine, theirs: Math.max(value - mine, 0) };
    }
    const mine = (value * splitPreset) / 100;
    return { mine, theirs: value - mine };
  }, [shared, value, splitPreset, ownerShare]);

  const partner = others[0];

  /** Divisão (responsabilidade) e pagamento efetivo desta despesa. */
  const division2 = useMemo(() => {
    if (!shared || !splitAmounts || !userId || !partner) return null;
    const shares: Party[] = [
      { userId, amount: splitAmounts.mine },
      { userId: partner.id, amount: splitAmounts.theirs },
    ];
    const mineePaid = payerMode === "both" ? parseAmount(myPaid) : payerMode === "me" ? value : 0;
    const payers: Party[] = [
      { userId, amount: mineePaid },
      { userId: partner.id, amount: Math.max(value - mineePaid, 0) },
    ].filter((party) => party.amount > 0);
    return { shares, payers, transfer: computeTransfer(shares, payers) };
  }, [shared, splitAmounts, userId, partner, payerMode, myPaid, value]);

  const paidSettlement = division.data?.settlements.find((item) => item.status === "SETTLED") ?? null;
  const nameOf = (id: string) =>
    id === userId
      ? "Você"
      : (memberProfiles.find((profile) => profile.id === id)?.name ?? "Parceiro(a)");


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

    if (shared && partner && division2) {
      const totalShares = division2.shares.reduce((sum, share) => sum + share.amount, 0);
      if (Math.abs(totalShares - value) > 0.02) {
        toast.error("A soma da divisão precisa ser igual ao valor da despesa.");
        return;
      }
      const totalPaid = division2.payers.reduce((sum, payer) => sum + payer.amount, 0);
      if (Math.abs(totalPaid - value) > 0.02) {
        toast.error("A soma do que cada um pagou precisa ser igual ao valor da despesa.");
        return;
      }
    }

    setSaving(true);
    try {
      const [source, id] = payment ? payment.split(":") : ["", ""];
      const linkedContext = contextId === NO_CONTEXT ? null : contextId;
      let transactionId = transaction?.id ?? "";

      if (isEditing && transaction) {
        await updateTransaction(transaction.id, {
          amount: value,
          description: description.trim(),
          transaction_date: date,
          due_date: date,
          status,
          paid_at: status === "PAID" ? (transaction.paid_at ?? date) : null,
          category_id: categoryId || null,
          account_id: source === "account" ? (id ?? null) : null,
          card_id: source === "card" ? (id ?? null) : null,
          context_id: linkedContext,
          visibility: "SHARED",
          is_shared: shared,
          notes: notes.trim() || null,
        });
      } else {
        const created = await createTransaction({
          workspaceId,
          ownerId: userId,
          type: isExpense ? "EXPENSE" : "INCOME",
          amount: value,
          description: description.trim(),
          transactionDate: date,
          dueDate: date,
          status,
          categoryId: categoryId || null,
          accountId: source === "account" ? (id ?? null) : null,
          cardId: source === "card" ? (id ?? null) : null,
          contextId: linkedContext,
          visibility: "SHARED",
          isShared: shared,
          notes: notes.trim() || null,
        });
        transactionId = created.id;
      }

      // Divisão + quem pagou + acerto (histórico já pago é preservado).
      if (shared && division2 && transactionId) {
        await saveDivision({
          workspaceId,
          transactionId,
          memberIds: memberProfiles.map((profile) => profile.id),
          shares: division2.shares,
          payers: division2.payers,
          note: description.trim(),
        });
      } else if (transactionId) {
        await clearDivision(transactionId);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["settlements"] }),
        queryClient.invalidateQueries({ queryKey: ["transaction_splits"] }),
        queryClient.invalidateQueries({ queryKey: ["transaction_payers"] }),
        queryClient.invalidateQueries({ queryKey: ["transaction_division"] }),
      ]);
      toast.success(
        isEditing ? "Lançamento atualizado." : isExpense ? "Despesa registrada." : "Receita registrada.",
      );
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
          <DialogTitle>
            {isEditing
              ? isExpense
                ? "Editar despesa"
                : "Editar receita"
              : isExpense
                ? "Nova despesa"
                : "Nova receita"}
          </DialogTitle>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ContextSelect value={contextId} onChange={setContextId} />


          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
            <div>
              <p className="text-sm font-medium">Dividir entre nós</p>
              <p className="text-xs text-muted-foreground">
                Define a responsabilidade de cada um e gera o acerto
              </p>
            </div>
            <Switch checked={shared} onCheckedChange={setShared} />
          </div>

          {shared ? (
            <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
              {!partner ? (
                <p className="text-xs text-muted-foreground">
                  Convide a outra pessoa para o espaço Nós para dividir os valores.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Divisão</Label>
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
                        className="numeric"
                      />
                    </div>
                  ) : null}

                  {splitAmounts ? (
                    <div className="space-y-1 rounded-lg bg-elevated p-3 text-sm">
                      <p className="flex justify-between">
                        <span className="text-muted-foreground">Você</span>
                        <span className="numeric">
                          {value ? Math.round((splitAmounts.mine / value) * 100) : 0}% ·{" "}
                          {formatCurrency(splitAmounts.mine)}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-muted-foreground">
                          {partner.name || partner.email}
                        </span>
                        <span className="numeric">
                          {value ? Math.round((splitAmounts.theirs / value) * 100) : 0}% ·{" "}
                          {formatCurrency(splitAmounts.theirs)}
                        </span>
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label>Quem pagou?</Label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { value: "me", label: "Você" },
                          { value: "other", label: partner.name || partner.email || "Parceiro(a)" },
                          { value: "both", label: "Ambos" },
                        ] as const
                      ).map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          size="sm"
                          variant={payerMode === option.value ? "default" : "outline"}
                          onClick={() => setPayerMode(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {payerMode === "both" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="myPaid">Você pagou</Label>
                        <Input
                          id="myPaid"
                          inputMode="decimal"
                          placeholder="R$ 0,00"
                          value={myPaid}
                          onChange={(event) => setMyPaid(event.target.value)}
                          className="numeric"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{partner.name || partner.email} pagou</Label>
                        <p className="numeric flex h-9 items-center text-sm text-muted-foreground">
                          {formatCurrency(Math.max(value - parseAmount(myPaid), 0))}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                    {division2?.transfer ? (
                      <p>
                        💜 <strong>{nameOf(division2.transfer.fromUserId)}</strong> deve passar{" "}
                        <strong className="numeric">
                          {formatCurrency(division2.transfer.amount)}
                        </strong>{" "}
                        para <strong>{nameOf(division2.transfer.toUserId)}</strong>.
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        Nenhum acerto necessário: cada um pagou a própria parte.
                      </p>
                    )}
                  </div>

                  {paidSettlement ? (
                    <p className="text-xs text-muted-foreground">
                      Já existe um acerto pago de{" "}
                      {formatCurrency(Number(paidSettlement.amount))} nesta despesa. Ao alterar
                      valores, o histórico é mantido e só a diferença vira um novo acerto.
                    </p>
                  ) : null}
                </>
              )}
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
