import { expect, test, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { occursOn, type Routine } from "./queries";

const routine = { status: "ACTIVE", start_date: "2026-01-31", frequency: "MONTHLY", weekdays: [], month_days: [] } as unknown as Routine;
test("monthly occurrence clamps to the final day", () => {
  expect(occursOn(routine, "2026-02-28")).toBe(true);
  expect(occursOn(routine, "2026-02-27")).toBe(false);
});
test("paused and not-yet-started routines never occur", () => {
  expect(occursOn({ ...routine, status: "PAUSED" }, "2026-02-28")).toBe(false);
  expect(occursOn(routine, "2026-01-30")).toBe(false);
});