import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Event = Tables<"events">;
export type Task = Tables<"tasks">;
export type Goal = Tables<"goals">;
export type Note = Tables<"notes">;

export function useEvents(workspaceId?: string) {
  return useQuery({
    queryKey: ["events", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("starts_at");
      if (error) throw error;
      return data as Event[];
    },
  });
}

export function useTasks(workspaceId?: string) {
  return useQuery({
    queryKey: ["tasks", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useGoals(workspaceId?: string) {
  return useQuery({
    queryKey: ["goals", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
  });
}

export function useGoal(goalId?: string) {
  return useQuery({
    queryKey: ["goal", goalId],
    enabled: !!goalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("id", goalId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Goal | null) ?? null;
    },
  });
}


export function useNotes(workspaceId?: string) {
  return useQuery({
    queryKey: ["notes", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });
}
