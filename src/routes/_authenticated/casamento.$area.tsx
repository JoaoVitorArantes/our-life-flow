import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { WeddingShell } from "@/components/wedding/shell";
import { WEDDING_AREAS } from "@/features/wedding/contracts";

export const Route = createFileRoute("/_authenticated/casamento/$area")({
  head: () => ({
    meta: [
      { title: "Casamento — em preparação · Life OS" },
      { name: "description", content: "Área do casamento em preparação." },
      { property: "og:title", content: "Casamento — Life OS" },
      { property: "og:description", content: "Área do casamento em preparação." },
    ],
  }),
  component: AreaPlaceholder,
});

function AreaPlaceholder() {
  const { area } = Route.useParams();
  const info = WEDDING_AREAS.find((a) => a.slug === area);
  return (
    <WeddingShell title={info ? `${info.emoji} ${info.label}` : "Área não encontrada"}>
      <EmptyState
        icon={Sparkles}
        title="Em preparação"
        description="Esta área ainda não tem funcionalidades. Ela será construída nas próximas fases, sem dados inventados."
      />
    </WeddingShell>
  );
}
