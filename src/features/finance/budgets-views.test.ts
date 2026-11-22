import { describe, expect, test } from "vitest";
import {
  budgetState,
  byOwner,
  monthSummary,
  parseYear,
  planEdit,
  planStop,
  shiftMonth,
  yearSummary,
  type BudgetRule,
} from "./budgets";

const ME = "u-joao";
const PARTNER = "u-renifer";
let seq = 0;
const rule = (p: Partial<BudgetRule>): BudgetRule => ({
  id: `r${++seq}`,
  workspace_id: "ws",
  owner_id: ME,
  visibility: "SHARED",
  category_id: "mercado",
  amount: 800,
  start_month: "2026-01-01",
  end_month: null,
  note: null,
  from_legacy: false,
  created_at: `2026-01-0${(seq % 9) + 1}T10:00:00Z`,
  updated_at: "2026-01-01T10:00:00Z",
  ...p,
});
const tx = (p: Record<string, unknown>) =>
  ({
    type: "EXPENSE",
    status: "PAID",
    amount: 100,
    transaction_date: "2026-11-10",
    category_id: "mercado",
    visibility: "SHARED",
    owner_id: ME,
    ...p,
  }) as never;

/** Aplica operações planejadas numa lista em memória, como o banco faria. */
function applyOps(list: BudgetRule[], ops: ReturnType<typeof planEdit>) {
  let out = [...list];
  for (const op of ops) {
    if (op.type === "delete") out = out.filter((r) => r.id !== op.id);
    else if (op.type === "update")
      out = out.map((r) => (r.id === op.id ? ({ ...r, ...op.patch } as BudgetRule) : r));
    else out.push(rule({ ...(op.row as Partial<BudgetRule>) }));
  }
  return out;
}

describe("qualquer ano, sem faixa fixa", () => {
  test("aceita 2026, 2027, 2028 e anos distantes; recusa lixo", () => {
    for (const y of [2026, 2027, 2028, 2045, 2099]) expect(parseYear(String(y))).toBe(y);
    expect(parseYear("20")).toBeNull();
    expect(parseYear("abcd")).toBeNull();
    expect(parseYear("10000")).toBeNull();
  });

  test("setas atravessam vários anos a partir de 2026", () => {
    expect(shiftMonth("2026-11", 12)).toBe("2027-11");
    expect(shiftMonth("2027-12", 1)).toBe("2028-01");
    expect(shiftMonth("2026-01", 12 * 19)).toBe("2045-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  test("limite recorrente vale em 2026, 2027, 2028 e 2045 sem cópias", () => {
    const rules = [rule({ amount: 500 })];
    for (const k of ["2026-03", "2027-06", "2028-12", "2045-07"])
      expect(monthSummary(rules, [], k, "SHARED", ME).planned).toBe(500);
    expect(monthSummary(rules, [], "2025-12", "SHARED", ME).planned).toBe(0);
    expect(rules).toHaveLength(1);
  });
});

describe("resumo do mês", () => {
  test("realizado por competência, sem cancelados nem de outro mês", () => {
    const list = [
      tx({ amount: 300 }),
      tx({ amount: 900, status: "CANCELLED" }),
      tx({ amount: 50, transaction_date: "2026-12-01" }),
      tx({ amount: 40, category_id: "lazer" }),
    ];
    const s = monthSummary([rule({ amount: 500 })], list, "2026-11", "SHARED", ME);
    expect(s.planned).toBe(500);
    expect(s.used).toBe(300);
    expect(s.spentTotal).toBe(340);
    expect(s.unbudgeted).toBe(40);
    expect(s.left).toBe(200);
    expect(s.pct).toBe(60);
    expect(s.state).toBe("ok");
  });

  test("orçamento geral vira o teto e conta todas as despesas", () => {
    const rules = [rule({ amount: 500 }), rule({ category_id: null, amount: 1000 })];
    const s = monthSummary(
      rules,
      [tx({ amount: 700 }), tx({ amount: 400, category_id: "lazer" })],
      "2026-11",
      "SHARED",
      ME,
    );
    expect(s.planned).toBe(1000);
    expect(s.used).toBe(1100);
    expect(s.state).toBe("over");
  });

  test("estados normal, atenção e excedido", () => {
    expect(budgetState(50, 100)).toBe("ok");
    expect(budgetState(85, 100)).toBe("warn");
    expect(budgetState(101, 100)).toBe("over");
    expect(budgetState(10, 0)).toBe("none");
  });
});

describe("exceção e mudança futura atravessando a virada do ano", () => {
  const base = rule({ amount: 500, start_month: "2026-06-01" });

  test("só dez/2026 muda; jan/2027 volta ao recorrente", () => {
    const after = applyOps([base], planEdit(base, "2026-12", 700, "month"));
    expect(monthSummary(after, [], "2026-11", "SHARED", ME).planned).toBe(500);
    expect(monthSummary(after, [], "2026-12", "SHARED", ME).planned).toBe(700);
    expect(monthSummary(after, [], "2027-01", "SHARED", ME).planned).toBe(500);
  });

  test("de mar/2028 em diante muda sem reescrever 2026/2027", () => {
    const after = applyOps([base], planEdit(base, "2028-03", 650, "forward"));
    expect(monthSummary(after, [], "2026-06", "SHARED", ME).planned).toBe(500);
    expect(monthSummary(after, [], "2027-12", "SHARED", ME).planned).toBe(500);
    expect(monthSummary(after, [], "2028-02", "SHARED", ME).planned).toBe(500);
    expect(monthSummary(after, [], "2028-03", "SHARED", ME).planned).toBe(650);
    expect(monthSummary(after, [], "2040-01", "SHARED", ME).planned).toBe(650);
  });

  test("pausar um mês deixa o mês sem limite e não apaga a regra", () => {
    const after = applyOps([base], planEdit(base, "2027-02", 0, "month"));
    expect(after).toHaveLength(2);
    expect(monthSummary(after, [], "2027-02", "SHARED", ME).planned).toBe(0);
    expect(monthSummary(after, [], "2027-03", "SHARED", ME).planned).toBe(500);
  });

  test("encerrar em 2029 mantém os meses anteriores", () => {
    const after = applyOps([base], planStop(base, "2029-01"));
    expect(monthSummary(after, [], "2028-12", "SHARED", ME).planned).toBe(500);
    expect(monthSummary(after, [], "2029-01", "SHARED", ME).planned).toBe(0);
  });
});

describe("visão anual", () => {
  test("12 meses das mesmas regras e lançamentos, sem duplicar", () => {
    const rules = [rule({ amount: 500, start_month: "2027-04-01" })];
    const list = [
      tx({ amount: 200, transaction_date: "2027-03-05" }),
      tx({ amount: 600, transaction_date: "2027-04-05" }),
      tx({ amount: 100, transaction_date: "2027-12-31" }),
      tx({ amount: 999, transaction_date: "2028-01-01" }),
      tx({ amount: 999, transaction_date: "2027-05-01", status: "CANCELLED" }),
    ];
    const y = yearSummary(rules, list, 2027, "SHARED", ME);
    expect(y.months.map((m) => m.key)[0]).toBe("2027-01");
    expect(y.months.map((m) => m.key)[11]).toBe("2027-12");
    expect(y.monthsWithBudget).toBe(9);
    expect(y.planned).toBe(4500);
    expect(y.spent).toBe(900);
    expect(y.months[3]!.state).toBe("over");
    expect(y.months[2]!.planned).toBe(0);
    expect(rules).toHaveLength(1);
  });

  test("ano distante (2045) continua com o limite recorrente", () => {
    const y = yearSummary([rule({ amount: 300 })], [], 2045, "SHARED", ME);
    expect(y.monthsWithBudget).toBe(12);
    expect(y.planned).toBe(3600);
  });
});

describe("filtros casal/pessoal e dono", () => {
  const list = [
    tx({ amount: 100, owner_id: ME }),
    tx({ amount: 250, owner_id: PARTNER }),
    tx({ amount: 70, owner_id: ME, visibility: "PRIVATE" }),
    tx({ amount: 999, owner_id: PARTNER, visibility: "PRIVATE" }),
  ];
  const rules = [
    rule({ amount: 500 }),
    rule({ amount: 80, visibility: "PRIVATE", owner_id: ME }),
    rule({ amount: 9000, visibility: "PRIVATE", owner_id: PARTNER }),
  ];

  test("do casal só conta compartilhados de todos", () => {
    const s = monthSummary(rules, list, "2026-11", "SHARED", ME);
    expect(s.planned).toBe(500);
    expect(s.spentTotal).toBe(350);
  });

  test("filtro por pessoa só muda o realizado, não o limite", () => {
    const s = monthSummary(rules, byOwner(list, PARTNER), "2026-11", "SHARED", ME);
    expect(s.planned).toBe(500);
    expect(s.spentTotal).toBe(250);
  });

  test("só meu usa meu limite e meus privados; nunca os do outro", () => {
    const s = monthSummary(rules, list, "2026-11", "MINE", ME);
    expect(s.planned).toBe(80);
    expect(s.spentTotal).toBe(70);
  });
});
