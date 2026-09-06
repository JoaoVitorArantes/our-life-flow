import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type MemberAvatarProps = {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function initialsOf(name?: string | null, email?: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}` : source.slice(0, 2)).toUpperCase();
}

export function MemberAvatar({ name, email, src, className, fallbackClassName }: MemberAvatarProps) {
  return (
    <Avatar className={cn("size-9 ring-1 ring-border", className)}>
      {src ? <AvatarImage src={src} alt={name || email || "Foto de perfil"} className="object-cover" /> : null}
      <AvatarFallback className={cn("bg-accent text-xs font-semibold text-foreground", fallbackClassName)}>
        {initialsOf(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}