import { supabase } from "./supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type EntityRow = {
  id: string; world_id: string; name: string; tags: string[];
  srd: any; personality: any; status: any; relationships: any;
};

export async function listEntities(worldId: string): Promise<EntityRow[]> {
  const { data, error } = await supabase.from("entities")
    .select("*").eq("world_id", worldId)
    .order("name", { ascending: true });
  if (error) throw error; return data ?? [];
}

export async function upsertEntity(row: EntityRow): Promise<EntityRow> {
  const { data, error } = await supabase.from("entities").upsert(row,{ onConflict:"id" }).select().single();
  if (error) throw error; return data!;
}

export async function deleteEntity(id: string) {
  const { error } = await supabase.from("entities").delete().eq("id", id);
  if (error) throw error;
}

export function onEntitiesChange(cb: (p: RealtimePostgresChangesPayload<any>) => void) {
  return supabase
    .channel("entities-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "entities" }, cb)
    .subscribe();
}

