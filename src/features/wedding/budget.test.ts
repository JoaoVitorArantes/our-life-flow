import { describe, expect, it } from "vitest";
import {
  byCategory,
  byMonth,
  filterItems,
  itemTotals,
  overview,
  parseMoney,
  type BItem,
  type BPayment,
} from "./budget";

const TODAY = "2027-05-10";
let seq = 0;
const item = (p: Partial<BItem> = {}): BItem => ({
  id: `i${++seq}`,
  name: "Buffet",
  category_id: "buffet",
  supplier_id: null,
  planned_amount: null,
  contracted_amount: null,
  status: "planned",
  due_date: null,
  notes: null,
  ...p,
});
const pay = (item_id: string, amount: number, paid_on = "2027-03-01"): BPayment => ({
  id: `p${++seq}`,
  item_id,
  amount,
  paid_on,
});

describe("item do orçamento do casamento", () => {
  it("pagamentos parciais calculam o que falta sem duplicar", () => {
    const i = item({ contracted_amount: 10000, status: "contracted" });
    const ps = [pay(i.id, 3000), pay(i.id, 2000)];
    const t = itemTotals(i, ps, TODAY);
    expect(t.paid).toBe(5000);
    expect(t.pending).toBe(5000);
    expect(t.payState).toBe("partial");
    expect(t.committed).toBe(10000);
  });

  it("sem valor contratado não presume saldo nem zero", () => {
    const i = item({ planned_amount: 8000 });
    const t = itemTotals(i, [], TODAY);
    expect(t.pending).toBeNull();
    expect(t.payState).toBe("unknown");
    expect(t.committed).toBe(0);
  });

  it("quitado e pago a mais", () => {
    const i = item({ contracted_amount: 1000 });
    expect(itemTotals(i, [pay(i.id, 1000)], TODAY).payState).toBe("paid");
    const over = itemTotals(i, [pay(i.id, 1200)], TODAY);
    expect(over.payState).toBe("over");
    expect(over.pending).toBe(0);
    expect(over.committed).toBe(1200);
  });

  it("vencimento só aparece com data e algo em aberto", () => {
    expect(
      itemTotals(item({ due_date: "2027-05-01", contracted_amount: 500 }), [], TODAY).due,
    ).toBe("overdue");
    expect(
      itemTotals(item({ due_date: "2027-05-20", contracted_amount: 500 }), [], TODAY).due,
    ).toBe("soon");
    expect(
      itemTotals(item({ due_date: "2027-08-20", contracted_amount: 500 }), [], TODAY).due,
    ).toBe("later");
    expect(itemTotals(item({ contracted_amount: 500 }), [], TODAY).due).toBe("none");
    const paid = item({ due_date: "2027-05-01", contracted_amount: 500 });
    expect(itemTotals(paid, [pay(paid.id, 500)], TODAY).due).toBe("none");
    expect(itemTotals(item({ due_date: "2027-05-01", status: "cancelled" }), [], TODAY).due).toBe(
      "none",
    );
  });

  it("cancelado conta só o que já foi pago", () => {
    const i = item({ contracted_amount: 4000, status: "cancelled" });
    const t = itemTotals(i, [pay(i.id, 500)], TODAY);
    expect(t.pending).toBeNull();
    expect(t.committed).toBe(500);
  });
});

describe("visão geral", () => {
  it("totais vêm só dos registros; avulsas entram no pago e no comprometido", () => {
    const a = item({ planned_amount: 12000, contracted_amount: 10000 });
    const b = item({ planned_amount: 3000 });
    const c = item({});
    const d = item({ contracted_amount: 2000, status: "cancelled" });
    const ps = [pay(a.id, 4000), pay(d.id, 300)];
    const o = overview(50000, [a, b, c, d], ps, [{ amount: 700, spent_on: "2027-02-01" }], TODAY);
    expect(o.planned).toBe(15000);
    expect(o.contracted).toBe(10000);
    expect(o.paidItems).toBe(4300);
    expect(o.paid).toBe(5000);
    expect(o.pending).toBe(6000);
    expect(o.committed).toBe(10000 + 300 + 700);
    expect(o.remaining).toBe(50000 - 11000);
    expect(o.withoutValue).toBe(1);
  });

  it("sem orçamento total não inventa saldo", () => {
    expect(overview(null, [], []).remaining).toBeNull();
    const empty = overview(null, [], []);
    expect([empty.planned, empty.contracted, empty.paid, empty.pending]).toEqual([0, 0, 0, 0]);
  });
});

describe("por categoria e período", () => {
  it("agrupa por categoria, inclusive sem categoria", () => {
    const a = item({ category_id: "foto", contracted_amount: 5000 });
    const b = item({ category_id: null, planned_amount: 100 });
    const g = byCategory([a, b], [pay(a.id, 1000)], ["foto", "buffet"]);
    expect(g.map((x) => x.id)).toEqual(["foto", "none"]);
    expect(g[0]!.pending).toBe(4000);
    expect(g[1]!.planned).toBe(100);
  });

  it("meses de qualquer ano: 2026, 2027, 2028 e 2040", () => {
    const a = item({ contracted_amount: 9000, due_date: "2028-02-15" });
    const ps = [
      pay(a.id, 1000, "2026-12-20"),
      pay(a.id, 2000, "2027-01-05"),
      pay(a.id, 500, "2040-07-01"),
    ];
    const exp = [{ amount: 50, spent_on: "2027-01-30" }];
    expect(byMonth(2026, [a], ps, exp)[11]!.paid).toBe(1000);
    expect(byMonth(2027, [a], ps, exp)[0]!.paid).toBe(2050);
    const feb28 = byMonth(2028, [a], ps, exp)[1]!;
    expect(feb28.duePending).toBe(9000 - 3500);
    expect(feb28.dueItems).toHaveLength(1);
    expect(byMonth(2040, [a], ps, exp)[6]!.paid).toBe(500);
    const total2027 = byMonth(2027, [a], ps, exp).reduce((s, m) => s + m.paid, 0);
    expect(total2027).toBe(2050);
  });
});

describe("filtros e busca", () => {
  const a = item({
    name: "Fotógrafo Ana",
    category_id: "foto",
    contracted_amount: 100,
    due_date: "2027-01-01",
  });
  const b = item({ name: "Vestido", category_id: "roupa", notes: "ajuste incluso" });
  const c = item({ name: "DJ", category_id: "musica", contracted_amount: 50 });
  const ps = [pay(c.id, 50)];
  const all = { q: "", category: "all", status: "all", pay: "all" } as const;
  it("busca por nome e observação", () => {
    expect(filterItems([a, b, c], ps, { ...all, q: "ajuste" }, undefined, TODAY)).toEqual([b]);
    expect(filterItems([a, b, c], ps, { ...all, q: "fotó" }, undefined, TODAY)).toEqual([a]);
    expect(filterItems([a, b, c], ps, { ...all, q: "FOTO" }, undefined, TODAY)).toEqual([a]);
  });
  it("filtra vencidos, quitados e sem valor", () => {
    expect(filterItems([a, b, c], ps, { ...all, pay: "overdue" }, undefined, TODAY)).toEqual([a]);
    expect(filterItems([a, b, c], ps, { ...all, pay: "paid" }, undefined, TODAY)).toEqual([c]);
    expect(filterItems([a, b, c], ps, { ...all, pay: "novalue" }, undefined, TODAY)).toEqual([b]);
    expect(filterItems([a, b, c], ps, { ...all, category: "roupa" }, undefined, TODAY)).toEqual([
      b,
    ]);
  });
});

it("valores em reais", () => {
  expect(parseMoney("1.500,50")).toBe(1500.5);
  expect(parseMoney("25.000")).toBe(25000);
  expect(parseMoney("1.250.000")).toBe(1250000);
  expect(parseMoney("12.5")).toBe(12.5);
  expect(parseMoney("5000")).toBe(5000);
  expect(parseMoney("")).toBeNull();
  expect(parseMoney("-3")).toBeNaN();
});
