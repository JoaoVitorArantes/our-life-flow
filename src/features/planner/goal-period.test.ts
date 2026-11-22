import { expect, test } from "vitest";
import { currentGoalPeriod, sumInWindow } from "./goal-period";

const base = { created_at: "2026-11-05T12:00:00Z" };

test("meta mensal continua depois da virada do ano", () => {
  const g = { ...base, recurrence: "MONTHLY" };
  expect(currentGoalPeriod(g, "2027-01-15")).toMatchObject({
    state: "period",
    from: "2027-01-01",
    to: "2027-01-31",
    index: 3,
  });
  expect(currentGoalPeriod(g, "2031-02-10")).toMatchObject({
    from: "2031-02-01",
    to: "2031-02-28",
  });
});
test("meta anual ancorada no início, não no ano civil", () => {
  const g = { ...base, start_date: "2026-03-10", recurrence: "YEARLY" };
  expect(currentGoalPeriod(g, "2027-02-01")).toMatchObject({
    from: "2026-03-01",
    to: "2027-02-28",
  });
  expect(currentGoalPeriod(g, "2027-03-01")).toMatchObject({
    from: "2027-03-01",
    to: "2028-02-29",
    index: 2,
  });
});
test("personalizada a cada 3 meses", () => {
  const g = { ...base, start_date: "2026-01-01", recurrence: "CUSTOM", recurrence_months: 3 };
  expect(currentGoalPeriod(g, "2027-05-20")).toMatchObject({
    from: "2027-04-01",
    to: "2027-06-30",
  });
});
test("contínua sem prazo nunca termina; com prazo termina", () => {
  expect(currentGoalPeriod({ ...base }, "2040-01-01").state).toBe("open");
  expect(currentGoalPeriod({ ...base, due_date: "2027-06-30" }, "2027-07-01").state).toBe("ended");
  expect(currentGoalPeriod({ ...base, start_date: "2027-02-01" }, "2027-01-01").state).toBe(
    "not_started",
  );
});
test("progresso do período usa os registros reais da janela", () => {
  const items = [
    { contribution_date: "2027-01-05", amount: 300, movement_type: "CONTRIBUTION" },
    { contribution_date: "2027-01-20", amount: 50, movement_type: "WITHDRAWAL" },
    { contribution_date: "2026-12-31", amount: 999, movement_type: "CONTRIBUTION" },
  ];
  expect(sumInWindow(items, "2027-01-01", "2027-01-31")).toBe(250);
});
