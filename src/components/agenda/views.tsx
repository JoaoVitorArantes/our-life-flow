import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { Context } from "@/features/contexts/queries";
import {
  addDays,
  groupByDate,
  isoOf,
  minutesLabel,
  parseISO,
  startOfMonthGrid,
  startOfWeek,
  type AgendaItem,
} from "@/features/agenda/queries";
import { AgendaRow, KIND_ICON, KIND_TONE } from "./agenda-row";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06h → 23h
const HOUR_HEIGHT = 52;

export type ViewHandlers = {
  contexts: Context[];
  onOpen: (item: AgendaItem) => void;
  onToggleTask: (item: AgendaItem) => void;
  onPay: (item: AgendaItem) => void;
  onCreateAt: (date: string, minutes?: number) => void;
  onDayMenu: (date: string) => void;
  onMove: (item: AgendaItem, date: string, minutes: number) => void;
};

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(
    parseISO(iso),
  );

function relativeLabel(iso: string) {
  const today = isoOf(new Date());
  if (iso === today) return "Hoje";
  if (iso === isoOf(addDays(new Date(), 1))) return "Amanhã";
  if (iso === isoOf(addDays(new Date(), -1))) return "Ontem";
  return null;
}

/* ------------------------------------------------------------------- mês */

export function MonthView({
  cursor,
  items,
  handlers,
}: {
  cursor: Date;
  items: AgendaItem[];
  handlers: ViewHandlers;
}) {
  const start = startOfMonthGrid(cursor);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(start, i)), [+start]);
  const byDate = groupByDate(items);
  const todayIso = isoOf(new Date());

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border text-center text-[11px] uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const iso = isoOf(day);
          const dayItems = byDate.get(iso) ?? [];
          const outside = day.getMonth() !== cursor.getMonth();
          return (
            <button
              key={iso}
              type="button"
              onClick={() => handlers.onDayMenu(iso)}
              className={cn(
                "min-h-[86px] border-b border-r border-border/60 p-1.5 text-left transition-colors hover:bg-elevated/60 sm:min-h-[110px]",
                outside && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "numeric inline-flex size-6 items-center justify-center rounded-full text-xs",
                  iso === todayIso && "bg-primary text-primary-foreground",
                )}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayItems.slice(0, 3).map((item) => {
                  const Icon = KIND_ICON[item.kind];
                  return (
                    <div
                      key={item.key}
                      className="flex items-center gap-1 truncate text-[11px] text-muted-foreground"
                    >
                      <Icon
                        className={cn(
                          "size-3 shrink-0",
                          item.overdue ? "text-destructive" : KIND_TONE[item.kind],
                        )}
                      />
                      <span className={cn("truncate", item.done && "line-through")}>
                        {item.title}
                      </span>
                    </div>
                  );
                })}
                {dayItems.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayItems.length - 3} itens
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------- grade de horas comum */

function TimedGrid({
  days,
  items,
  handlers,
}: {
  days: Date[];
  items: AgendaItem[];
  handlers: ViewHandlers;
}) {
  const byDate = groupByDate(items);
  const todayIso = isoOf(new Date());

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <div className="min-w-[640px]">
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div />
          {days.map((day) => {
            const iso = isoOf(day);
            return (
              <div key={iso} className="border-l border-border/60 px-2 py-2 text-center">
                <p className="text-[11px] uppercase text-muted-foreground">
                  {WEEKDAYS[day.getDay()]}
                </p>
                <p
                  className={cn(
                    "numeric mx-auto mt-1 inline-flex size-6 items-center justify-center rounded-full text-sm",
                    iso === todayIso && "bg-primary text-primary-foreground",
                  )}
                >
                  {day.getDate()}
                </p>
                <div className="mt-1 space-y-1">
                  {(byDate.get(iso) ?? [])
                    .filter((item) => item.minutes == null)
                    .map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handlers.onOpen(item)}
                        className={cn(
                          "block w-full truncate rounded-md bg-elevated px-1.5 py-1 text-left text-[11px]",
                          item.overdue && "text-destructive",
                          item.done && "line-through opacity-60",
                        )}
                      >
                        {item.title}
                        {item.amount != null ? ` · ${formatCurrency(item.amount)}` : ""}
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="numeric border-b border-border/40 pr-2 text-right text-[10px] text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const iso = isoOf(day);
            const timed = (byDate.get(iso) ?? []).filter((item) => item.minutes != null);
            return (
              <div key={iso} className="relative border-l border-border/60">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-border/40 transition-colors hover:bg-elevated/40"
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => handlers.onCreateAt(iso, hour * 60)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      const key = event.dataTransfer.getData("text/agenda");
                      const item = items.find((entry) => entry.key === key);
                      if (item) handlers.onMove(item, iso, hour * 60);
                    }}
                  />
                ))}
                {timed.map((item) => {
                  const top = ((item.minutes! - HOURS[0]! * 60) / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    28,
                    (((item.endMinutes ?? item.minutes! + 60) - item.minutes!) / 60) * HOUR_HEIGHT,
                  );
                  return (
                    <button
                      key={item.key}
                      type="button"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/agenda", item.key)}
                      onClick={(event) => {
                        event.stopPropagation();
                        handlers.onOpen(item);
                      }}
                      className={cn(
                        "absolute left-1 right-1 overflow-hidden rounded-lg border border-primary/30 bg-primary/15 px-2 py-1 text-left text-[11px] text-foreground",
                        item.done && "opacity-60 line-through",
                      )}
                      style={{ top: Math.max(0, top), height }}
                    >
                      <span className="numeric block text-[10px] text-muted-foreground">
                        {minutesLabel(item.minutes)}
                      </span>
                      <span className="block truncate font-medium">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function WeekView({
  cursor,
  items,
  handlers,
}: {
  cursor: Date;
  items: AgendaItem[];
  handlers: ViewHandlers;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return <TimedGrid days={days} items={items} handlers={handlers} />;
}

/* ------------------------------------------------------------------- dia */

export function DayView({
  cursor,
  items,
  handlers,
}: {
  cursor: Date;
  items: AgendaItem[];
  handlers: ViewHandlers;
}) {
  const iso = isoOf(cursor);
  const dayItems = items.filter((item) => item.date === iso);
  const open = dayItems.filter((item) => !item.done);
  const done = dayItems.filter((item) => item.done);
  const next = items
    .filter((item) => item.date > iso && !item.done)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <TimedGrid days={[cursor]} items={items} handlers={handlers} />

      <Section title={`${relativeLabel(iso) ?? dayLabel(iso)}`} items={open} handlers={handlers} />
      <Section title="Próximos" items={next} handlers={handlers} />
      <Section title="Concluídos" items={done} handlers={handlers} />
    </div>
  );
}

function Section({
  title,
  items,
  handlers,
}: {
  title: string;
  items: AgendaItem[];
  handlers: ViewHandlers;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">Nada por aqui.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {items.map((item) => (
            <AgendaRow
              key={item.key}
              item={item}
              contexts={handlers.contexts}
              onOpen={handlers.onOpen}
              onToggleTask={handlers.onToggleTask}
              onPay={handlers.onPay}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------- lista */

export function ListView({ items, handlers }: { items: AgendaItem[]; handlers: ViewHandlers }) {
  const grouped = [...groupByDate(items).entries()];

  if (grouped.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        Nenhum item no período selecionado.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([date, dayItems]) => (
        <section key={date} className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em]">
              {relativeLabel(date) ?? dayLabel(date)}
            </h2>
            <span className="text-xs text-muted-foreground">{dayItems.length} itens</span>
          </div>
          <div className="divide-y divide-border/60">
            {dayItems.map((item) => (
              <AgendaRow
                key={item.key}
                item={item}
                contexts={handlers.contexts}
                onOpen={handlers.onOpen}
                onToggleTask={handlers.onToggleTask}
                onPay={handlers.onPay}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
