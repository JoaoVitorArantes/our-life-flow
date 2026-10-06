import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useApp } from "@/features/app/app-context";
import {
  EXPORT_TABLES,
  exportTableCsv,
  exportWorkspaceJson,
  type ExportTable,
} from "@/features/export/export";
import {
  purgeFromTrash,
  restoreFromTrash,
  TRASH_LABELS,
  useTrash,
  type TrashItem,
} from "@/features/trash/api";
import { LoadingState } from "@/components/common/states";

export const Route = createFileRoute("/_authenticated/configuracoes/dados")({
  head: () => ({
    meta: [
      { title: "Dados — Life OS" },
      { name: "description", content: "Exporte seus dados e recupere itens da lixeira." },
      { property: "og:title", content: "Dados — Life OS" },
      { property: "og:description", content: "Exportação e lixeira do seu espaço." },
    ],
  }),
  component: Dados,
});

const INVALIDATE: Record<TrashItem["table_name"], string[]> = {
  tasks: ["tasks"],
  notes: ["notes"],
  goals: ["goals"],
  contexts: ["contexts", "context"],
  events: ["events"],
  purchases: ["purchases"],
};

function Dados() {
  const { workspaceId, workspaceName, memberProfiles } = useApp();
  const queryClient = useQueryClient();
  const trash = useTrash(workspaceId);
  const [table, setTable] = useState<ExportTable>("transactions");
  const [exporting, setExporting] = useState(false);
  const [purging, setPurging] = useState<TrashItem | null>(null);

  const who = (id: string | null) =>
    memberProfiles.find((p) => p.id === id)?.name?.split(" ")[0] ?? "Alguém";

  async function runExport(kind: "json" | "csv") {
    if (!workspaceId) return;
    setExporting(true);
    try {
      if (kind === "json") await exportWorkspaceJson(workspaceId, workspaceName);
      else {
        const count = await exportTableCsv(workspaceId, table);
        if (!count) toast.message("Essa tabela está vazia; o arquivo saiu sem linhas.");
      }
      toast.success("Exportação pronta.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível exportar.");
    } finally {
      setExporting(false);
    }
  }

  async function refreshAfter(item: TrashItem) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trash"] }),
      ...INVALIDATE[item.table_name].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    ]);
  }

  async function restore(item: TrashItem) {
    try {
      await restoreFromTrash(item.table_name, item.id);
      await refreshAfter(item);
      toast.success(`${TRASH_LABELS[item.table_name]} restaurada(o).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível restaurar.");
    }
  }

  async function purge() {
    if (!purging) return;
    try {
      await purgeFromTrash(purging.table_name, purging.id);
      await refreshAfter(purging);
      toast.success("Excluído definitivamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setPurging(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dados"
        subtitle={`Só dados do espaço “${workspaceName}” que você pode ver.`}
      />

      <Panel className="space-y-4">
        <PanelTitle>Exportar</PanelTitle>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Tudo em JSON</p>
            <p className="text-xs text-muted-foreground">
              Um arquivo com todas as áreas do espaço.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={exporting}
            onClick={() => void runExport("json")}
          >
            <Download className="size-4" /> {exporting ? "Preparando..." : "Exportar JSON"}
          </Button>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
          <div className="min-w-0 flex-1 space-y-2 sm:max-w-xs">
            <Label>Uma área em CSV (planilha)</Label>
            <Select value={table} onValueChange={(v) => setTable(v as ExportTable)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_TABLES.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={exporting}
            onClick={() => void runExport("csv")}
          >
            <Download className="size-4" /> Exportar CSV
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Itens na lixeira e registros privados de outra pessoa não entram na exportação.
        </p>
      </Panel>

      <Panel>
        <PanelTitle>Lixeira</PanelTitle>
        <p className="mb-3 text-xs text-muted-foreground">
          Tarefas, notas, metas, contextos, eventos e compras excluídos ficam aqui até você
          restaurar ou apagar de vez.
        </p>
        {trash.isLoading ? (
          <LoadingState />
        ) : trash.data?.length ? (
          <ul className="divide-y divide-border">
            {trash.data.map((item) => (
              <li
                key={`${item.table_name}-${item.id}`}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.label || "Sem título"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {TRASH_LABELS[item.table_name]} · excluído por {who(item.deleted_by)}{" "}
                    {formatDistanceToNow(new Date(item.deleted_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </span>
                {item.can_manage ? (
                  <span className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => void restore(item)}>
                      <RotateCcw className="size-4" /> Restaurar
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9"
                      aria-label="Excluir definitivamente"
                      onClick={() => setPurging(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Só quem criou pode restaurar
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">A lixeira está vazia.</p>
        )}
      </Panel>

      <AlertDialog open={!!purging} onOpenChange={(open) => !open && setPurging(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir “{purging?.label || "Sem título"}” para sempre?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O item some para todos os membros do espaço.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void purge()}>
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
