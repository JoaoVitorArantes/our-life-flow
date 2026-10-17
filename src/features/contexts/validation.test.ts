import { expect, test } from "vitest";
import { contextSchema, contextSaveError } from "./validation";
const base = { name: "Projeto de teste", type: "PROJECT", status: "ACTIVE", visibility: "SHARED" };
test("blank optional context fields are accepted", () => {
  expect(
    contextSchema.parse({
      ...base,
      budget_amount: null,
      start_date: null,
      end_date: null,
      description: null,
      cover_image: null,
    }).name,
  ).toBe("Projeto de teste");
});
test("date-only and numeric formats remain database-compatible", () => {
  expect(
    contextSchema.parse({
      ...base,
      start_date: "2026-10-17",
      end_date: "2026-10-18",
      budget_amount: 1234.56,
    }).budget_amount,
  ).toBe(1234.56);
});
test("invalid dates and negative budgets fail validation", () => {
  expect(contextSchema.safeParse({ ...base, start_date: "2026-02-30" }).success).toBe(false);
  expect(contextSchema.safeParse({ ...base, budget_amount: -1 }).success).toBe(false);
});
test("context errors never expose database details", () => {
  expect(
    contextSaveError({ code: "42703", message: "record new has no field title" }),
  ).not.toContain("record new");
});
