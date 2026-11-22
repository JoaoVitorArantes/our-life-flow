import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2, Pencil, Receipt, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useApp } from "@/features/app/app-context";
import { toCsv } from "@/features/export/export";
import {
  missingReceiptFields,
  RECEIPT_CATEGORIES,
  receiptFileOk,
  receiptsToRows,
  type NormalizedReading,
} from "@/features/receipts/contracts";
import { readReceipt } from "@/lib/receipts/receipts.functions";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notas-fiscais")({
  head: () => ({
    meta: [
      { title: "Notas e recibos — Life OS" },
      {
        name: "description",
        content: "Envie notas fiscais e recibos; a IA lê e organiza numa lista própria exportável.",
      },
      { property: "og:title", content: "Notas e recibos — Life OS" },
      {
        property: "og:description",
        content: "Notas fiscais e recibos lidos por IA, separados do Financeiro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceiptsPage,
});

type ReceiptRow = Tables<"receipts">;
type Draft = {
  key: string;
  fileName: string;
  path: string | null;
  state: "uploading" | "reading" | "ready" | "error";
  error?: string;
  confidence?: NormalizedReading["confidence"];
  notReceipt?: boolean;
  form: FormState;
  items: NormalizedReading["items"];
};
type FormState = {
  merchant: string;
  receipt_date: string;
  total: string;
  category: string;
  payment_method: string;
  description: string;
  document_number: string;
  notes: string;
};
const emptyForm: FormState = {
  merchant: "",
  receipt_date: "",
  total: "",
  category: "Outros",
  payment_method: "",
  description: "",
  document_number: "",
  notes: "",
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const parseMoney = (v: string) => {
  const n = Number(
    v
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const nul = (v: string) => v.trim() || null;
const CONF: Record<string, string> = {
  high: "Leitura confiável",
  medium: "Confira os dados",
  low: "Leitura incerta — revise tudo",
};

function useReceipts(workspaceId?: string) {
  return useQuery({
    queryKey: ["receipts", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("receipt_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });
}

function ReceiptsPage() {
  const { workspaceId, userId } = useApp();
  const qc = useQueryClient();
  const list = useReceipts(workspaceId);
  const read = useServerFn(readReceipt);
  const inputRef = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [month, setMonth] = useState("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const patch = (key: string, p: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...p } : d)));

  const handleFiles = async (files: FileList | null) => {
    if (!files || !workspaceId) return;
    const picked = Array.from(files).slice(0, 10);
    for (const file of picked) {
      const key = crypto.randomUUID();
      const bad = receiptFileOk(file.type, file.size);
      setDrafts((ds) => [
        ...ds,
        {
          key,
          fileName: file.name,
          path: null,
          state: bad ? "error" : "uploading",
          ...(bad ? { error: bad } : {}),
          form: { ...emptyForm },
          items: [],
        },
      ]);
      if (bad) continue;
      // Uma nota por vez: evita sobrecarregar a leitura.
      const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
      const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage
        .from("receipts")
        .upload(path, file, { contentType: file.type });
      if (up.error) {
        patch(key, { state: "error", error: "Não foi possível enviar o arquivo." });
        continue;
      }
      patch(key, { path, state: "reading" });
      try {
        const r = await read({ data: { workspaceId, path, today: today() } });
        if (!r.ok) {
          patch(key, { state: "error", error: r.error });
          continue;
        }
        const x = r.reading;
        patch(key, {
          state: "ready",
          confidence: x.confidence,
          notReceipt: !x.is_receipt,
          items: x.items,
          form: {
            merchant: x.merchant ?? "",
            receipt_date: x.receipt_date ?? "",
            total: x.total != null ? String(x.total).replace(".", ",") : "",
            category: x.category,
            payment_method: x.payment_method ?? "",
            description: x.description ?? "",
            document_number: x.document_number ?? "",
            notes: "",
          },
        });
      } catch {
        patch(key, { state: "error", error: "Não foi possível ler este arquivo agora." });
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const discard = async (d: Draft) => {
    if (d.path) await supabase.storage.from("receipts").remove([d.path]);
    setDrafts((ds) => ds.filter((x) => x.key !== d.key));
  };

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!workspaceId || !userId) throw new Error("Sessão indisponível.");
      const total = parseMoney(d.form.total);
      const missing = missingReceiptFields({ total, receipt_date: d.form.receipt_date || null });
      if (missing.length) throw new Error(`Preencha: ${missing.join(", ")}.`);
      const { error } = await supabase.from("receipts").insert({
        workspace_id: workspaceId,
        created_by: userId,
        merchant: nul(d.form.merchant),
        receipt_date: d.form.receipt_date,
        total,
        category: d.form.category,
        payment_method: nul(d.form.payment_method),
        description: nul(d.form.description),
        document_number: nul(d.form.document_number),
        notes: nul(d.form.notes),
        items: d.items,
        file_path: d.path,
        file_name: d.fileName.slice(0, 200),
        ai_read: true,
      });
      if (error) throw error;
      return d.key;
    },
    onSuccess: (key) => {
      setDrafts((ds) => ds.filter((x) => x.key !== key));
      void qc.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Nota salva na lista.");
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const months = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.receipt_date?.slice(0, 7)).filter(Boolean) as string[]))
        .sort()
        .reverse(),
    [rows],
  );
  const filtered = rows.filter(
    (r) =>
      (month === "all" || r.receipt_date?.startsWith(month)) &&
      (cat === "all" || r.category === cat) &&
      (!q.trim() ||
        `${r.merchant ?? ""} ${r.description ?? ""}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())),
  );
  const sum = filtered.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const byCat = Object.entries(
    filtered.reduce<Record<string, number>>(
      (acc, r) => ({ ...acc, [r.category]: (acc[r.category] ?? 0) + Number(r.total ?? 0) }),
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);

  const exportCsv = () => {
    const csv = "\uFEFF" + toCsv(receiptsToRows(filtered));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `notas-e-recibos-${month === "all" ? "todas" : month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (list.isLoading) return <LoadingState />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas e recibos"
        subtitle="Envie fotos ou PDFs. A IA lê e categoriza; você revisa antes de salvar. Esta lista é separada do Financeiro."
        action={
          <>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              aria-label="Escolher notas ou recibos"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button className="h-11" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" /> Enviar notas
            </Button>
          </>
        }
      />

      {drafts.length > 0 && (
        <section className="space-y-3" aria-label="Notas para revisar">
          <h2 className="text-lg font-semibold">Para revisar ({drafts.length})</h2>
          {drafts.map((d) => (
            <DraftCard
              key={d.key}
              d={d}
              onChange={(form) => patch(d.key, { form })}
              onSave={() => save.mutate(d)}
              onDiscard={() => void discard(d)}
              saving={save.isPending}
            />
          ))}
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <p className="text-xs text-muted-foreground">
            Total {month === "all" ? "geral" : "do mês"}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(sum)}</p>
        </Panel>
        <Panel>
          <p className="text-xs text-muted-foreground">Notas</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{filtered.length}</p>
        </Panel>
        <Panel>
          <p className="text-xs text-muted-foreground">Maior categoria</p>
          <p className="mt-1 truncate text-2xl font-semibold">
            {byCat[0] ? `${byCat[0][0]}` : "—"}
          </p>
          {byCat[0] && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(byCat[0][1])}
            </p>
          )}
        </Panel>
      </div>

      <Panel className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_10rem_12rem_auto]">
          <Input
            aria-label="Buscar notas"
            className="h-11"
            placeholder="Buscar estabelecimento ou descrição"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-11" aria-label="Mês">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-11" aria-label="Categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {RECEIPT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-11"
            disabled={!filtered.length}
            onClick={exportCsv}
          >
            <Download className="size-4" /> Exportar CSV
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhuma nota ainda"
            description="Envie a foto de um cupom, nota fiscal ou recibo para começar."
          />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma nota com esses filtros.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 pr-3 font-medium">Estabelecimento</th>
                    <th className="py-2 pr-3 font-medium">Categoria</th>
                    <th className="py-2 pr-3 font-medium">Pagamento</th>
                    <th className="py-2 pr-3 text-right font-medium">Valor</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="py-2.5 pr-3 tabular-nums">
                        {r.receipt_date
                          ? new Date(`${r.receipt_date}T12:00:00`).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <p className="break-words font-medium">{r.merchant ?? "Sem nome"}</p>
                        {r.description && (
                          <p className="break-words text-xs text-muted-foreground">
                            {r.description}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="secondary">{r.category}</Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {r.payment_method ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium tabular-nums">
                        {r.total != null ? formatCurrency(Number(r.total)) : "—"}
                      </td>
                      <td className="py-2.5">
                        <RowActions r={r} onEdit={() => setEditing(r.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 lg:hidden">
              {filtered.map((r) => (
                <li key={r.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{r.merchant ?? "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.receipt_date
                          ? new Date(`${r.receipt_date}T12:00:00`).toLocaleDateString("pt-BR")
                          : "Sem data"}
                        {r.payment_method ? ` · ${r.payment_method}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">
                      {r.total != null ? formatCurrency(Number(r.total)) : "—"}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="secondary">{r.category}</Badge>
                    <RowActions r={r} onEdit={() => setEditing(r.id)} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
      {editing && rows.find((r) => r.id === editing) && (
        <EditDialog r={rows.find((r) => r.id === editing)!} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function Fields({ form, onChange }: { form: FormState; onChange: (f: FormState) => void }) {
  const set =
    (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...form, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Estabelecimento</Label>
        <Input className="h-11" maxLength={160} value={form.merchant} onChange={set("merchant")} />
      </div>
      <div className="space-y-1.5">
        <Label>Valor total (R$)</Label>
        <Input
          className="h-11"
          inputMode="decimal"
          placeholder="0,00"
          value={form.total}
          onChange={set("total")}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Data</Label>
        <Input
          className="h-11"
          type="date"
          max={today()}
          value={form.receipt_date}
          onChange={set("receipt_date")}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Categoria</Label>
        <Select value={form.category} onValueChange={(v) => onChange({ ...form, category: v })}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECEIPT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Forma de pagamento</Label>
        <Input
          className="h-11"
          maxLength={60}
          placeholder="Crédito, Pix…"
          value={form.payment_method}
          onChange={set("payment_method")}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Nº do documento</Label>
        <Input
          className="h-11"
          maxLength={80}
          value={form.document_number}
          onChange={set("document_number")}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Descrição</Label>
        <Input
          className="h-11"
          maxLength={300}
          value={form.description}
          onChange={set("description")}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Observações</Label>
        <Textarea maxLength={1000} value={form.notes} onChange={set("notes")} />
      </div>
    </div>
  );
}

function DraftCard({
  d,
  onChange,
  onSave,
  onDiscard,
  saving,
}: {
  d: Draft;
  onChange: (f: FormState) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <FileText className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{d.fileName}</span>
        </p>
        <div className="flex items-center gap-2">
          {d.state === "ready" && d.confidence && (
            <Badge variant={d.confidence === "high" ? "secondary" : "outline"}>
              {CONF[d.confidence]}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            aria-label="Descartar"
            onClick={onDiscard}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      {(d.state === "uploading" || d.state === "reading") && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />{" "}
          {d.state === "uploading" ? "Enviando…" : "Lendo com IA…"}
        </p>
      )}
      {d.state === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {d.error}
        </p>
      )}
      {d.state === "ready" && (
        <>
          {d.notReceipt && (
            <p className="rounded-xl bg-muted p-3 text-sm">
              Este arquivo não parece uma nota ou recibo. Confira antes de salvar.
            </p>
          )}
          <Fields form={d.form} onChange={onChange} />
          {d.items.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                {d.items.length} item(ns) lidos
              </summary>
              <ul className="mt-2 space-y-1">
                {d.items.map((i, n) => (
                  <li key={n} className="flex justify-between gap-3">
                    <span className="min-w-0 break-words">
                      {i.quantity ? `${i.quantity}× ` : ""}
                      {i.name}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {i.amount != null ? formatCurrency(i.amount) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Button className="h-11" disabled={saving} onClick={onSave}>
              Salvar na lista
            </Button>
            <Button variant="outline" className="h-11" onClick={onDiscard}>
              Descartar
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}

function RowActions({ r, onEdit }: { r: ReceiptRow; onEdit: () => void }) {
  const qc = useQueryClient();
  const open = async () => {
    if (!r.file_path) return;
    const { data, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(r.file_path, 300);
    if (error || !data) return void toast.error("Arquivo indisponível.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const remove = async () => {
    const { error } = await supabase
      .from("receipts")
      .delete()
      .eq("id", r.id)
      .eq("workspace_id", r.workspace_id);
    if (error) return void toast.error(error.message);
    if (r.file_path) await supabase.storage.from("receipts").remove([r.file_path]);
    void qc.invalidateQueries({ queryKey: ["receipts"] });
    toast.success("Nota excluída.");
  };
  return (
    <div className="flex justify-end gap-1">
      {r.file_path && (
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="Ver arquivo"
          onClick={() => void open()}
        >
          <FileText className="size-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label="Editar nota"
        onClick={onEdit}
      >
        <Pencil className="size-4" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="size-9" aria-label="Excluir nota">
            <Trash2 className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta nota?</AlertDialogTitle>
            <AlertDialogDescription>
              A nota e o arquivo enviado serão apagados. Isso não afeta o Financeiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditDialog({ r, onClose }: { r: ReceiptRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({
    merchant: r.merchant ?? "",
    receipt_date: r.receipt_date ?? "",
    total: r.total != null ? String(r.total).replace(".", ",") : "",
    category: r.category,
    payment_method: r.payment_method ?? "",
    description: r.description ?? "",
    document_number: r.document_number ?? "",
    notes: r.notes ?? "",
  });
  const save = async () => {
    const total = parseMoney(form.total);
    const missing = missingReceiptFields({ total, receipt_date: form.receipt_date || null });
    if (missing.length) return void toast.error(`Preencha: ${missing.join(", ")}.`);
    const { error } = await supabase
      .from("receipts")
      .update({
        merchant: nul(form.merchant),
        receipt_date: form.receipt_date,
        total,
        category: form.category,
        payment_method: nul(form.payment_method),
        description: nul(form.description),
        document_number: nul(form.document_number),
        notes: nul(form.notes),
      })
      .eq("id", r.id)
      .eq("workspace_id", r.workspace_id);
    if (error) return void toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["receipts"] });
    toast.success("Nota atualizada.");
    onClose();
  };
  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Editar nota</AlertDialogTitle>
          <AlertDialogDescription>Ajuste os dados lidos.</AlertDialogDescription>
        </AlertDialogHeader>
        <Fields form={form} onChange={setForm} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button className="h-10" onClick={() => void save()}>
            Salvar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
