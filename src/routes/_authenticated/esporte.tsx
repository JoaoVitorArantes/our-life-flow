import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityCard } from "@/components/activities/activity-card";
import { ActivityDetail } from "@/components/activities/activity-detail";
import { ActivityDialog } from "@/components/activities/activity-dialog";
import { useApp } from "@/features/app/app-context";
import { useContexts, contextEmoji } from "@/features/contexts/queries";
import {
  ACTIVITY_GROUPS,
  ACTIVITY_PERSONS,
  activityDayLabel,
  activityGroup,
  activityInsights,
  formatDistance,
  formatDuration,
  summarize,
  useActivities,
  type Activity,
} from "@/features/activities/queries";
import { parseDateOnly } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/esporte")({
  head: () => ({
    meta: [
      { title: "Esporte & Atividades — Life OS" },
      {
        name: "description",
        content: "Diário de atividades físicas do casal: caminhadas, treinos, pedais e passeios.",
      },
      { property: "og:title", content: "Esporte & Atividades — Life OS" },
      { property: "og:description", content: "Mexer o corpo, sair de casa e fazer coisas juntos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Esporte,
});

const ALL = "all";

const PERIODS = [
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "all", label: "Tudo" },
];

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = (result.getDay() + 6) % 7; // segunda = 0
  result.setDate(result.getDate() - day);
  return result;
}

function Stat({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <Panel className="p-4 transition-colors hover:border-primary/30">
      <p className="text-xs text-muted-foreground">
        {emoji} {label}
      </p>
      <p className="numeric mt-1 text-xl font-semibold">{value}</p>
    </Panel>
  );
}

function Esporte() {
  const { workspaceId } = useApp();
  const { data: activities = [], isLoading } = useActivities(workspaceId);
  const { data: contexts = [] } = useContexts(workspaceId);
  const [period, setPeriod] = useState("month");
  const [type, setType] = useState(ALL);
  const [person, setPerson] = useState(ALL);
  const [contextId, setContextId] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detail, setDetail] = useState<Activity | null>(null);

  const inPeriod = useMemo(() => {
    if (period === "all") return activities;
    const now = new Date();
    const from = period === "week" ? startOfWeek(now) : new Date(now.getFullYear(), now.getMonth(), 1);
    return activities.filter((item) => parseDateOnly(item.activity_date) >= from);
  }, [activities, period]);

  const filtered = useMemo(
    () =>
      inPeriod.filter((item) => {
        if (type !== ALL && activityGroup(item.activity_type) !== type) return false;
        if (person !== ALL && item.person_scope !== person) return false;
        if (contextId !== ALL && item.context_id !== contextId) return false;
        return true;
      }),
    [inPeriod, type, person, contextId],
  );

  const stats = useMemo(() => summarize(filtered), [filtered]);
  const periodLabel =
    period === "week" ? "esta semana" : period === "month" ? "este mês" : "até agora";
  const insights = useMemo(() => activityInsights(filtered, periodLabel), [filtered, periodLabel]);

  const groups = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const item of filtered) {
      const list = map.get(item.activity_date) ?? [];
      list.push(item);
      map.set(item.activity_date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const contextOf = (id?: string | null) => contexts.find((item) => item.id === id) ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Esporte & Atividades"
        subtitle="Mexer o corpo, sair de casa e fazer coisas juntos."
        action={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            + Nova atividade
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat emoji="🔥" label="Atividades" value={String(stats.count)} />
        <Stat emoji="⏱️" label="Tempo em movimento" value={formatDuration(stats.minutes) ?? "—"} />
        <Stat emoji="📍" label="Distância" value={formatDistance(stats.distance) ?? "—"} />
        <Stat emoji="❤️" label="Atividades juntos" value={String(stats.together)} />
      </div>

      {insights.length ? (
        <Panel className="space-y-1.5 border-primary/20 bg-primary/5">
          {insights.map((text) => (
            <p key={text} className="text-sm">
              {text}
            </p>
          ))}
        </Panel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            {ACTIVITY_GROUPS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={person} onValueChange={setPerson}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Pessoa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {ACTIVITY_PERSONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.emoji} {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={contextId} onValueChange={setContextId}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Contexto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os contextos</SelectItem>
            {contexts.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {contextEmoji(item.type)} {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : !activities.length ? (
        <Panel>
          <EmptyState
            icon={Dumbbell}
            title="Nada por aqui ainda 👀"
            description="Uma caminhada no parque já conta. Registre a primeira atividade de vocês."
            action={<Button size="sm" onClick={() => setDialogOpen(true)}>+ Nova atividade</Button>}
          />
        </Panel>
      ) : !filtered.length ? (
        <Panel>
          <EmptyState
            title="Nenhuma atividade nesse filtro"
            description="Tente outro período ou tipo de atividade."
          />
        </Panel>
      ) : (
        <div className="space-y-8">
          <div className="space-y-6">
            {groups.map(([date, items]) => (
              <section key={date} className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {activityDayLabel(date)}
                </h2>
                <div className="space-y-3">
                  {items.map((item) => {
                    const context = contextOf(item.context_id);
                    return (
                      <ActivityCard
                        key={item.id}
                        activity={item}
                        contextName={context?.name}
                        contextType={context?.type}
                        onOpen={() => setDetail(item)}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <Panel>
            <PanelTitle>Resumo · {periodLabel}</PanelTitle>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>
                {stats.count} {stats.count === 1 ? "atividade" : "atividades"} em {stats.days}{" "}
                {stats.days === 1 ? "dia" : "dias"} ativos.
              </li>
              {formatDuration(stats.minutes) ? (
                <li>Tempo em movimento: {formatDuration(stats.minutes)}.</li>
              ) : null}
              {formatDistance(stats.distance) ? (
                <li>Distância total: {formatDistance(stats.distance)}.</li>
              ) : null}
              <li>
                {stats.together} {stats.together === 1 ? "atividade foi junto" : "atividades foram juntos"}
                , {stats.solo} {stats.solo === 1 ? "individual" : "individuais"}.
              </li>
              <li>
                João fez {stats.joao} {stats.joao === 1 ? "atividade" : "atividades"} · Renifer fez{" "}
                {stats.renifer} {stats.renifer === 1 ? "atividade" : "atividades"}.
              </li>
            </ul>
          </Panel>
        </div>
      )}

      <ActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <ActivityDetail
        activity={detail}
        open={!!detail}
        onOpenChange={(value) => !value && setDetail(null)}
      />
    </div>
  );
}
