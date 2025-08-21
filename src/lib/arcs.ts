import { supabase } from "./supabase";
export type ArcRow = {
  id:string; title:string; stage?:string; goal?:string;
  progress:number; triggers:string[]; beats:string[]; pressure_vector:any; owner?:string;
};
export async function listArcs(): Promise<ArcRow[]> {
  const { data, error } = await supabase.from("arcs").select("*").order("title",{ascending:true});
  if (error) throw error; return data ?? [];
}
export async function upsertArc(row: ArcRow): Promise<ArcRow> {
  const { data, error } = await supabase.from("arcs").upsert(row,{ onConflict:"id" }).select().single();
  if (error) throw error; return data!;
}
export async function deleteArc(id:string){ const { error } = await supabase.from("arcs").delete().eq("id",id); if (error) throw error; }
