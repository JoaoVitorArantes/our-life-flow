import { CreatedBy } from "@/components/common/created-by";
import { contextEmoji } from "@/features/contexts/queries";
import {
  activityEmoji,
  activityLabel,
  formatClock,
  formatDistance,
  formatDuration,
  personEmoji,
  personLabel,
  type Activity,
} from "@/features/activities/queries";
import { cn } from "@/lib/utils";

export function ActivityCard({
  activity,
  contextName,
  contextType,
  onOpen,
}: {
  activity: Activity;
  contextName?: string | null;
  contextType?: string | null;
  onOpen: () => void;
}) {
  const together = activity.person_scope === "COUPLE";
  const metrics = [formatDuration(activity.duration_minutes), formatDistance(activity.distance_km)]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft active:scale-[0.995]",
        together && "border-primary/25",
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-xl transition-transform duration-300 group-hover:scale-105">
        {activityEmoji(activity.activity_type)}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-base font-semibold">{activity.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {activityLabel(activity.activity_type)} ·{" "}
          <span className={cn(together && "text-primary")}>
            {personEmoji(activity.person_scope)} {personLabel(activity.person_scope)}
          </span>
          {formatClock(activity.start_time) ? ` · ${formatClock(activity.start_time)}` : ""}
        </p>
        {metrics ? <p className="numeric text-sm font-medium">{metrics}</p> : null}
        {activity.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">“{activity.description}”</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
          {activity.location ? <span className="truncate">📍 {activity.location}</span> : null}
          {contextName ? (
            <span className="truncate">
              {contextEmoji(contextType ?? "OTHER")} {contextName}
            </span>
          ) : null}
          <CreatedBy userId={activity.created_by} className="ml-auto" />
        </div>
      </div>
    </button>
  );
}
