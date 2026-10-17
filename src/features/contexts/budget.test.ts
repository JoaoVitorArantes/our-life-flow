import { expect, test } from "vitest";
import { parseContextBudget } from "./budget";

test("blank budget stays null", () => {
  expect(parseContextBudget(" ")).toBeNull();
});
test("Brazilian and decimal budgets preserve their value", () => {
  expect(parseContextBudget("R$ 1.234,56")).toBe(1234.56);
  expect(parseContextBudget("1234.56")).toBe(1234.56);
  expect(parseContextBudget("1.234")).toBe(1234);
});
test("malformed or negative budgets never become zero", () => {
  for (const value of ["1..2", ",", "1,2,3", "-1", "NaN", "Infinity"])
    expect(() => parseContextBudget(value)).toThrow();
});