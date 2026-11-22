import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeReading, RECEIPT_MAX_BYTES, receiptFileOk } from "@/features/receipts/contracts";

const input = z.object({
  workspaceId: z.string().uuid(),
  path: z.string().min(40).max(300),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Lê uma nota já enviada ao armazenamento privado. O arquivo é baixado com o cliente RLS do
 * usuário (só membros do espaço conseguem), e o caminho precisa ficar na pasta do espaço.
 * Não grava nada: a gravação só acontece após o usuário revisar e confirmar.
 */
export const readReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) return { ok: false as const, error: "Você não participa deste espaço." };
    if (!data.path.startsWith(`${data.workspaceId}/`) || data.path.includes(".."))
      return { ok: false as const, error: "Arquivo inválido." };
    const { data: blob, error } = await supabase.storage.from("receipts").download(data.path);
    if (error || !blob) return { ok: false as const, error: "Arquivo não encontrado." };
    const fileError = receiptFileOk(blob.type, blob.size);
    if (fileError || blob.size > RECEIPT_MAX_BYTES)
      return { ok: false as const, error: fileError ?? "Arquivo grande demais." };
    const { readReceiptWithAi, ReceiptAiError } = await import("./receipts.server");
    try {
      const name = data.path.split("/").pop() ?? "nota";
      const reading = await readReceiptWithAi(
        await blob.arrayBuffer(),
        blob.type,
        name,
        data.today,
      );
      return { ok: true as const, reading: normalizeReading(reading, data.today) };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof ReceiptAiError ? e.message : "Não foi possível ler este arquivo agora.",
      };
    }
  });
