import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DEFAULT_PENDING_DAYS, PIX_KEY_TYPES } from "@/features/wedding/gift-contracts";
import type { WeddingGiftSettings } from "@/features/wedding/gifts";

export interface GiftSettingsValue {
  portal_enabled: boolean;
  pending_days: number;
  pix_key_type: string | null;
  pix_key: string | null;
  pix_receiver_name: string | null;
  instructions: string | null;
  delivery_instructions: string | null;
}

const blank = (v: string) => v.trim() || null;

export function GiftSettingsDialog({
  trigger,
  settings,
  onSave,
}: {
  trigger: ReactNode;
  settings: WeddingGiftSettings | null;
  onSave: (v: GiftSettingsValue) => Promise<unknown>;
}) {
  const init = () => ({
    portal_enabled: settings?.portal_enabled ?? false,
    pix_key_type: settings?.pix_key_type ?? "",
    pix_key: settings?.pix_key ?? "",
    pix_receiver_name: settings?.pix_receiver_name ?? "",
    instructions: settings?.instructions ?? "",
    delivery_instructions: settings?.delivery_instructions ?? "",
  });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (f.pix_key.trim() && !f.pix_key_type) return setError("Escolha o tipo da chave Pix.");
    if (f.pix_key.trim().length > 120) return setError("Chave Pix com até 120 caracteres.");
    setBusy(true);
    setError(null);
    try {
      await onSave({
        portal_enabled: f.portal_enabled,
        pending_days: settings?.pending_days ?? DEFAULT_PENDING_DAYS,
        pix_key_type: f.pix_key.trim() ? f.pix_key_type || null : null,
        pix_key: blank(f.pix_key),
        pix_receiver_name: blank(f.pix_receiver_name),
        instructions: blank(f.instructions),
        delivery_instructions: blank(f.delivery_instructions),
      });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setF(init());
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustes de presentes</DialogTitle>
          <DialogDescription>
            O Pix é só informação exibida aos convidados. O sistema não recebe nem confere
            pagamentos: vocês confirmam cada recebimento manualmente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <Label htmlFor="gift-portal" className="leading-snug">
                Mostrar presentes no portal
              </Label>
              <p className="text-xs text-muted-foreground">
                Convidados com link ou código válido poderão reservar.
              </p>
            </div>
            <Switch
              id="gift-portal"
              checked={f.portal_enabled}
              onCheckedChange={(v) => set("portal_enabled", v)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Reservas pendentes vencem em {settings?.pending_days ?? DEFAULT_PENDING_DAYS} dias e
            liberam o presente.
          </p>
          <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="pix-type">Tipo da chave</Label>
              <select
                id="pix-type"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={f.pix_key_type}
                onChange={(e) => set("pix_key_type", e.target.value)}
              >
                <option value="">Não informado</option>
                {PIX_KEY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pix-key">Chave Pix</Label>
              <Input
                id="pix-key"
                className="h-11"
                maxLength={120}
                value={f.pix_key}
                onChange={(e) => set("pix_key", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pix-name">Nome de quem recebe</Label>
            <Input
              id="pix-name"
              className="h-11"
              maxLength={120}
              value={f.pix_receiver_name}
              onChange={(e) => set("pix_receiver_name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gift-instr">Instruções para contribuições</Label>
            <Textarea
              id="gift-instr"
              maxLength={1500}
              value={f.instructions}
              onChange={(e) => set("instructions", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gift-deliv">Instruções de entrega de presentes físicos</Label>
            <Textarea
              id="gift-deliv"
              maxLength={1500}
              value={f.delivery_instructions}
              onChange={(e) => set("delivery_instructions", e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button className="h-11" disabled={busy} onClick={() => void submit()}>
            Salvar ajustes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
