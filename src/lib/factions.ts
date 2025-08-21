import { supabase } from "./supabase";
export type FactionRow = {
  id:string; name:string; tags:string[]; ideology?:string;
  goals:string[]; pressure:number; stability:number;
  resources:any; relations:any; leaders?:string[];
};
export async function listFactions(): Promise<FactionRow[]> {
  const { data, error } = await supabase.from("factions").select("*").order("name",{ascending:true});
  if (error) throw error; return data ?? [];
}
export async function upsertFaction(row: FactionRow): Promise<FactionRow> {
  const { data, error } = await supabase.from("factions").upsert(row,{ onConflict:"id" }).select().single();
  if (error) throw error; return data!;
}
export async function deleteFaction(id:string){ const { error } = await supabase.from("factions").delete().eq("id",id); if (error) throw error; }
