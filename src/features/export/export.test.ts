import { expect, test, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { toCsv } from "./export";

test("CSV neutralizes formula text including leading whitespace", () => {
  expect(toCsv([{ title: "=1+1", note: " @SUM(1)", amount: -10 }])).toBe(
    "title,note,amount\n'=1+1,' @SUM(1),-10",
  );
});
test("CSV preserves quote and delimiter escaping", () => {
  expect(toCsv([{ title: 'a,"b"' }])).toBe('title\n"a,""b"""');
});
