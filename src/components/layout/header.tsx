import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { useTheme } from "@/lib/theme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { setCommandOpen, setQuickMenuOpen, profile } = useApp();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initials = (profile?.name || profile?.email || "?").slice(0, 1).toUpperCase();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-8">
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-9">
              <AvatarFallback className="bg-accent text-xs">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">
            {profile?.name || profile?.email || "Conta"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setMode("dark")}>
            <Moon className="size-4" /> Escuro {mode === "dark" ? "•" : ""}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode("light")}>
            <Sun className="size-4" /> Claro {mode === "light" ? "•" : ""}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode("system")}>
            <Monitor className="size-4" /> Sistema {mode === "system" ? "•" : ""}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="size-4" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
