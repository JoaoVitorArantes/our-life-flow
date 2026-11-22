import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function BackToHouse({ roomId, label }: { roomId?: string | undefined; label: string }) {
  return roomId ? (
    <Link
      to="/casamento/casa/$roomId"
      params={{ roomId }}
      className="inline-flex min-h-9 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden /> <span className="truncate">{label}</span>
    </Link>
  ) : (
    <Link
      to="/casamento/casa"
      className="inline-flex min-h-9 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden /> {label}
    </Link>
  );
}
