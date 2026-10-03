import { useEffect, useMemo, useState } from "react";
import { CalendarHeart, ChevronRight, Heart } from "lucide-react";
import { useApp } from "@/features/app/app-context";
import { MemberAvatar } from "@/components/profile/member-avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function addCalendarMonths(date: Date, months: number) {
  const copy = new Date(date);
  const day = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + months);
  const lastDay = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(day, lastDay));
  return copy;
}

export function relationshipDuration(start: Date, now: Date) {
  if (now < start) return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  let cursor = new Date(start);
  let years = now.getFullYear() - cursor.getFullYear();
  let yearCursor = new Date(cursor);
  yearCursor.setFullYear(cursor.getFullYear() + years);
  if (yearCursor > now) {
    years -= 1;
    yearCursor = new Date(cursor);
    yearCursor.setFullYear(cursor.getFullYear() + years);
  }
  cursor = yearCursor;
  let months = (now.getFullYear() - cursor.getFullYear()) * 12 + now.getMonth() - cursor.getMonth();
  let monthCursor = addCalendarMonths(cursor, months);
  if (monthCursor > now) {
    months -= 1;
    monthCursor = addCalendarMonths(cursor, months);
  }
  const remainder = now.getTime() - monthCursor.getTime();
  const days = Math.floor(remainder / 86_400_000);
  const afterDays = remainder - days * 86_400_000;
  const hours = Math.floor(afterDays / 3_600_000);
  const minutes = Math.floor((afterDays % 3_600_000) / 60_000);
  const seconds = Math.floor((afterDays % 60_000) / 1000);
  return { years, months, days, hours, minutes, seconds };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function RelationshipTime() {
  const { memberProfiles, workspace, relationship } = useApp();
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const start = relationship?.started_at ? new Date(relationship.started_at) : null;
  const duration = start ? relationshipDuration(start, now) : null;
  const totals = useMemo(() => {
    const milliseconds = start ? Math.max(0, now.getTime() - start.getTime()) : 0;
    return {
      days: Math.floor(milliseconds / 86_400_000),
      hours: Math.floor(milliseconds / 3_600_000),
      minutes: Math.floor(milliseconds / 60_000),
      seconds: Math.floor(milliseconds / 1000),
    };
  }, [now, start?.getTime()]);
  const people = memberProfiles.slice(0, 2);
  const names = people.map((person) => person.name.trim().split(" ")[0]).filter(Boolean);
  if (people.length < 2 || !start || relationship?.status !== "ACTIVE" || !duration) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-primary/30 bg-surface/70 p-5 sm:p-7">
        <div><p className="text-sm font-semibold">Tempo de Nós</p><p className="mt-1 text-sm text-muted-foreground">Adicione seu parceiro(a) e configure a data de início para começar o contador.</p></div>
        <CalendarHeart className="size-6 shrink-0 text-primary" />
      </div>
    );
  }
  const longDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(start);
  const shortDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(start);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ver detalhes do Tempo de Nós"
        className="group flex min-h-[80px] w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-4 text-left shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4 sm:px-5"
      >
        <div className="flex shrink-0 items-center">
          {people.map((person, index) => (
            <MemberAvatar
              key={person.id}
              name={person.name}
              email={person.email}
              src={person.avatar_url}
              className={index ? "-ml-2.5 size-9 border-2 border-surface sm:size-10" : "size-9 border-2 border-surface sm:size-10"}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
            <Heart className="size-3 shrink-0 fill-primary text-primary" aria-hidden />
            <span className="truncate">{names.join(" + ") || "Nossa história"}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">Juntos desde {longDate}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="numeric text-sm font-semibold text-foreground sm:text-base">
            {[
              duration.years ? `${duration.years} ${duration.years === 1 ? "ano" : "anos"}` : null,
              duration.months ? `${duration.months} ${duration.months === 1 ? "mês" : "meses"}` : null,
              `${duration.days} ${duration.days === 1 ? "dia" : "dias"}`,
            ].filter(Boolean).join(" · ")}
          </p>
          <p className="numeric font-mono text-[11px] text-muted-foreground tabular-nums">
            {pad(duration.hours)}:{pad(duration.minutes)}:{pad(duration.seconds)}
          </p>
        </div>
        <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarHeart className="size-5 text-primary" /> Tempo de Nós</DialogTitle>
            <DialogDescription>{names.join(" e ") || "Nossa história"} · desde {shortDate}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-2">
            {[
              [duration.years, "anos"], [duration.months, "meses"], [duration.days, "dias"],
              [duration.hours, "horas"], [duration.minutes, "minutos"], [duration.seconds, "segundos"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border border-border bg-background/50 p-3 text-center">
                <p className="numeric font-mono text-2xl font-medium">{pad(Number(value))}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
            {[
              [totals.days, "dias juntos"], [totals.hours, "horas juntos"],
              [totals.minutes, "minutos juntos"], [totals.seconds, "segundos juntos"],
            ].map(([value, label]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="numeric font-mono">{Number(value).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}