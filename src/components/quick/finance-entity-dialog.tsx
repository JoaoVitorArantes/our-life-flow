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
import { ACCOUNT_TYPES } from "@/features/finance/constants";
import { saveAccount, saveCard, saveCategory } from "@/features/finance/mutations";
import type { Account, Card, Category } from "@/features/finance/queries";
import { parseAmount } from "@/lib/format";
import type { Enums } from "@/integrations/supabase/types";

export type FinanceEntityKind = "account" | "card" | "category";

const TITLES: Record<FinanceEntityKind, [string, string]> = {
  account: ["Nova conta", "Editar conta"],
  card: ["Novo cartão", "Editar cartão"],
  category: ["Nova categoria", "Editar categoria"],
};

export function FinanceEntityDialog({
  kind,
  open,
  onOpenChange,
  record,
}: {
  kind: FinanceEntityKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: Account | Card | Category | null;
}) {
  const { workspaceId, userId } = useApp();
  const queryClient = useQueryClient();
  const accounts = useAccounts(workspaceId).data ?? [];
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [accountType, setAccountType] = useState<Enums<"account_type">>("CHECKING");
  const [initialBalance, setInitialBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(NO_ACCOUNT);
  const [isActive, setIsActive] = useState(true);
  const [categoryType, setCategoryType] = useState<Enums<"category_type">>("EXPENSE");
  const [saving, setSaving] = useState(false);

  const isEditing = !!record;

  useEffect(() => {
    if (!open) return;
    const any = record as (Account & Card & Category) | null | undefined;
    setName(any?.name ?? "");
    setInstitution(any?.institution ?? "");
    setAccountType((any?.account_type as Enums<"account_type">) ?? "CHECKING");
    setInitialBalance(any?.initial_balance ? String(Number(any.initial_balance)) : "");
    setCreditLimit(any?.credit_limit ? String(Number(any.credit_limit)) : "");
    setClosingDay(any?.closing_day ? String(any.closing_day) : "");
    setDueDay(any?.due_day ? String(any.due_day) : "");
    setPaymentAccountId(any?.payment_account_id ?? NO_ACCOUNT);
    setIsActive(any?.is_active ?? true);
    setCategoryType((any?.type as Enums<"category_type">) ?? "EXPENSE");
  }, [open, record]);

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!name.trim()) {
      toast.error("Informe um nome.");
      return;
    }
    setSaving(true);
    try {
      const id = record?.id ?? null;
      if (kind === "account") {
        const balance = parseAmount(initialBalance);
        await saveAccount(id, {
          workspace_id: workspaceId,
          owner_id: userId,
          name: name.trim(),
          institution: institution.trim() || null,
          account_type: accountType,
          initial_balance: balance,
          current_balance: balance,
        });
        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      } else if (kind === "card") {
        await saveCard(id, {
          workspace_id: workspaceId,
          owner_id: userId,
          name: name.trim(),
          institution: institution.trim() || null,
          credit_limit: parseAmount(creditLimit),
        });
        await queryClient.invalidateQueries({ queryKey: ["cards"] });
      } else {
        await saveCategory(id, {
          workspace_id: workspaceId,
          name: name.trim(),
          type: categoryType,
        });
        await queryClient.invalidateQueries({ queryKey: ["categories"] });
      }
      toast.success(isEditing ? "Atualizado." : "Criado.");
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
          <DialogTitle>{TITLES[kind][isEditing ? 1 : 0]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entity-name">Nome</Label>
            <Input
              id="entity-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>

          {kind !== "category" ? (
            <div className="space-y-2">
              <Label htmlFor="entity-institution">Instituição</Label>
              <Input
                id="entity-institution"
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
              />
            </div>
          ) : null}

          {kind === "account" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={accountType}
                  onValueChange={(value) => setAccountType(value as Enums<"account_type">)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="entity-balance">Saldo inicial</Label>
                <Input
                  id="entity-balance"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  value={initialBalance}
                  onChange={(event) => setInitialBalance(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {kind === "card" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="entity-limit">Limite</Label>
                <Input
                  id="entity-limit"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  value={creditLimit}
                  onChange={(event) => setCreditLimit(event.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="entity-closing">Fecha dia</Label>
                  <Input
                    id="entity-closing"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    type="number"
                    placeholder="15"
                    value={closingDay}
                    onChange={(event) => setClosingDay(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entity-due">Vence dia</Label>
                  <Input
                    id="entity-due"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    type="number"
                    placeholder="22"
                    value={dueDay}
                    onChange={(event) => setDueDay(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conta para pagamento</Label>
                <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem conta definida" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACCOUNT}>Sem conta definida</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select value={isActive ? "active" : "inactive"} onValueChange={(value) => setIsActive(value === "active")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          {kind === "category" ? (
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={categoryType}
                onValueChange={(value) => setCategoryType(value as Enums<"category_type">)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="INCOME">Receita</SelectItem>
                  <SelectItem value="BOTH">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
