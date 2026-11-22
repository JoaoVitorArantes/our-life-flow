/** Regras puras dos presentes do Casamento (testáveis, sem rede). Isoladas de Financeiro/recibos/metas. */
export type GiftKind = "physical" | "fund" | "quota";
export type PledgeState = "pending" | "confirmed" | "cancelled" | "expired";

/** Teto por reserva decidido pelo casal. */
export const MAX_PLEDGE_AMOUNT = 50_000;
export const MAX_PLEDGE_UNITS = 100;
export const DEFAULT_PENDING_DAYS = 15;
export const MAX_MESSAGE = 500;

export const GIFT_KIND_LABEL: Record<GiftKind, string> = {
  physical: "Presente físico",
  fund: "Fundo de contribuição",
  quota: "Presente por cotas",
};

export const PLEDGE_STATE_LABEL: Record<PledgeState, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Recebido",
  cancelled: "Cancelada",
  expired: "Vencida",
};

export const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave aleatória" },
] as const;

export interface PledgeLike {
  gift_id: string;
  units: number | null;
  amount: number | string | null;
  state: string;
  expires_at: string;
}
export interface GiftLike {
  id: string;
  kind: string;
  quantity_total: number | null;
  quota_total: number | null;
}

/** Estado efetivo: pendente vencida já conta como vencida, mesmo antes do banco marcar. */
export function effectiveState(p: Pick<PledgeLike, "state" | "expires_at">, now = Date.now()) {
  if (p.state === "pending" && new Date(p.expires_at).getTime() <= now) return "expired";
  return p.state as PledgeState;
}

/** Unidades ocupadas: confirmadas + pendentes no prazo. */
export function usedUnits(giftId: string, pledges: PledgeLike[], now = Date.now()) {
  return pledges
    .filter((p) => p.gift_id === giftId)
    .filter((p) => {
      const s = effectiveState(p, now);
      return s === "confirmed" || s === "pending";
    })
    .reduce((t, p) => t + (p.units ?? 0), 0);
}

/** Disponibilidade; null = sem limite (fundos). */
export function availability(gift: GiftLike, pledges: PledgeLike[], now = Date.now()) {
  if (gift.kind === "fund") return null;
  const total = gift.quantity_total ?? gift.quota_total ?? 0;
  return Math.max(0, total - usedUnits(gift.id, pledges, now));
}

/** Somatórios só para o painel do casal (o portal nunca recebe estes números). */
export function summarizePledges(pledges: PledgeLike[], now = Date.now()) {
  let pending = 0;
  let confirmed = 0;
  let confirmedAmount = 0;
  let pendingAmount = 0;
  for (const p of pledges) {
    const s = effectiveState(p, now);
    const a = Number(p.amount ?? 0);
    if (s === "pending") {
      pending++;
      pendingAmount += a;
    } else if (s === "confirmed") {
      confirmed++;
      confirmedAmount += a;
    }
  }
  return { pending, confirmed, pendingAmount, confirmedAmount };
}

export interface GiftDraft {
  kind: GiftKind;
  title: string;
  description: string;
  external_url: string;
  quantity_total: string;
  quota_amount: string;
  quota_total: string;
  suggested_amount: string;
  goal_amount: string;
  is_visible: boolean;
}

/** Aceita "1.234,56", "1234.56" ou "1234,5". Vazio → null; inválido → NaN. */
export function parseMoney(raw: string): number | null {
  const t = raw.trim().replace(/^R\$\s*/i, "");
  if (!t) return null;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return Number.NaN;
  return Number(norm);
}

function parseIntStrict(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
}

export function validateGift(d: GiftDraft):
  | {
      ok: true;
      value: {
        kind: GiftKind;
        title: string;
        description: string | null;
        external_url: string | null;
        quantity_total: number | null;
        quota_amount: number | null;
        quota_total: number | null;
        suggested_amount: number | null;
        goal_amount: number | null;
        is_visible: boolean;
      };
    }
  | { ok: false; error: string } {
  const title = d.title.trim();
  if (!title) return { ok: false, error: "Informe o nome do presente." };
  if (title.length > 120) return { ok: false, error: "Nome com até 120 caracteres." };
  const description = d.description.trim() || null;
  if (description && description.length > 1000)
    return { ok: false, error: "Descrição com até 1000 caracteres." };
  const url = d.external_url.trim() || null;
  if (url && (!/^https:\/\/\S+$/.test(url) || url.length > 500))
    return { ok: false, error: "O link precisa começar com https://." };
  const base = {
    kind: d.kind,
    title,
    description,
    external_url: url,
    quantity_total: null as number | null,
    quota_amount: null as number | null,
    quota_total: null as number | null,
    suggested_amount: null as number | null,
    goal_amount: null as number | null,
    is_visible: d.is_visible,
  };
  if (d.kind === "physical") {
    const q = parseIntStrict(d.quantity_total);
    if (q == null || !Number.isFinite(q) || q < 1 || q > 1000)
      return { ok: false, error: "Quantidade desejada entre 1 e 1000." };
    return { ok: true, value: { ...base, quantity_total: q } };
  }
  if (d.kind === "quota") {
    const a = parseMoney(d.quota_amount);
    const n = parseIntStrict(d.quota_total);
    if (a == null || !Number.isFinite(a) || a <= 0 || a > MAX_PLEDGE_AMOUNT)
      return { ok: false, error: "Valor da cota entre R$ 0,01 e R$ 50.000,00." };
    if (n == null || !Number.isFinite(n) || n < 1 || n > 1000)
      return { ok: false, error: "Número de cotas entre 1 e 1000." };
    return { ok: true, value: { ...base, quota_amount: a, quota_total: n } };
  }
  const s = parseMoney(d.suggested_amount);
  if (s != null && (!Number.isFinite(s) || s <= 0 || s > MAX_PLEDGE_AMOUNT))
    return { ok: false, error: "Valor sugerido entre R$ 0,01 e R$ 50.000,00." };
  const g = parseMoney(d.goal_amount);
  if (g != null && (!Number.isFinite(g) || g <= 0 || g > 10_000_000))
    return { ok: false, error: "Meta inválida." };
  return { ok: true, value: { ...base, suggested_amount: s, goal_amount: g } };
}

/** Validação da reserva feita no portal, espelhando a regra do servidor. */
export function validatePledge(
  gift: { kind: GiftKind; available: number | null; quota_amount: number | null },
  input: { units: string; amount: string; message: string },
):
  | { ok: true; units: number | null; amount: number | null; message: string }
  | { ok: false; error: string } {
  const message = input.message.trim();
  if (message.length > MAX_MESSAGE) return { ok: false, error: "Mensagem com até 500 caracteres." };
  if (/[<>]/.test(message)) return { ok: false, error: "A mensagem não pode conter < ou >." };
  if (gift.kind === "fund") {
    const a = parseMoney(input.amount);
    if (a == null || !Number.isFinite(a) || a <= 0)
      return { ok: false, error: "Informe o valor que pretende enviar." };
    if (a > MAX_PLEDGE_AMOUNT)
      return { ok: false, error: "O valor máximo por reserva é R$ 50.000,00." };
    return { ok: true, units: null, amount: a, message };
  }
  const u = parseIntStrict(input.units);
  if (u == null || !Number.isFinite(u) || u < 1)
    return { ok: false, error: "Informe a quantidade." };
  if (u > MAX_PLEDGE_UNITS) return { ok: false, error: "No máximo 100 por reserva." };
  if (gift.available != null && u > gift.available)
    return { ok: false, error: "Quantidade maior do que a disponível." };
  if (
    gift.kind === "quota" &&
    gift.quota_amount != null &&
    u * gift.quota_amount > MAX_PLEDGE_AMOUNT
  )
    return { ok: false, error: "O valor máximo por reserva é R$ 50.000,00." };
  return { ok: true, units: u, amount: null, message };
}

export function giftPortalError(error: string | undefined) {
  switch (error) {
    case "disabled":
      return "A lista de presentes não está disponível no momento.";
    case "unavailable":
      return "Este presente acabou de ficar indisponível. Escolha outra quantidade ou outro presente.";
    case "too_many":
      return "Você fez muitas reservas em pouco tempo. Tente novamente mais tarde.";
    case "invalid":
      return "Confira os dados da reserva e tente novamente.";
    default:
      return "Não foi possível concluir agora. Tente novamente.";
  }
}
