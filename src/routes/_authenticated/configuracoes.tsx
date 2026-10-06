import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTIONS } from "@/features/settings/sections";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Life OS" },
      {
        name: "description",
        content: "Centro de controle do seu Life OS: perfil, espaço, pessoas e dados.",
      },
      { property: "og:title", content: "Configurações — Life OS" },
      { property: "og:description", content: "Administre e personalize o seu Life OS." },
    ],
  }),
  component: SettingsLayout,
});

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const atIndex = pathname === "/configuracoes" || pathname === "/configuracoes/";

  return (
    <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Seções de configurações" className="hidden md:block">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Configurações
        </p>
        <ul className="sticky top-6 space-y-0.5">
          {SETTINGS_SECTIONS.map((section) => {
            const active = pathname.startsWith(section.to);
            return (
              <li key={section.to}>
                <Link
                  to={section.to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/45 hover:text-foreground",
                  )}
                >
                  <section.icon className={cn("size-4", active && "text-primary")} />
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0 space-y-6">
        {atIndex ? null : (
          <Link
            to="/configuracoes"
            className="-ml-1 inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
          >
            <ChevronLeft className="size-4" /> Configurações
          </Link>
        )}
        <Outlet />
      </div>
    </div>
  );
}
