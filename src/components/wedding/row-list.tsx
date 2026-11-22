import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Confirm } from "./confirm";

export function RowList({
  title,
  rows,
  onDelete,
  empty = "Nada registrado ainda.",
}: {
  title: string;
  rows: { id: string; main: string; sub: string }[];
  onDelete: (id: string) => void;
  empty?: string;
}) {
  return (
    <section className="wed-card overflow-hidden">
      <h2 className="wed-display border-b border-border px-4 py-3 text-lg sm:px-5">{title}</h2>
      <ul className="divide-y divide-border">
        {rows.length === 0 && <li className="px-5 py-6 text-sm text-muted-foreground">{empty}</li>}
        {rows.map((r) => (
          <li key={r.id} className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium">{r.main}</p>
              <p className="break-words text-xs text-muted-foreground">{r.sub}</p>
            </div>
            <Confirm
              title="Excluir registro?"
              description="Esta ação não pode ser desfeita."
              confirmLabel="Excluir"
              onConfirm={() => onDelete(r.id)}
              trigger={
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-10 shrink-0"
                  aria-label={`Excluir ${r.main}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
