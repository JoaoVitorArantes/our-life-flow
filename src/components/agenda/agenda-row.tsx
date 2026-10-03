import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckSquare,
  Square,
  Wallet,
  Target,
  StickyNote,
  Repeat,
  MapPin,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreatedBy } from "@/components/common/created-by";
import { formatCurrency } from "@/lib/format";
import { contextEmoji, type Context } from "@/features/contexts/queries";
import { minutesLabel, type AgendaItem, type AgendaKind } from "@/features/agenda/queries";

export const KIND_ICON: Record<AgendaKind, typeof CalendarDays> = {
  event: CalendarDays,
  task: CheckSquare,
  finance: Wallet,
  goal: Target,
  note: StickyNote,
  routine: Repeat,
};

export const KIND_TONE: Record<AgendaKind, string> = {
  event: "text-primary",
  task: "text-sky-400",
  finance: "text-amber-400",
  goal: "text-emerald-400",
  note: "text-muted-foreground",
  routine: "text-primary",
};

export function AgendaRow({
  item,
  contexts,
  onOpen,
  onToggleTask,
  onPay,
  actions,
  compact = false,
}: {
  item: AgendaItem;
  contexts: Context[];
  onOpen?: (item: AgendaItem) => void;
  onToggleTask?: (item: AgendaItem) => void;
  onPay?: (item: AgendaItem) => void;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  const Icon = KIND_ICON[item.kind];
  const context = contexts.find((entry) => entry.id === item.contextId);
  const time = minutesLabel(item.minutes);

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-transparent px-2 py-3 transition-colors hover:border-border hover:bg-elevated/60",
        item.done && "opacity-60",
      )}
    >
      {item.kind === "task" && onToggleTask ? (
        <button
          type="button"
          aria-label={item.done ? "Reabrir tarefa" : "Concluir tarefa"}
          onClick={() => onToggleTask(item)}
          className="mt-0.5 text-muted-foreground transition-colors hover:text-primary"
        >
          {item.done ? (
            <CheckSquare className="size-5 text-primary" />
          ) : (
            <Square className="size-5" />
          )}
        </button>
      ) : (
        <Icon className={cn("mt-0.5 size-5 shrink-0", KIND_TONE[item.kind])} />
      )}

      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("truncate text-sm font-medium", item.done && "line-through")}>
            {item.title}
          </span>
          {item.recurring ? <Repeat className="size-3.5 text-muted-foreground" /> : null}
          {item.amount != null ? (
            <span className="numeric text-sm font-medium">{formatCurrency(item.amount)}</span>
          ) : null}
        </div>
        {!compact ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {time ? <span className="numeric">{time}</span> : null}
            {item.hint ? (
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-1.5 text-[10px]",
                  item.overdue && "border-destructive/40 text-destructive",
                )}
              >
                {item.hint}
              </Badge>
            ) : null}
            {item.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {item.location}
              </span>
            ) : null}
          </div>
        ) : null}
      </button>

      <div className="flex shrink-0 items-center gap-2">
        {context ? (
          <Link
            to="/contextos/$id"
            params={{ id: context.id }}
            className="hidden items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:flex"
          >
            <Folder className="size-3" />
            {contextEmoji(context.type)} {context.name}
          </Link>
        ) : null}
        {item.kind === "finance" && !item.done && !item.recordId.startsWith("proj-") && onPay ? (
          <Button size="sm" variant="outline" className="h-7" onClick={() => onPay(item)}>
            Pagar
          </Button>
        ) : null}
        {item.ownerId ? <CreatedBy userId={item.ownerId} className="hidden md:inline-flex" /> : null}
        {actions}
      </div>
    </div>
  );
}
