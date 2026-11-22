import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { itemInputSchema, type ItemInput } from "@/features/wedding/contracts";
import { uploadWeddingImage, useWeddingImage, type WeddingItem } from "@/features/wedding/api";
import type { WeddingData } from "@/features/wedding/use-wedding";

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const str = (v: number | null | undefined) => (v == null ? "" : String(v));

export function itemToInput(i: WeddingItem): ItemInput {
  return {
    room_id: i.room_id,
    name: i.name,
    description: i.description,
    quantity: i.quantity,
    priority_id: i.priority_id,
    status_id: i.status_id,
    price_low: i.price_low == null ? null : Number(i.price_low),
    price_target: i.price_target == null ? null : Number(i.price_target),
    price_high: i.price_high == null ? null : Number(i.price_high),
    price_actual: i.price_actual == null ? null : Number(i.price_actual),
    responsible_user_id: i.responsible_user_id,
    links: i.links,
    notes: i.notes,
    image_path: i.image_path,
  };
}

export function Field({
  label,
  wide,
  children,
  htmlFor,
}: {
  label: string;
  wide?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function Choice({
  value,
  onChange,
  options,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  placeholder?: string;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-11 w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Formulário completo do item. Preços vazios continuam vazios — nada é estimado automaticamente. */
export function ItemForm({
  w,
  initial,
  onSubmit,
  pending,
  submitLabel = "Salvar",
}: {
  w: WeddingData;
  initial: ItemInput;
  onSubmit: (input: ItemInput) => void;
  pending?: boolean;
  submitLabel?: string;
}) {
  const [f, setF] = useState({
    ...initial,
    quantity: String(initial.quantity),
    price_low: str(initial.price_low),
    price_target: str(initial.price_target),
    price_high: str(initial.price_high),
    price_actual: str(initial.price_actual),
    links: initial.links.join("\n"),
    notes: initial.notes ?? "",
    description: initial.description ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const preview = useWeddingImage(f.image_path);
  const set =
    <K extends keyof typeof f>(k: K) =>
    (v: (typeof f)[K]) =>
      setF((s) => ({ ...s, [k]: v }));
  const NONE = "__none__";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = itemInputSchema.safeParse({
      room_id: f.room_id,
      name: f.name,
      description: f.description.trim() || null,
      quantity: Number(f.quantity),
      priority_id: f.priority_id,
      status_id: f.status_id,
      price_low: num(f.price_low),
      price_target: num(f.price_target),
      price_high: num(f.price_high),
      price_actual: num(f.price_actual),
      responsible_user_id: f.responsible_user_id,
      links: f.links
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      notes: f.notes.trim() || null,
      image_path: f.image_path,
    });
    if (!parsed.success) {
      toast.error(
        "Confira nome, quantidade (1–999), preços (≥ 0) e links (endereços completos com https://).",
      );
      return;
    }
    onSubmit(parsed.data);
  };

  const upload = async (file?: File) => {
    if (!file || !w.workspaceId) return;
    setUploading(true);
    try {
      set("image_path")(await uploadWeddingImage(w.workspaceId, file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome do item" wide htmlFor="it-name">
        <Input
          id="it-name"
          className="h-11"
          value={f.name}
          onChange={(e) => set("name")(e.target.value)}
          required
        />
      </Field>
      <Field label="Cômodo" htmlFor="it-room">
        <Choice
          id="it-room"
          value={f.room_id}
          onChange={set("room_id")}
          options={w.rooms.map((r) => [r.id, r.name])}
        />
      </Field>
      <Field label="Quantidade" htmlFor="it-qty">
        <Input
          id="it-qty"
          className="h-11"
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          value={f.quantity}
          onChange={(e) => set("quantity")(e.target.value)}
        />
      </Field>
      <Field label="Prioridade" htmlFor="it-prio">
        <Choice
          id="it-prio"
          value={f.priority_id ?? NONE}
          onChange={(v) => set("priority_id")(v === NONE ? null : v)}
          options={[
            [NONE, "Sem prioridade"],
            ...w.priorities.map((p) => [p.id, p.label] as [string, string]),
          ]}
        />
      </Field>
      <Field label="Status" htmlFor="it-status">
        <Choice
          id="it-status"
          value={f.status_id ?? NONE}
          onChange={(v) => set("status_id")(v === NONE ? null : v)}
          options={[
            [NONE, "Sem status"],
            ...w.statuses.map((s) => [s.id, s.label] as [string, string]),
          ]}
        />
      </Field>
      <Field label="Responsável" htmlFor="it-resp">
        <Choice
          id="it-resp"
          value={f.responsible_user_id ?? NONE}
          onChange={(v) => set("responsible_user_id")(v === NONE ? null : v)}
          options={[[NONE, "Ninguém"], ...w.people.map((p) => [p.id, p.name] as [string, string])]}
        />
      </Field>
      <Field label="Faixa econômica (R$)" htmlFor="it-low">
        <Input
          id="it-low"
          className="h-11"
          inputMode="decimal"
          placeholder="Não informado"
          value={f.price_low}
          onChange={(e) => set("price_low")(e.target.value)}
        />
      </Field>
      <Field label="Preço-meta intermediário (R$)" htmlFor="it-target">
        <Input
          id="it-target"
          className="h-11"
          inputMode="decimal"
          placeholder="Não informado"
          value={f.price_target}
          onChange={(e) => set("price_target")(e.target.value)}
        />
      </Field>
      <Field label="Faixa premium (R$)" htmlFor="it-high">
        <Input
          id="it-high"
          className="h-11"
          inputMode="decimal"
          placeholder="Não informado"
          value={f.price_high}
          onChange={(e) => set("price_high")(e.target.value)}
        />
      </Field>
      <Field label="Preço real pago (R$)" htmlFor="it-actual">
        <Input
          id="it-actual"
          className="h-11"
          inputMode="decimal"
          placeholder="Não informado"
          value={f.price_actual}
          onChange={(e) => set("price_actual")(e.target.value)}
        />
      </Field>
      <Field label="Descrição" wide htmlFor="it-desc">
        <Textarea
          id="it-desc"
          value={f.description}
          onChange={(e) => set("description")(e.target.value)}
        />
      </Field>
      <Field label="Links de referência (um por linha)" wide htmlFor="it-links">
        <Textarea
          id="it-links"
          value={f.links}
          onChange={(e) => set("links")(e.target.value)}
          placeholder="https://"
        />
      </Field>
      <Field label="Observações" wide htmlFor="it-notes">
        <Textarea id="it-notes" value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
      </Field>
      <Field label="Imagem" wide>
        <div className="flex flex-wrap items-center gap-3">
          {preview.data && (
            <img
              src={preview.data}
              alt="Imagem do item"
              className="size-20 rounded-xl object-cover"
            />
          )}
          <Button type="button" variant="outline" disabled={uploading} asChild>
            <label className="cursor-pointer">
              <ImagePlus className="size-4" />{" "}
              {uploading ? "Enviando…" : f.image_path ? "Trocar imagem" : "Adicionar imagem"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => void upload(e.target.files?.[0])}
              />
            </label>
          </Button>
          {f.image_path && (
            <Button type="button" variant="ghost" onClick={() => set("image_path")(null)}>
              <X className="size-4" /> Remover
            </Button>
          )}
        </div>
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" className="h-11 w-full sm:w-auto" disabled={pending || uploading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
