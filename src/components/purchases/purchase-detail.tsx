import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatedBy } from "@/components/common/created-by";
import { TransactionDialog } from "@/components/quick/transaction-dialog";
import { useApp } from "@/features/app/app-context";
import { useCategories } from "@/features/finance/queries";
import { contextEmoji, useContexts } from "@/features/contexts/queries";
import {
  budgetDelta,
  categoryEmoji,
  categoryLabel,
  deletePurchase,
  personLabel,
  priorityLabel,
  statusDot,
  statusLabel,
  updatePurchase,
  PURCHASE_STATUSES,
  type Purchase,
  type PurchaseStatus,
} from "@/features/purchases/queries";
import { formatCurrency, formatDateShort, toDateInput } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Categoria de compra -> nome da categoria financeira usada no Life OS. */
const FINANCE_CATEGORY: Record<string, string> = {
  HOME: "Moradia",
  LEISURE: "Lazer",
  TRAVEL: "Lazer",
  SPORT: "Saúde",
  COLLEGE: "Faculdade",
  GIFTS: "Casal",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}

export function PurchaseDetail({
  purchase,
  open,
  onOpenChange,
  onEdit,
}: {
  purchase: Purchase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (purchase: Purchase) => void;
}) {
  const { workspaceId } = useApp();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories(workspaceId);
  const { data: contexts = [] } = useContexts(workspaceId);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [confirmAgain, setConfirmAgain] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!purchase) return null;
  const delta = budgetDelta(purchase);
  const context = contexts.find((item) => item.id === purchase.context_id) ?? null;
  const financeCategory = categories.find(
    (item) => item.name === FINANCE_CATEGORY[purchase.category ?? ""],
  );

  async function changeStatus(status: PurchaseStatus) {
    if (!purchase) return;
    try {
      await updatePurchase(purchase.id, {
        status,
        purchased_at:
          status === "PURCHASED" ? (purchase.purchased_at ?? toDateInput()) : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["purchases"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar.");
    }
  }

  async function remove() {
    if (!purchase) return;
    try {
      await deletePurchase(purchase.id);
      await queryClient.invalidateQueries({ queryKey: ["purchases"] });
      onOpenChange(false);
      toast.success("Compra excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

  function openExpense() {
    if (purchase?.transaction_id) setConfirmAgain(true);
    else setExpenseOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{categoryEmoji(purchase.category)}</span>
              <span className="min-w-0 truncate">{purchase.title}</span>
            </DialogTitle>
            {purchase.description ? (
              <DialogDescription>{purchase.description}</DialogDescription>
            ) : null}
          </DialogHeader>

          {purchase.image_url ? (
            <img
              src={purchase.image_url}
              alt={purchase.title}
              className="max-h-56 w-full rounded-xl border border-border object-cover"
            />
          ) : null}

          <div className="space-y-2">
            <Select value={purchase.status} onValueChange={(value) => void changeStatus(value as PurchaseStatus)}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PURCHASE_STATUSES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="gap-1.5">
              <span className={cn("size-1.5 rounded-full", statusDot(purchase.status))} />
              {statusLabel(purchase.status)}
            </Badge>
          </div>

          <div>
            {purchase.category ? <Row label="Categoria">{categoryLabel(purchase.category)}</Row> : null}
            <Row label="Prioridade">{priorityLabel(purchase.priority)}</Row>
            <Row label="Pessoa">{personLabel(purchase.person_scope)}</Row>
            {purchase.budget_amount != null ? (
              <Row label="Orçamento">
                <span className="numeric">{formatCurrency(Number(purchase.budget_amount))}</span>
              </Row>
            ) : null}
            {purchase.found_price != null ? (
              <Row label="Melhor preço">
                <span className="numeric">{formatCurrency(Number(purchase.found_price))}</span>
              </Row>
            ) : null}
            {delta ? (
              <Row label="Diferença">
                <span className={delta.under ? "text-emerald-500" : "text-destructive"}>
                  {formatCurrency(Math.abs(delta.diff))} {delta.under ? "abaixo" : "acima"} ·{" "}
                  {delta.percent.toFixed(1).replace(".", ",")}%
                </span>
              </Row>
            ) : null}
            {purchase.desired_date ? (
              <Row label="Data desejada">{formatDateShort(purchase.desired_date)}</Row>
            ) : null}
            {context ? (
              <Row label="Contexto">
                {contextEmoji(context.type)} {context.name}
              </Row>
            ) : null}
            {purchase.purchased_at ? (
              <Row label="Comprado em">{formatDateShort(purchase.purchased_at)}</Row>
            ) : null}
            {purchase.notes ? <Row label="Observações">{purchase.notes}</Row> : null}
            <Row label="Adicionado por">
              <CreatedBy userId={purchase.created_by} />
            </Row>
            <Row label="Criado em">{formatDateShort(purchase.created_at)}</Row>
          </div>

          <div className="flex flex-wrap gap-2">
            {purchase.purchase_url ? (
              <Button asChild variant="outline" size="sm">
                <a href={purchase.purchase_url} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="size-4" /> Ver produto
                </a>
              </Button>
            ) : null}
            {purchase.status === "PURCHASED" ? (
              <Button size="sm" onClick={openExpense}>
                {purchase.transaction_id ? "Registrado no Financeiro" : "Registrar no Financeiro"}
              </Button>
            ) : null}
            {purchase.transaction_id ? (
              <Button asChild variant="ghost" size="sm">
                <Link to="/financeiro">Abrir lançamento</Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => onEdit(purchase)}>
              <Pencil className="size-4" /> Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {expenseOpen ? (
        <TransactionDialog
          kind="expense"
          open
          onOpenChange={setExpenseOpen}
          defaultContextId={purchase.context_id}
          defaults={{
            description: purchase.title,
            amount: purchase.found_price == null ? null : Number(purchase.found_price),
            date: purchase.purchased_at ?? toDateInput(),
            categoryId: financeCategory?.id ?? null,
          }}
          onCreated={async (transactionId) => {
            await updatePurchase(purchase.id, { transaction_id: transactionId });
            await queryClient.invalidateQueries({ queryKey: ["purchases"] });
          }}
        />
      ) : null}

      <AlertDialog open={confirmAgain} onOpenChange={setConfirmAgain}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esta compra já tem um lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              Registrar de novo criará uma segunda despesa no Financeiro. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setExpenseOpen(true)}>Registrar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta compra?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento financeiro, se existir, não será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
