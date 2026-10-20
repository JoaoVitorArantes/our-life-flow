import { z } from "zod";
import { courseInputSchema } from "./contracts";

/**
 * Importação de disciplinas (CSV ou JSON) com validação e prévia.
 * Nada é gravado aqui: o resultado é uma lista de itens válidos/inválidos
 * que o usuário revisa antes de confirmar.
 */

export type ImportItem = {
  line: number;
  input: z.infer<typeof courseInputSchema> | null;
  error: string | null;
};

export type ImportPreview = {
  items: ImportItem[];
  valid: number;
  invalid: number;
};

const jsonRowSchema = z
  .object({
    name: z.string().max(200),
    code: z.string().max(40).nullish(),
    semester: z.number().int().nullish(),
    credits: z.number().int().nullish(),
    status: z.string().max(20).nullish(),
    grade: z.number().nullish(),
    attendance_percent: z.number().nullish(),
    prerequisites: z.array(z.string().max(120)).max(20).nullish(),
    notes: z.string().max(500).nullish(),
  })
  .strict();

const STATUS_VALUES = ["PENDING", "ENROLLED", "COMPLETED", "FAILED", "WAIVED"] as const;

function toCourseInput(raw: z.infer<typeof jsonRowSchema>): z.infer<typeof courseInputSchema> {
  const status = (raw.status ?? "PENDING").toUpperCase();
  return courseInputSchema.parse({
    name: raw.name.trim(),
    code: raw.code?.trim() || null,
    term_id: null,
    semester: raw.semester ?? null,
    credits: raw.credits ?? null,
    status: (STATUS_VALUES as readonly string[]).includes(status) ? status : "PENDING",
    grade: raw.grade ?? null,
    attendance_percent: raw.attendance_percent ?? null,
    prerequisites: raw.prerequisites ?? [],
    notes: raw.notes?.trim() || null,
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";") {
      cells.push(current.trim());
      current = "";
    } else current += ch;
  }
  cells.push(current.trim());
  return cells;
}

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** CSV: cabeçalho obrigatório com coluna `name`; aceitas: code, semester, credits, status, grade, attendance_percent, prerequisites (separados por |), notes. */
export function parseCsv(text: string): ImportPreview {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2)
    return { items: [], valid: 0, invalid: 0 };
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const nameIdx = header.indexOf("name");
  if (nameIdx < 0)
    return {
      items: [{ line: 1, input: null, error: "Cabeçalho sem a coluna obrigatória name." }],
      valid: 0,
      invalid: 1,
    };
  const items: ImportItem[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]!);
    const get = (col: string) => {
      const idx = header.indexOf(col);
      return idx >= 0 ? cells[idx] : undefined;
    };
    try {
      const input = toCourseInput(
        jsonRowSchema.parse({
          name: get("name") ?? "",
          code: get("code") || null,
          semester: num(get("semester")),
          credits: num(get("credits")),
          status: get("status") || null,
          grade: num(get("grade")),
          attendance_percent: num(get("attendance_percent")),
          prerequisites: get("prerequisites")
            ? get("prerequisites")!
                .split("|")
                .map((p) => p.trim())
                .filter(Boolean)
            : [],
          notes: get("notes") || null,
        }),
      );
      items.push({ line: i + 1, input, error: null });
    } catch (e) {
      items.push({
        line: i + 1,
        input: null,
        error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Linha inválida.") : "Linha inválida.",
      });
    }
  }
  return {
    items,
    valid: items.filter((i) => i.input).length,
    invalid: items.filter((i) => !i.input).length,
  };
}

/** JSON: array de objetos com os mesmos campos do CSV. */
export function parseJson(text: string): ImportPreview {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { items: [{ line: 1, input: null, error: "JSON inválido." }], valid: 0, invalid: 1 };
  }
  if (!Array.isArray(raw))
    return {
      items: [{ line: 1, input: null, error: "O JSON deve ser uma lista de disciplinas." }],
      valid: 0,
      invalid: 1,
    };
  const items: ImportItem[] = raw.map((row, i) => {
    try {
      return { line: i + 1, input: toCourseInput(jsonRowSchema.parse(row)), error: null };
    } catch (e) {
      return {
        line: i + 1,
        input: null,
        error: e instanceof z.ZodError ? (e.issues[0]?.message ?? "Item inválido.") : "Item inválido.",
      };
    }
  });
  return {
    items,
    valid: items.filter((i) => i.input).length,
    invalid: items.filter((i) => !i.input).length,
  };
}

export function parseImport(text: string, format: "csv" | "json"): ImportPreview {
  return format === "csv" ? parseCsv(text) : parseJson(text);
}
