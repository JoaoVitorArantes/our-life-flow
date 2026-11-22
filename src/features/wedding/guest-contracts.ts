/** Regras puras dos convidados (testáveis, sem rede). */
export type Rsvp = "pending" | "yes" | "no";

export interface GuestLike {
  invitation_id: string | null;
  is_companion: boolean;
  rsvp: string;
  archived_at: string | null;
}

export const RSVP_LABEL: Record<Rsvp, string> = {
  pending: "Aguardando",
  yes: "Confirmado",
  no: "Não poderá ir",
};

export const INVITATION_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Link gerado",
  responded: "Respondido",
  revoked: "Revogado",
};

export function summarizeGuests(guests: GuestLike[], checkedIn: number) {
  const active = guests.filter((g) => !g.archived_at);
  return {
    total: active.length,
    yes: active.filter((g) => g.rsvp === "yes").length,
    no: active.filter((g) => g.rsvp === "no").length,
    pending: active.filter((g) => g.rsvp === "pending").length,
    companions: active.filter((g) => g.is_companion).length,
    checkedIn,
  };
}

/** Quantos acompanhantes ainda podem ser nomeados num convite. */
export function companionSlotsLeft(max: number, keptCheckedIn: number, requested: number) {
  return Math.max(0, max - keptCheckedIn - requested);
}

/** Valida a lista de acompanhantes antes de enviar ao portal. */
export function validateCompanions(
  names: string[],
  max: number,
): { ok: true; names: string[] } | { ok: false; error: string } {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length > max)
    return { ok: false, error: `Este convite permite até ${max} acompanhante(s).` };
  if (clean.some((n) => n.length > 120))
    return { ok: false, error: "Nome de acompanhante muito longo." };
  return { ok: true, names: clean };
}

export function normalizeCode(raw: string) {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function formatCode(code: string) {
  const c = normalizeCode(code);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export function inviteLink(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/convite/${encodeURIComponent(token)}`;
}

/** Extrai a credencial de um link lido por QR ou colado; senão devolve o texto como código. */
export function credentialFromInput(raw: string) {
  const t = raw.trim();
  const m = t.match(/\/convite\/([A-Za-z0-9_-]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : t;
}

/** Mensagens do portal: sempre genéricas para não revelar se um convite existe. */
export function portalErrorMessage(error: string | undefined) {
  switch (error) {
    case "locked":
      return "As respostas deste convite foram encerradas pelos noivos.";
    case "invalid":
      return "Confira as respostas e tente novamente.";
    case "too_many":
      return "Você enviou muitas mensagens. Tente novamente mais tarde.";
    default:
      return "Convite indisponível. Confira o link ou o código recebido.";
  }
}
