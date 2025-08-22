import { supabase } from "./supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type WorldRow = {
  id: string;
  name: string;
  time?: string;
  weather?: string;
  locations: string[];      // text[] (schema now text[])
  factions: any;            // jsonb
  events: any[];            // jsonb array
  history_log: string[];    // jsonb array
  tension: number;
  created_by?: string;
};

export async function listWorlds() {
  const { data, error } = await supabase
    .from("worlds")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorldRow[];
}

export async function createWorld(name: string, partial: Partial<WorldRow> = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be authenticated to create world");
  const base: Omit<WorldRow, "id"> = {
    created_by: user.id,
    name,
    time: "Day 1, 00:00",
    weather: "clear",
    locations: [],
    factions: {},
    events: [],
    history_log: [],
    tension: 0,
  };
  const payload = { ...base, ...partial };

  const { data, error } = await supabase
    .from("worlds")
    .insert(payload)      // no id -> Postgres default UUID fills it
    .select()
    .single();
  if (error) throw error;
  return data as WorldRow;
}

export async function upsertWorld(row: Partial<WorldRow> & { id: string }) {
  // Only call this when editing existing world with a real id
  const { data, error } = await supabase
    .from("worlds")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as WorldRow;
}

export async function renameWorld(id: string, name: string) {
  const { data, error } = await supabase
    .from("worlds")
    .update({ name })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as WorldRow;
}

export async function deleteWorld(id: string) {
  const { error } = await supabase.from("worlds").delete().eq("id", id);
  if (error) throw error;
}

export function onWorldsChange(cb: (p: RealtimePostgresChangesPayload<any>) => void) {
  return supabase
    .channel("worlds-rt")
    .on("postgres_changes", { event: "*", schema: "public", table: "worlds" }, cb)
    .subscribe();
}

export async function advanceWorldTick(world_id: string, hours: number = 1) {
  const { data, error } = await supabase.functions.invoke('advanceWorldTick', {
    body: { world_id, hours }
  });
  if (error) throw error;
  return data;
}