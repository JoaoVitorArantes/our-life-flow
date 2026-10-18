import type { z } from "zod";
import type { actionSchema } from "@/features/plugins/action-schema";
import { supabase } from "@/integrations/supabase/client";
import { createContext, updateContext, deleteContext, type ContextInput } from "./queries";
import { contextCreateInput, contextProposalSchema } from "./ai-contract";
import { contextSaveError } from "./validation";

/** Called only by the confirmed Inbox executor, using its server-verified identity. */
export async function executeContextAction(
  action: z.infer<typeof actionSchema>,
  workspaceId: string,
  userId: string,
) {
  try {
    let id: string;
    if (action.intent === "create_context") {
      const saved = await createContext(workspaceId, userId, contextCreateInput(action.description, action.context_data));
      id = saved.id;
    } else {
      if (!action.context_id) throw new Error("Missing context selection");
      id = action.context_id;
      if (action.intent === "delete_context") {
        await deleteContext(id);
        const { data, error } = await supabase.from("contexts").select("id").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
        if (error || data) throw new Error("Trash outcome unverified");
        return { id, module: "Contextos", href: "/configuracoes/dados" };
      }
      const fields = contextProposalSchema.parse(action.context_data ?? {});
      // Remove undefined only; explicit null still clears nullable fields.
      const patch = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<ContextInput>;
      await updateContext(id, action.intent === "archive_context" ? { status: "ARCHIVED" } : { ...patch, name: action.description }, workspaceId);
    }
    const { data, error } = await supabase.from("contexts").select("id,name,status").eq("workspace_id", workspaceId).eq("id", id).single();
    if (error || !data?.id) throw new Error("Persistence unverified");
    return { id: data.id, module: "Contextos", href: `/contextos/${data.id}` };
  } catch (error) {
    throw new Error(contextSaveError(error));
  }
}