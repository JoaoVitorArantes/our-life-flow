import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  portalCancelPledge,
  portalGifts,
  portalPledge,
  type PortalGift,
  type PortalGiftsData,
} from "@/features/wedding/gifts";
import {
  PIX_KEY_TYPES,
  PLEDGE_STATE_LABEL,
  giftPortalError,
  validatePledge,
} from "@/features/wedding/gift-contracts";
import { formatCurrency } from "@/lib/format";

const fmtD = (s: string) => new Date(s).toLocaleDateString("pt-BR");

/** Seção de presentes do portal: só aparece quando o casal ativa. Nunca mostra quem reservou nem progresso de fundos. */
export function PortalGifts({ token }: { token: string }) {
  const [data, setData] = useState<PortalGiftsData | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    void portalGifts(token).then((r) => (r.ok ? setData(r) : setData(null)));
  }, [token]);
  if (!data || !data.enabled) return null;

  const apply = (r: Awaited<ReturnType<typeof portalGifts>>, ok: string) => {
    if (r.ok) {
      setData(r);
      setFeedback({ ok: true, text: ok });
    } else {
      setFeedback({ ok: false, text: giftPortalError(r.error) });
      void portalGifts(token).then((x) => x.ok && setData(x));
    }
  };
  const pay = data.payment;
  const pixType = PIX_KEY_TYPES.find((t) => t.value === pay?.pix_key_type)?.label;

  return (
    <section className="wed-card space-y-4 p-5" aria-labelledby="gifts">
      <h2 id="gifts" className="wed-display flex items-center gap-2 text-xl">
        <Gift className="size-5 text-primary" aria-hidden /> Presentes
      </h2>
      <p className="text-sm text-muted-foreground">
        Escolha um presente para reservar. Os noivos confirmam o recebimento. Reservas não
        confirmadas vencem em {data.pending_days} dias.
      </p>
      {data.gifts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum presente disponível no momento.</p>
      ) : (
        <ul className="space-y-3">
          {data.gifts.map((g) => (
            <GiftItem
              key={g.id}
              g={g}
              onPledge={async (u, a, msg) =>
                apply(await portalPledge(token, g.id, u, a, msg), "Reserva registrada. Obrigado!")
              }
            />
          ))}
        </ul>
      )}
      {feedback && (
        <p
          role="status"
          className={`flex items-center gap-2 text-sm ${feedback.ok ? "text-primary" : "text-destructive"}`}
        >
          {feedback.ok && <CheckCircle2 className="size-4" />}
          {feedback.text}
        </p>
      )}

      {pay && data.my_pledges.length > 0 && (
        <div className="space-y-2 rounded-xl border p-3 text-sm">
          {pay.pix_key && (
            <div className="space-y-1">
              <p className="font-medium">Pix{pixType ? ` (${pixType})` : ""}</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1">
                  {pay.pix_key}
                </code>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-10"
                  aria-label="Copiar chave Pix"
                  onClick={() => void navigator.clipboard?.writeText(pay.pix_key ?? "")}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              {pay.pix_receiver_name && (
                <p className="text-muted-foreground">Recebedor: {pay.pix_receiver_name}</p>
              )}
            </div>
          )}
          {pay.instructions && (
            <p className="whitespace-pre-wrap break-words">{pay.instructions}</p>
          )}
          {pay.delivery_instructions && (
            <p className="whitespace-pre-wrap break-words text-muted-foreground">
              {pay.delivery_instructions}
            </p>
          )}
        </div>
      )}

      {data.my_pledges.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Suas reservas</h3>
          <ul className="space-y-2">
            {data.my_pledges.map((p) => (
              <li key={p.id} className="space-y-1 rounded-xl border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words font-medium">{p.gift_title}</span>
                  <span className="text-xs text-muted-foreground">
                    {PLEDGE_STATE_LABEL[p.state]}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  {p.kind === "fund"
                    ? formatCurrency(Number(p.amount))
                    : p.kind === "quota"
                      ? `${p.units} cota(s) · ${formatCurrency(Number(p.amount))}`
                      : `${p.units} unidade(s)`}
                  {p.state === "pending" && ` · vence em ${fmtD(p.expires_at)}`}
                </p>
                {p.state === "pending" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-10"
                    onClick={async () => {
                      if (!window.confirm("Cancelar esta reserva?")) return;
                      apply(await portalCancelPledge(token, p.id), "Reserva cancelada.");
                    }}
                  >
                    Cancelar reserva
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Para mudar uma reserva, cancele e faça outra.
          </p>
        </div>
      )}
    </section>
  );
}

function GiftItem({
  g,
  onPledge,
}: {
  g: PortalGift;
  onPledge: (units: number | null, amount: number | null, message: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState("1");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const soldOut = g.available != null && g.available <= 0;
  const submit = async () => {
    const v = validatePledge(g, { units, amount, message });
    if (!v.ok) return setError(v.error);
    setError(null);
    setBusy(true);
    await onPledge(v.units, v.amount, v.message);
    setBusy(false);
    setOpen(false);
    setMessage("");
  };
  return (
    <li className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 break-words font-medium">{g.title}</p>
        <span className="text-xs text-muted-foreground">
          {g.kind === "fund"
            ? "Disponível"
            : soldOut
              ? "Esgotado"
              : g.kind === "quota"
                ? `${g.available} de ${g.total} cotas disponíveis`
                : `${g.available} de ${g.total} disponíveis`}
        </span>
      </div>
      {g.description && (
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {g.description}
        </p>
      )}
      <p className="text-sm">
        {g.kind === "quota" &&
          g.quota_amount != null &&
          `${formatCurrency(g.quota_amount)} por cota`}
        {g.kind === "fund" &&
          (g.suggested_amount != null
            ? `Sugestão: ${formatCurrency(g.suggested_amount)}`
            : "Valor livre")}
      </p>
      {g.external_url && (
        <a
          className="text-sm text-primary underline"
          href={g.external_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver referência
        </a>
      )}
      {!soldOut && !open && (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => setOpen(true)}
        >
          {g.kind === "fund" ? "Quero contribuir" : "Reservar"}
        </Button>
      )}
      {open && (
        <div className="space-y-2">
          {g.kind === "fund" ? (
            <div className="space-y-1">
              <Label htmlFor={`amt-${g.id}`}>Valor que pretende enviar (R$)</Label>
              <Input
                id={`amt-${g.id}`}
                className="h-11"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor={`qty-${g.id}`}>{g.kind === "quota" ? "Cotas" : "Quantidade"}</Label>
              <Input
                id={`qty-${g.id}`}
                className="h-11"
                inputMode="numeric"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
            </div>
          )}
          <Textarea
            aria-label={`Mensagem para ${g.title}`}
            maxLength={500}
            placeholder="Mensagem aos noivos (opcional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Outros convidados não veem quem reservou. Os noivos veem o seu convite.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button type="button" className="h-11" disabled={busy} onClick={() => void submit()}>
              Confirmar reserva
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
