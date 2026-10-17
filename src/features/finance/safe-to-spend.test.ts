import { expect, test } from "vitest";
import type { Account, Transaction, InvoicePayment } from "./queries";
import { applyInvoicePayments, calculateSafeToSpend } from "./safe-to-spend";

const account = { id: "cash", initial_balance: 1000, is_active: true, account_type: "CHECKING" } as Account;
const expense = { id: "expense", type: "EXPENSE", amount: 100, status: "PENDING", transaction_date: "2026-10-17", due_date: "2026-10-20", card_id: null, account_id: "cash" } as Transaction;
test("pending payables reduce free money, cancelled ones do not", () => {
  expect(calculateSafeToSpend([account], [expense], 30, "2026-10-17").safe).toBe(900);
  expect(calculateSafeToSpend([account], [{ ...expense, status: "CANCELLED" }], 30, "2026-10-17").safe).toBe(1000);
});
test("settled expenses move the account once", () => {
  expect(calculateSafeToSpend([account], [{ ...expense, status: "PAID" }], 30, "2026-10-17").safe).toBe(900);
});
test("partial payment reduces its matching invoice commitment", () => {
  const cardExpense = { ...expense, card_id: "card" };
  const payment = { card_id: "card", due_date: "2026-10-20", amount: 40 } as InvoicePayment;
  expect(applyInvoicePayments([cardExpense], [payment]).map((t) => t.amount)).toEqual([60]);
});