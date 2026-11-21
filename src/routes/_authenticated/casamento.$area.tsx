import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { WeddingShell } from "@/components/wedding/shell";
import { WEDDING_AREAS } from "@/features/wedding/contracts";

export const Route = createFileRoute("/_authenticated/casamento/$area")({
  head: () => ({
    meta: [
      { title: "Casamento — área em breve · Life OS" },
      { name: "description", content: "Área futura do planejamento do casamento." },
      { property: "og:title", content: "Casamento — Life OS" },
      { property: "og:description", content: "Área futura do planejamento do casamento." },
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
        title="Em breve"
        description="Esta área ainda não tem funcionalidades. Por enquanto, comecem por Nossa Casa / Enxoval."
      />
    </WeddingShell>
  );
}
