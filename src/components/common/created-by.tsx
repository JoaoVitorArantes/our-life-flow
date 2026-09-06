import { Badge } from "@/components/ui/badge";
import { useApp } from "@/features/app/app-context";

/** Resolves a member's display name inside the couple workspace. */
export function useMemberName() {
  const { memberProfiles, userId } = useApp();
  return (id?: string | null) => {
    if (!id) return null;
    const profile = memberProfiles.find((item) => item.id === id);
    if (profile) return profile.name || profile.email || "Membro";
    return id === userId ? "Você" : "Membro";
  };
}

/** Small tag showing who created a shared record. */
export function CreatedBy({ userId, className }: { userId?: string | null; className?: string }) {
  const nameOf = useMemberName();
  const name = nameOf(userId);
  if (!name) return null;
  return (
    <Badge variant="outline" className={className}>
      {name}
    </Badge>
  );
}
