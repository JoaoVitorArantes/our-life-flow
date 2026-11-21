import { describe, expect, it } from "vitest";
import {
  computeSummary,
  itemInputSchema,
  monthsFrom,
  SUGGESTED_INVENTORY,
  DEFAULT_PLAN,
} from "./contracts";

describe("casamento", () => {
  it("estimativa soma preço-meta × quantidade e conta itens sem preço", () => {
    const s = computeSummary(
      [
        { room_id: "r1", quantity: 2, priority: "P1", price_target: 100, status: "bought" },
        { room_id: "r1", quantity: 1, priority: "P2", price_target: null, status: "planned" },
      ],
      [{ amount: 50 }, { amount: 30 }],
      [{ amount: 190 }],
      [{ target_amount: 500 }],
    );
    expect(s.estimated).toBe(200);
    expect(s.itemsWithoutPrice).toBe(1);
    expect(s.saved).toBe(80);
    expect(s.spent).toBe(190);
    expect(s.remainingToSave).toBe(120);
    expect(s.byPriority.P1).toEqual({ total: 1, bought: 1 });
  });
  it("inventário sugerido não traz preços", () => {
    for (const room of SUGGESTED_INVENTORY) for (const it of room.items) expect(it).toHaveLength(3);
  });
  it("premissas do casal sem datas nem orçamento presumidos", () => {
    expect(DEFAULT_PLAN.savings_start).toBe("2027-01-01");
    expect(DEFAULT_PLAN.wedding_date).toBeNull();
    expect(DEFAULT_PLAN.move_in_date).toBeNull();
    expect(DEFAULT_PLAN.total_budget).toBeNull();
  });
  it("metas mensais começam em jan/2027", () => {
    expect(monthsFrom("2027-01-01", 3)).toEqual(["2027-01-01", "2027-02-01", "2027-03-01"]);
    expect(monthsFrom("2027-11-01", 3)[2]).toBe("2028-01-01");
  });
  it("rejeita preço negativo e campo extra", () => {
    const base = {
      room_id: "00000000-0000-4000-8000-000000000000",
      name: "Sofá",
      quantity: 1,
      priority: "P1",
      price_low: null,
      price_target: -1,
      price_high: null,
      price_actual: null,
      status: "planned",
      responsible_user_id: null,
      links: [],
      notes: null,
    };
    expect(itemInputSchema.safeParse(base).success).toBe(false);
    expect(itemInputSchema.safeParse({ ...base, price_target: 10, owner: "x" }).success).toBe(
      false,
    );
  });
});
