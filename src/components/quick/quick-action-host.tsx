import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "@/features/app/app-context";
import { QuickActionMenu } from "./quick-action-menu";
import { TransactionDialog } from "./transaction-dialog";
import { SimpleRecordDialog, type SimpleKind } from "./simple-record-dialog";
import { ContextDialog } from "./context-dialog";
import { TransferDialog } from "./transfer-dialog";
import { InstallmentDialog } from "./installment-dialog";
import { RecurringDialog } from "./recurring-dialog";
import { LoanDialog } from "./loan-dialog";
import { FinancingDialog } from "./financing-dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { InboxAssistant } from "@/components/inbox/inbox-assistant";

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
      {quickAction === "transfer" ? <TransferDialog open onOpenChange={close} /> : null}
      {quickAction === "installment" ? <InstallmentDialog open onOpenChange={close} /> : null}
      {quickAction === "recurring" ? <RecurringDialog open onOpenChange={close} /> : null}
      {quickAction === "loan" ? <LoanDialog open onOpenChange={close} /> : null}
      {quickAction === "financing" ? <FinancingDialog open onOpenChange={close} /> : null}

      <Drawer open={quickAction === "inbox"} onOpenChange={close}>
        <DrawerContent className="mx-auto h-[88dvh] max-w-2xl">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Falar com o Life OS</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
            <InboxAssistant compact />
          </div>
        </DrawerContent>
      </Drawer>

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
