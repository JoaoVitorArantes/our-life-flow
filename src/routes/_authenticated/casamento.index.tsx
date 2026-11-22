import { createFileRoute, Link } from "@tanstack/react-router";
import { LoadingState } from "@/components/common/states";
import { Bar, OptionBadge, SectionTitle, Stat, WeddingShell } from "@/components/wedding/shell";
import { useWeddingData } from "@/features/wedding/use-wedding";
import { useGuestsData } from "@/features/wedding/guests";
import { summarizeGuests } from "@/features/wedding/guest-contracts";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/casamento/")({
  head: () => ({
    meta: [
      { title: "Casamento — Life OS" },
      {
        name: "description",
        content: "Painel do casamento do casal: casa, orçamento e preparativos.",
      },
      { property: "og:title", content: "Casamento — Life OS" },
      { property: "og:description", content: "O projeto do casal, em um só lugar." },
    ],
  }),
  component: WeddingOverview,
});

const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

function daysUntil(d: string | null | undefined) {
  if (!d) return null;
  const diff = Math.ceil((new Date(`${d}T12:00:00`).getTime() - Date.now()) / 86_400_000);
  return diff;
}

function WeddingOverview() {
  const w = useWeddingData();
  const gd = useGuestsData(w.workspaceId);
  if (w.loading) return <LoadingState />;
  const s = w.summary;
  const days = daysUntil(w.plan?.wedding_date);
  const open = w.tasks.filter((t) => t.status !== "done");
  const next = [...open]
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 5);
  const progress = s.totalItems ? Math.round((s.boughtItems / s.totalItems) * 100) : 0;
  return (
    <WeddingShell
      title="Nosso casamento"
      subtitle={w.plan?.message ?? "Área do casal, separada dos módulos gerais do Life OS."}
    >
      <GuestsCard
        g={summarizeGuests(gd.guests, gd.activeCheckin.size)}
        invitations={gd.invitations.length}
      />
      <section className="wed-card grid gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:p-6">
        <div className="text-center sm:text-left">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Data do casamento
          </p>
          <p className="wed-display mt-1 text-3xl">
            {fmtDate(w.plan?.wedding_date) ?? "Não informada"}
          </p>
          {days != null && days >= 0 && (
            <p className="mt-1 text-sm text-primary">
              {days === 0 ? "É hoje!" : `Faltam ${days} dias`}
            </p>
          )}
          {!w.plan?.wedding_date && (
            <Link
              to="/casamento/configuracoes"
              className="mt-1 inline-block text-sm text-primary underline-offset-4 hover:underline"
            >
              Definir em Ajustes
            </Link>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Enxoval</span>
            <span className="tabular-nums text-muted-foreground">{progress}%</span>
          </div>
          <Bar value={progress} />
          <p className="text-xs text-muted-foreground">
            Mudança: {fmtDate(w.plan?.move_in_date) ?? "não informada"}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Itens comprados"
          value={`${s.boughtItems}/${s.totalItems}`}
          hint={s.itemsWithoutPrice ? `${s.itemsWithoutPrice} sem preço-meta` : undefined}
        />
        <Stat
          label="Casa estimada"
          value={s.estimated ? formatCurrency(s.estimated) : "—"}
          hint={s.itemsWithoutPrice && s.estimated ? "Total parcial" : undefined}
        />
        <Stat
          label="Guardado"
          value={formatCurrency(s.saved)}
          hint={s.savingsTarget ? `Meta ${formatCurrency(s.savingsTarget)}` : "Sem meta definida"}
        />
        <Stat
          label="Gasto"
          value={formatCurrency(s.spent)}
          hint={
            w.plan?.total_budget != null
              ? `Orçamento ${formatCurrency(Number(w.plan.total_budget))}`
              : "Orçamento não informado"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="wed-card p-4 sm:p-5">
          <SectionTitle
            action={
              <Link to="/casamento/casa" className="text-sm text-primary hover:underline">
                Ver casa
              </Link>
            }
          >
            Por prioridade
          </SectionTitle>
          <ul className="space-y-3">
            {w.priorities.map((p) => {
              const d = s.byPriority[p.id] ?? { total: 0, bought: 0 };
              return (
                <li key={p.id} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <OptionBadge label={p.label} color={p.color} />
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {d.bought}/{d.total}
                    </span>
                  </div>
                  <Bar value={d.total ? (d.bought / d.total) * 100 : 0} />
                </li>
              );
            })}
          </ul>
        </section>
        <section className="wed-card p-4 sm:p-5">
          <SectionTitle
            action={
              <Link to="/casamento/preparativos" className="text-sm text-primary hover:underline">
                Ver todos
              </Link>
            }
          >
            Próximos preparativos
          </SectionTitle>
          {next.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum preparativo em aberto.</p>
          ) : (
            <ul className="divide-y divide-border">
              {next.map((t) => (
                <li key={t.id} className="py-2.5">
                  <p className="break-words font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.due_date
                      ? new Date(`${t.due_date}T12:00:00`).toLocaleDateString("pt-BR")
                      : "sem prazo"}{" "}
                    · {w.personName(t.responsible_user_id)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="wed-card p-4">
          <p className="wed-display text-lg">💌 Convidados</p>
          <p className="text-sm text-muted-foreground">
            Em preparação — lista, RSVP e portal chegam na próxima fase.
          </p>
        </div>
        <div className="wed-card p-4">
          <p className="wed-display text-lg">🎁 Presentes</p>
          <p className="text-sm text-muted-foreground">
            Em preparação — lista de presentes e cotas numa fase seguinte.
          </p>
        </div>
      </section>
    </WeddingShell>
  );
}

function GuestsCard({
  g,
  invitations,
}: {
  g: ReturnType<typeof summarizeGuests>;
  invitations: number;
}) {
  return (
    <Link
      to="/casamento/convidados"
      className="wed-card grid grid-cols-2 gap-3 p-4 transition hover:border-primary/40 sm:grid-cols-4 sm:p-5"
    >
      <div>
        <p className="text-xs text-muted-foreground">Convites</p>
        <p className="wed-display text-2xl tabular-nums">{invitations}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Pessoas</p>
        <p className="wed-display text-2xl tabular-nums">{g.total}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Confirmadas</p>
        <p className="wed-display text-2xl tabular-nums">{g.yes}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Aguardando</p>
        <p className="wed-display text-2xl tabular-nums">{g.pending}</p>
      </div>
    </Link>
  );
}
