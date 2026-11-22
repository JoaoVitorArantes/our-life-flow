import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import {
  RECEIPT_CATEGORIES,
  receiptReadingSchema,
  type ReceiptReading,
} from "@/features/receipts/contracts";

const RUN = "X-Lovable-AIG-Run-ID";
function runIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN)) headers.set(RUN, runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get(RUN)?.trim() || undefined;
    return res;
  };
}

export class ReceiptAiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Lê uma nota/recibo (imagem ou PDF) com a IA e devolve campos estruturados. Só interpreta. */
export async function readReceiptWithAi(
  file: ArrayBuffer,
  mediaType: string,
  filename: string,
  today: string,
): Promise<ReceiptReading> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new ReceiptAiError("A leitura por IA não está configurada.", 500);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch(),
  });
  const b64 = toBase64(file);
  const media =
    mediaType === "application/pdf"
      ? ({ type: "file", filename, data: b64, mediaType: "application/pdf" } as const)
      : ({ type: "image", image: new URL(`data:${mediaType};base64,${b64}`) } as const);
  const result = streamText({
    model: provider.responses("openai/gpt-6.1-sol"),
    maxRetries: 0,
    instructions: `Você lê notas fiscais, cupons e recibos brasileiros e extrai dados. Hoje é ${today}.
Regras:
- Use SOMENTE o que está no documento. Nunca invente valores, datas ou nomes: se não estiver legível, use null.
- is_receipt=false se o arquivo não for uma nota, cupom, recibo ou comprovante de pagamento.
- total = valor total pago (número, 38,90 → 38.9). date em AAAA-MM-DD (datas brasileiras são DD/MM/AAAA).
- merchant = nome do estabelecimento ou de quem recebeu. document_number = número da nota/cupom, se houver.
- category: escolha a mais adequada entre ${RECEIPT_CATEGORIES.join(", ")}.
- payment_method: como foi pago, se constar (ex.: Crédito, Débito, Pix, Dinheiro), senão null.
- description: resumo curto em português (até 80 caracteres).
- items: itens listados (no máximo 60), com quantidade e valor quando legíveis; vazio se não houver.
- confidence: low se a imagem estiver ruim ou faltar o total.`,
    messages: [{ role: "user", content: [{ type: "text", text: "Leia este documento." }, media] }],
    output: Output.object({ schema: receiptReadingSchema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    for await (const _ of result.textStream) void _;
    return receiptReadingSchema.parse(await result.output);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      try {
        const parsed = receiptReadingSchema.safeParse(JSON.parse(error.text));
        if (parsed.success) return parsed.data;
      } catch {
        /* resposta inválida */
      }
    }
    const status =
      (error as { statusCode?: number }).statusCode ?? (error as { status?: number }).status;
    if (status === 402)
      throw new ReceiptAiError(
        "Sem créditos de IA no momento. Adicione créditos para continuar lendo notas.",
        402,
      );
    if (status === 403)
      throw new ReceiptAiError("A IA recusou ou não tem permissão para ler este arquivo.", 403);
    if (status === 429)
      throw new ReceiptAiError("Muitas leituras ao mesmo tempo. Tente de novo em instantes.", 429);
    console.error("receipt read failed", status, (error as Error).message);
    throw new ReceiptAiError("Não foi possível ler este arquivo agora.", 502);
  }
}
