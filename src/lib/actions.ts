// src/lib/actions.ts
import { supabase } from "@/lib/supabase";

export type DeltaPlan = {
  world?: { tension_delta?: number };
  arcs?: { id: string; progress_delta: number }[];
  factions?: { id: string; pressure_delta: number }[];
};

export async function postEvent(row: {
  world_id: string;
  type: string;
  title?: string | null;
  payload?: any;
  priority?: number;
  tags?: string[];
  parent_event_id?: string | null;
  thread_id?: string | null;
}) {
  const insertRow = {
    world_id: row.world_id,
    type: row.type,
    title: row.title ?? null,
    payload: row.payload ?? {},
    priority: row.priority ?? 1,
    tags: row.tags ?? [],
    parent_event_id: row.parent_event_id ?? null,
    thread_id: row.thread_id ?? null,
  };

  // Return the inserted row (id, thread_id, etc.)
  const { data, error } = await supabase
    .from("events")
    .insert([insertRow])
    .select()
    .single();

  if (error) throw error;
  return data; // includes id, thread_id
}

export async function ensureThreadFor(eventId: string): Promise<string> {
  const { data } = await supabase.from("events").select("id, thread_id").eq("id", eventId).single();
  if (!data) throw new Error("event not found");
  if (data.thread_id) return data.thread_id;
  // set thread_id = id for this root
  const { data: upd } = await supabase.from("events").update({ thread_id: eventId }).eq("id", eventId).select("thread_id").single();
  return upd?.thread_id ?? eventId;
}

export async function deriveThreadFromParent(parentId: string): Promise<string> {
  const { data } = await supabase.from("events").select("id, thread_id").eq("id", parentId).single();
  if (!data) throw new Error("parent event not found");
  return data.thread_id ?? data.id;
}

export async function applyDeltas(worldId: string, plan: DeltaPlan) {
  const rpc = async (fn: string, args: any) => {
    const { error } = await supabase.rpc(fn as any, args);
    if (error) throw error;
  };

  // Try RPCs; if they don't exist, fall back to client updates
  // WORLD
  if (plan.world && typeof plan.world.tension_delta === "number") {
    try {
      await rpc("apply_world_deltas", { p_world_id: worldId, p_tension_delta: plan.world.tension_delta });
    } catch {
      // fallback: read-modify-write
      const { data: w } = await supabase.from("worlds").select("tension").eq("id", worldId).single();
      const next = clamp((w?.tension ?? 0) + (plan.world.tension_delta ?? 0), 0, 1);
      await supabase.from("worlds").update({ tension: next }).eq("id", worldId);
    }
  }

  // ARCS
  if (plan.arcs?.length) {
    try {
      await rpc("apply_arc_progress_deltas", { p_updates: plan.arcs });
    } catch {
      for (const a of plan.arcs) {
        const { data: cur } = await supabase.from("arcs").select("progress").eq("id", a.id).single();
        const next = clamp((cur?.progress ?? 0) + a.progress_delta, 0, 1);
        await supabase.from("arcs").update({ progress: next }).eq("id", a.id);
      }
    }
  }

  // FACTIONS
  if (plan.factions?.length) {
    try {
      await rpc("apply_faction_pressure_deltas", { p_updates: plan.factions });
    } catch {
      for (const f of plan.factions) {
        const { data: cur } = await supabase.from("factions").select("pressure").eq("id", f.id).single();
        const next = clamp((cur?.pressure ?? 0.5) + f.pressure_delta, 0, 1);
        await supabase.from("factions").update({ pressure: next }).eq("id", f.id);
      }
    }
  }
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }