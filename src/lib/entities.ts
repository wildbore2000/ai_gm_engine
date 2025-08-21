import { supabase } from "./supabase";
export type EntityRow = {
  id: string; name: string; tags: string[];
  srd: any; personality: any; status: any; relationships: any;
};
export async function listEntities(): Promise<EntityRow[]> {
  const { data, error } = await supabase.from("entities").select("*").order("name",{ascending:true});
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

