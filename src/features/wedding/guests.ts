import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type WeddingInvitation = Tables<"wedding_invitations">;
export type WeddingGuest = Tables<"wedding_guests">;
export type WeddingCheckin = Tables<"wedding_checkins">;
export type WeddingGuestMessage = Tables<"wedding_guest_messages">;
export type WeddingPublicContent = Tables<"wedding_public_content">;

type GuestTable =
  | "wedding_invitations"
  | "wedding_guests"
  | "wedding_checkins"
  | "wedding_guest_messages"
  | "wedding_guest_audit";

/** Colunas seguras para o painel (hashes do link/código nunca são lidos). */
const COLUMNS: Record<GuestTable, string> = {
  wedding_invitations:
    "id, workspace_id, kind, label, max_companions, status, link_issued_at, expires_at, revoked_at, rsvp_locked, responded_at, created_by, created_at, updated_at",
  wedding_guests: "*",
  wedding_checkins: "*",
  wedding_guest_messages: "*",
  wedding_guest_audit: "*",
};

export function useGuestList<T extends GuestTable>(table: T, workspaceId?: string) {
  return useQuery({
    queryKey: [table, workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any)
        .select(COLUMNS[table])
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data as Tables<T>[];
    },
  });
}

export function usePublicContent(workspaceId?: string) {
  return useQuery({
    queryKey: ["wedding_public_content", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_public_content")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Dados de convidados do workspace ativo. */
export function useGuestsData(workspaceId?: string) {
  const invitations = useGuestList("wedding_invitations", workspaceId);
  const guests = useGuestList("wedding_guests", workspaceId);
  const checkins = useGuestList("wedding_checkins", workspaceId);
  const messages = useGuestList("wedding_guest_messages", workspaceId);
  const active = (checkins.data ?? []).filter((c) => !c.undone_at);
  return {
    loading: invitations.isLoading || guests.isLoading || checkins.isLoading,
    error: invitations.error ?? guests.error ?? null,
    invitations: (invitations.data ?? []) as Omit<WeddingInvitation, "token_hash" | "code_hash">[],
    guests: (guests.data ?? []).filter((g) => !g.archived_at),
    archivedGuests: (guests.data ?? []).filter((g) => g.archived_at),
    checkins: checkins.data ?? [],
    activeCheckin: new Map(active.map((c) => [c.guest_id, c])),
    messages: [...(messages.data ?? [])].reverse(),
  };
}

export function useGuestMutations(workspaceId?: string, userId?: string) {
  const qc = useQueryClient();
  const inv = (...t: string[]) =>
    Promise.all(t.map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const need = () => {
    if (!workspaceId || !userId) throw new Error("Sessão ou espaço indisponível.");
    return { workspaceId, userId };
  };
  return {
    createInvitation: useMutation({
      mutationFn: async (input: {
        kind: "individual" | "group";
        label: string;
        max_companions: number;
        guests: { name: string; contact?: string | null; group_label?: string | null }[];
      }) => {
        const s = need();
        if (input.guests.length === 0) throw new Error("Adicione ao menos um convidado.");
        if (input.kind === "individual" && input.guests.length !== 1)
          throw new Error("Convite individual tem exatamente uma pessoa.");
        const { data, error } = await supabase
          .from("wedding_invitations")
          .insert({
            workspace_id: s.workspaceId,
            created_by: s.userId,
            kind: input.kind,
            label: input.label.trim(),
            max_companions: input.max_companions,
          })
          .select("id")
          .single();
        if (error) throw error;
        const { error: gErr } = await supabase.from("wedding_guests").insert(
          input.guests.map((g) => ({
            workspace_id: s.workspaceId,
            created_by: s.userId,
            invitation_id: data.id,
            name: g.name.trim(),
            contact: g.contact?.trim() || null,
            group_label: g.group_label?.trim() || null,
          })),
        );
        if (gErr) throw gErr;
        return data.id;
      },
      onSuccess: () => inv("wedding_invitations", "wedding_guests"),
    }),
    updateInvitation: useMutation({
      mutationFn: async ({
        id,
        ...patch
      }: { id: string } & TablesUpdate<"wedding_invitations">) => {
        const { error } = await supabase
          .from("wedding_invitations")
          .update(patch)
          .eq("id", id)
          .eq("workspace_id", need().workspaceId);
        if (error) throw error;
      },
      onSuccess: () => inv("wedding_invitations"),
    }),
    deleteInvitation: useMutation({
      mutationFn: async (id: string) => {
        const ws = need().workspaceId;
        // Convidados do convite são arquivados (restauráveis), o convite é removido.
        const { error: gErr } = await supabase
          .from("wedding_guests")
          .update({ archived_at: new Date().toISOString() })
          .eq("invitation_id", id)
          .eq("workspace_id", ws);
        if (gErr) throw gErr;
        const { error } = await supabase
          .from("wedding_invitations")
          .delete()
          .eq("id", id)
          .eq("workspace_id", ws);
        if (error) throw error;
      },
      onSuccess: () => inv("wedding_invitations", "wedding_guests"),
    }),
    issueLink: useMutation({
      mutationFn: async (invitationId: string) => {
        const { data, error } = await supabase.rpc("wedding_issue_invitation_link", {
          _invitation_id: invitationId,
        });
        if (error) throw error;
        const row = data?.[0];
        if (!row) throw new Error("Não foi possível gerar o link.");
        return row;
      },
      onSuccess: () => inv("wedding_invitations", "wedding_guest_audit"),
    }),
    addGuest: useMutation({
      mutationFn: async (
        input: Omit<TablesInsert<"wedding_guests">, "workspace_id" | "created_by">,
      ) => {
        const s = need();
        const { error } = await supabase
          .from("wedding_guests")
          .insert({ ...input, workspace_id: s.workspaceId, created_by: s.userId });
        if (error) throw error;
      },
      onSuccess: () => inv("wedding_guests"),
    }),
    updateGuest: useMutation({
      mutationFn: async ({ id, ...patch }: { id: string } & TablesUpdate<"wedding_guests">) => {
        const { error } = await supabase
          .from("wedding_guests")
          .update(patch)
          .eq("id", id)
          .eq("workspace_id", need().workspaceId);
        if (error) throw error;
      },
      onSuccess: () => inv("wedding_guests"),
    }),
    deleteGuest: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase
          .from("wedding_guests")
          .delete()
          .eq("id", id)
          .eq("workspace_id", need().workspaceId);
        if (error) throw error;
      },
      onSuccess: () => inv("wedding_guests"),
    }),
    checkIn: useMutation({
      mutationFn: async (guestId: string) => {
        const s = need();
        const { error } = await supabase
          .from("wedding_checkins")
          .insert({ workspace_id: s.workspaceId, guest_id: guestId, operator_id: s.userId });
        if (error) {
          if (error.code === "23505") throw new Error("Este convidado já fez check-in.");
          throw error;
        }
      },
      onSuccess: () => inv("wedding_checkins"),
    }),
    undoCheckIn: useMutation({
      mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
        const s = need();
        if (!reason.trim()) throw new Error("Informe o motivo da correção.");
        const { error } = await supabase
          .from("wedding_checkins")
          .update({
            undone_by: s.userId,
            undo_reason: reason.trim().slice(0, 200),
            undone_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("workspace_id", s.workspaceId);
        if (error) throw error;
      },
      onSuccess: () => inv("wedding_checkins"),
    }),
    savePublicContent: useMutation({
      mutationFn: async (
        input: Omit<TablesInsert<"wedding_public_content">, "workspace_id" | "created_by">,
      ) => {
        const s = need();
        const { error } = await supabase
          .from("wedding_public_content")
          .upsert(
            { ...input, workspace_id: s.workspaceId, created_by: s.userId },
            { onConflict: "workspace_id" },
          );
        if (error) throw error;
      },
      onSuccess: () => inv("wedding_public_content"),
    }),
    markMessage: useMutation({
      mutationFn: async ({ id, read }: { id: string; read: boolean }) => {
        const { error } = await supabase
          .from("wedding_guest_messages")
          .update({ read_at: read ? new Date().toISOString() : null })
          .eq("id", id)
          .eq("workspace_id", need().workspaceId);
        if (error) throw error;
      },
      onSuccess: () => inv("wedding_guest_messages"),
    }),
    findByCode: async (cred: string) => {
      const { data, error } = await supabase.rpc("wedding_find_invitation", {
        _workspace_id: need().workspaceId,
        _cred: cred,
      });
      if (error) throw error;
      return data as string | null;
    },
  };
}

/* ---------- Portal público (sem login) ---------- */
export interface PortalGuest {
  id: string;
  name: string;
  is_companion: boolean;
  rsvp: "pending" | "yes" | "no";
  dietary: string | null;
  accessibility: string | null;
  checked_in: boolean;
}
export interface PortalData {
  ok: true;
  invitation: {
    label: string;
    kind: string;
    max_companions: number;
    locked: boolean;
    responded_at: string | null;
  };
  couple: string | null;
  theme: string | null;
  guests: PortalGuest[];
  content: null | {
    headline: string | null;
    message: string | null;
    event_date: string | null;
    event_time: string | null;
    venue: string | null;
    address: string | null;
    map_url: string | null;
    guidance: string | null;
    rsvp_deadline: string | null;
  };
}
export type PortalResult = PortalData | { ok: false; error?: string };

export async function portalGet(cred: string): Promise<PortalResult> {
  const { data, error } = await supabase.rpc("wedding_portal_get", { _cred: cred });
  if (error) return { ok: false };
  return data as unknown as PortalResult;
}

export async function portalRsvp(
  cred: string,
  responses: { id: string; rsvp: "yes" | "no"; dietary: string; accessibility: string }[],
  companions: string[],
): Promise<PortalResult> {
  const { data, error } = await supabase.rpc("wedding_portal_rsvp", {
    _cred: cred,
    _responses: responses,
    _companions: companions,
  });
  if (error)
    return {
      ok: false,
      error: error.message.includes("acompanhantes") ? "invalid" : "unavailable",
    };
  return data as unknown as PortalResult;
}

export async function portalMessage(
  cred: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("wedding_portal_message", {
    _cred: cred,
    _body: body,
  });
  if (error) return { ok: false };
  return data as unknown as { ok: boolean; error?: string };
}
