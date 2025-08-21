import { supabase } from "./supabase";
export type WorldRow = {
  id:string; time?:string; weather?:string; locations:string[];
  factions:any; events:any[]; history_log:string[]; tension:number;
};
export async function listWorlds(): Promise<WorldRow[]> {
  const { data, error } = await supabase.from("worlds").select("*").order("created_at",{ascending:false});
  if (error) throw error; return data ?? [];
}
export async function upsertWorld(row: Partial<WorldRow> & { id?:string }) {
  const { data, error } = await supabase.from("worlds").upsert(row).select().maybeSingle();
  if (error) throw error; return data;
}
export async function deleteWorld(id:string){ const { error } = await supabase.from("worlds").delete().eq("id",id); if (error) throw error; }
