import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Archive, ChevronLeft, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingState } from "@/components/common/states";
import { OptionBadge, SectionTitle, Stat, WeddingShell } from "@/components/wedding/shell";
import { GiftFormDialog } from "@/components/wedding/gift-form";
import { Confirm } from "@/components/wedding/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApp } from "@/features/app/app-context";
import { useGiftMutations, useGiftsData, type WeddingGiftPledge } from "@/features/wedding/gifts";
import { useGuestList } from "@/features/wedding/guests";
import { useWeddingImage } from "@/features/wedding/api";
import {
  GIFT_KIND_LABEL,
  PLEDGE_STATE_LABEL,
  availability,
  effectiveState,
  parseMoney,
  summarizePledges,
  type GiftKind,
  type PledgeState,
} from "@/features/wedding/gift-contracts";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/casamento/presentes/$giftId")({
  head: () => ({
    meta: [
      { title: "Presente do casamento — Life OS" },
      { name: "description", content: "Detalhe do presente, reservas e confirmação manual." },
      { property: "og:title", content: "Presente do casamento — Life OS" },
      { property: "og:description", content: "Reservas e recebimentos deste presente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GiftDetail,
});

const STATE_COLOR: Record<PledgeState, string> = {
  pending: "gold",
  confirmed: "sage",
  cancelled: "stone",
  expired: "stone",
};
const fmtDT = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function Back() {
  return (
    <Link
      to="/casamento/presentes"
      className="inline-flex min-h-9 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden /> Presentes
    </Link>
  );
}

function GiftDetail() {
  const { giftId } = Route.useParams();
  const { workspaceId, userId } = useApp();
  const d = useGiftsData(workspaceId);
  const m = useGiftMutations(workspaceId, userId);
  const invitations = useGuestList("wedding_invitations", workspaceId);
  const navigate = useNavigate();
  const gift = d.gifts.find((g) => g.id === giftId);
  const image = useWeddingImage(gift?.image_path);
  if (d.loading || !workspaceId) return <LoadingState />;
  if (!gift)
    return (
      <WeddingShell title="Presente não encontrado" back={<Back />}>
        <EmptyState
          icon={Trash2}
          title="Presente não encontrado"
          description="Ele pode ter sido excluído."
        />
      </WeddingShell>
    );
  const kind = gift.kind as GiftKind;
  const pledges = d.pledges.filter((p) => p.gift_id === gift.id);
  const s = summarizePledges(pledges);
  const avail = availability(gift, d.pledges);
  const total = gift.quantity_total ?? gift.quota_total;
  const invLabel = (id: string) =>
    (invitations.data ?? []).find((i) => i.id === id)?.label ?? "Convite removido";
  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    }
  };

  return (
    <WeddingShell
      title={gift.title}
      subtitle={GIFT_KIND_LABEL[kind]}
      back={<Back />}
      action={
        <>
          <GiftFormDialog
            gift={gift}
            workspaceId={workspaceId}
            onSave={async (v) => {
              const { kind: _k, ...patch } = v;
              await m.updateGift.mutateAsync({ id: gift.id, ...patch });
              toast.success("Presente atualizado.");
            }}
            trigger={
              <Button variant="outline" className="h-11">
                <Pencil className="size-4" /> Editar
              </Button>
            }
          />
          {gift.archived_at ? (
            <Button
              variant="outline"
              className="h-11"
              onClick={() =>
                void run(
                  m.updateGift.mutateAsync({ id: gift.id, archived_at: null }),
                  "Presente restaurado.",
                )
              }
            >
              <RotateCcw className="size-4" /> Restaurar
            </Button>
          ) : (
            <Confirm
              title="Arquivar presente?"
              description="Ele sai do portal e da lista principal. As reservas são mantidas."
              confirmLabel="Arquivar"
              onConfirm={() =>
                void run(
                  m.updateGift.mutateAsync({ id: gift.id, archived_at: new Date().toISOString() }),
                  "Presente arquivado.",
                )
              }
              trigger={
                <Button variant="outline" className="h-11">
                  <Archive className="size-4" /> Arquivar
                </Button>
              }
            />
          )}
          {pledges.length === 0 && (
            <Confirm
              title="Excluir presente?"
              description="Ele ainda não tem reservas. Esta ação não pode ser desfeita."
              confirmLabel="Excluir"
              onConfirm={() =>
                void m.deleteGift
                  .mutateAsync(gift.id)
                  .then(() => {
                    toast.success("Presente excluído.");
                    void navigate({ to: "/casamento/presentes" });
                  })
                  .catch((e: Error) => toast.error(e.message))
              }
              trigger={
                <Button variant="ghost" className="h-11 text-destructive">
                  <Trash2 className="size-4" /> Excluir
                </Button>
              }
            />
          )}
        </>
      }
    >
      {(gift.description ||
        gift.external_url ||
        image.data ||
        !gift.is_visible ||
        gift.archived_at) && (
        <section className="wed-card grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_14rem] sm:p-5">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {!gift.is_visible && <OptionBadge label="Oculto no portal" color="stone" />}
              {gift.archived_at && <OptionBadge label="Arquivado" color="stone" />}
            </div>
            {gift.description && (
              <p className="whitespace-pre-wrap break-words text-sm">{gift.description}</p>
            )}
            {gift.external_url && (
              <a
                href={gift.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm text-primary underline"
              >
                Link de referência
              </a>
            )}
          </div>
          {image.data && (
            <img src={image.data} alt="" className="h-40 w-full rounded-xl object-cover" />
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kind === "fund" ? (
          <Stat
            label="Sugestão"
            value={gift.suggested_amount ? formatCurrency(Number(gift.suggested_amount)) : "Livre"}
          />
        ) : (
          <Stat label="Disponível" value={`${avail} de ${total}`} />
        )}
        {kind === "quota" && (
          <Stat label="Valor da cota" value={formatCurrency(Number(gift.quota_amount))} />
        )}
        {kind === "fund" && (
          <Stat
            label="Meta (só vocês)"
            value={gift.goal_amount ? formatCurrency(Number(gift.goal_amount)) : "—"}
          />
        )}
        <Stat label="Aguardando" value={String(s.pending)} />
        <Stat
          label="Recebido"
          value={kind === "physical" ? String(s.confirmed) : formatCurrency(s.confirmedAmount)}
        />
      </div>

      <section>
        <SectionTitle>Reservas e intenções</SectionTitle>
        {pledges.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma reserva ainda.</p>
        ) : (
          <ul className="space-y-2">
            {pledges.map((p) => (
              <PledgeRow
                key={p.id}
                p={p}
                kind={kind}
                invitation={invLabel(p.invitation_id)}
                onConfirm={(amount) =>
                  run(m.confirm.mutateAsync({ id: p.id, amount }), "Recebimento confirmado.")
                }
                onCancel={(reason) =>
                  run(m.cancel.mutateAsync({ id: p.id, reason }), "Reserva cancelada.")
                }
                onReopen={() => run(m.reopen.mutateAsync(p.id), "Reserva reaberta.")}
              />
            ))}
          </ul>
        )}
      </section>
    </WeddingShell>
  );
}

function PledgeRow({
  p,
  kind,
  invitation,
  onConfirm,
  onCancel,
  onReopen,
}: {
  p: WeddingGiftPledge;
  kind: GiftKind;
  invitation: string;
  onConfirm: (amount?: number) => Promise<void>;
  onCancel: (reason: string) => Promise<void>;
  onReopen: () => Promise<void>;
}) {
  const state = effectiveState(p);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(
    p.amount != null ? Number(p.amount).toFixed(2).replace(".", ",") : "",
  );
  const [open, setOpen] = useState<"cancel" | "confirm" | null>(null);
  const value =
    kind === "fund"
      ? formatCurrency(Number(p.amount))
      : kind === "quota"
        ? `${p.units} cota(s) · ${formatCurrency(Number(p.amount))}`
        : `${p.units} unidade(s)`;
  return (
    <li className="wed-card space-y-2 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words font-medium">{invitation}</p>
        <OptionBadge label={PLEDGE_STATE_LABEL[state]} color={STATE_COLOR[state]} />
      </div>
      <p className="text-sm">{value}</p>
      {p.message && (
        <p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-2 text-sm">
          {p.message}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Feita em {fmtDT(p.created_at)}
        {state === "pending" && ` · vence em ${fmtDT(p.expires_at)}`}
        {p.confirmed_at && ` · recebida em ${fmtDT(p.confirmed_at)}`}
        {p.cancel_reason && ` · motivo: ${p.cancel_reason}`}
        {p.cancelled_by_kind === "guest" && " · cancelada pelo convidado"}
      </p>
      <div className="flex flex-wrap gap-2">
        {state === "pending" && (
          <Dialog open={open === "confirm"} onOpenChange={(o) => setOpen(o ? "confirm" : null)}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-10">
                Confirmar recebimento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar recebimento?</DialogTitle>
                <DialogDescription>
                  Confirme só depois de conferir que o presente ou valor chegou. O sistema não
                  verifica pagamentos.
                </DialogDescription>
              </DialogHeader>
              {kind === "fund" && (
                <div className="space-y-1.5">
                  <Label htmlFor={`amt-${p.id}`}>Valor recebido (R$)</Label>
                  <Input
                    id={`amt-${p.id}`}
                    className="h-11"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              )}
              <DialogFooter>
                <Button
                  className="h-11"
                  onClick={() => {
                    let a: number | undefined;
                    if (kind === "fund") {
                      const v = parseMoney(amount);
                      if (v == null || !Number.isFinite(v) || v <= 0 || v > 50000) {
                        toast.error("Valor entre R$ 0,01 e R$ 50.000,00.");
                        return;
                      }
                      a = v;
                    }
                    void onConfirm(a).then(() => setOpen(null));
                  }}
                >
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {(state === "pending" || state === "confirmed") && (
          <Dialog open={open === "cancel"} onOpenChange={(o) => setOpen(o ? "cancel" : null)}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-10">
                Cancelar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancelar reserva?</DialogTitle>
                <DialogDescription>
                  A disponibilidade é liberada e o cancelamento fica no histórico.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor={`why-${p.id}`}>Motivo</Label>
                <Input
                  id={`why-${p.id}`}
                  className="h-11"
                  maxLength={200}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  className="h-11"
                  variant="destructive"
                  disabled={!reason.trim()}
                  onClick={() => void onCancel(reason).then(() => setOpen(null))}
                >
                  Cancelar reserva
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {(state === "cancelled" || state === "expired") && (
          <Confirm
            title="Reabrir reserva?"
            description="Ela volta a ficar pendente por um novo prazo, se ainda houver disponibilidade."
            confirmLabel="Reabrir"
            onConfirm={() => void onReopen()}
            trigger={
              <Button size="sm" variant="outline" className="h-10">
                Reabrir
              </Button>
            }
          />
        )}
      </div>
    </li>
  );
}
