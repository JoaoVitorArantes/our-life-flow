import { useState } from "react";
import { toast } from "sonner";
import { Choice } from "@/components/wedding/item-form";
import { RowList } from "@/components/wedding/row-list";
import { SectionTitle, Stat } from "@/components/wedding/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WeddingData } from "@/features/wedding/use-wedding";
import type { WeddingMutations } from "@/features/wedding/api";
import { formatCurrency } from "@/lib/format";
import { YearNav } from "./year-nav";

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const today = () => new Date().toISOString().slice(0, 10);

/** Economia do casal (metas mensais e aportes) — mesmas tabelas de antes, agora em qualquer ano. */
export function SavingsTab({ w, m }: { w: WeddingData; m: WeddingMutations }) {
  const start = w.plan?.savings_start?.slice(0, 7) ?? null;
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(() => {
    const sy = start ? Number(start.slice(0, 4)) : null;
    return sy && sy > nowYear ? sy : nowYear;
  });
  const [who, setWho] = useState(w.userId ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const y = String(year).padStart(4, "0");
  const months = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}-01`);
  const byMonth = (mo: string) =>
    w.contributions
      .filter((c) => c.contributed_on.slice(0, 7) === mo.slice(0, 7))
      .reduce((s, c) => s + Number(c.amount), 0);
  const goalYear = w.goals
    .filter((g) => g.month.slice(0, 4) === y)
    .reduce((s, g) => s + Number(g.target_amount), 0);
  const savedYear = w.contributions
    .filter((c) => c.contributed_on.slice(0, 4) === y)
    .reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Guardado (total)" value={formatCurrency(w.summary.saved)} />
        <Stat label={`Meta de ${year}`} value={goalYear ? formatCurrency(goalYear) : "Sem meta"} />
        <Stat label={`Guardado em ${year}`} value={formatCurrency(savedYear)} />
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
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
        <SectionTitle action={<YearNav year={year} onChange={setYear} />}>
          Metas mensais
        </SectionTitle>
        {start ? (
          <p className="mb-2 text-xs text-muted-foreground">
            Economia começa em{" "}
            {new Date(`${start}-01T12:00:00`).toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}{" "}
            (muda em Ajustes). Podem planejar qualquer ano.
          </p>
        ) : null}
        <ul className="divide-y divide-border">
          {months.map((mo) => {
            const goal = w.goals.find((g) => g.month === mo);
            const label = new Date(`${mo}T12:00:00`).toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            });
            const before = !!start && mo.slice(0, 7) < start;
            return (
              <li
                key={mo}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-sm lg:grid-cols-[10rem_9rem_1fr]"
              >
                <span className="capitalize">
                  {label}
                  {before ? (
                    <span className="block text-xs normal-case text-muted-foreground">
                      antes do início
                    </span>
                  ) : null}
                </span>
                <Input
                  aria-label={`Meta de ${label}`}
                  key={`${mo}-${String(goal?.target_amount ?? "x")}`}
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
                <span className="col-span-2 text-muted-foreground lg:col-span-1">
                  Realizado {formatCurrency(byMonth(mo))}
                </span>
              </li>
            );
          })}
        </ul>
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
    </div>
  );
}

/** Despesas avulsas (inclui compras da Nossa Casa) — mesmo fluxo de antes. */
export function ExpensesTab({ w, m }: { w: WeddingData; m: WeddingMutations }) {
  const [desc, setDesc] = useState("");
  const [expense, setExpense] = useState("");
  const [paidBy, setPaidBy] = useState(w.userId ?? "");
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Gastos rápidos que não são um item do orçamento, e as compras marcadas na Nossa Casa. Eles
        entram no total pago do casamento.
      </p>
      <section className="wed-card space-y-3 p-4 sm:p-5">
        <SectionTitle>Nova despesa avulsa</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
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
        title="Despesas avulsas"
        rows={w.expenses.map((e) => ({
          id: e.id,
          main: `${e.description} · ${formatCurrency(Number(e.amount))}`,
          sub: `${new Date(`${e.spent_on}T12:00:00`).toLocaleDateString("pt-BR")} · pago por ${w.personName(e.paid_by_user_id)} · ${e.split === "equal" ? "metade cada" : "só quem pagou"}`,
        }))}
        onDelete={(id) => m.deleteRow.mutate({ table: "wedding_expenses", id })}
      />
    </div>
  );
}
