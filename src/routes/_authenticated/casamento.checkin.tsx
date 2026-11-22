import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, CheckCircle2, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/common/states";
import { Stat, WeddingShell } from "@/components/wedding/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/features/app/app-context";
import { useGuestMutations, useGuestsData } from "@/features/wedding/guests";
import { credentialFromInput } from "@/features/wedding/guest-contracts";

export const Route = createFileRoute("/_authenticated/casamento/checkin")({
  head: () => ({
    meta: [
      { title: "Check-in do casamento — Life OS" },
      {
        name: "description",
        content: "Registrar a chegada dos convidados por nome, código ou QR.",
      },
      { property: "og:title", content: "Check-in do casamento — Life OS" },
      { property: "og:description", content: "Recepção rápida dos convidados." },
    ],
  }),
  component: CheckinPage,
});

function CheckinPage() {
  const { workspaceId, userId } = useApp();
  const d = useGuestsData(workspaceId);
  const m = useGuestMutations(workspaceId, userId);
  const [q, setQ] = useState("");
  const [code, setCode] = useState("");
  const [invFilter, setInvFilter] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return d.guests
      .filter((g) => (invFilter ? g.invitation_id === invFilter : true))
      .filter((g) => !t || g.name.toLowerCase().includes(t))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, invFilter || t ? 100 : 30);
  }, [d.guests, q, invFilter]);
  if (d.loading) return <LoadingState />;
  const err = (e: Error) => toast.error(e.message);
  const lookup = async (raw: string) => {
    try {
      const id = await m.findByCode(credentialFromInput(raw));
      if (!id) {
        toast.error("Código não encontrado neste casamento.");
        return;
      }
      setInvFilter(id);
      setQ("");
      setCode("");
    } catch (e) {
      err(e as Error);
    }
    return;
  };
  const confirmed = d.guests.filter((g) => g.rsvp === "yes").length;
  return (
    <WeddingShell
      title="Check-in"
      subtitle="Busque pelo nome ou leia o código do convite. Cada pessoa entra uma única vez."
    >
      <section className="grid grid-cols-2 gap-3">
        <Stat label="Chegaram" value={String(d.activeCheckin.size)} />
        <Stat label="Confirmados" value={String(confirmed)} />
      </section>
      <section className="wed-card space-y-2 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Buscar convidado"
            className="h-12 pl-9 text-base"
            placeholder="Nome do convidado"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void lookup(code);
          }}
        >
          <Input
            aria-label="Código do convite"
            className="h-12 text-base uppercase"
            placeholder="Código ou link do convite"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" className="h-12">
            Buscar
          </Button>
          {typeof window !== "undefined" && "BarcodeDetector" in window && (
            <Button
              type="button"
              variant="outline"
              className="h-12"
              aria-label="Ler QR code"
              onClick={() => setScanning((s) => !s)}
            >
              <Camera className="size-4" />
            </Button>
          )}
        </form>
        {scanning && (
          <Scanner
            onCode={(v) => {
              setScanning(false);
              void lookup(v);
            }}
          />
        )}
        {invFilter && (
          <Button variant="ghost" size="sm" onClick={() => setInvFilter(null)}>
            Mostrando convite: {d.invitations.find((i) => i.id === invFilter)?.label} · limpar
          </Button>
        )}
      </section>
      <ul className="space-y-2">
        {list.map((g) => {
          const c = d.activeCheckin.get(g.id);
          return (
            <li
              key={g.id}
              className="wed-card flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.invitations.find((i) => i.id === g.invitation_id)?.label ?? "Sem convite"}
                  {g.rsvp === "yes"
                    ? " · confirmado"
                    : g.rsvp === "no"
                      ? " · recusou"
                      : " · sem resposta"}
                  {c &&
                    ` · chegou às ${new Date(c.checked_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </p>
              </div>
              {c ? (
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={() => {
                    const reason = window.prompt("Motivo da correção do check-in:");
                    if (reason?.trim())
                      m.undoCheckIn.mutate({ id: c.id, reason }, { onError: err });
                  }}
                >
                  <Undo2 className="size-4" /> Desfazer
                </Button>
              ) : (
                <Button
                  className="h-11"
                  disabled={m.checkIn.isPending}
                  onClick={() =>
                    m.checkIn.mutate(g.id, {
                      onSuccess: () => toast.success(`${g.name} chegou`),
                      onError: err,
                    })
                  }
                >
                  <CheckCircle2 className="size-4" /> Check-in
                </Button>
              )}
            </li>
          );
        })}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum convidado encontrado.</p>
        )}
      </ul>
    </WeddingShell>
  );
}

/** Leitor de QR usando o detector nativo do navegador (sem serviço externo). */
function Scanner({ onCode }: { onCode: (v: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Detector = (window as any).BarcodeDetector;
    const detector = new Detector({ formats: ["qr_code"] });
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!ref.current) return;
        ref.current.srcObject = stream;
        await ref.current.play();
        while (!stop) {
          const codes = await detector.detect(ref.current);
          if (codes[0]?.rawValue) {
            cb.current(codes[0].rawValue);
            break;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        toast.error("Não foi possível usar a câmera. Digite o código.");
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <video
      ref={ref}
      className="aspect-square w-full max-w-xs rounded-xl bg-muted object-cover"
      muted
      playsInline
      aria-label="Câmera para ler QR"
    />
  );
}
