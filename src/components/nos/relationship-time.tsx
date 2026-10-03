import { useEffect, useMemo, useState } from "react";
import { CalendarHeart, ChevronRight, Plus } from "lucide-react";
import { useApp } from "@/features/app/app-context";
import { MemberAvatar } from "@/components/profile/member-avatar";
import { Button } from "@/components/ui/button";
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
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="group relative h-auto w-full justify-start overflow-hidden whitespace-normal rounded-2xl border border-primary/20 bg-surface/90 p-4 text-left text-foreground shadow-lift backdrop-blur-xl transition-all duration-300 hover:border-primary/45 hover:bg-surface sm:p-6 lg:p-7"
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-full overflow-hidden bg-primary/5 sm:w-1/2">
          {workspace?.avatar_url ? (
            <img
              src={workspace.avatar_url}
              alt="Foto compartilhada do Life OS"
              className="size-full object-cover opacity-20 sm:opacity-30"
            />
          ) : null}
          <div className="absolute inset-0 bg-background/25" />
        </div>
        <div className="relative flex w-full min-w-0 flex-col gap-4 sm:gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
              Tempo de Nós
            </div>
            <div className="mt-3 flex min-w-0 items-center gap-3 sm:mt-4">
              <div className="flex shrink-0 items-center">
                {people.map((person, index) => (
                  <MemberAvatar
                    key={person.id}
                    name={person.name}
                    email={person.email}
                    src={person.avatar_url}
                    className={index ? "-ml-2 size-10 border-2 border-surface" : "size-10 border-2 border-surface"}
                  />
                ))}
                {people.length === 1 ? <Plus className="mx-1 size-3 text-muted-foreground" /> : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{names.join(" + ") || "Nossa história"}</p>
                <p className="truncate text-xs text-muted-foreground">Desde {longDate}</p>
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:gap-7">
            {[
              [duration.years, "anos"],
              [duration.months, "meses"],
              [duration.days, "dias"],
            ].map(([value, label]) => (
              <div key={label} className="min-w-0 text-center sm:text-left xl:text-center">
                <p className="numeric font-mono text-2xl font-medium text-foreground sm:text-3xl xl:text-4xl">{pad(Number(value))}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-3 sm:pt-4 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
            <div className="min-w-0">
              <p className="numeric font-mono text-lg text-foreground sm:text-2xl">
                {pad(duration.hours)}:{pad(duration.minutes)}:{pad(duration.seconds)}
              </p>
              <p className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">horas · minutos · segundos</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </div>
      </Button>

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