import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "@/features/app/app-context";
import { QuickActionMenu } from "./quick-action-menu";
import { TransactionDialog } from "./transaction-dialog";
import { SimpleRecordDialog, type SimpleKind } from "./simple-record-dialog";
import { ContextDialog } from "./context-dialog";

const SIMPLE: SimpleKind[] = ["event", "task", "goal", "note"];

export function QuickActionHost() {
  const { quickAction, openQuickAction } = useApp();
  const close = (open: boolean) => {
    if (!open) openQuickAction(null);
  };

  return (
    <>
      <QuickActionMenu />

      {quickAction === "expense" || quickAction === "income" ? (
        <TransactionDialog kind={quickAction} open onOpenChange={close} />
      ) : null}

      {quickAction && SIMPLE.includes(quickAction as SimpleKind) ? (
        <SimpleRecordDialog kind={quickAction as SimpleKind} open onOpenChange={close} />
      ) : null}

      {quickAction === "context" ? <ContextDialog open onOpenChange={close} /> : null}

      <Dialog open={quickAction === "workout"} onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo treino</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O módulo de Esporte entra na próxima etapa. A estrutura de criação rápida já está
            pronta para receber o formulário de treinos.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
