import { z } from "zod";

/** Categorias próprias das notas (independentes das categorias do Financeiro). */
export const RECEIPT_CATEGORIES = [
  "Mercado",
  "Alimentação",
  "Transporte",
  "Combustível",
  "Saúde",
  "Farmácia",
  "Casa",
  "Contas e serviços",
  "Educação",
  "Lazer",
  "Vestuário",
  "Tecnologia",
  "Pets",
  "Viagem",
  "Presentes",
  "Outros",
] as const;
export type ReceiptCategory = (typeof RECEIPT_CATEGORIES)[number];

export const RECEIPT_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

/** Saída estruturada da IA (schema estrito: tudo obrigatório, opcionais anuláveis). */
export const receiptReadingSchema = z.object({
  is_receipt: z.boolean(),
  merchant: z.string().nullable(),
  date: z.string().nullable(),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  category: z.enum(RECEIPT_CATEGORIES),
  payment_method: z.string().nullable(),
  description: z.string().nullable(),
  document_number: z.string().nullable(),
  items: z.array(
    z.object({ name: z.string(), quantity: z.number().nullable(), amount: z.number().nullable() }),
  ),
  confidence: z.enum(["low", "medium", "high"]),
});
export type ReceiptReading = z.infer<typeof receiptReadingSchema>;

const clip = (v: string | null | undefined, max: number) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};
const money = (v: number | null | undefined) =>
  v != null && Number.isFinite(v) && v >= 0 && v < 1e9 ? Math.round(v * 100) / 100 : null;

/** Valida e limpa a leitura da IA. Nada é inventado: o que não for confiável vira nulo. */
export function normalizeReading(r: ReceiptReading, today: string) {
  const date =
    r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && !Number.isNaN(Date.parse(r.date))
      ? r.date
      : null;
  const currency =
    r.currency && /^[A-Za-z]{3}$/.test(r.currency) ? r.currency.toUpperCase() : "BRL";
  return {
    is_receipt: r.is_receipt,
    merchant: clip(r.merchant, 160),
    // data no futuro é descartada (provável erro de leitura)
    receipt_date: date && date <= today ? date : null,
    total: money(r.total),
    currency,
    category: (RECEIPT_CATEGORIES as readonly string[]).includes(r.category)
      ? r.category
      : "Outros",
    payment_method: clip(r.payment_method, 60),
    description: clip(r.description, 300),
    document_number: clip(r.document_number, 80),
    items: r.items.slice(0, 60).map((i) => ({
      name: clip(i.name, 120) ?? "Item",
      quantity:
        i.quantity != null && Number.isFinite(i.quantity) && i.quantity > 0 ? i.quantity : null,
      amount: money(i.amount),
    })),
    confidence: r.confidence,
  };
}
export type NormalizedReading = ReturnType<typeof normalizeReading>;

/** Campos que ainda precisam de confirmação manual antes de salvar. */
export function missingReceiptFields(r: { total: number | null; receipt_date: string | null }) {
  const m: string[] = [];
  if (r.total == null || r.total <= 0) m.push("valor total");
  if (!r.receipt_date) m.push("data");
  return m;
}

export function receiptFileOk(type: string, size: number): string | null {
  if (!(RECEIPT_MIME as readonly string[]).includes(type))
    return "Envie foto (JPG, PNG, WebP) ou PDF.";
  if (size <= 0) return "Arquivo vazio.";
  if (size > RECEIPT_MAX_BYTES) return "O arquivo deve ter até 8 MB.";
  return null;
}

/** Linhas para exportação (CSV). */
export function receiptsToRows(
  rows: {
    receipt_date: string | null;
    merchant: string | null;
    category: string;
    total: number | null;
    currency: string;
    payment_method: string | null;
    description: string | null;
    document_number: string | null;
    notes: string | null;
    file_name: string | null;
  }[],
) {
  return rows.map((r) => ({
    data: r.receipt_date ?? "",
    estabelecimento: r.merchant ?? "",
    categoria: r.category,
    valor: r.total ?? "",
    moeda: r.currency,
    pagamento: r.payment_method ?? "",
    descricao: r.description ?? "",
    documento: r.document_number ?? "",
    observacoes: r.notes ?? "",
    arquivo: r.file_name ?? "",
  }));
}
