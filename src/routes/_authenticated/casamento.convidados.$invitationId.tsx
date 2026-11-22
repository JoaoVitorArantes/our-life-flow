import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import QRCode from "qrcode";
import { Copy, KeyRound, Link2Off, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingState } from "@/components/common/states";
import { BackLink } from "@/components/wedding/back";
import { Confirm } from "@/components/wedding/confirm";
import { OptionBadge, SectionTitle, WeddingShell } from "@/components/wedding/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/features/app/app-context";
import {
  useGuestList,
  useGuestMutations,
  useGuestsData,
  type WeddingGuest,
} from "@/features/wedding/guests";
import {
  formatCode,
  INVITATION_STATUS_LABEL,
  inviteLink,
  RSVP_LABEL,
  type Rsvp,
} from "@/features/wedding/guest-contracts";

export const Route = createFileRoute("/_authenticated/casamento/convidados/$invitationId")({
  head: () => ({
    meta: [
      { title: "Convite — Casamento · Life OS" },
      { name: "description", content: "Pessoas, link secreto e respostas de um convite." },
      { property: "og:title", content: "Convite — Casamento · Life OS" },
      { property: "og:description", content: "Detalhes de um convite do casamento." },
    ],
  }),
  component: InvitationPage,
});

const AUDIT_LABEL: Record<string, string> = {
  link_issued: "Link gerado",
  link_revoked: "Link revogado",
  guest_added: "Pessoa adicionada",
  rsvp_yes: "Confirmou presença",
  rsvp_no: "Recusou",
  rsvp_pending: "Resposta reaberta",
  checkin: "Check-in",
  checkin_undone: "Check-in desfeito",
};

function InvitationPage() {
  const { invitationId } = Route.useParams();
  const { workspaceId, userId } = useApp();
  const d = useGuestsData(workspaceId);
  const audit = useGuestList("wedding_guest_audit", workspaceId);
  const m = useGuestMutations(workspaceId, userId);
  const navigate = useNavigate();
  const inv = d.invitations.find((i) => i.id === invitationId);
  const [form, setForm] = useState({ label: "", max: 0 });
  const [secret, setSecret] = useState<{ link: string; code: string; qr: string } | null>(null);
  const [newName, setNewName] = useState("");
  useEffect(() => {
    if (inv) setForm({ label: inv.label, max: inv.max_companions });
  }, [inv?.id, inv?.label, inv?.max_companions]); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading) return <LoadingState />;
  if (!inv)
    return (
      <WeddingShell
        title="Convite"
        back={<BackLink to="/casamento/convidados" label="Convidados" />}
      >
        <EmptyState
          icon={KeyRound}
          title="Convite não encontrado"
          description="Ele pode ter sido removido."
        />
      </WeddingShell>
    );
  const guests = d.guests.filter((g) => g.invitation_id === inv.id);
  const history = (audit.data ?? [])
    .filter((a) => a.invitation_id === inv.id || guests.some((g) => g.id === a.guest_id))
    .slice(-20)
    .reverse();
  const err = (e: Error) => toast.error(e.message);

  const issue = () =>
    m.issueLink.mutate(inv.id, {
      onSuccess: async ({ token, code }) => {
        const link = inviteLink(window.location.origin, token);
        const qr = await QRCode.toDataURL(link, { margin: 1, width: 320 });
        setSecret({ link, code: formatCode(code), qr });
      },
      onError: err,
    });

  return (
    <WeddingShell
      title={inv.label}
      subtitle={`${inv.kind === "group" ? "Família / grupo" : "Individual"} · ${INVITATION_STATUS_LABEL[inv.status] ?? inv.status}`}
      back={<BackLink to="/casamento/convidados" label="Convidados" />}
    >
      <section className="wed-card space-y-3 p-4 sm:p-5">
        <SectionTitle>Link e código</SectionTitle>
        {secret ? (
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <img
              src={secret.qr}
              alt="QR code do convite"
              className="mx-auto size-40 rounded-xl bg-background p-2"
            />
            <div className="min-w-0 space-y-3">
              <p className="text-sm text-muted-foreground">
                Copie agora: por segurança, o link e o código não ficam visíveis depois. Gerar de
                novo invalida os anteriores.
              </p>
              <div className="space-y-1">
                <Label>Link individual</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={secret.link}
                    className="h-11 min-w-0"
                    aria-label="Link do convite"
                  />
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(secret.link)
                        .then(() => toast.success("Link copiado"))
                    }
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Código</Label>
                <p className="wed-display text-2xl tracking-[0.2em]">{secret.code}</p>
              </div>
              <Button
                variant="outline"
                className="h-11"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(
                      `Você recebeu um convite! Responda em: ${secret.link}\nCódigo: ${secret.code}`,
                    )
                    .then(() => toast.success("Mensagem copiada"))
                }
              >
                <Copy className="size-4" /> Copiar mensagem pronta
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {inv.revoked_at
              ? "Link revogado — ninguém consegue abrir este convite."
              : inv.link_issued_at
                ? `Link ativo desde ${new Date(inv.link_issued_at).toLocaleString("pt-BR")}.`
                : "Nenhum link gerado ainda."}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {inv.link_issued_at && !inv.revoked_at ? (
            <Confirm
              trigger={
                <Button variant="outline" className="h-11">
                  <KeyRound className="size-4" /> Gerar novo link
                </Button>
              }
              title="Gerar novo link?"
              description="O link e o código atuais deixarão de funcionar."
              onConfirm={issue}
            />
          ) : (
            <Button className="h-11" onClick={issue} disabled={m.issueLink.isPending}>
              <KeyRound className="size-4" /> Gerar link e código
            </Button>
          )}
          {inv.link_issued_at && !inv.revoked_at && (
            <Confirm
              trigger={
                <Button variant="outline" className="h-11">
                  <Link2Off className="size-4" /> Revogar
                </Button>
              }
              title="Revogar acesso?"
              description="O convidado não conseguirá mais abrir o convite até um novo link ser gerado."
              onConfirm={() =>
                m.updateInvitation.mutate(
                  { id: inv.id, revoked_at: new Date().toISOString(), status: "revoked" },
                  { onSuccess: () => setSecret(null), onError: err },
                )
              }
            />
          )}
          <Button
            variant="outline"
            className="h-11"
            onClick={() =>
              m.updateInvitation.mutate(
                { id: inv.id, rsvp_locked: !inv.rsvp_locked },
                { onError: err },
              )
            }
          >
            {inv.rsvp_locked ? (
              <>
                <Unlock className="size-4" /> Reabrir respostas
              </>
            ) : (
              <>
                <Lock className="size-4" /> Encerrar respostas
              </>
            )}
          </Button>
        </div>
      </section>

      <section className="wed-card grid gap-3 p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end sm:p-5">
        <div className="space-y-1.5">
          <Label htmlFor="label">Nome do convite</Label>
          <Input
            id="label"
            className="h-11"
            maxLength={120}
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max">Acompanhantes permitidos</Label>
          <Input
            id="max"
            type="number"
            min={0}
            max={20}
            className="h-11"
            value={form.max}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                max: Math.max(0, Math.min(20, Number(e.target.value) || 0)),
              }))
            }
          />
        </div>
        <Button
          className="h-11"
          disabled={!form.label.trim()}
          onClick={() =>
            m.updateInvitation.mutate(
              { id: inv.id, label: form.label.trim(), max_companions: form.max },
              { onSuccess: () => toast.success("Convite salvo"), onError: err },
            )
          }
        >
          Salvar
        </Button>
      </section>

      <section>
        <SectionTitle>Pessoas ({guests.length})</SectionTitle>
        <ul className="grid gap-3 lg:grid-cols-2">
          {guests.map((g) => (
            <GuestEditor key={g.id} guest={g} checkedIn={d.activeCheckin.has(g.id)} m={m} />
          ))}
        </ul>
        {inv.kind === "group" && (
          <div className="mt-3 flex gap-2">
            <Input
              aria-label="Nome da nova pessoa"
              className="h-11"
              placeholder="Adicionar pessoa ao convite"
              value={newName}
              maxLength={120}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button
              className="h-11"
              disabled={!newName.trim()}
              onClick={() =>
                m.addGuest.mutate(
                  { invitation_id: inv.id, name: newName.trim() },
                  { onSuccess: () => setNewName(""), onError: err },
                )
              }
            >
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
        )}
      </section>

      <section className="wed-card p-4 sm:p-5">
        <SectionTitle>Histórico</SectionTitle>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registros ainda.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {AUDIT_LABEL[h.action] ?? h.action}
                  {h.via_portal ? " · pelo convidado" : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Confirm
        trigger={
          <Button variant="ghost" className="h-11 text-destructive">
            <Trash2 className="size-4" /> Excluir convite
          </Button>
        }
        title="Excluir este convite?"
        description="O link deixa de funcionar e as pessoas do convite vão para a lixeira de convidados."
        onConfirm={() =>
          m.deleteInvitation.mutate(inv.id, {
            onSuccess: () => void navigate({ to: "/casamento/convidados" }),
            onError: err,
          })
        }
      />
    </WeddingShell>
  );
}

function GuestEditor({
  guest,
  checkedIn,
  m,
}: {
  guest: WeddingGuest;
  checkedIn: boolean;
  m: ReturnType<typeof useGuestMutations>;
}) {
  const [f, setF] = useState({
    name: guest.name,
    contact: guest.contact ?? "",
    group_label: guest.group_label ?? "",
    dietary: guest.dietary ?? "",
    accessibility: guest.accessibility ?? "",
    internal_notes: guest.internal_notes ?? "",
  });
  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));
  const err = (e: Error) => toast.error(e.message);
  const nul = (v: string) => v.trim() || null;
  return (
    <li className="wed-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="wed-display min-w-0 break-words text-lg">
          {guest.name}
          {guest.is_companion && (
            <span className="text-xs text-muted-foreground"> · acompanhante</span>
          )}
        </p>
        <div className="flex gap-1">
          {checkedIn && <OptionBadge label="Chegou" color="gold" />}
          <OptionBadge
            label={RSVP_LABEL[guest.rsvp as Rsvp]}
            color={guest.rsvp === "yes" ? "sage" : guest.rsvp === "no" ? "blush" : "stone"}
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          aria-label="Nome"
          className="h-11"
          maxLength={120}
          value={f.name}
          onChange={set("name")}
        />
        <Input
          aria-label="Contato"
          className="h-11"
          placeholder="Contato (interno)"
          maxLength={160}
          value={f.contact}
          onChange={set("contact")}
        />
        <Input
          aria-label="Grupo"
          className="h-11"
          placeholder="Grupo"
          maxLength={80}
          value={f.group_label}
          onChange={set("group_label")}
        />
        <Input
          aria-label="Restrições alimentares"
          className="h-11"
          placeholder="Restrições alimentares"
          maxLength={300}
          value={f.dietary}
          onChange={set("dietary")}
        />
        <Input
          aria-label="Acessibilidade"
          className="h-11 sm:col-span-2"
          placeholder="Acessibilidade"
          maxLength={300}
          value={f.accessibility}
          onChange={set("accessibility")}
        />
        <Textarea
          aria-label="Notas internas"
          className="sm:col-span-2"
          placeholder="Notas internas (só vocês veem)"
          maxLength={1000}
          value={f.internal_notes}
          onChange={set("internal_notes")}
        />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Resposta manual">
        {(["pending", "yes", "no"] as const).map((r) => (
          <Button
            key={r}
            size="sm"
            variant={guest.rsvp === r ? "default" : "outline"}
            className="h-10"
            onClick={() =>
              m.updateGuest.mutate(
                {
                  id: guest.id,
                  rsvp: r,
                  responded_at: r === "pending" ? null : new Date().toISOString(),
                },
                { onError: err },
              )
            }
          >
            {RSVP_LABEL[r]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          className="h-11"
          disabled={!f.name.trim()}
          onClick={() =>
            m.updateGuest.mutate(
              {
                id: guest.id,
                name: f.name.trim(),
                contact: nul(f.contact),
                group_label: nul(f.group_label),
                dietary: nul(f.dietary),
                accessibility: nul(f.accessibility),
                internal_notes: nul(f.internal_notes),
              },
              { onSuccess: () => toast.success("Salvo"), onError: err },
            )
          }
        >
          Salvar
        </Button>
        <Confirm
          trigger={
            <Button variant="ghost" className="h-11">
              <Trash2 className="size-4" /> Remover
            </Button>
          }
          title={`Remover ${guest.name}?`}
          description="A pessoa vai para a lixeira de convidados e pode ser restaurada."
          onConfirm={() =>
            m.updateGuest.mutate(
              { id: guest.id, archived_at: new Date().toISOString() },
              { onError: err },
            )
          }
        />
      </div>
    </li>
  );
}
