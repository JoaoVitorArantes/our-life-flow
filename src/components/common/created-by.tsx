import { Badge } from "@/components/ui/badge";
import { useApp } from "@/features/app/app-context";
import { MemberAvatar } from "@/components/profile/member-avatar";
import { cn } from "@/lib/utils";

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
  const { memberProfiles } = useApp();
  const nameOf = useMemberName();
  const name = nameOf(userId);
  if (!name) return null;
  const profile = memberProfiles.find((item) => item.id === userId);
  return (
    <Badge variant="outline" className={cn("gap-1.5 pl-1", className)}>
      <MemberAvatar name={profile?.name} email={profile?.email} src={profile?.avatar_url} className="size-4 border-0 ring-0" fallbackClassName="text-[7px]" />
      {name}
    </Badge>
  );
}
