import { describe, expect, test } from "bun:test";
import { enabledIds, intentAllowed, toolAllowed, PLUGINS } from "./registry";
describe("Life AI plugin authorization", () => {
  test("internal capabilities preserve existing defaults", () => { expect(toolAllowed("financial_overview", enabledIds([]))).toBe(true); });
  test("disabled tools cannot be dispatched", () => { expect(toolAllowed("financial_overview", enabledIds([{ plugin_id: "finance", enabled: false }]))).toBe(false); });
  test("disabled writes cannot be confirmed", () => { expect(intentAllowed("expense", enabledIds([{ plugin_id: "finance", enabled: false }]))).toBe(false); });
  test("unknown tools and intents fail closed", () => { expect(toolAllowed("fetch_any_url", enabledIds([]))).toBe(false); expect(intentAllowed("send_email", enabledIds([]))).toBe(false); });
  test("unconfigured external providers never execute", () => { expect(enabledIds([{ plugin_id: "google_mail", enabled: true }]).has("google_mail")).toBe(false); });
  test("integrated reads respect disabled dependencies", () => { expect(toolAllowed("contexts", enabledIds([{ plugin_id: "finance", enabled: false }]))).toBe(false); expect(toolAllowed("agenda", enabledIds([{ plugin_id: "routines", enabled: false }]))).toBe(false); });
  test("every write capability requires explicit confirmation", () => { for (const p of PLUGINS.filter((p) => p.intents.length)) expect(p.confirmationRequired).toBe(true); });
});