import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Confirm } from "@/components/wedding/confirm";
import { SectionTitle } from "@/components/wedding/shell";
import { parseMoney } from "@/features/wedding/budget";
import {
  fundingSummary,
  INST_LABEL,
  installmentState,
  KIND_LABEL,
  loanTotals,
  monthlySchedule,
  type FundingKind,
} from "@/features/wedding/funding";
import type { FundingData, FundingMutations, SourceInput } from "@/features/wedding/funding-api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fieldCls, fmtDate } from "./ui-utils";

type Source = FundingData["sources"][number];
const money = (v: number) => formatCurrency(v);
const str = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
const today = () => new Date().toISOString().slice(0, 10);
const KINDS: FundingKind[] = ["own", "family", "loan"];

export function FundingTab({
  data,
  m,
  weddingCost,
}: {
  data: FundingData;
  m: FundingMutations;
  /** Custo do casamento já calculado pelos itens/avulsas — só exibido, nunca somado às fontes. */
  weddingCost: number;
}) {
  const [editing, setEditing] = useState<{ source: Source | null; kind: FundingKind } | null>(null);
  const s = fundingSummary(data.sources, data.installments, data.payments);
  const resources = s.ownReceived + s.loanReceived + s.familyReceived;

  return (
    <div className="space-y-6">
      <section className="wed-card space-y-4 p-4 sm:p-5" aria-label="Resumo das fontes e dívidas">
        <p className="text-xs text-muted-foreground">
          Custo é o que o casamento custa. Fontes dizem de onde vem o dinheiro. Dívidas são o que
          ainda será devolvido — parcelas pagas reduzem a dívida e não somam ao custo.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Block title="Custo do casamento" rows={[["Contratado + avulsas", money(weddingCost)]]} />
          <Block
            title="Fontes de recursos"
            rows={[
              ["Próprio reservado", money(s.ownReserved)],
              ["Próprio já separado", money(s.ownReceived)],
              ["Empréstimos recebidos", money(s.loanReceived)],
              ["Família prometido", money(s.familyPromised)],
              ["Família recebido", money(s.familyReceived)],
              ["Total já disponível", money(resources)],
            ]}
          />
          <Block
            title="Dívidas"
            rows={[
              ["Contratado a devolver", money(s.toRepay)],
              ["Já pago das dívidas", money(s.debtPaid)],
              ["Saldo devedor", money(s.balance)],
            ]}
          />
        </div>
        {s.unknownRepay > 0 ? (
          <p className="text-xs text-muted-foreground">
            {s.unknownRepay} empréstimo(s) sem total a devolver nem parcelas — fora do saldo
            devedor.
          </p>
        ) : null}
        {s.overdue > 0 ? (
          <p className="text-sm text-destructive">{s.overdue} parcela(s) vencida(s) em aberto.</p>
        ) : null}
        {s.monthly.length ? (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Compromissos mensais futuros
            </p>
            <ul className="flex flex-wrap gap-2 text-xs">
              {s.monthly.slice(0, 12).map((x) => (
                <li key={x.month} className="rounded-full border px-2.5 py-1 tabular-nums">
                  {x.month.slice(5)}/{x.month.slice(0, 4)} · {money(x.amount)}
                </li>
              ))}
              {s.monthly.length > 12 ? (
                <li className="px-1 py-1 text-muted-foreground">+{s.monthly.length - 12} meses</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </section>

      {KINDS.map((kind) => {
        const list = data.sources.filter((x) => x.kind === kind);
        return (
          <section key={kind} className="space-y-2" aria-label={KIND_LABEL[kind]}>
            <SectionTitle
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing({ source: null, kind })}
                >
                  <Plus className="mr-1 h-4 w-4" /> Adicionar
                </Button>
              }
            >
              {KIND_LABEL[kind]}
            </SectionTitle>
            {list.length === 0 ? (
              <p className="wed-card p-4 text-sm text-muted-foreground">
                {kind === "loan"
                  ? "Nenhum empréstimo. Parcelamento direto com fornecedor fica no item, não aqui."
                  : "Nada cadastrado ainda."}
              </p>
            ) : (
              list.map((src) =>
                kind === "loan" ? (
                  <LoanCard
                    key={src.id}
                    src={src}
                    data={data}
                    m={m}
                    onEdit={() => setEditing({ source: src, kind })}
                  />
                ) : (
                  <div key={src.id} className="wed-card flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium">{src.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {kind === "own" ? "Reservado" : "Prometido"}:{" "}
                        {src.promised_amount == null ? "não informado" : money(src.promised_amount)}{" "}
                        · Recebido:{" "}
                        {src.received_amount == null ? "não informado" : money(src.received_amount)}
                        {src.received_on ? ` em ${fmtDate(src.received_on)}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing({ source: src, kind })}
                    >
                      Editar
                    </Button>
                  </div>
                ),
              )
            )}
          </section>
        );
      })}

      {editing ? (
        <SourceDialog
          kind={editing.kind}
          source={editing.source}
          m={m}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function Block({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="wed-display text-lg">{title}</p>
      <dl className="space-y-0.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function LoanCard({
  src,
  data,
  m,
  onEdit,
}: {
  src: Source;
  data: FundingData;
  m: FundingMutations;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = loanTotals(src, data.installments, data.payments);
  const inst = data.installments
    .filter((i) => i.source_id === src.id)
    .sort((a, b) => a.number - b.number);
  const canGenerate =
    inst.length === 0 &&
    src.installment_count != null &&
    src.installment_amount != null &&
    !!src.first_due_date;

  const generate = () =>
    m.addInstallments.mutate(
      monthlySchedule(src.first_due_date!, src.installment_count!).map((d, k) => ({
        source_id: src.id,
        number: k + 1,
        due_date: d,
        amount: src.installment_amount!,
      })),
      {
        onSuccess: () => toast.success("Parcelas criadas"),
        onError: (e) => toast.error(e.message),
      },
    );

  return (
    <div className="wed-card overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium">{src.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Recebido: {src.received_amount == null ? "não informado" : money(src.received_amount)}
            {src.received_on ? ` em ${fmtDate(src.received_on)}` : ""} · A devolver:{" "}
            {t.toRepay == null ? "não informado" : money(t.toRepay)}
            {src.financial_cost != null ? ` · Custo financeiro ${money(src.financial_cost)}` : ""}
          </p>
          <p className="text-sm tabular-nums">
            Pago {money(t.paid)} · Saldo devedor{" "}
            <strong>{t.balance == null ? "—" : money(t.balance)}</strong>
          </p>
          {t.mismatch ? (
            <p className="text-xs text-muted-foreground">
              A soma das parcelas difere do total a devolver informado.
            </p>
          ) : null}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            Parcelas ({inst.length}){" "}
            <ChevronDown className={cn("ml-1 h-4 w-4 transition", open && "rotate-180")} />
          </Button>
        </div>
      </div>
      {open ? (
        <div className="space-y-3 border-t p-4">
          {canGenerate ? (
            <Button size="sm" onClick={generate} disabled={m.addInstallments.isPending}>
              Criar {src.installment_count} parcelas mensais de {money(src.installment_amount!)} a
              partir de {fmtDate(src.first_due_date!)}
            </Button>
          ) : null}
          {inst.length === 0 && !canGenerate ? (
            <p className="text-sm text-muted-foreground">
              Sem parcelas. Informe quantidade, valor e 1º vencimento no empréstimo, ou adicione uma
              a uma.
            </p>
          ) : null}
          <ul className="space-y-2">
            {inst.map((i) => (
              <InstallmentRow key={i.id} inst={i} data={data} m={m} />
            ))}
          </ul>
          <AddInstallment sourceId={src.id} next={(inst.at(-1)?.number ?? 0) + 1} m={m} />
        </div>
      ) : null}
    </div>
  );
}

function InstallmentRow({
  inst,
  data,
  m,
}: {
  inst: FundingData["installments"][number];
  data: FundingData;
  m: FundingMutations;
}) {
  const st = installmentState(inst, data.payments);
  const pays = data.payments.filter((p) => p.installment_id === inst.id);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const pay = () => {
    const v = parseMoney(amount);
    if (v == null || Number.isNaN(v) || v <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (!date) {
      toast.error("Informe a data do pagamento.");
      return;
    }
    m.addPayment.mutate(
      { installment_id: inst.id, amount: v, paid_on: date, note: null },
      {
        onSuccess: () => {
          setAmount("");
          toast.success("Pagamento registrado");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };
  return (
    <li className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">#{inst.number}</span>
        <span className="tabular-nums">{fmtDate(inst.due_date)}</span>
        <span className="tabular-nums">{money(inst.amount)}</span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs",
            st.status === "overdue" && "border-destructive text-destructive",
          )}
        >
          {INST_LABEL[st.status]}
          {st.partial ? " · parcial" : ""}
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          Pago {money(st.paid)} · falta {money(st.remaining)}
        </span>
        <Confirm
          trigger={
            <Button size="icon" variant="ghost" aria-label={`Excluir parcela ${inst.number}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          }
          title="Excluir parcela?"
          description="A parcela e os pagamentos dela serão removidos."
          confirmLabel="Excluir"
          onConfirm={() =>
            m.deleteInstallment.mutate(inst.id, { onError: (e) => toast.error(e.message) })
          }
        />
      </div>
      {pays.length ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {pays.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              Pago {money(p.amount)} em {fmtDate(p.paid_on)}
              <Confirm
                trigger={<button className="underline">remover</button>}
                title="Remover pagamento?"
                description="O valor volta para o saldo da parcela."
                confirmLabel="Remover"
                onConfirm={() =>
                  m.deletePayment.mutate(p.id, { onError: (e) => toast.error(e.message) })
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
      {st.status !== "paid" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            className="h-9 w-32"
            inputMode="decimal"
            placeholder="Valor pago"
            aria-label={`Valor pago parcela ${inst.number}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            className="h-9 w-40"
            type="date"
            aria-label={`Data do pagamento parcela ${inst.number}`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button size="sm" variant="outline" onClick={pay} disabled={m.addPayment.isPending}>
            Registrar
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function AddInstallment({
  sourceId,
  next,
  m,
}: {
  sourceId: string;
  next: number;
  m: FundingMutations;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const add = () => {
    const v = parseMoney(amount);
    if (v == null || Number.isNaN(v) || v <= 0) {
      toast.error("Informe o valor da parcela.");
      return;
    }
    if (!date) {
      toast.error("Informe o vencimento.");
      return;
    }
    m.addInstallments.mutate([{ source_id: sourceId, number: next, due_date: date, amount: v }], {
      onSuccess: () => {
        setAmount("");
        setDate("");
      },
      onError: (e) => toast.error(e.message),
    });
  };
  return (
    <div className="flex flex-wrap items-end gap-2 border-t pt-3">
      <span className="text-xs text-muted-foreground">Nova parcela #{next}</span>
      <Input
        className="h-9 w-32"
        inputMode="decimal"
        placeholder="Valor"
        aria-label="Valor da nova parcela"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Input
        className="h-9 w-40"
        type="date"
        aria-label="Vencimento da nova parcela"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <Button size="sm" variant="outline" onClick={add}>
        Adicionar parcela
      </Button>
    </div>
  );
}

function SourceDialog({
  kind,
  source,
  m,
  onClose,
}: {
  kind: FundingKind;
  source: Source | null;
  m: FundingMutations;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    name: source?.name ?? "",
    promised: str(source?.promised_amount ?? null),
    received: str(source?.received_amount ?? null),
    received_on: source?.received_on ?? "",
    repay: str(source?.total_to_repay ?? null),
    cost: str(source?.financial_cost ?? null),
    interest: source?.interest_note ?? "",
    count: source?.installment_count == null ? "" : String(source.installment_count),
    instAmount: str(source?.installment_amount ?? null),
    first: source?.first_due_date ?? "",
    notes: source?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  const loan = kind === "loan";

  const save = () => {
    if (!f.name.trim()) {
      toast.error(loan ? "Informe o credor ou instituição." : "Informe um nome.");
      return;
    }
    const vals = [f.promised, f.received, f.repay, f.cost, f.instAmount].map(parseMoney);
    if (vals.some((v) => Number.isNaN(v))) {
      toast.error("Confira os valores digitados.");
      return;
    }
    const count = f.count.trim() ? Number(f.count) : null;
    if (count != null && (!Number.isInteger(count) || count < 1 || count > 600)) {
      toast.error("Quantidade de parcelas entre 1 e 600.");
      return;
    }
    if (vals[4] === 0) {
      toast.error("Valor da parcela deve ser maior que zero.");
      return;
    }
    const [promised, received, repay, cost, instAmount] = vals as (number | null)[];
    const input: SourceInput = {
      kind,
      name: f.name.trim(),
      promised_amount: loan ? null : (promised ?? null),
      received_amount: received ?? null,
      received_on: f.received_on || null,
      total_to_repay: loan ? (repay ?? null) : null,
      financial_cost: loan ? (cost ?? null) : null,
      interest_note: loan && f.interest.trim() ? f.interest.trim() : null,
      installment_count: loan ? count : null,
      installment_amount: loan ? (instAmount ?? null) : null,
      first_due_date: loan && f.first ? f.first : null,
      notes: f.notes.trim() || null,
    };
    m.saveSource.mutate(
      { id: source?.id, input },
      {
        onSuccess: () => {
          toast.success("Salvo");
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {source ? "Editar" : "Adicionar"} — {KIND_LABEL[kind]}
          </DialogTitle>
          <DialogDescription>Deixe em branco o que ainda não souberem.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label={loan ? "Credor / instituição" : kind === "family" ? "Quem ajuda" : "Nome"} full>
            <Input value={f.name} onChange={set("name")} maxLength={120} />
          </F>
          {!loan ? (
            <F label={kind === "own" ? "Valor reservado" : "Valor prometido"}>
              <Input inputMode="decimal" value={f.promised} onChange={set("promised")} />
            </F>
          ) : null}
          <F label={loan ? "Valor recebido" : "Valor já recebido"}>
            <Input inputMode="decimal" value={f.received} onChange={set("received")} />
          </F>
          <F label={loan ? "Data de contratação/recebimento" : "Data do recebimento"}>
            <input
              type="date"
              className={fieldCls}
              value={f.received_on}
              onChange={set("received_on")}
            />
          </F>
          {loan ? (
            <>
              <F label="Total a devolver">
                <Input inputMode="decimal" value={f.repay} onChange={set("repay")} />
              </F>
              <F label="Custo financeiro total (juros/taxas)">
                <Input
                  inputMode="decimal"
                  placeholder="0 se sem juros"
                  value={f.cost}
                  onChange={set("cost")}
                />
              </F>
              <F label="Juros/taxa (texto livre)">
                <Input
                  value={f.interest}
                  onChange={set("interest")}
                  maxLength={200}
                  placeholder="ex.: 1,5% a.m."
                />
              </F>
              <F label="Quantidade de parcelas">
                <Input inputMode="numeric" value={f.count} onChange={set("count")} />
              </F>
              <F label="Valor da parcela">
                <Input inputMode="decimal" value={f.instAmount} onChange={set("instAmount")} />
              </F>
              <F label="1º vencimento">
                <input type="date" className={fieldCls} value={f.first} onChange={set("first")} />
              </F>
            </>
          ) : null}
          <F label="Observações" full>
            <Textarea value={f.notes} onChange={set("notes")} maxLength={2000} rows={3} />
          </F>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {source ? (
            <Confirm
              trigger={
                <Button variant="ghost" className="text-destructive">
                  Excluir
                </Button>
              }
              title="Excluir esta fonte?"
              description={
                loan
                  ? "O empréstimo, suas parcelas e pagamentos serão removidos."
                  : "O registro será removido."
              }
              confirmLabel="Excluir"
              onConfirm={() =>
                m.deleteSource.mutate(source.id, {
                  onSuccess: onClose,
                  onError: (e) => toast.error(e.message),
                })
              }
            />
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={m.saveSource.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", full && "sm:col-span-2")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
