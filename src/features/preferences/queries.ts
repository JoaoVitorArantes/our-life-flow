import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/features/auth/session";
import { NAV_GROUPS, type NavGroup } from "@/features/app/navigation";

export type Favorite = { kind: "module"; to: string };

export type Preferences = {
  home_route: string;
  nav_order: string[];
  nav_hidden: string[];
  favorites: Favorite[];
  currency: string;
  date_format: string;
  density: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  home_route: "/dashboard",
  nav_order: [],
  nav_hidden: [],
  favorites: [],
  currency: "BRL",
  date_format: "dd/MM/yyyy",
  density: "comfortable",
};

export function usePreferences() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["user_preferences", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Preferences> => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_PREFERENCES;
      return {
        ...DEFAULT_PREFERENCES,
        ...data,
        favorites: Array.isArray(data.favorites) ? (data.favorites as Favorite[]) : [],
      };
    },
  });
}

export function useSavePreferences() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Preferences>) => {
      if (!user) throw new Error("Entre novamente.");
      const current =
        queryClient.getQueryData<Preferences>(["user_preferences", user.id]) ?? DEFAULT_PREFERENCES;
      const next = { ...current, ...patch };
      const { error } = await supabase.from("user_preferences").upsert({
        user_id: user.id,
        ...next,
        favorites: next.favorites as never,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["user_preferences", user?.id], next);
    },
  });
}

/** Navigation groups after applying the person's order, hidden modules and favorites. Hidden ≠ removed. */
export function useNavGroups(): NavGroup[] {
  const { data } = usePreferences();
  return useMemo(() => {
    const prefs = data ?? DEFAULT_PREFERENCES;
    const rank = (to: string) => {
      const index = prefs.nav_order.indexOf(to);
      return index === -1 ? 1000 : index;
    };
    const all = NAV_GROUPS.flatMap((group) => group.items);
    const favorites = prefs.favorites
      .map((fav) => all.find((item) => item.to === fav.to))
      .filter((item): item is NonNullable<typeof item> => !!item);
    const groups = NAV_GROUPS.map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => !prefs.nav_hidden.includes(item.to))
        .map((item, index) => ({ item, index }))
        .sort((a, b) => rank(a.item.to) - rank(b.item.to) || a.index - b.index)
        .map(({ item }) => item),
    })).filter((group) => group.items.length > 0);
    return favorites.length ? [{ label: "Favoritos", items: favorites }, ...groups] : groups;
  }, [data]);
}

const HOME_ROUTES = new Set(NAV_GROUPS.flatMap((group) => group.items.map((item) => item.to)));

/** Person's chosen home screen (falls back to the Dashboard). */
export async function resolveHomeRoute(): Promise<"/dashboard"> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "/dashboard";
  const { data } = await supabase
    .from("user_preferences")
    .select("home_route")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const route = data?.home_route;
  return (route && HOME_ROUTES.has(route) ? route : "/dashboard") as "/dashboard";
}
