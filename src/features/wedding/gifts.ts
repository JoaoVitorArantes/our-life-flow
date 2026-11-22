import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { GiftKind, PledgeState } from "./gift-contracts";

export type WeddingGift = Tables<"wedding_gifts">;
export type WeddingGiftPledge = Tables<"wedding_gift_pledges">;
export type WeddingGiftSettings = Tables<"wedding_gift_settings">;

/** Lê presentes, reservas e ajustes do espaço do casal (RLS por membro). Vence pendentes antes de ler. */
export function useGiftsData(workspaceId?: string) {
  const gifts = useQuery({
    queryKey: ["wedding_gifts", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_gifts")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("sort_order")
        .order("created_at")
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const pledges = useQuery({
    queryKey: ["wedding_gift_pledges", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      await supabase.rpc("wedding_gift_refresh", { _workspace_id: workspaceId! });
      const { data, error } = await supabase
        .from("wedding_gift_pledges")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });
  const settings = useQuery({
    queryKey: ["wedding_gift_settings", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_gift_settings")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return {
    loading: gifts.isLoading || pledges.isLoading || settings.isLoading,
    error: gifts.error ?? pledges.error ?? settings.error ?? null,
    gifts: gifts.data ?? [],
    pledges: pledges.data ?? [],
    settings: settings.data ?? null,
  };
}

export function useGiftMutations(workspaceId?: string, userId?: string) {
  const qc = useQueryClient();
  const inv = (...t: string[]) =>
    Promise.all(t.map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const need = () => {
    if (!workspaceId || !userId) throw new Error("Sessão ou espaço indisponível.");
    return { workspaceId, userId };
  };
  const rpcError = (e: { message: string } | null) => {
    if (e) throw new Error(e.message);
  };
  return {
    createGift: useMutation({
      mutationFn: async (
        input: Omit<TablesInsert<"wedding_gifts">, "workspace_id" | "created_by">,
      ) => {
        const s = need();
        const { data, error } = await supabase
          .from("wedding_gifts")
          .insert({ ...input, workspace_id: s.workspaceId, created_by: s.userId })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      },
      onSuccess: () => inv("wedding_gifts"),
    }),
    updateGift: useMutation({
      mutationFn: async ({ id, ...patch }: { id: string } & TablesUpdate<"wedding_gifts">) => {
        const { error } = await supabase
          .from("wedding_gifts")
          .update(patch)
          .eq("id", id)
          .eq("workspace_id", need().workspaceId);
        if (error) throw error;
      },
      onSuccess: () => inv("wedding_gifts"),
    }),
    deleteGift: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase
          .from("wedding_gifts")
          .delete()
          .eq("id", id)
          .eq("workspace_id", need().workspaceId);
        if (error) throw new Error(error.message);
      },
      onSuccess: () => inv("wedding_gifts"),
    }),
    saveSettings: useMutation({
      mutationFn: async (
        input: Omit<TablesInsert<"wedding_gift_settings">, "workspace_id" | "created_by">,
      ) => {
        const s = need();
        const { error } = await supabase
          .from("wedding_gift_settings")
          .upsert(
            { ...input, workspace_id: s.workspaceId, created_by: s.userId },
            { onConflict: "workspace_id" },
          );
        if (error) throw error;
      },
      onSuccess: () => inv("wedding_gift_settings"),
    }),
    confirm: useMutation({
      mutationFn: async ({ id, amount }: { id: string; amount?: number | undefined }) => {
        const { error } = await supabase.rpc(
          "wedding_gift_confirm",
          amount != null ? { _pledge: id, _amount: amount } : { _pledge: id },
        );
        rpcError(error);
      },
      onSuccess: () => inv("wedding_gift_pledges"),
    }),
    cancel: useMutation({
      mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
        if (!reason.trim()) throw new Error("Informe o motivo do cancelamento.");
        const { error } = await supabase.rpc("wedding_gift_cancel", {
          _pledge: id,
          _reason: reason.trim().slice(0, 200),
        });
        rpcError(error);
      },
      onSuccess: () => inv("wedding_gift_pledges"),
    }),
    reopen: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.rpc("wedding_gift_reopen", { _pledge: id });
        rpcError(error);
      },
      onSuccess: () => inv("wedding_gift_pledges"),
    }),
  };
}

/* ---------- Portal do convidado (sem login) ---------- */
export interface PortalGift {
  id: string;
  kind: GiftKind;
  title: string;
  description: string | null;
  external_url: string | null;
  quota_amount: number | null;
  suggested_amount: number | null;
  total: number | null;
  available: number | null;
}
export interface PortalPledge {
  id: string;
  gift_title: string;
  kind: GiftKind;
  units: number | null;
  amount: number | null;
  state: PledgeState;
  expires_at: string;
  message: string | null;
  created_at: string;
}
export interface PortalGiftsData {
  ok: true;
  enabled: boolean;
  pending_days: number;
  gifts: PortalGift[];
  my_pledges: PortalPledge[];
  payment: null | {
    pix_key_type: string | null;
    pix_key: string | null;
    pix_receiver_name: string | null;
    instructions: string | null;
    delivery_instructions: string | null;
  };
}
export type PortalGiftsResult = PortalGiftsData | { ok: false; error?: string };

export async function portalGifts(cred: string): Promise<PortalGiftsResult> {
  const { data, error } = await supabase.rpc("wedding_portal_gifts", { _cred: cred });
  if (error) return { ok: false };
  return data as unknown as PortalGiftsResult;
}

export async function portalPledge(
  cred: string,
  giftId: string,
  units: number | null,
  amount: number | null,
  message: string,
): Promise<PortalGiftsResult> {
  const { data, error } = await supabase.rpc("wedding_portal_pledge", {
    _cred: cred,
    _gift: giftId,
    _units: units as unknown as number,
    _amount: amount as unknown as number,
    _message: message,
  });
  if (error) return { ok: false };
  return data as unknown as PortalGiftsResult;
}

export async function portalCancelPledge(
  cred: string,
  pledgeId: string,
): Promise<PortalGiftsResult> {
  const { data, error } = await supabase.rpc("wedding_portal_pledge_cancel", {
    _cred: cred,
    _pledge: pledgeId,
  });
  if (error) return { ok: false };
  return data as unknown as PortalGiftsResult;
}
