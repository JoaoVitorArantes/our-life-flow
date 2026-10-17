import { z } from "zod";

/** Accepts the form's Brazilian amounts or a plain decimal, never coerces malformed input to zero. */
export function parseContextBudget(input: string): number | null {
  const text = input.trim().replace(/^R\$\s*/, "");
  if (!text) return null;
  const brazilian = /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  const decimal = /^-?\d+(?:\.\d{1,2})?$/;
  if (!brazilian.test(text) && !decimal.test(text)) throw new Error("Informe um orçamento válido.");
  const normalized =
    text.includes(",") || /^-?\d{1,3}(?:\.\d{3})+$/.test(text)
      ? text.replace(/\./g, "").replace(",", ".")
      : text;
  return z
    .number()
    .finite()
    .nonnegative("O orçamento não pode ser negativo.")
    .parse(Number(normalized));
}
