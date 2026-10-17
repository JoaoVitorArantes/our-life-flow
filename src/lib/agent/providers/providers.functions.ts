import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProviderCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: member, error } = await context.supabase.rpc("is_workspace_member", {
      _workspace_id: data.workspaceId,
    });
    if (error || member !== true) throw new Error("Este espaço não está disponível.");
    const { providerCatalog } = await import("./catalog.server");
    return {
      personalStoreAvailable: false as const,
      providers: await providerCatalog(data.workspaceId),
    };
  });
