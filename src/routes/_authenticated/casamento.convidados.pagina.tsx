import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LoadingState } from "@/components/common/states";
import { BackLink } from "@/components/wedding/back";
import { SectionTitle, WeddingShell } from "@/components/wedding/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/features/app/app-context";
import { useGuestMutations, useGuestsData, usePublicContent } from "@/features/wedding/guests";

export const Route = createFileRoute("/_authenticated/casamento/convidados/pagina")({
  head: () => ({
    meta: [
      { title: "Página dos convidados — Casamento · Life OS" },
      {
        name: "description",
        content: "O que os convidados veem no convite e as mensagens recebidas.",
      },
      { property: "og:title", content: "Página dos convidados — Life OS" },
      { property: "og:description", content: "Informações publicadas pelo casal." },
    ],
  }),
  component: PublicPage,
});

const EMPTY = {
  headline: "",
  message: "",
  event_date: "",
  event_time: "",
  venue: "",
  address: "",
  map_url: "",
  guidance: "",
  rsvp_deadline: "",
};

function PublicPage() {
  const { workspaceId, userId } = useApp();
  const content = usePublicContent(workspaceId);
  const d = useGuestsData(workspaceId);
  const m = useGuestMutations(workspaceId, userId);
  const [f, setF] = useState(EMPTY);
  const [published, setPublished] = useState(false);
  useEffect(() => {
    const c = content.data;
    if (!c) return;
    setPublished(c.published);
    setF({
      headline: c.headline ?? "",
      message: c.message ?? "",
      event_date: c.event_date ?? "",
      event_time: c.event_time ?? "",
      venue: c.venue ?? "",
      address: c.address ?? "",
      map_url: c.map_url ?? "",
      guidance: c.guidance ?? "",
      rsvp_deadline: c.rsvp_deadline ?? "",
    });
  }, [content.data]);
  if (content.isLoading || d.loading) return <LoadingState />;
  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));
  const n = (v: string) => v.trim() || null;
  const save = () => {
    if (f.map_url.trim() && !/^https:\/\//.test(f.map_url.trim())) {
      toast.error("O link do mapa deve começar com https://");
      return;
    }
    m.savePublicContent.mutate(
      {
        published,
        headline: n(f.headline),
        message: n(f.message),
        event_date: n(f.event_date),
        event_time: n(f.event_time),
        venue: n(f.venue),
        address: n(f.address),
        map_url: n(f.map_url),
        guidance: n(f.guidance),
        rsvp_deadline: n(f.rsvp_deadline),
      },
      {
        onSuccess: () =>
          toast.success(published ? "Página publicada para os convidados" : "Rascunho salvo"),
        onError: (e) => toast.error(e.message),
      },
    );
  };
  const field = (
    k: keyof typeof f,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} className="h-11" value={f[k]} onChange={set(k)} {...props} />
    </div>
  );
  return (
    <WeddingShell
      title="Página dos convidados"
      subtitle="Tudo é opcional. Só aparece no convite o que vocês publicarem."
      back={<BackLink to="/casamento/convidados" label="Convidados" />}
    >
      <section className="wed-card space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <div>
            <p className="font-medium">Publicar informações</p>
            <p className="text-xs text-muted-foreground">
              Desligado: os convidados veem apenas o formulário de resposta.
            </p>
          </div>
          <Switch
            checked={published}
            onCheckedChange={setPublished}
            aria-label="Publicar informações"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("headline", "Título", { maxLength: 160 })}
          {field("venue", "Local", { maxLength: 160 })}
          {field("event_date", "Data", { type: "date" })}
          {field("event_time", "Horário", { maxLength: 60, placeholder: "ex.: 16h" })}
          {field("address", "Endereço", { maxLength: 300 })}
          {field("map_url", "Link do mapa", { placeholder: "https://", maxLength: 500 })}
          {field("rsvp_deadline", "Responder até", { type: "date" })}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="message">Mensagem do casal</Label>
          <Textarea id="message" maxLength={2000} value={f.message} onChange={set("message")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="guidance">Orientações (traje, estacionamento…)</Label>
          <Textarea id="guidance" maxLength={2000} value={f.guidance} onChange={set("guidance")} />
        </div>
        <Button className="h-11" onClick={save} disabled={m.savePublicContent.isPending}>
          Salvar
        </Button>
      </section>

      <section className="wed-card p-4 sm:p-5">
        <SectionTitle>Mensagens dos convidados ({d.messages.length})</SectionTitle>
        {d.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
        ) : (
          <ul className="space-y-3">
            {d.messages.map((msg) => (
              <li
                key={msg.id}
                className={`rounded-xl border p-3 ${msg.read_at ? "opacity-70" : ""}`}
              >
                <p className="text-xs text-muted-foreground">
                  {d.invitations.find((i) => i.id === msg.invitation_id)?.label ?? "Convite"} ·{" "}
                  {new Date(msg.created_at).toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{msg.body}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-9"
                  onClick={() => m.markMessage.mutate({ id: msg.id, read: !msg.read_at })}
                >
                  {msg.read_at ? "Marcar como não lida" : "Marcar como lida"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="wed-card p-4 sm:p-5">
        <SectionTitle>Lixeira de convidados ({d.archivedGuests.length})</SectionTitle>
        {d.archivedGuests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Vazia.</p>
        ) : (
          <ul className="space-y-2">
            {d.archivedGuests.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="break-words">
                  {g.name}
                  {!g.invitation_id && (
                    <span className="text-xs text-muted-foreground"> · sem convite</span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() =>
                    m.updateGuest.mutate(
                      { id: g.id, archived_at: null },
                      { onError: (e) => toast.error(e.message) },
                    )
                  }
                >
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WeddingShell>
  );
}
