import { Search, Plus } from "lucide-react";
import { useApp } from "@/features/app/app-context";
import { Button } from "@/components/ui/button";
import { AvatarMenu } from "@/components/profile/avatar-menu";
import { MobileMenu } from "./mobile-menu";

export function Header() {
  const { setCommandOpen, setQuickMenuOpen } = useApp();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-xl md:px-8">
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="flex h-10 flex-1 items-center gap-3 rounded-xl border border-border bg-surface px-3 text-sm text-muted-foreground transition-colors hover:border-ring/40"
      >
        <Search className="size-4" />
        <span className="truncate">Pesquisar ou registrar algo...</span>
        <kbd className="ml-auto hidden rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
          Ctrl K
        </kbd>
      </button>

      <Button
        className="hidden md:inline-flex"
        size="sm"
        onClick={() => setQuickMenuOpen(true)}
      >
        <Plus className="size-4" />
        Novo
      </Button>

      <div className="md:hidden"><MobileMenu /></div>
      <div className="hidden md:block"><AvatarMenu compact /></div>
    </header>
  );
}
