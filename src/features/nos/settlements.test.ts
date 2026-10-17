import { expect, test, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { computeTransfer, netBalance, type Settlement } from "./settlements";

test("equal split with one payer produces half-value settlement", () => {
  expect(
    computeTransfer(
      [
        { userId: "a", amount: 50 },
        { userId: "b", amount: 50 },
      ],
      [{ userId: "a", amount: 100 }],
    ),
  ).toEqual({ fromUserId: "b", toUserId: "a", amount: 50 });
});
test("paid settlements do not count in outstanding balance", () => {
  const pending = {
    from_user_id: "b",
    to_user_id: "a",
    amount: 50,
    status: "PENDING",
  } as Settlement;
  const paid = { ...pending, amount: 20, status: "SETTLED" } as Settlement;
  expect(netBalance([pending, paid], "a").net).toBe(50);
});
