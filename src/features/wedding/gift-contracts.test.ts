import { describe, expect, it } from "vitest";
import {
  DEFAULT_PENDING_DAYS,
  MAX_PLEDGE_AMOUNT,
  availability,
  effectiveState,
  parseMoney,
  summarizePledges,
  validateGift,
  validatePledge,
  type GiftDraft,
} from "./gift-contracts";

const NOW = Date.parse("2027-03-01T12:00:00Z");
const future = "2027-03-10T12:00:00Z";
const past = "2027-02-20T12:00:00Z";
const gift = { id: "g1", kind: "quota", quantity_total: null, quota_total: 5 };

describe("regras de presentes", () => {
  it("reservas pendentes vencem em 15 dias por padrão", () => {
    expect(DEFAULT_PENDING_DAYS).toBe(15);
  });

  it("teto por reserva é R$ 50.000,00", () => {
    expect(MAX_PLEDGE_AMOUNT).toBe(50000);
    const fund = { kind: "fund" as const, available: null, quota_amount: null };
    expect(validatePledge(fund, { units: "", amount: "50.000,00", message: "" }).ok).toBe(true);
    expect(validatePledge(fund, { units: "", amount: "50.000,01", message: "" }).ok).toBe(false);
  });

  it("cotas não passam do teto somando unidades × valor", () => {
    const q = { kind: "quota" as const, available: 10, quota_amount: 10000 };
    expect(validatePledge(q, { units: "5", amount: "", message: "" }).ok).toBe(true);
    expect(validatePledge(q, { units: "6", amount: "", message: "" }).ok).toBe(false);
  });

  it("disponibilidade conta pendentes no prazo e confirmadas, não vencidas/canceladas", () => {
    const pledges = [
      { gift_id: "g1", units: 1, amount: null, state: "pending", expires_at: future },
      { gift_id: "g1", units: 2, amount: null, state: "confirmed", expires_at: past },
      { gift_id: "g1", units: 1, amount: null, state: "pending", expires_at: past },
      { gift_id: "g1", units: 1, amount: null, state: "cancelled", expires_at: future },
    ];
    expect(availability(gift, pledges, NOW)).toBe(2);
    expect(effectiveState(pledges[2]!, NOW)).toBe("expired");
  });

  it("fundos não têm limite de reservas", () => {
    expect(availability({ ...gift, kind: "fund", quota_total: null }, [], NOW)).toBeNull();
  });

  it("não reserva mais do que o disponível", () => {
    const g = { kind: "physical" as const, available: 1, quota_amount: null };
    expect(validatePledge(g, { units: "2", amount: "", message: "" }).ok).toBe(false);
  });

  it("mensagem com HTML é recusada", () => {
    const g = { kind: "physical" as const, available: 3, quota_amount: null };
    expect(validatePledge(g, { units: "1", amount: "", message: "<b>oi</b>" }).ok).toBe(false);
  });

  it("resumo do casal soma só confirmados como recebidos", () => {
    const s = summarizePledges(
      [
        { gift_id: "a", units: null, amount: "100", state: "confirmed", expires_at: past },
        { gift_id: "a", units: null, amount: "50", state: "pending", expires_at: future },
        { gift_id: "a", units: null, amount: "70", state: "pending", expires_at: past },
      ],
      NOW,
    );
    expect(s).toEqual({ pending: 1, confirmed: 1, pendingAmount: 50, confirmedAmount: 100 });
  });

  it("valores em formato brasileiro", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("")).toBeNull();
    expect(Number.isNaN(parseMoney("abc"))).toBe(true);
  });

  it("presente exige os campos do seu tipo", () => {
    const base: GiftDraft = {
      kind: "quota",
      title: "Viagem",
      description: "",
      external_url: "",
      quantity_total: "",
      quota_amount: "",
      quota_total: "10",
      suggested_amount: "",
      goal_amount: "",
      is_visible: true,
    };
    expect(validateGift(base).ok).toBe(false);
    expect(validateGift({ ...base, quota_amount: "200" }).ok).toBe(true);
    expect(validateGift({ ...base, kind: "fund" }).ok).toBe(true);
    expect(validateGift({ ...base, kind: "physical", quantity_total: "0" }).ok).toBe(false);
    expect(validateGift({ ...base, quota_amount: "200", external_url: "http://x" }).ok).toBe(false);
  });
});
