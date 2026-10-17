import { expect, test } from "vitest";
import { addMonths, cardDueDate, invoiceDueDateFor, splitInstallments } from "./calc";

test("month addition clamps to leap-day", () => {
  expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
});
test("installments preserve the full amount in cents", () => {
  expect(splitInstallments(100, 3)).toEqual([33.33, 33.33, 33.34]);
});
test("invoice due date moves after closing", () => {
  expect(cardDueDate("2026-10-25", 5)).toBe("2026-11-05");
  expect(invoiceDueDateFor("2026-10-26", 25, 5)).toBe("2026-12-05");
});
