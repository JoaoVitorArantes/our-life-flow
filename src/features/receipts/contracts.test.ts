import { describe, expect, it } from "vitest";
import { missingReceiptFields, normalizeReading, receiptFileOk, receiptsToRows } from "./contracts";

const base = {
  is_receipt: true,
  merchant: "  Mercado  Bom ",
  date: "2026-11-20",
  total: 38.904,
  currency: "brl",
  category: "Mercado" as const,
  payment_method: "Pix",
  description: "Compras",
  document_number: null,
  items: [{ name: "Arroz", quantity: 2, amount: 20 }],
  confidence: "high" as const,
};

describe("notas e recibos", () => {
  it("arredonda o total a centavos e limpa o nome", () => {
    const r = normalizeReading(base, "2026-11-22");
    expect(r.total).toBe(38.9);
    expect(r.merchant).toBe("Mercado Bom");
    expect(r.currency).toBe("BRL");
  });
  it("descarta data futura ou inválida em vez de inventar", () => {
    expect(normalizeReading({ ...base, date: "2027-01-01" }, "2026-11-22").receipt_date).toBeNull();
    expect(normalizeReading({ ...base, date: "20/11/2026" }, "2026-11-22").receipt_date).toBeNull();
  });
  it("valor negativo vira vazio e exige preenchimento", () => {
    const r = normalizeReading({ ...base, total: -5 }, "2026-11-22");
    expect(r.total).toBeNull();
    expect(missingReceiptFields(r)).toEqual(["valor total"]);
  });
  it("aceita só imagens e PDF até 8 MB", () => {
    expect(receiptFileOk("image/jpeg", 1000)).toBeNull();
    expect(receiptFileOk("application/pdf", 9 * 1024 * 1024)).not.toBeNull();
    expect(receiptFileOk("text/plain", 10)).not.toBeNull();
  });
  it("exporta colunas em português", () => {
    const [row] = receiptsToRows([
      {
        receipt_date: "2026-11-20",
        merchant: "X",
        category: "Mercado",
        total: 10,
        currency: "BRL",
        payment_method: null,
        description: null,
        document_number: null,
        notes: null,
        file_name: "a.jpg",
      },
    ]);
    expect(row).toMatchObject({
      data: "2026-11-20",
      estabelecimento: "X",
      categoria: "Mercado",
      valor: 10,
    });
  });
});
