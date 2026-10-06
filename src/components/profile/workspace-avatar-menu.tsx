import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/features/app/app-context";
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
import { removeStoredImage, saveWorkspaceIdentity, storedPath, uploadWorkspaceImage } from "@/features/workspace/identity";
import { cn } from "@/lib/utils";


export function WorkspaceAvatarMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { workspace, workspaceId, workspaceName, refetchWorkspace } = useApp();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function refreshWorkspace() {
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    refetchWorkspace();
  }

  async function savePhoto() {
    if (!selected || !workspaceId) return;
    setBusy(true);
    try {
      if (!workspace) return;
      const oldPath = storedPath(workspace.avatar_url);
      const path = await uploadWorkspaceImage(workspaceId, "avatar", selected);
      try {
        await saveWorkspaceIdentity(workspace, {
          name: workspace.name,
          description: workspace.description,
          accentColor: workspace.accent_color,
          avatarPath: path,
        });
      } catch (error) {
        await removeStoredImage(path);
        throw error;
      }
      if (oldPath && oldPath !== path) await removeStoredImage(oldPath);

      await refreshWorkspace();
      closePreview();
      toast.success("Foto do Life OS atualizada para vocês.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!workspaceId || !workspace?.avatar_url) return;
    setBusy(true);
    try {
      const path = storedPath(workspace.avatar_url);
      await saveWorkspaceIdentity(workspace, {
        name: workspace.name,
        description: workspace.description,
        accentColor: workspace.accent_color,
        avatarPath: null,
      });
      await removeStoredImage(path);
      await refreshWorkspace();
      toast.success("Foto do Life OS removida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover a foto.");
    } finally {
      setBusy(false);
    }
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
            title="Foto compartilhada do Life OS"
            aria-label="Editar foto compartilhada do Life OS"
            className="size-9 shrink-0 overflow-hidden rounded-xl p-0 shadow-lift ring-offset-background hover:ring-2 hover:ring-primary/50"
          >
            {workspace?.avatar_url ? (
              <img src={workspace.avatar_url} alt={`Foto de ${workspaceName}`} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">L</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={collapsed ? "start" : "end"} className="w-64">
          <DropdownMenuLabel>
            <p className="text-sm">Foto do Life OS</p>
            <p className="text-xs font-normal text-muted-foreground">Compartilhada com os membros deste espaço.</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            {workspace?.avatar_url ? <Camera className="size-4" /> : <ImagePlus className="size-4" />}
            {workspace?.avatar_url ? "Trocar foto" : "Adicionar foto"}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!workspace?.avatar_url || busy} onClick={() => void removePhoto()}>
            <Trash2 className="size-4" /> Remover foto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!preview} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Foto do Life OS</DialogTitle>
            <DialogDescription>Essa imagem será exibida para vocês dois.</DialogDescription>
          </DialogHeader>
          <div className="mx-auto size-56 overflow-hidden rounded-xl border border-border bg-muted">
            {preview ? <img src={preview} alt="Prévia da foto compartilhada" className="size-full object-cover" /> : null}
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