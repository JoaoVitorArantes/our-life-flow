import { describe, expect, test } from "vitest";
import {
  ALL,
  monthBudgetStatus,
  parseMoney,
  planEdit,
  planStop,
  resolveBudgets,
  shiftMonth,
  spentByCategory,
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
  start_month: "2026-11-01",
  end_month: null,
  note: null,
  from_legacy: false,
  created_at: `2026-11-0${seq % 9 || 1}T10:00:00Z`,
  updated_at: "2026-11-01T10:00:00Z",
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

describe("navegação de meses", () => {
  test("vira o ano para frente e para trás", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-11", 26)).toBe("2029-01");
  });
});

describe("recorrência", () => {
  const r = rule({});
  test("regra recorrente continua nos anos seguintes sem cópias", () => {
    for (const m of ["2026-11", "2027-01", "2028-06", "2035-12"])
      expect(resolveBudgets([r], m, "SHARED", ME).get("mercado")?.amount).toBe(800);
  });
  test("não vale antes do início", () => {
    expect(resolveBudgets([r], "2026-10", "SHARED", ME).size).toBe(0);
  });
  test("regra com fim deixa de valer depois do mês final", () => {
    const closed = rule({ end_month: "2027-02-01" });
    expect(resolveBudgets([closed], "2027-02", "SHARED", ME).get("mercado")?.amount).toBe(800);
    expect(resolveBudgets([closed], "2027-03", "SHARED", ME).size).toBe(0);
  });
  test("exceção de um mês vence a recorrente só naquele mês", () => {
    const once = rule({ amount: 1200, start_month: "2027-01-01", end_month: "2027-01-01" });
    expect(resolveBudgets([r, once], "2027-01", "SHARED", ME).get("mercado")?.amount).toBe(1200);
    expect(resolveBudgets([r, once], "2027-02", "SHARED", ME).get("mercado")?.amount).toBe(800);
  });
});

describe("edição sem reescrever histórico", () => {
  const r = rule({ start_month: "2026-06-01" });
  test("deste mês em diante encerra a anterior e cria nova", () => {
    const ops = planEdit(r, "2027-01", 950, "forward");
    expect(ops).toEqual([
      { type: "update", id: r.id, patch: { end_month: "2026-12-01" } },
      expect.objectContaining({
        type: "insert",
        row: expect.objectContaining({ amount: 950, start_month: "2027-01-01", end_month: null }),
      }),
    ]);
    const after = [
      { ...r, end_month: "2026-12-01" },
      rule({ amount: 950, start_month: "2027-01-01" }),
    ];
    expect(resolveBudgets(after, "2026-08", "SHARED", ME).get("mercado")?.amount).toBe(800);
    expect(resolveBudgets(after, "2028-03", "SHARED", ME).get("mercado")?.amount).toBe(950);
  });
  test("só este mês cria exceção e não toca a regra", () => {
    const ops = planEdit(r, "2027-01", 0, "month");
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      type: "insert",
      row: { start_month: "2027-01-01", end_month: "2027-01-01", amount: 0 },
    });
  });
  test("encerrar preserva meses anteriores", () => {
    expect(planStop(r, "2027-01")).toEqual([
      { type: "update", id: r.id, patch: { end_month: "2026-12-01" } },
    ]);
    expect(planStop(r, "2026-06")).toEqual([{ type: "delete", id: r.id }]);
  });
});

describe("competência, canceladas e isolamento", () => {
  const list = [
    tx({}),
    tx({ amount: 50, status: "CANCELLED" }),
    tx({ amount: 70, transaction_date: "2026-10-31" }),
    tx({ amount: 30, visibility: "PRIVATE", owner_id: ME }),
    tx({ amount: 999, visibility: "PRIVATE", owner_id: PARTNER }),
    tx({ amount: 40, type: "INCOME" }),
  ];
  test("casal conta só compartilhadas do mês, sem canceladas", () => {
    expect(spentByCategory(list, "2026-11", "SHARED", ME).total).toBe(100);
  });
  test("pessoal conta só as minhas privadas, nunca as do parceiro", () => {
    expect(spentByCategory(list, "2026-11", "MINE", ME).total).toBe(30);
    expect(spentByCategory(list, "2026-11", "MINE", PARTNER).total).toBe(999);
  });
  test("orçamento pessoal do parceiro não aparece para mim", () => {
    const theirs = rule({ visibility: "PRIVATE", owner_id: PARTNER });
    expect(resolveBudgets([theirs], "2026-11", "MINE", ME).size).toBe(0);
    expect(resolveBudgets([theirs], "2026-11", "SHARED", ME).size).toBe(0);
  });
  test("orçamento geral compara com todas as despesas do escopo", () => {
    const overall = rule({ category_id: null, amount: 3000 });
    const s = monthBudgetStatus([overall], list, "2026-11", ME);
    expect(s).toEqual([{ scope: "SHARED", categoryId: ALL, budget: 3000, spent: 100 }]);
  });
});

describe("compatibilidade com o limite mensal antigo", () => {
  test("regra migrada do limite da categoria vale desde a criação da categoria", () => {
    const legacy = rule({ from_legacy: true, start_month: "2025-03-01", amount: 450 });
    expect(resolveBudgets([legacy], "2025-03", "SHARED", ME).get("mercado")?.amount).toBe(450);
    expect(resolveBudgets([legacy], "2027-07", "SHARED", ME).get("mercado")?.amount).toBe(450);
  });
});

test("valores em reais", () => {
  expect(parseMoney("1.234,56")).toBe(1234.56);
  expect(parseMoney("800")).toBe(800);
  expect(parseMoney("")).toBeNull();
  expect(parseMoney("-5")).toBeNaN();
});
