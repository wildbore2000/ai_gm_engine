// src/components/ActionModals.tsx
import { useMemo, useState } from "react";
import { levelDc, degreeOfSuccess, Degree } from "@/rules/pf2e";
import { applyDeltas, postEvent, ensureThreadFor, deriveThreadFromParent } from "@/lib/actions";
import { supabase } from "@/lib/supabase";
import { planFromOutcome } from "@/lib/story_director";

// Event types with a guaranteed "type"
type EventLite = { id: string; type: string; title?: string; tags?: string[]; payload?: any };
type Rumor = EventLite;
type FactionMove = EventLite;

type Entity = { id: string; name: string; srd?: any; status?: any };

export function InvestigateRumorModal({
  worldId, rumor, party, onClose, onDidApply
}: { worldId: string; rumor: Rumor; party: Entity[]; onClose: () => void; onDidApply?: (result: Degree) => void; }) {
  const [rolling, setRolling] = useState(false);
  const [picked, setPicked] = useState<string | null>(party[0]?.id ?? null);

  const actor = useMemo(() => party.find(p => p.id === picked) ?? party[0], [party, picked]);
  const level = Number(actor?.srd?.level ?? actor?.status?.level ?? 1);
  const dc = levelDc(level);

  async function rollInvestigate() {
    if (!actor) return;
    setRolling(true);
    try {
      // Make sure the root rumor has a thread id
      const rootThreadId = await ensureThreadFor(rumor.id);

      const d20 = 1 + Math.floor(Math.random() * 20);
      const mod =
        Number(
          actor?.srd?.skills?.investigation ??
          actor?.srd?.skills?.perception ??
          actor?.srd?.mods?.wis ?? 0
        );
      const total = d20 + mod;
      const deg = degreeOfSuccess(total, dc);

      // 1) Log the check as a child of the rumor, in the same thread
      const skill = await postEvent({
        world_id: worldId,
        type: "skill_result",
        title: `Investigate: ${rumor.title ?? "Rumor"}`,
        payload: { actor: actor.name, d20, mod, total, dc, degree: deg, source_event_id: rumor.id },
        priority: 2,
        tags: ["investigate", "skill", "rumor"],
        parent_event_id: rumor.id,
        thread_id: rootThreadId,
      });

      // 2) Plan follow-ups based on the outcome
      const rumorSrc: Rumor = rumor?.type ? rumor : ({ ...rumor, type: "rumor" } as Rumor);
      const plan = planFromOutcome(rumorSrc, deg);

      // 3) Post follow-up events as children of the skill_result (keeps the chain)
      for (const ev of plan.new_events) {
        await postEvent({
          world_id: worldId,
          ...ev,
          parent_event_id: skill.id,
          thread_id: rootThreadId,
        });
      }

      // 4) Apply deltas
      await applyDeltas(worldId, plan.updates);

      // 5) Tag the source rumor (resolved/stale/complication, etc.)
      if (plan.mutate?.source_event_id) {
        try {
          const add = plan.mutate.add_tags ?? [];
          const { data: cur } = await supabase.from("events").select("tags").eq("id", rumor.id).single();
          const next = Array.from(new Set([...(cur?.tags ?? []), ...add]));
          await supabase.from("events").update({ tags: next }).eq("id", rumor.id);
        } catch { /* no-op */ }
      }

      onDidApply?.(deg);
      onClose();
    } finally {
      setRolling(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="text-lg font-semibold mb-2">Investigate Rumor</div>
        <div className="text-sm text-slate-300 mb-3">{rumor.title}</div>
        <label className="block text-xs mb-1">Choose Investigator</label>
        <select value={picked ?? ""} onChange={e=>setPicked(e.target.value)} className="w-full bg-slate-800 rounded p-2 mb-3">
          {party.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="text-xs mb-3 text-slate-400">PF2e DC (L{level}): <span className="text-slate-200">{dc}</span></div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 rounded bg-slate-800">Cancel</button>
          <button disabled={rolling} onClick={rollInvestigate} className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500">
            {rolling ? "Rolling…" : "Roll"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PressureFactionModal({
  worldId, move, factionId, onClose, onDidApply
}: { worldId: string; move: FactionMove; factionId: string; onClose: () => void; onDidApply?: (result: Degree) => void; }) {
  const [rolling, setRolling] = useState(false);

  async function rollPressure() {
    setRolling(true);
    try {
      // Use the move as the root of this thread (or inherit if it already had one)
      const rootThreadId = await ensureThreadFor(move.id);

      const d20 = 1 + Math.floor(Math.random() * 20);
      const mod = 6;   // TODO: wire to party Face
      const dc = 18;   // TODO: derive from faction/location
      const total = d20 + mod;
      const deg = degreeOfSuccess(total, dc);

      // 1) Log the result, child of the move
      const result = await postEvent({
        world_id: worldId,
        type: "faction_pressure_result",
        title: `Pressure ${move.title ?? "Faction Move"}`,
        payload: { d20, mod, total, dc, degree: deg, faction_id: factionId, source_event_id: move.id },
        priority: 2,
        tags: ["faction", "negotiation"],
        parent_event_id: move.id,
        thread_id: rootThreadId,
      });

      // 2) Director follow-ups
      const moveSrc: FactionMove = move?.type ? move : ({ ...move, type: "faction_move" } as FactionMove);
      const plan = planFromOutcome(moveSrc, deg);

      // 3) Post follow-ups as children of the result
      for (const ev of plan.new_events) {
        await postEvent({
          world_id: worldId,
          ...ev,
          parent_event_id: result.id,
          thread_id: rootThreadId,
        });
      }

      // 4) Apply deltas
      await applyDeltas(worldId, plan.updates);

      // 5) Tag the source move if requested
      if (plan.mutate?.source_event_id) {
        try {
          const add = plan.mutate.add_tags ?? [];
          const { data: cur } = await supabase.from("events").select("tags").eq("id", move.id).single();
          const next = Array.from(new Set([...(cur?.tags ?? []), ...add]));
          await supabase.from("events").update({ tags: next }).eq("id", move.id);
        } catch { /* no-op */ }
      }

      onDidApply?.(deg);
      onClose();
    } finally {
      setRolling(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="text-lg font-semibold mb-2">Pressure Faction</div>
        <div className="text-sm text-slate-300 mb-3">{move.title ?? "Faction Move"}</div>
        <div className="text-xs text-slate-400 mb-3">Attempt to reduce their pressure. On success, world tension dips.</div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 rounded bg-slate-800">Cancel</button>
          <button disabled={rolling} onClick={rollPressure} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500">
            {rolling ? "Rolling…" : "Roll"}
          </button>
        </div>
      </div>
    </div>
  );
}
