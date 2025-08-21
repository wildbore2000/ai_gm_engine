import { supabase } from "./supabase";
export type EventRow = {
  id: string; world_id: string; type: string; title?: string;
  payload: any; priority: number; source?: string;
  tags: string[]; expires_at?: string; created_at: string;
};

export async function listEvents(world_id: string): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("world_id", world_id)
    .order("created_at", { ascending: false });
  if (error) throw error; return data ?? [];
}

export async function insertEvent(row: Omit<EventRow, "id"|"created_at">) {
  const { data, error } = await supabase.from("events").insert(row).select().single();
  if (error) throw error; return data!;
}
