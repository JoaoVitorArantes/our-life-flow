import { describe, expect, it } from "vitest";
import {
  credentialFromInput,
  formatCode,
  inviteLink,
  normalizeCode,
  portalErrorMessage,
  summarizeGuests,
  validateCompanions,
} from "./guest-contracts";

describe("convidados", () => {
  it("rejeita acompanhantes acima do limite do convite", () => {
    expect(validateCompanions(["Ana", "Bia"], 1).ok).toBe(false);
    expect(validateCompanions(["Ana", " ", ""], 1)).toEqual({ ok: true, names: ["Ana"] });
  });
  it("convite sem acompanhantes não aceita nenhum", () => {
    expect(validateCompanions(["Ana"], 0).ok).toBe(false);
  });
  it("normaliza e formata o código de 8 caracteres", () => {
    expect(normalizeCode("ab cd-12 34")).toBe("ABCD1234");
    expect(formatCode("abcd1234")).toBe("ABCD-1234");
  });
  it("extrai a credencial de um link lido por QR", () => {
    const link = inviteLink("https://exemplo.com/", "tok_-123");
    expect(link).toBe("https://exemplo.com/convite/tok_-123");
    expect(credentialFromInput(link)).toBe("tok_-123");
    expect(credentialFromInput(" ABCD-1234 ")).toBe("ABCD-1234");
  });
  it("erro do portal é genérico para convite inexistente, expirado ou revogado", () => {
    expect(portalErrorMessage(undefined)).toBe(portalErrorMessage("unavailable"));
    expect(portalErrorMessage(undefined)).not.toMatch(/revogad|expirad/i);
  });
  it("resumo ignora convidados na lixeira", () => {
    const s = summarizeGuests(
      [
        { invitation_id: "a", is_companion: false, rsvp: "yes", archived_at: null },
        { invitation_id: "a", is_companion: true, rsvp: "yes", archived_at: null },
        { invitation_id: "b", is_companion: false, rsvp: "pending", archived_at: null },
        { invitation_id: "b", is_companion: false, rsvp: "no", archived_at: "2026-01-01" },
      ],
      1,
    );
    expect(s).toEqual({ total: 3, yes: 2, no: 0, pending: 1, companions: 1, checkedIn: 1 });
  });
});
