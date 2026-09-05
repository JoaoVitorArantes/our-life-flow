import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/**
 * Shared "three dots" action menu with a delete confirmation.
 * `canManage` mirrors the RLS rule: only the owner can edit or delete.
 */
export function RecordActions({
  onEdit,
  onDelete,
  canManage = true,
  confirmTitle = "Excluir este registro?",
  confirmDescription = "Essa ação não poderá ser desfeita.",
  editLabel = "Editar",
  deleteLabel = "Excluir",
}: {
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
  canManage?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  editLabel?: string;
  deleteLabel?: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!canManage) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Ações do registro"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {onEdit ? (
            <DropdownMenuItem onSelect={() => onEdit()}>
              <Pencil className="size-4" />
              {editLabel}
            </DropdownMenuItem>
          ) : null}
          {onDelete ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(event) => {
                event.preventDefault();
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="size-4" />
              {deleteLabel}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (event) => {
                event.preventDefault();
                setBusy(true);
                try {
                  await onDelete?.();
                  setConfirmOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
