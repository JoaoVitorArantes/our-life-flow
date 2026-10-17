import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLUGINS } from "./registry";

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
        state:
          p.category === "external"
            ? p.connection
            : p.id === "workspace" &&
                !enabled.has("workspace") &&
                (prefs?.find((r) => r.plugin_id === p.id)?.enabled ?? true)
              ? "permission_required"
              : enabled.has(p.id)
                ? "enabled"
                : "disabled",
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
    z.object({ intent: z.string().max(80), expectedWorkspaceId: z.string().uuid() }).parse(input),
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
    const { requirePluginIntent } = await import("./access.server");
    await requirePluginIntent(
      context.supabase,
      context.userId,
      profile.active_workspace_id,
      data.intent,
    );
    return { workspaceId: profile.active_workspace_id, userId: context.userId };
  });
