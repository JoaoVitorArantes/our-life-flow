import { useState, type ReactNode } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { uploadWeddingImage, useWeddingImage } from "@/features/wedding/api";
import {
  GIFT_KIND_LABEL,
  validateGift,
  type GiftDraft,
  type GiftKind,
} from "@/features/wedding/gift-contracts";
import type { WeddingGift } from "@/features/wedding/gifts";

const money = (v: number | string | null | undefined) =>
  v == null ? "" : Number(v).toFixed(2).replace(".", ",");

function draftFrom(g?: WeddingGift | null): GiftDraft {
  return {
    kind: (g?.kind as GiftKind) ?? "physical",
    title: g?.title ?? "",
    description: g?.description ?? "",
    external_url: g?.external_url ?? "",
    quantity_total: g?.quantity_total != null ? String(g.quantity_total) : "1",
    quota_amount: money(g?.quota_amount),
    quota_total: g?.quota_total != null ? String(g.quota_total) : "",
    suggested_amount: money(g?.suggested_amount),
    goal_amount: money(g?.goal_amount),
    is_visible: g?.is_visible ?? true,
  };
}

export type GiftFormValue =
  ReturnType<typeof validateGift> extends infer R
    ? R extends { ok: true; value: infer V }
      ? V & { image_path: string | null }
      : never
    : never;

export function GiftFormDialog({
  trigger,
  gift,
  workspaceId,
  onSave,
}: {
  trigger: ReactNode;
  gift?: WeddingGift | null;
  workspaceId: string;
  onSave: (v: GiftFormValue) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<GiftDraft>(() => draftFrom(gift));
  const [image, setImage] = useState<string | null>(gift?.image_path ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useWeddingImage(image);
  const editing = !!gift;
  const set = <K extends keyof GiftDraft>(k: K, v: GiftDraft[K]) => setD((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    const r = validateGift(d);
    if (!r.ok) return setError(r.error);
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...r.value, image_path: image });
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
          setD(draftFrom(gift));
          setImage(gift?.image_path ?? null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar presente" : "Novo presente"}</DialogTitle>
          <DialogDescription>
            Valores e quantidades são definidos por vocês. Nada aqui vai para o Financeiro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tipo</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(GIFT_KIND_LABEL) as GiftKind[]).map((k) => (
                <Button
                  key={k}
                  type="button"
                  variant={d.kind === k ? "default" : "outline"}
                  aria-pressed={d.kind === k}
                  disabled={editing && d.kind !== k}
                  className="h-auto min-h-11 whitespace-normal py-2 text-xs"
                  onClick={() => set("kind", k)}
                >
                  {GIFT_KIND_LABEL[k]}
                </Button>
              ))}
            </div>
            {editing && (
              <p className="text-xs text-muted-foreground">O tipo não muda depois de criado.</p>
            )}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="gift-title">Nome</Label>
            <Input
              id="gift-title"
              className="h-11"
              maxLength={120}
              value={d.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gift-desc">Descrição (opcional)</Label>
            <Textarea
              id="gift-desc"
              maxLength={1000}
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          {d.kind === "physical" && (
            <div className="space-y-1.5">
              <Label htmlFor="gift-qty">Quantidade desejada</Label>
              <Input
                id="gift-qty"
                className="h-11"
                inputMode="numeric"
                value={d.quantity_total}
                onChange={(e) => set("quantity_total", e.target.value)}
              />
            </div>
          )}
          {d.kind === "quota" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gift-qamount">Valor da cota (R$)</Label>
                <Input
                  id="gift-qamount"
                  className="h-11"
                  inputMode="decimal"
                  value={d.quota_amount}
                  onChange={(e) => set("quota_amount", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gift-qtotal">Número de cotas</Label>
                <Input
                  id="gift-qtotal"
                  className="h-11"
                  inputMode="numeric"
                  value={d.quota_total}
                  onChange={(e) => set("quota_total", e.target.value)}
                />
              </div>
            </div>
          )}
          {d.kind === "fund" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gift-sugg">Valor sugerido (opcional)</Label>
                <Input
                  id="gift-sugg"
                  className="h-11"
                  inputMode="decimal"
                  value={d.suggested_amount}
                  onChange={(e) => set("suggested_amount", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gift-goal">Meta (só vocês veem)</Label>
                <Input
                  id="gift-goal"
                  className="h-11"
                  inputMode="decimal"
                  value={d.goal_amount}
                  onChange={(e) => set("goal_amount", e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="gift-url">Link de referência (opcional)</Label>
            <Input
              id="gift-url"
              className="h-11"
              placeholder="https://"
              maxLength={500}
              value={d.external_url}
              onChange={(e) => set("external_url", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Imagem (opcional, só no painel de vocês)</Label>
            {preview.data && (
              <img src={preview.data} alt="" className="h-32 w-full rounded-xl object-cover" />
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild type="button" variant="outline" className="h-11">
                <label>
                  <ImagePlus className="size-4" /> Escolher imagem
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label="Escolher imagem do presente"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        setImage(await uploadWeddingImage(workspaceId, f));
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Falha no envio.");
                      }
                    }}
                  />
                </label>
              </Button>
              {image && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11"
                  onClick={() => setImage(null)}
                >
                  <Trash2 className="size-4" /> Remover imagem
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <Label htmlFor="gift-visible" className="leading-snug">
              Mostrar no portal dos convidados
            </Label>
            <Switch
              id="gift-visible"
              checked={d.is_visible}
              onCheckedChange={(v) => set("is_visible", v)}
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
            {editing ? "Salvar" : "Adicionar presente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
