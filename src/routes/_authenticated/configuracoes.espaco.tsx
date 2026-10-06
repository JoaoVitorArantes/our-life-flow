import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/features/app/app-context";
import { validateImage } from "@/components/profile/image-utils";
import {
  DEFAULT_ACCENT,
  removeStoredImage,
  saveWorkspaceIdentity,
  storedPath,
  uploadWorkspaceImage,
} from "@/features/workspace/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes/espaco")({
  head: () => ({
    meta: [
      { title: "Meu espaço — Life OS" },
      { name: "description", content: "Nome, descrição, foto, capa e cor do seu espaço." },
      { property: "og:title", content: "Meu espaço — Life OS" },
      { property: "og:description", content: "A identidade do seu espaço no Life OS." },
    ],
  }),
  component: Espaco,
});

const ACCENTS = ["#7C5CFC", "#3B82F6", "#14B8A6", "#22C55E", "#F59E0B", "#F43F5E", "#EC4899"];

type ImageDraft = { file: File; preview: string } | null | undefined; // undefined = unchanged, null = remove

function Espaco() {
  const { workspace, workspaceId, members } = useApp();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [avatar, setAvatar] = useState<ImageDraft>(undefined);
  const [cover, setCover] = useState<ImageDraft>(undefined);
  const [busy, setBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name);
    setDescription(workspace.description ?? "");
    setAccent(workspace.accent_color ?? DEFAULT_ACCENT);
  }, [workspace]);

  useEffect(
    () => () => {
      if (avatar) URL.revokeObjectURL(avatar.preview);
      if (cover) URL.revokeObjectURL(cover.preview);
    },
    [avatar, cover],
  );

  if (!workspace || !workspaceId) return null;

  const avatarSrc = avatar === null ? null : (avatar?.preview ?? workspace.avatar_url);
  const coverSrc = cover === null ? null : (cover?.preview ?? workspace.cover_url);
  const dirty =
    name.trim() !== workspace.name ||
    (description.trim() || null) !== (workspace.description ?? null) ||
    accent !== (workspace.accent_color ?? DEFAULT_ACCENT) ||
    avatar !== undefined ||
    cover !== undefined;

  function pick(file: File | undefined, set: (d: ImageDraft) => void) {
    if (!file) return;
    const invalid = validateImage(file);
    if (invalid) return void toast.error(invalid);
    set({ file, preview: URL.createObjectURL(file) });
  }

  function reset() {
    setName(workspace!.name);
    setDescription(workspace!.description ?? "");
    setAccent(workspace!.accent_color ?? DEFAULT_ACCENT);
    setAvatar(undefined);
    setCover(undefined);
  }

  async function save() {
    if (!name.trim()) return void toast.error("Dê um nome ao espaço.");
    setBusy(true);
    const uploaded: string[] = [];
    try {
      const avatarPath = avatar
        ? await uploadWorkspaceImage(workspaceId!, "avatar", avatar.file)
        : avatar;
      if (typeof avatarPath === "string") uploaded.push(avatarPath);
      const coverPath = cover
        ? await uploadWorkspaceImage(workspaceId!, "cover", cover.file)
        : cover;
      if (typeof coverPath === "string") uploaded.push(coverPath);
      await saveWorkspaceIdentity(workspace!, {
        name: name.trim(),
        description: description.trim() || null,
        accentColor: accent === DEFAULT_ACCENT ? null : accent,
        avatarPath,
        coverPath,
      });
      if (avatar !== undefined) await removeStoredImage(storedPath(workspace!.avatar_url));
      if (cover !== undefined) await removeStoredImage(storedPath(workspace!.cover_url));
      setAvatar(undefined);
      setCover(undefined);
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Espaço atualizado para todos os membros.");
    } catch (error) {
      await Promise.all(uploaded.map((path) => removeStoredImage(path)));
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meu espaço"
        subtitle="Muda o espaço para todos os membros. Nada é criado de novo."
      />

      <section
        aria-label="Prévia do espaço"
        className="overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="relative h-32 bg-muted sm:h-44">
          {coverSrc ? (
            <img src={coverSrc} alt="Capa do espaço" className="size-full object-cover" />
          ) : (
            <div
              className="size-full"
              style={{ background: `linear-gradient(135deg, ${accent}33, transparent)` }}
            />
          )}
        </div>
        <div className="-mt-10 flex flex-col items-center px-5 pb-6 text-center">
          <div className="size-20 overflow-hidden rounded-2xl border-4 border-surface bg-primary shadow-lift">
            {avatarSrc ? (
              <img src={avatarSrc} alt="Foto do espaço" className="size-full object-cover" />
            ) : (
              <span
                className="flex size-full items-center justify-center text-2xl font-semibold text-white"
                style={{ background: accent }}
              >
                {(name.trim()[0] ?? "L").toUpperCase()}
              </span>
            )}
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">{name.trim() || "Sem nome"}</h2>
          {description.trim() ? (
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{description.trim()}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? "membro" : "membros"}
          </p>
        </div>
      </section>

      <Panel className="space-y-4">
        <PanelTitle>Identidade</PanelTitle>
        <div className="space-y-2">
          <Label htmlFor="ws-name">Nome</Label>
          <Input
            id="ws-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ws-desc">Descrição</Label>
          <Textarea
            id="ws-desc"
            value={description}
            maxLength={280}
            rows={3}
            placeholder="Nosso espaço para organizar a vida juntos."
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </Panel>

      <Panel className="space-y-4">
        <PanelTitle>Imagens</PanelTitle>
        <input
          ref={avatarInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0], setAvatar);
            e.target.value = "";
          }}
        />
        <input
          ref={coverInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0], setCover);
            e.target.value = "";
          }}
        />
        <ImageRow
          label="Foto"
          hint="Quadrada, até 8 MB"
          has={!!avatarSrc}
          onPick={() => avatarInput.current?.click()}
          onRemove={() => setAvatar(null)}
        />
        <ImageRow
          label="Capa"
          hint="Horizontal, até 8 MB"
          has={!!coverSrc}
          onPick={() => coverInput.current?.click()}
          onRemove={() => setCover(null)}
        />
        <p className="text-xs text-muted-foreground">
          As imagens ficam privadas: só membros deste espaço conseguem vê-las.
        </p>
      </Panel>

      <Panel className="space-y-4">
        <PanelTitle>Cor de destaque</PanelTitle>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Cor de destaque">
          {ACCENTS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={accent === color}
              aria-label={color === DEFAULT_ACCENT ? "Violeta padrão" : color}
              onClick={() => setAccent(color)}
              className={cn(
                "size-9 rounded-full ring-offset-2 ring-offset-background transition",
                accent === color && "ring-2 ring-foreground",
              )}
              style={{ background: color }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Usada só em detalhes: itens ativos, seleção e progresso.
        </p>
      </Panel>

      <div className="sticky bottom-24 z-10 flex justify-end gap-2 md:bottom-4">
        <Button variant="outline" disabled={!dirty || busy} onClick={reset}>
          Descartar
        </Button>
        <Button disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

function ImageRow({
  label,
  hint,
  has,
  onPick,
  onRemove,
}: {
  label: string;
  hint: string;
  has: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onPick}>
          <ImagePlus className="size-4" /> {has ? "Trocar" : "Adicionar"}
        </Button>
        <Button size="sm" variant="ghost" disabled={!has} onClick={onRemove}>
          <Trash2 className="size-4" /> Remover
        </Button>
      </div>
    </div>
  );
}
