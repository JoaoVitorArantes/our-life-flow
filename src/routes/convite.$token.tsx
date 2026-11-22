import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarHeart, CheckCircle2, Heart, MapPin, Plus, Trash2 } from "lucide-react";
import { Ornament, useWeddingTheme } from "@/components/wedding/shell";
import { PortalGifts } from "@/components/wedding/portal-gifts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { portalErrorMessage, validateCompanions } from "@/features/wedding/guest-contracts";
import { getPortalCover } from "@/features/wedding/portal-cover.functions";
import { portalGet, portalMessage, portalRsvp, type PortalData } from "@/features/wedding/guests";

export const Route = createFileRoute("/convite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite de casamento" },
      { name: "description", content: "Confirme sua presença no casamento." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
      { property: "og:title", content: "Convite de casamento" },
      { property: "og:description", content: "Confirme sua presença." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Portal,
});

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function Portal() {
  const { token } = Route.useParams();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useWeddingTheme(data?.theme ?? undefined);
  useEffect(() => {
    void portalGet(token).then((r) => (r.ok ? setData(r) : setError(portalErrorMessage(r.error))));
  }, [token]);

  if (error)
    return (
      <Frame>
        <h1 className="wed-display text-2xl">Convite indisponível</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button asChild variant="outline" className="h-11">
          <Link to="/convite">Digitar código</Link>
        </Button>
      </Frame>
    );
  if (!data)
    return (
      <Frame>
        <p className="text-sm text-muted-foreground">Abrindo seu convite…</p>
      </Frame>
    );
  return <PortalView token={token} data={data} onChange={setData} />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="wed-card mx-auto max-w-xl space-y-4 p-6 text-center">{children}</div>
    </main>
  );
}

function PortalView({
  token,
  data,
  onChange,
}: {
  token: string;
  data: PortalData;
  onChange: (d: PortalData) => void;
}) {
  const main = data.guests.filter((g) => !g.is_companion);
  const comps = data.guests.filter((g) => g.is_companion);
  const [answers, setAnswers] = useState(
    () =>
      Object.fromEntries(
        main.map((g) => [
          g.id,
          {
            rsvp: g.rsvp === "pending" ? null : g.rsvp,
            dietary: g.dietary ?? "",
            accessibility: g.accessibility ?? "",
          },
        ]),
      ) as Record<string, { rsvp: "yes" | "no" | null; dietary: string; accessibility: string }>,
  );
  const [companions, setCompanions] = useState<string[]>(
    comps.filter((c) => !c.checked_in).map((c) => c.name),
  );
  const keptCheckedIn = comps.filter((c) => c.checked_in).length;
  const max = data.invitation.max_companions - keptCheckedIn;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [msgState, setMsgState] = useState<string | null>(null);
  const c = data.content;
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    void getPortalCover({ data: { cred: token } }).then((r) => setCover(r.url));
  }, [token]);
  const anyYes = Object.values(answers).some((a) => a.rsvp === "yes");
  const complete = main.every((g) => answers[g.id]?.rsvp);
  const locked = data.invitation.locked;

  const submit = async () => {
    const v = validateCompanions(anyYes ? companions : [], Math.max(0, max));
    if (!v.ok) return setFeedback({ ok: false, text: v.error });
    setBusy(true);
    setFeedback(null);
    const r = await portalRsvp(
      token,
      main.map((g) => ({
        id: g.id,
        rsvp: answers[g.id]!.rsvp!,
        dietary: answers[g.id]!.dietary,
        accessibility: answers[g.id]!.accessibility,
      })),
      v.names,
    );
    setBusy(false);
    if (!r.ok) return setFeedback({ ok: false, text: portalErrorMessage(r.error) });
    onChange(r);
    setFeedback({ ok: true, text: "Resposta registrada. Obrigado!" });
  };
  const send = async () => {
    const r = await portalMessage(token, msg);
    if (r.ok) {
      setMsg("");
      setMsgState("Mensagem enviada aos noivos.");
    } else setMsgState(portalErrorMessage(r.error));
  };

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:py-10">
      <div className="mx-auto max-w-xl space-y-5">
        {cover && (
          <img
            src={cover}
            alt="Foto do casal"
            className="aspect-[16/9] w-full rounded-3xl object-cover shadow-sm"
          />
        )}
        <header className="wed-card relative overflow-hidden p-6 text-center sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-wed-blush/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 size-44 rounded-full bg-wed-lavender/40 blur-3xl" />
          <div className="relative space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Ornament />
              <Heart className="size-5" aria-hidden />
              <Ornament />
            </div>
            {data.couple && (
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                {data.couple}
              </p>
            )}
            <h1 className="wed-display break-words text-3xl leading-tight sm:text-4xl">
              {c?.headline || "Você está convidado"}
            </h1>
            <p className="break-words text-sm text-muted-foreground">
              Convite para {data.invitation.label}
            </p>
          </div>
        </header>

        {c && (c.event_date || c.venue || c.message || c.guidance) && (
          <section className="wed-card space-y-3 p-5">
            {c.message && <p className="whitespace-pre-wrap break-words">{c.message}</p>}
            {c.event_date && (
              <p className="flex gap-2 text-sm">
                <CalendarHeart className="size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  {fmtDate(c.event_date)}
                  {c.event_time ? ` · ${c.event_time}` : ""}
                </span>
              </p>
            )}
            {(c.venue || c.address) && (
              <p className="flex gap-2 text-sm">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="break-words">
                  {[c.venue, c.address].filter(Boolean).join(" — ")}
                  {c.map_url && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        className="underline"
                        href={c.map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver mapa
                      </a>
                    </>
                  )}
                </span>
              </p>
            )}
            {c.guidance && (
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {c.guidance}
              </p>
            )}
            {c.rsvp_deadline && (
              <p className="text-xs text-muted-foreground">
                Responda até {fmtDate(c.rsvp_deadline)}.
              </p>
            )}
          </section>
        )}

        <section className="wed-card space-y-4 p-5" aria-labelledby="rsvp">
          <h2 id="rsvp" className="wed-display text-xl">
            Confirmação de presença
          </h2>
          {locked && (
            <p className="rounded-xl bg-muted p-3 text-sm">{portalErrorMessage("locked")}</p>
          )}
          {main.map((g) => {
            const a = answers[g.id]!;
            return (
              <fieldset key={g.id} className="space-y-2 rounded-xl border p-3" disabled={locked}>
                <legend className="px-1 font-medium break-words">
                  {g.name}
                  {g.checked_in && " · já chegou"}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="h-11"
                    variant={a.rsvp === "yes" ? "default" : "outline"}
                    aria-pressed={a.rsvp === "yes"}
                    onClick={() => setAnswers((s) => ({ ...s, [g.id]: { ...a, rsvp: "yes" } }))}
                  >
                    Vou
                  </Button>
                  <Button
                    type="button"
                    className="h-11"
                    variant={a.rsvp === "no" ? "default" : "outline"}
                    aria-pressed={a.rsvp === "no"}
                    onClick={() => setAnswers((s) => ({ ...s, [g.id]: { ...a, rsvp: "no" } }))}
                  >
                    Não poderei
                  </Button>
                </div>
                {a.rsvp === "yes" && (
                  <div className="grid gap-2">
                    <Input
                      aria-label={`Restrições alimentares de ${g.name}`}
                      className="h-11"
                      placeholder="Restrições alimentares (opcional)"
                      maxLength={300}
                      value={a.dietary}
                      onChange={(e) =>
                        setAnswers((s) => ({ ...s, [g.id]: { ...a, dietary: e.target.value } }))
                      }
                    />
                    <Input
                      aria-label={`Acessibilidade de ${g.name}`}
                      className="h-11"
                      placeholder="Precisa de acessibilidade? (opcional)"
                      maxLength={300}
                      value={a.accessibility}
                      onChange={(e) =>
                        setAnswers((s) => ({
                          ...s,
                          [g.id]: { ...a, accessibility: e.target.value },
                        }))
                      }
                    />
                  </div>
                )}
              </fieldset>
            );
          })}
          {anyYes && max > 0 && !locked && (
            <div className="space-y-2">
              <Label>Acompanhantes (até {max})</Label>
              {companions.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    aria-label={`Acompanhante ${i + 1}`}
                    className="h-11"
                    placeholder="Nome do acompanhante"
                    maxLength={120}
                    value={n}
                    onChange={(e) =>
                      setCompanions((s) => s.map((x, j) => (j === i ? e.target.value : x)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label="Remover acompanhante"
                    onClick={() => setCompanions((s) => s.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              {companions.length < max && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => setCompanions((s) => [...s, ""])}
                >
                  <Plus className="size-4" /> Adicionar acompanhante
                </Button>
              )}
            </div>
          )}
          {keptCheckedIn > 0 && (
            <p className="text-xs text-muted-foreground">
              {keptCheckedIn} acompanhante(s) já fizeram check-in.
            </p>
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
          {!locked && (
            <Button
              className="h-12 w-full"
              disabled={!complete || busy}
              onClick={() => void submit()}
            >
              {data.invitation.responded_at ? "Atualizar resposta" : "Enviar resposta"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Seus dados são usados apenas pelos noivos para organizar o casamento.
          </p>
        </section>

        <PortalGifts token={token} />

        <section className="wed-card space-y-3 p-5">
          <h2 className="wed-display text-xl">Mensagem aos noivos</h2>
          <Textarea
            aria-label="Mensagem aos noivos"
            maxLength={1000}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Escreva um recado (opcional)"
          />
          {msgState && (
            <p role="status" className="text-sm text-muted-foreground">
              {msgState}
            </p>
          )}
          <Button
            variant="outline"
            className="h-11"
            disabled={!msg.trim()}
            onClick={() => void send()}
          >
            Enviar mensagem
          </Button>
        </section>
      </div>
    </main>
  );
}
