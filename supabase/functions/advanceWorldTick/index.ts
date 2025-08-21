// supabase/functions/advanceWorldTick/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { world_id, hours = 1 } = await req.json();
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key);

  const { data: world, error: werr } = await db.from("worlds").select("*").eq("id", world_id).single();
  if (werr || !world) return new Response(JSON.stringify({ ok: false, error: werr?.message || "world not found" }), { status: 400 });

  // naive time + tension drift
  const time = `${world.time || "Day 1, 00:00"} (+${hours}h)`;
  const tension = Math.min(1, Math.max(0, (world.tension ?? 0) + (Math.random() - 0.5) * 0.05));

  await db.from("worlds").update({ time, tension }).eq("id", world_id);

  // seed a rumor if tension moderate
  if (tension < 0.6) {
    await db.from("events").insert({
      world_id, type: "rumor", title: "Market whispers",
      payload: { content: "Supplies are thinner than they look." },
      priority: 2, source: "tick", tags: ["tick", "rumor"]
    });
  }

  return new Response(JSON.stringify({ ok: true, world_id, hours, tension }), { headers: { "content-type": "application/json" } });
});