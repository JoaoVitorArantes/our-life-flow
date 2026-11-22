import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Capa do casamento para o portal público: o servidor valida a credencial do convite
 * (mesmo resolvedor do portal) e devolve apenas uma URL assinada curta da capa
 * daquele workspace. Credencial inválida → null (resposta uniforme).
 */
export const getPortalCover = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ cred: z.string().min(4).max(200) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: path } = await supabaseAdmin.rpc("wedding_portal_cover_path", {
        _cred: data.cred,
      });
      if (!path || typeof path !== "string") return { url: null as string | null };
      const { data: signed } = await supabaseAdmin.storage
        .from("wedding")
        .createSignedUrl(path, 3600);
      return { url: signed?.signedUrl ?? null };
    } catch {
      return { url: null as string | null };
    }
  });
