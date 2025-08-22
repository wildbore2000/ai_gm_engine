import { supabase } from "./supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
export type FactionRow = {
  id: string; // UUID
  world_id: string; // UUID
  name: string;
  tags: string[];
  ideology?: string;
  goals: string[];
  pressure: number;
  stability: number;
  resources: any;
  relations: any;
  leaders?: string[];
  created_at: string;
};
export async function listFactions(worldId: string): Promise<FactionRow[]> {
  const { data, error } = await supabase.from("factions")
    .select("*").eq("world_id", worldId)
    .order("name", { ascending: true });
  if (error) throw error; return data ?? [];
}
export async function upsertFaction(row: FactionRow): Promise<FactionRow> {
  const { data, error } = await supabase.from("factions").upsert(row,{ onConflict:"id" }).select().single();
  if (error) throw error; return data!;
}
export async function deleteFaction(id:string){ const { error } = await supabase.from("factions").delete().eq("id",id); if (error) throw error; }

export function onFactionsChange(cb: (p: RealtimePostgresChangesPayload<any>) => void) {
  return supabase
    .channel("factions-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "factions" }, cb)
    .subscribe();
}
