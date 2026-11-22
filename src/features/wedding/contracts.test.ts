import { describe, expect, it } from "vitest";
import {
  computeSummary,
  duplicateInput,
  itemInputSchema,
  monthsFrom,
  moveInOrder,
  SUGGESTED_INVENTORY,
  DEFAULT_PLAN,
  optionInputSchema,
  type ItemInput,
} from "./contracts";

const uuid = "00000000-0000-4000-8000-000000000000";
const base: ItemInput = {
  room_id: uuid,
  name: "Sofá",
  description: null,
  quantity: 1,
  priority_id: null,
  status_id: null,
  price_low: null,
  price_target: 10,
  price_high: null,
  price_actual: 900,
  responsible_user_id: null,
  links: [],
  notes: null,
  image_path: null,
};

describe("casamento", () => {
  it("estimativa soma preço-meta × quantidade; comprado vem dos status marcados como compra", () => {
    const s = computeSummary(
      [
        { room_id: "r1", quantity: 2, priority_id: "p1", price_target: 100, status_id: "bought" },
        { room_id: "r1", quantity: 1, priority_id: "p2", price_target: null, status_id: "plan" },
      ],
      [{ amount: 50 }, { amount: 30 }],
      [{ amount: 190 }],
      [{ target_amount: 500 }],
      new Set(["bought"]),
    );
    expect(s.estimated).toBe(200);
    expect(s.itemsWithoutPrice).toBe(1);
    expect(s.boughtItems).toBe(1);
    expect(s.remainingToSave).toBe(120);
    expect(s.byPriority["p1"]).toEqual({ total: 1, bought: 1 });
    expect(s.byPriority["p2"]).toEqual({ total: 1, bought: 0 });
  });
  it("sem nenhum preço, 'falta economizar' fica indefinido em vez de R$ 0", () => {
    const s = computeSummary(
      [{ room_id: "r", quantity: 1, priority_id: null, price_target: null, status_id: null }],
      [],
      [],
      [],
    );
    expect(s.remainingToSave).toBeNull();
  });
  it("inventário sugerido não traz preços", () => {
    for (const room of SUGGESTED_INVENTORY) for (const it of room.items) expect(it).toHaveLength(3);
  });
  it("premissas sem datas nem orçamento presumidos", () => {
    expect(DEFAULT_PLAN.savings_start).toBe("2027-01-01");
    expect(DEFAULT_PLAN.wedding_date).toBeNull();
    expect(DEFAULT_PLAN.move_in_date).toBeNull();
    expect(DEFAULT_PLAN.total_budget).toBeNull();
  });
  it("metas mensais a partir de jan/2027", () => {
    expect(monthsFrom("2027-11-01", 3)).toEqual(["2027-11-01", "2027-12-01", "2028-01-01"]);
  });
  it("rejeita preço negativo e campo extra", () => {
    expect(itemInputSchema.safeParse({ ...base, price_target: -1 }).success).toBe(false);
    expect(itemInputSchema.safeParse({ ...base, owner: "x" }).success).toBe(false);
  });
  it("duplicar zera preço real e volta ao status inicial", () => {
    const d = duplicateInput({ ...base, status_id: uuid }, null);
    expect(d.price_actual).toBeNull();
    expect(d.status_id).toBeNull();
    expect(d.name).toBe("Sofá (cópia)");
  });
  it("reordenar troca com o vizinho e ignora extremos", () => {
    const l = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moveInOrder(l, "b", -1).map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(moveInOrder(l, "a", -1)).toEqual([]);
  });
  it("prioridade personalizada exige nome e cor permitida", () => {
    expect(optionInputSchema.safeParse({ label: "Urgente", color: "plum" }).success).toBe(true);
    expect(optionInputSchema.safeParse({ label: "", color: "plum" }).success).toBe(false);
    expect(optionInputSchema.safeParse({ label: "X", color: "#ff0000" }).success).toBe(false);
  });
});
