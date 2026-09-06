import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { NAV_GROUPS, FOOTER_NAV, type NavItem } from "@/features/app/navigation";
import { useNavigationIndicators } from "@/features/app/use-navigation-indicators";
import { useApp } from "@/features/app/app-context";
import { supabase } from "@/integrations/supabase/client";
import { MemberAvatar } from "@/components/profile/member-avatar";
import { compressSquareImage } from "@/components/profile/image-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeMode } from "@/lib/theme";

function MobileNavLink({ item, badge, active, close }: { item: NavItem; badge?: number | undefined; active: boolean; close: () => void }) {
  return (
    <Link
      to={item.to}
      onClick={close}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm transition-colors active:scale-[0.99]",
        active
          ? "border-primary/20 bg-primary/10 text-foreground"
          : "border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden /> : null}
      <item.icon className={cn("size-4 shrink-0", active && "text-primary")} />
      <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
      {badge && badge > 0 ? (
        <span className="numeric flex min-w-5 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function MobileMenu() {
  const { workspaceId, workspaceName, profile, userId, refetchWorkspace } = useApp();
  const indicators = useNavigationIndicators(workspaceId);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mode, setMode } = useTheme();

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
      const blob = await compressSquareImage(selected);
      const path = `${userId}/profile.jpg`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
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

  async function signOut() {
    setOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const themes: { value: ThemeMode; label: string; icon: typeof Moon }[] = [
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "light", label: "Claro", icon: Sun },
    { value: "system", label: "Sistema", icon: Monitor },
  ];

  return (
    <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Abrir menu completo" className="size-11 rounded-full p-0 hover:bg-transparent">
            <MemberAvatar name={profile?.name} email={profile?.email} src={profile?.avatar_url} className="size-10" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="flex h-dvh w-[min(90vw,360px)] flex-col gap-0 overflow-hidden border-sidebar-border bg-sidebar/98 p-0 pb-[env(safe-area-inset-bottom)] md:hidden">
          <SheetTitle className="sr-only">Menu completo</SheetTitle>
          <SheetDescription className="sr-only">Navegue por todos os módulos do Life OS</SheetDescription>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-sidebar-border px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] pr-14">
            <Button type="button" variant="ghost" size="icon" aria-label="Alterar foto do perfil" onClick={() => inputRef.current?.click()} className="group relative size-14 shrink-0 rounded-full p-0 hover:bg-transparent">
              <MemberAvatar name={profile?.name} email={profile?.email} src={profile?.avatar_url} className="size-14 ring-primary/25" />
              <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-2 border-sidebar bg-primary text-primary-foreground">
                <Camera className="size-3" />
              </span>
            </Button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{profile?.name || "Seu perfil"}</p>
              <p className="text-xs text-muted-foreground">Perfil pessoal</p>
              <p className="mt-1 truncate text-xs font-medium text-primary">{workspaceName}</p>
            </div>
          </div>

          <nav aria-label="Menu completo" className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
            <div className="space-y-5">
              {NAV_GROUPS.map((group) => (
                <section key={group.label} aria-labelledby={`mobile-${group.label}`}>
                  <p id={`mobile-${group.label}`} className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/65">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => <MobileNavLink key={item.to} item={item} badge={indicators[item.to]} active={pathname === item.to || pathname.startsWith(`${item.to}/`)} close={() => setOpen(false)} />)}
                  </div>
                </section>
              ))}
              <section aria-labelledby="mobile-system" className="border-t border-sidebar-border pt-4">
                <p id="mobile-system" className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/65">Sistema</p>
                {FOOTER_NAV.map((item) => <MobileNavLink key={item.to} item={item} active={pathname === item.to} close={() => setOpen(false)} />)}
              </section>
            </div>
          </nav>

          <div className="border-t border-sidebar-border px-4 py-3">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/65">Aparência</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-sidebar-border bg-background/50 p-1">
              {themes.map((theme) => (
                <Button key={theme.value} type="button" variant="ghost" onClick={() => setMode(theme.value)} className={cn("h-11 min-w-0 gap-1 rounded-lg px-2 text-[11px]", mode === theme.value ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground")}>
                  <theme.icon className="size-3.5" /> <span className="truncate">{theme.label}</span>
                </Button>
              ))}
            </div>
            <Button type="button" variant="ghost" onClick={() => void signOut()} className="mt-2 h-11 w-full justify-start gap-3 px-3 text-muted-foreground">
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!preview} onOpenChange={(isOpen) => !isOpen && closePreview()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova foto de perfil</DialogTitle><DialogDescription>Confira o enquadramento antes de salvar.</DialogDescription></DialogHeader>
          <div className="mx-auto size-56 overflow-hidden rounded-full border border-border bg-muted">{preview ? <img src={preview} alt="Prévia da nova foto" className="size-full object-cover" /> : null}</div>
          <DialogFooter><Button variant="outline" onClick={closePreview} disabled={busy}>Cancelar</Button><Button onClick={() => void savePhoto()} disabled={busy}>{busy ? "Salvando..." : "Usar esta foto"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}