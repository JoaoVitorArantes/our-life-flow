import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { SETTINGS_SECTIONS } from "@/features/settings/sections";
import { useApp } from "@/features/app/app-context";

export const Route = createFileRoute("/_authenticated/configuracoes/")({
  head: () => ({
    meta: [
      { title: "Configurações — Life OS" },
      { name: "description", content: "Centro de controle do Life OS." },
      { property: "og:title", content: "Configurações — Life OS" },
      { property: "og:description", content: "Administre e personalize o seu Life OS." },
    ],
  }),
  component: SettingsIndex,
});

function SettingsIndex() {
  const { workspaceName } = useApp();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle={`Você está ajustando o espaço “${workspaceName}”.`}
      />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {SETTINGS_SECTIONS.map((section) => (
          <li key={section.to}>
            <Link
              to={section.to}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <section.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{section.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{section.hint}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
