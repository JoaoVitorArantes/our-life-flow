import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LoadingState } from "@/components/common/states";
import { SectionTitle, Stat, WeddingShell } from "@/components/wedding/shell";
import { Choice } from "@/components/wedding/item-form";
import { RowList } from "@/components/wedding/row-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthsFrom } from "@/features/wedding/contracts";
import { useWeddingMutations } from "@/features/wedding/api";
import { useWeddingData } from "@/features/wedding/use-wedding";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/casamento/orcamento")({
  head: () => ({
    meta: [
      { title: "Orçamento do casamento — Life OS" },
      {
        name: "description",
        content: "Metas mensais, aportes de cada um e despesas do casamento.",
      },
      { property: "og:title", content: "Orçamento do casamento — Life OS" },
      {
        property: "og:description",
        content: "Economia e despesas do casal, separadas do Financeiro geral.",
      },
    ],
  }),
  component: Budget,
});

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const today = () => new Date().toISOString().slice(0, 10);

function Budget() {
  const w = useWeddingData();
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const [who, setWho] = useState(w.userId ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [desc, setDesc] = useState("");
  const [expense, setExpense] = useState("");
  const [paidBy, setPaidBy] = useState(w.userId ?? "");
  if (w.loading) return <LoadingState />;
  const start = (w.plan?.savings_start ?? "2027-01-01").slice(0, 7) + "-01";
  const months = monthsFrom(start, 12);
  const byMonth = (mo: string) =>
    w.contributions
      .filter((c) => c.contributed_on.slice(0, 7) === mo.slice(0, 7))
      .reduce((s, c) => s + Number(c.amount), 0);
  const s = w.summary;
  return (
    <WeddingShell title="Orçamento" subtitle="Separado do Financeiro geral — nada é lançado lá.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Orçamento total"
          value={
            w.plan?.total_budget != null
              ? formatCurrency(Number(w.plan.total_budget))
              : "Não informado"
          }
        />
        <Stat label="Meta (12 meses)" value={formatCurrency(s.savingsTarget)} />
        <Stat label="Guardado" value={formatCurrency(s.saved)} />
        <Stat label="Gasto" value={formatCurrency(s.spent)} />
        {w.people.map((p) => (
          <Stat
            key={p.id}
            label={`Aportes de ${p.name}`}
            value={formatCurrency(
              w.contributions
                .filter((c) => c.user_id === p.id)
                .reduce((t, c) => t + Number(c.amount), 0),
            )}
          />
        ))}
      </div>

      <section className="wed-card space-y-3 p-4 sm:p-5">
        <SectionTitle>Registrar aporte</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Choice value={who} onChange={setWho} options={w.people.map((x) => [x.id, x.name])} />
          <Input
            aria-label="Valor do aporte"
            className="h-11"
            inputMode="decimal"
            placeholder="Valor (R$)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            aria-label="Data do aporte"
            className="h-11"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button
            className="h-11"
            disabled={!num(amount) || !who}
            onClick={() =>
              m.addContribution.mutate(
                { userId: who, amount: num(amount)!, date, note: null },
                {
                  onSuccess: () => {
                    setAmount("");
                    toast.success("Aporte registrado.");
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </section>

      <section className="wed-card p-4 sm:p-5">
        <SectionTitle>Metas mensais</SectionTitle>
        <ul className="divide-y divide-border">
          {months.map((mo) => {
            const goal = w.goals.find((g) => g.month === mo);
            const label = new Date(`${mo}T12:00:00`).toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            });
            return (
              <li
                key={mo}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-sm sm:grid-cols-[10rem_9rem_1fr]"
              >
                <span className="capitalize">{label}</span>
                <Input
                  aria-label={`Meta de ${label}`}
                  key={String(goal?.target_amount ?? "x")}
                  inputMode="decimal"
                  placeholder="Meta (R$)"
                  defaultValue={goal ? String(goal.target_amount) : ""}
                  className="h-10 w-28"
                  onBlur={(e) => {
                    const v = num(e.target.value);
                    if (v != null && v >= 0 && v !== Number(goal?.target_amount))
                      m.setGoal.mutate(
                        { month: mo, amount: v },
                        { onError: (er) => toast.error(er.message) },
                      );
                  }}
                />
                <span className="col-span-2 text-muted-foreground sm:col-span-1">
                  Realizado {formatCurrency(byMonth(mo))}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="wed-card space-y-3 p-4 sm:p-5">
        <SectionTitle>Nova despesa</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <Input
            aria-label="Descrição da despesa"
            className="h-11"
            placeholder="Ex.: frete da mudança"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <Input
            aria-label="Valor da despesa"
            className="h-11"
            inputMode="decimal"
            placeholder="Valor (R$)"
            value={expense}
            onChange={(e) => setExpense(e.target.value)}
          />
          <Choice
            value={paidBy}
            onChange={setPaidBy}
            options={w.people.map((x) => [x.id, x.name])}
          />
          <Button
            className="h-11"
            disabled={!desc.trim() || !num(expense) || !paidBy}
            onClick={() =>
              m.addExpense.mutate(
                {
                  description: desc.trim(),
                  amount: num(expense)!,
                  paidBy,
                  split: "equal",
                  date: today(),
                },
                {
                  onSuccess: () => {
                    setDesc("");
                    setExpense("");
                    toast.success("Despesa registrada.");
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </section>

      <RowList
        title="Aportes"
        rows={w.contributions.map((c) => ({
          id: c.id,
          main: `${w.personName(c.user_id)} · ${formatCurrency(Number(c.amount))}`,
          sub: new Date(`${c.contributed_on}T12:00:00`).toLocaleDateString("pt-BR"),
        }))}
        onDelete={(id) => m.deleteRow.mutate({ table: "wedding_contributions", id })}
      />
      <RowList
        title="Despesas"
        rows={w.expenses.map((e) => ({
          id: e.id,
          main: `${e.description} · ${formatCurrency(Number(e.amount))}`,
          sub: `${new Date(`${e.spent_on}T12:00:00`).toLocaleDateString("pt-BR")} · pago por ${w.personName(e.paid_by_user_id)} · ${e.split === "equal" ? "metade cada" : "só quem pagou"}`,
        }))}
        onDelete={(id) => m.deleteRow.mutate({ table: "wedding_expenses", id })}
      />
    </WeddingShell>
  );
}
