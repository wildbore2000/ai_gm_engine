// src/components/HUDGoal.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function HUDGoal({ worldId, arcId = "arc_bandit_threat" }: { worldId: string; arcId?: string }) {
  const [deadline, setDeadline] = useState<number>(() => {
    const saved = localStorage.getItem("goal_deadline_ts");
    if (saved) return Number(saved);
    const ts = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days from now (real time proxy)
    localStorage.setItem("goal_deadline_ts", String(ts));
    return ts;
  });
  const [tension, setTension] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let sub = supabase.channel(`hud-${worldId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "worlds", filter: `id=eq.${worldId}` },
        p => setTension(p.new?.tension ?? 0))
      .on("postgres_changes", { event: "*", schema: "public", table: "arcs", filter: `id=eq.${arcId}` },
        p => setProgress(p.new?.progress ?? 0))
      .subscribe();
    (async () => {
      const [w, a] = await Promise.all([
        supabase.from("worlds").select("tension").eq("id", worldId).single(),
        supabase.from("arcs").select("progress").eq("id", arcId).single()
      ]);
      if (!w.error) setTension(w.data?.tension ?? 0);
      if (!a.error) setProgress(a.data?.progress ?? 0);
    })();
    return () => { supabase.removeChannel(sub); };
  }, [worldId, arcId]);

  const msLeft = Math.max(0, deadline - Date.now());
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  const win = progress >= 1;
  const lose = tension >= 0.9 || daysLeft <= 0;

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className={`px-2 py-0.5 rounded ${win ? "bg-emerald-700" : lose ? "bg-rose-700" : "bg-slate-800"}`}>
        {win ? "Victory: Arc Complete" : lose ? "Defeat: Pressure Overwhelms" : `Goal: Complete Arc in ${daysLeft}d`}
      </span>
      <span className="text-slate-400">Arc: {(progress*100)|0}%</span>
      <span className="text-slate-400">Tension: {(tension*100)|0}%</span>
    </div>
  );
}