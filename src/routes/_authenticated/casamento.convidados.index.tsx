import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingState } from "@/components/common/states";
import { OptionBadge, SectionTitle, Stat, WeddingShell } from "@/components/wedding/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApp } from "@/features/app/app-context";
import { useGuestMutations, useGuestsData } from "@/features/wedding/guests";
import {
  INVITATION_STATUS_LABEL,
  RSVP_LABEL,
  summarizeGuests,
  type Rsvp,
} from "@/features/wedding/guest-contracts";

export const Route = createFileRoute("/_authenticated/casamento/convidados/")({
  head: () => ({
    meta: [
      { title: "Convidados do casamento — Life OS" },
      { name: "description", content: "Convites individuais e por família, RSVP e acompanhantes." },
      { property: "og:title", content: "Convidados do casamento — Life OS" },
      { property: "og:description", content: "Lista de convidados e respostas do casal." },
    ],
  }),
  component: GuestsPage,
});

const RSVP_COLOR: Record<Rsvp, string> = { pending: "stone", yes: "sage", no: "blush" };

function GuestsPage() {
  const { workspaceId, userId } = useApp();
  const d = useGuestsData(workspaceId);
  const [q, setQ] = useState("");
  const [rsvp, setRsvp] = useState<"all" | Rsvp>("all");
  const summary = summarizeGuests(d.guests, d.activeCheckin.size);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return d.invitations
      .map((inv) => ({ inv, guests: d.guests.filter((g) => g.invitation_id === inv.id) }))
      .filter(({ inv, guests }) => {
        const matchText =
          !term ||
          inv.label.toLowerCase().includes(term) ||
          guests.some(
            (g) =>
              g.name.toLowerCase().includes(term) || g.group_label?.toLowerCase().includes(term),
          );
        const matchRsvp = rsvp === "all" || guests.some((g) => g.rsvp === rsvp);
        return matchText && matchRsvp;
      });
  }, [d.invitations, d.guests, q, rsvp]);

  if (d.loading) return <LoadingState />;
  return (
    <WeddingShell
      title="Convidados"
      subtitle="Convites individuais ou por família. Cada convite tem seu próprio link secreto."
      action={<NewInvitation workspaceId={workspaceId} userId={userId} />}
    >
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Pessoas"
          value={String(summary.total)}
          hint={`${summary.companions} acompanhante(s)`}
        />
        <Stat label="Confirmadas" value={String(summary.yes)} />
        <Stat label="Aguardando" value={String(summary.pending)} />
        <Stat label="Não poderão ir" value={String(summary.no)} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/casamento/convidados/pagina"
          className="wed-card inline-flex min-h-11 items-center gap-2 px-4 text-sm font-medium"
        >
          <Mail className="size-4" aria-hidden /> Página dos convidados e mensagens
          {d.messages.some((m) => !m.read_at) && (
            <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
              {d.messages.filter((m) => !m.read_at).length}
            </span>
          )}
        </Link>
      </div>

      <section className="wed-card space-y-3 p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Buscar convidados"
              className="h-11 pl-9"
              placeholder="Buscar por nome, convite ou grupo"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por resposta">
            {(["all", "pending", "yes", "no"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={rsvp === k ? "default" : "outline"}
                className="h-11"
                onClick={() => setRsvp(k)}
              >
                {k === "all" ? "Todos" : RSVP_LABEL[k]}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {d.invitations.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum convite ainda"
          description="Crie o primeiro convite — individual ou para uma família inteira."
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum convite encontrado com esses filtros.
        </p>
      ) : (
        <section>
          <SectionTitle>{filtered.length} convite(s)</SectionTitle>
          <ul className="grid gap-3 md:grid-cols-2">
            {filtered.map(({ inv, guests }) => (
              <li key={inv.id}>
                <Link
                  to="/casamento/convidados/$invitationId"
                  params={{ invitationId: inv.id }}
                  className="wed-card block h-full space-y-3 p-4 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="wed-display break-words text-lg leading-tight">{inv.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.kind === "group" ? "Família / grupo" : "Individual"} · até{" "}
                        {inv.max_companions} acompanhante(s)
                      </p>
                    </div>
                    <OptionBadge
                      label={INVITATION_STATUS_LABEL[inv.status] ?? inv.status}
                      color={inv.revoked_at ? "blush" : "lavender"}
                    />
                  </div>
                  <ul className="space-y-1.5">
                    {guests.map((g) => (
                      <li
                        key={g.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 break-words">
                          {g.name}
                          {g.is_companion && (
                            <span className="text-xs text-muted-foreground"> · acompanhante</span>
                          )}
                        </span>
                        <span className="flex gap-1">
                          {d.activeCheckin.has(g.id) && <OptionBadge label="Chegou" color="gold" />}
                          <OptionBadge
                            label={RSVP_LABEL[g.rsvp as Rsvp]}
                            color={RSVP_COLOR[g.rsvp as Rsvp]}
                          />
                        </span>
                      </li>
                    ))}
                    {guests.length === 0 && (
                      <li className="text-sm text-muted-foreground">Sem pessoas neste convite.</li>
                    )}
                  </ul>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </WeddingShell>
  );
}

function NewInvitation({
  workspaceId,
  userId,
}: {
  workspaceId?: string | undefined;
  userId?: string | undefined;
}) {
  const m = useGuestMutations(workspaceId, userId);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"individual" | "group">("individual");
  const [label, setLabel] = useState("");
  const [max, setMax] = useState(0);
  const [group, setGroup] = useState("");
  const [people, setPeople] = useState<{ name: string; contact: string }[]>([
    { name: "", contact: "" },
  ]);
  const reset = () => {
    setKind("individual");
    setLabel("");
    setMax(0);
    setGroup("");
    setPeople([{ name: "", contact: "" }]);
  };
  const names = people.filter((p) => p.name.trim());
  const valid =
    names.length > 0 &&
    (kind === "group" ? label.trim() : true) &&
    (kind === "group" || names.length === 1);
  const submit = () =>
    m.createInvitation.mutate(
      {
        kind,
        label: (kind === "individual" ? label.trim() || (names[0]?.name ?? "") : label).trim(),
        max_companions: max,
        guests: names.map((p) => ({
          name: p.name,
          contact: p.contact || null,
          group_label: group || null,
        })),
      },
      {
        onSuccess: (id) => {
          setOpen(false);
          reset();
          toast.success("Convite criado. Gere o link quando quiser enviar.");
          void navigate({
            to: "/casamento/convidados/$invitationId",
            params: { invitationId: id },
          });
        },
        onError: (e) => toast.error(e.message),
      },
    );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11">
          <Plus className="size-4" /> Novo convite
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo convite</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de convite">
            {(["individual", "group"] as const).map((k) => (
              <Button
                key={k}
                type="button"
                variant={kind === k ? "default" : "outline"}
                className="h-11"
                onClick={() => {
                  setKind(k);
                  if (k === "individual") setPeople((p) => p.slice(0, 1));
                }}
              >
                {k === "individual" ? "Individual" : "Família / grupo"}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-label">
              {kind === "group"
                ? "Nome do convite (ex.: Família Souza)"
                : "Nome do convite (opcional)"}
            </Label>
            <Input
              id="inv-label"
              className="h-11"
              value={label}
              maxLength={120}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-max">Acompanhantes permitidos</Label>
              <Input
                id="inv-max"
                type="number"
                min={0}
                max={20}
                className="h-11"
                value={max}
                onChange={(e) => setMax(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-group">Grupo (opcional)</Label>
              <Input
                id="inv-group"
                className="h-11"
                placeholder="Família, amigos…"
                value={group}
                maxLength={80}
                onChange={(e) => setGroup(e.target.value)}
              />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {kind === "group" ? "Pessoas do convite" : "Pessoa convidada"}
            </legend>
            {people.map((p, i) => (
              <div key={i} className="grid gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  aria-label={`Nome da pessoa ${i + 1}`}
                  className="h-11"
                  placeholder="Nome"
                  value={p.name}
                  maxLength={120}
                  onChange={(e) =>
                    setPeople((s) =>
                      s.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  aria-label={`Contato da pessoa ${i + 1}`}
                  className="h-11"
                  placeholder="Contato (opcional)"
                  value={p.contact}
                  maxLength={160}
                  onChange={(e) =>
                    setPeople((s) =>
                      s.map((x, j) => (j === i ? { ...x, contact: e.target.value } : x)),
                    )
                  }
                />
                {people.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label="Remover pessoa"
                    onClick={() => setPeople((s) => s.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {kind === "group" && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                onClick={() => setPeople((s) => [...s, { name: "", contact: "" }])}
              >
                <Plus className="size-4" /> Adicionar pessoa
              </Button>
            )}
          </fieldset>
          <p className="text-xs text-muted-foreground">
            Contatos são opcionais e nunca aparecem para os convidados.
          </p>
        </div>
        <DialogFooter>
          <Button
            className="h-11"
            disabled={!valid || m.createInvitation.isPending}
            onClick={submit}
          >
            Criar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
