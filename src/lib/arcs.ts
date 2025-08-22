import { supabase } from "./supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
export type ArcRow = {
  id: string; // UUID
  world_id: string; // UUID
  title: string;
  stage?: string;
  goal?: string;
  progress: number;
  triggers: string[];
  beats: string[];
  pressure_vector: any;
  owner?: string;
  created_at: string;
};
export async function listArcs(worldId: string): Promise<ArcRow[]> {
  const { data, error } = await supabase.from("arcs")
    .select("*").eq("world_id", worldId)
    .order("title", { ascending: true });
  if (error) throw error; return data ?? [];
}
export async function upsertArc(row: ArcRow): Promise<ArcRow> {
  const { data, error } = await supabase.from("arcs").upsert(row,{ onConflict:"id" }).select().single();
  if (error) throw error; return data!;
}
export async function deleteArc(id:string){ const { error } = await supabase.from("arcs").delete().eq("id",id); if (error) throw error; }

export function onArcsChange(cb: (p: RealtimePostgresChangesPayload<any>) => void) {
  return supabase
    .channel("arcs-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "arcs" }, cb)
    .subscribe();
}
