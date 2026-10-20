import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLUGINS, catalogState } from "./registry";
import { intentSchema } from "./contracts";
import { actionSchema } from "./action-schema";
import { CAPABILITIES } from "./capabilities";

export const getCapabilityHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readCapabilityHistory } = await import("./history.server");
    return readCapabilityHistory(context.supabase, context.userId);
  });

export const getPluginCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", context.userId)
      .single();
    if (error || !profile.active_workspace_id)
      throw new Error("Selecione um espaço para configurar os plugins.");
    const { loadPluginAccess } = await import("./access.server");
    const enabled = await loadPluginAccess(
      context.supabase,
      context.userId,
      profile.active_workspace_id,
    );
    const { data: prefs, error: prefsError } = await context.supabase
      .from("ai_plugin_preferences")
      .select("plugin_id,enabled")
      .eq("workspace_id", profile.active_workspace_id)
      .eq("user_id", context.userId);
    if (prefsError) throw new Error("Não foi possível carregar os plugins.");
    return {
      workspaceId: profile.active_workspace_id,
      plugins: PLUGINS.map((p) => ({
        ...p,
        enabled: enabled.has(p.id),
        requestedEnabled: prefs?.find((r) => r.plugin_id === p.id)?.enabled ?? p.defaultEnabled,
        capabilities: CAPABILITIES.filter((c) => p.tools.includes(c.id)),
        state: catalogState(p, enabled, prefs ?? []),
      })),
    };
  });
export const setPluginEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ pluginId: z.string().max(80), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const plugin = PLUGINS.find((p) => p.id === data.pluginId && p.category === "internal");
    if (!plugin) throw new Error("Este plugin não está disponível para ativação.");
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", context.userId)
      .single();
    if (error || !profile.active_workspace_id) throw new Error("Selecione um espaço.");
    const { loadPluginAccess } = await import("./access.server");
    const enabled = await loadPluginAccess(
      context.supabase,
      context.userId,
      profile.active_workspace_id,
    );
    if (plugin.id === "workspace" && data.enabled && !enabled.has("workspace")) {
      const { data: allowed } = await context.supabase.rpc("workspace_can", {
        _workspace_id: profile.active_workspace_id,
        _action: "manage_workspace",
      });
      if (!allowed) throw new Error("Você não tem permissão para administrar este espaço.");
    }
    const { error: saveError } = await context.supabase.from("ai_plugin_preferences").upsert({
      workspace_id: profile.active_workspace_id,
      user_id: context.userId,
      plugin_id: plugin.id,
      enabled: data.enabled,
    });
    if (saveError) throw new Error("Não foi possível atualizar o plugin.");
    return { ok: true };
  });
export const authorizePluginAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        intent: intentSchema,
        expectedWorkspaceId: z.string().uuid(),
        confirmed: z.literal(true),
        action: actionSchema,
        threadId: z.string().uuid().optional(),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("active_workspace_id")
      .eq("id", context.userId)
      .single();
    if (
      error ||
      !profile.active_workspace_id ||
      profile.active_workspace_id !== data.expectedWorkspaceId
    )
      throw new Error(
        "O espaço ativo mudou. Abra a conversa no espaço correto antes de confirmar.",
      );
    if (data.action.intent !== data.intent) throw new Error("A prévia mudou. Confira a ação.");
    if (data.threadId) {
      const { data: thread, error: threadError } = await context.supabase
        .from("ai_conversations")
        .select("workspace_id")
        .eq("id", data.threadId)
        .maybeSingle();
      if (threadError || thread?.workspace_id !== profile.active_workspace_id)
        throw new Error("Esta conversa não pertence ao espaço ativo.");
    }
    const { requirePluginIntent } = await import("./access.server");
    await requirePluginIntent(
      context.supabase,
      context.userId,
      profile.active_workspace_id,
      data.intent,
    );
    const { validateActionReferences } = await import("./references.server");
    await validateActionReferences(context.supabase, profile.active_workspace_id, data.action);
    const { writeCapabilityAudit } = await import("./audit.server");
    const runId = crypto.randomUUID();
    await writeCapabilityAudit(
      context.supabase,
      { workspaceId: profile.active_workspace_id, userId: context.userId },
      runId,
      data.intent,
      "success",
      "accepted",
    );
    return { workspaceId: profile.active_workspace_id, userId: context.userId };
  });
