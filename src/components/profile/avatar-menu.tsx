import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, LogOut, Settings, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/features/app/app-context";
import { supabase } from "@/integrations/supabase/client";
import { MemberAvatar } from "@/components/profile/member-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

async function compressAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 640;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    640,
    640,
  );
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível comprimir a imagem."))),
      "image/jpeg",
      0.84,
    ),
  );
}

export function AvatarMenu({ compact = false }: { compact?: boolean }) {
  const { profile, userId, refetchWorkspace } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function chooseFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem válida.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setSelected(file);
    setPreview(URL.createObjectURL(file));
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function savePhoto() {
    if (!selected || !userId) return;
    setBusy(true);
    try {
      const blob = await compressAvatar(selected);
      const path = `${userId}/profile.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", userId);
      if (profileError) throw profileError;
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      refetchWorkspace();
      closePreview();
      toast.success("Foto atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!userId || !profile?.avatar_url) return;
    setBusy(true);
    try {
      const storedPath = profile.avatar_url.split("#avatar-path=")[1] ?? `${userId}/profile.jpg`;
      const [{ error: storageError }, { error: profileError }] = await Promise.all([
        supabase.storage.from("avatars").remove([storedPath]),
        supabase.from("profiles").update({ avatar_url: null }).eq("id", userId),
      ]);
      if (storageError) throw storageError;
      if (profileError) throw profileError;
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      refetchWorkspace();
      toast.success("Foto removida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover a foto.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Abrir perfil"
            className={cn(
              "group rounded-full p-0 ring-offset-background transition-all hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring",
              compact ? "size-9" : "size-10",
            )}
          >
            <MemberAvatar
              name={profile?.name}
              email={profile?.email}
              src={profile?.avatar_url}
              className={cn("transition-all group-hover:ring-primary/60", compact ? "size-9" : "size-10")}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <p className="truncate text-sm">{profile?.name || "Seu perfil"}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{profile?.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
            <UserRound className="size-4" /> Ver perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            <Camera className="size-4" /> Alterar foto
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!profile?.avatar_url || busy} onClick={() => void removePhoto()}>
            <Trash2 className="size-4" /> Remover foto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
            <Settings className="size-4" /> Configurações
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!preview} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova foto de perfil</DialogTitle>
            <DialogDescription>Confira o enquadramento antes de salvar.</DialogDescription>
          </DialogHeader>
          <div className="mx-auto size-56 overflow-hidden rounded-full border border-border bg-muted">
            {preview ? <img src={preview} alt="Prévia da nova foto" className="size-full object-cover" /> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePreview} disabled={busy}>Cancelar</Button>
            <Button onClick={() => void savePhoto()} disabled={busy}>{busy ? "Salvando..." : "Usar esta foto"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}