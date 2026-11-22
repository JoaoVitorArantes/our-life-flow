import { Link } from "@tanstack/react-router";
import { ImageIcon } from "lucide-react";
import type { WeddingItem } from "@/features/wedding/api";
import type { WeddingData } from "@/features/wedding/use-wedding";
import { useWeddingImage } from "@/features/wedding/api";
import { formatCurrency } from "@/lib/format";
import { OptionBadge } from "./shell";

/** Card de item: nome sempre visível (até 2 linhas), badges em linha própria. */
export function ItemCard({
  item,
  w,
  showRoom,
}: {
  item: WeddingItem;
  w: WeddingData;
  showRoom?: boolean;
}) {
  const p = w.priorityOf(item.priority_id);
  const s = w.statusOf(item.status_id);
  const img = useWeddingImage(item.image_path);
  return (
    <Link
      to="/casamento/casa/item/$itemId"
      params={{ itemId: item.id }}
      className="wed-card flex gap-3 p-3 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
    >
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
        {img.data ? (
          <img src={img.data} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="line-clamp-2 font-semibold leading-snug break-words">
          <span className="tabular-nums text-primary">{item.quantity}×</span> {item.name}
        </p>
        {showRoom && (
          <p className="truncate text-xs text-muted-foreground">{w.roomOf(item.room_id)?.name}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {p && <OptionBadge label={p.label} color={p.color} />}
          {s && <OptionBadge label={s.label} color={s.color} />}
        </div>
        <p className="text-xs text-muted-foreground">
          {item.price_target != null
            ? `Meta ${formatCurrency(Number(item.price_target))}`
            : "Sem preço-meta"}
          {item.price_actual != null && ` · Pago ${formatCurrency(Number(item.price_actual))}`}
          {item.responsible_user_id && ` · ${w.personName(item.responsible_user_id)}`}
        </p>
      </div>
    </Link>
  );
}
