import { describe, expect, test } from "vitest";
import {
  pluginSchema,
  readInputSchemas,
  intentSchema,
  toolNameSchema,
  validateToolOutput,
} from "./contracts";
import { actionSchema } from "./action-schema";
import { PLUGINS, enabledIds, validateRegistry, catalogState } from "./registry";
import { buildTools, type AgentCtx, type Base } from "@/lib/agent/tools.server";

describe("closed capability contract", () => {
  test("actual buildTools and registry cover every executable name bidirectionally", () => {
    const ctx = {
      supabase: {},
      workspaceId: "w",
      userId: "u",
      today: "2026-10-18",
      enabledPlugins: enabledIds([]),
      executionRunId: "r",
    } as unknown as AgentCtx;
    const base: Base = {
      workspace: { name: "test", description: null, members: 0 },
      accounts: [],
      cards: [],
      categories: [],
      contexts: [],
      goals: [],
      people: [],
    };
    const executable = Object.keys(buildTools(ctx, base)).sort();
    expect(executable).toEqual([...toolNameSchema.options].sort());
    expect(executable.filter((n) => n !== "propose_action")).toEqual(
      PLUGINS.flatMap((p) => p.tools).sort(),
    );
    expect(PLUGINS.flatMap((p) => p.intents).sort()).toEqual(
      [...actionSchema.shape.intent.options].sort(),
    );
    expect([...intentSchema.options].sort()).toEqual([...actionSchema.shape.intent.options].sort());
  });
  test("missing tools, duplicate mappings and invented external capabilities reject", () => {
    const finance = PLUGINS.find((p) => p.id === "finance");
    expect(finance).toBeDefined();
    if (!finance) return;
    expect(() =>
      validateRegistry(PLUGINS.map((p) => (p.id === "finance" ? { ...p, tools: [] } : p))),
    ).toThrow("Missing");
    expect(() => validateRegistry([...PLUGINS, finance])).toThrow("Duplicate");
    expect(pluginSchema.safeParse({ ...finance, category: "external" }).success).toBe(false);
    expect(
      pluginSchema.safeParse({ ...finance, configuration: { secret: "not-allowed" } }).success,
    ).toBe(false);
  });
  test("dates, ranges and hidden identity fields validate strictly", () => {
    expect(
      readInputSchemas.agenda.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success,
    ).toBe(false);
    expect(
      readInputSchemas.agenda.safeParse({ from: "2026-10-20", to: "2026-10-18" }).success,
    ).toBe(false);
    expect(readInputSchemas.tasks.safeParse({ scope: "open", workspace_id: "other" }).success).toBe(
      false,
    );
    expect(readInputSchemas.financial_overview.safeParse({ horizon_days: 30 }).success).toBe(true);
    expect(readInputSchemas.financial_overview.safeParse({ horizon_days: NaN }).success).toBe(
      false,
    );
  });
  test("failed, wrong-shape and nonfinite outputs cannot become successes", () => {
    expect(() => validateToolOutput("goals", { error: "query failed" })).toThrow();
    expect(() => validateToolOutput("goals", {})).toThrow();
    expect(() => validateToolOutput("financial_overview", { total: Infinity })).toThrow();
    expect(validateToolOutput("goals", [])).toEqual([]);
  });
  test("dependent catalog reports unavailable while preserving preference", () => {
    const agenda = PLUGINS.find((p) => p.id === "agenda");
    const external = PLUGINS.find((p) => p.id === "google_mail");
    if (!agenda || !external) throw new Error("Expected catalog entries");
    expect(catalogState(agenda, enabledIds([{ plugin_id: "routines", enabled: false }]), [])).toBe(
      "permission_required",
    );
    expect(catalogState(agenda, enabledIds([]), [{ plugin_id: "agenda", enabled: false }])).toBe(
      "disabled",
    );
    expect(catalogState(external, new Set([external.id]), [])).toBe("not_connected");
    expect(catalogState({ ...external, connection: "coming_soon" }, new Set(), [])).toBe(
      "coming_soon",
    );
  });
});
