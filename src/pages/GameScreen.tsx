// src/pages/GameScreen.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorld } from "@/context/WorldContext";
import { Play, FastForward, Filter, MapPin } from "lucide-react";
import { listEvents, type EventRow } from "@/lib/events";
import { listEntities } from "@/lib/entities";
import { listArcs } from "@/lib/arcs";
import { advanceWorldTick } from "@/lib/worlds";

export default function GameScreen() {
  const { worldId } = useWorld();
  const [world, setWorld] = useState<any>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [party, setParty] = useState<any[]>([]);
  const [arcs, setArcs] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const tensionPct = Math.max(0, Math.min(100, (world?.tension ?? 0) * 100)); // tension 0..1 -> 0..100

  useEffect(() => {
    if (!worldId) return;
    (async () => {
      setLoading(true);
      const [w, e, ents, qs] = await Promise.all([
        supabase.from("worlds").select("*").eq("id", worldId).single(),
        listEvents(worldId),
        // party: tags contains "party"
        supabase.from("entities").select("*").eq("world_id", worldId).contains("tags", ["party"]),
        supabase.from("arcs").select("*").eq("world_id", worldId).order("created_at", { ascending: false })
      ]);
      if (!w.error) setWorld(w.data);
      setEvents(e as any[]);
      if (!ents.error) setParty(ents.data ?? []);
      if (!qs.error) setArcs(qs.data ?? []);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`world-${worldId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worlds', filter: `id=eq.${worldId}` },
        (p: any) => setWorld(p.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `world_id=eq.${worldId}` },
        (p: any) => {
          if (p.eventType === "INSERT") setEvents(prev => [p.new, ...prev]);
          if (p.eventType === "UPDATE") setEvents(prev => prev.map(ev => ev.id === p.new.id ? p.new : ev));
          if (p.eventType === "DELETE") setEvents(prev => prev.filter(ev => ev.id !== p.old.id));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entities', filter: `world_id=eq.${worldId}` },
        (p: any) => {
          // keep party list in sync
          const row = p.new ?? p.old;
          const isParty = (row?.tags ?? []).includes("party");
          if (!isParty) return;
          if (p.eventType === "INSERT") setParty(prev => [p.new, ...prev]);
          if (p.eventType === "UPDATE") setParty(prev => prev.map(e => e.id === p.new.id ? p.new : e));
          if (p.eventType === "DELETE") setParty(prev => prev.filter(e => e.id !== p.old.id));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arcs', filter: `world_id=eq.${worldId}` },
        (p: any) => {
          if (p.eventType === "INSERT") setArcs(prev => [p.new, ...prev]);
          if (p.eventType === "UPDATE") setArcs(prev => prev.map(a => a.id === p.new.id ? p.new : a));
          if (p.eventType === "DELETE") setArcs(prev => prev.filter(a => a.id !== p.old.id));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [worldId]);

  async function advanceTick() {
    if (!worldId) return;
    await advanceWorldTick(worldId, 1);
  }

  async function randomEncounter() {
    // super simple: insert a "rumor/encounter" event
    if (!worldId) return;
    await supabase.from("events").insert([{
      world_id: worldId,
      type: "encounter",
      title: "A shadow in the alley",
      payload: { danger: Math.floor(Math.random()*3)+1 },
      priority: 2,
      tags: ["encounter","urban"]
    }]);
  }

  if (!worldId) return <div className="p-6 text-slate-200">Select or create a world first.</div>;
  if (loading) return <div className="p-6 text-slate-200">Loading world…</div>;

  const locations: string[] = Array.isArray(world?.locations) ? world.locations : [];
  const filteredEvents = events.filter(e => {
    const tags: string[] = (e.tags ?? []);
    const locOk = selectedLocation ? (e.payload?.location === selectedLocation || tags.includes(selectedLocation)) : true;
    const tagOk = tagFilter ? tags.includes(tagFilter) : true;
    return locOk && tagOk;
  });

  return (
    <div className="h-screen bg-slate-950 text-white grid grid-rows-[auto,1fr]">
      {/* HUD */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800">
        <div>
          <div className="text-lg font-semibold">{world?.name}</div>
          <div className="text-xs text-slate-400">{world?.time}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-48 bg-slate-800 h-2 rounded">
            <div className="bg-indigo-500 h-2 rounded" style={{ width: `${tensionPct}%` }} />
          </div>
          <button onClick={() => advanceWorldTick(worldId!, 1)} className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 flex items-center gap-1">
            <FastForward className="w-4 h-4" /> Advance Tick
          </button>
        </div>
      </div>

      {/* Main grid: Map/Locations | Feed | Right rail (Party/Quests) */}
      <div className="grid grid-cols-[220px,1fr,280px] gap-3 p-3 overflow-hidden">
        {/* Locations */}
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-2 py-1 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">Locations</div>
          <div className="max-h-full overflow-auto">
            {locations.length === 0 ? <div className="p-2 text-slate-500 text-sm">No locations</div> :
              locations.map(loc => (
                <button key={loc}
                  onClick={() => setSelectedLocation(selectedLocation === loc ? null : loc)}
                  className={`w-full text-left px-2 py-1 text-sm hover:bg-slate-800 ${selectedLocation===loc ? 'bg-indigo-600 text-white' : ''}`}>
                  <MapPin className="inline w-3 h-3 mr-1" /> {loc}
                </button>
              ))
            }
          </div>
        </div>

        {/* Event Feed */}
        <div className="border border-slate-800 rounded-lg flex flex-col overflow-hidden">
          <div className="px-2 py-1 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800 flex items-center justify-between">
            <span>Event Feed</span>
            <div className="flex items-center gap-2">
              <button className="text-xs px-2 py-0.5 bg-slate-800 rounded" onClick={() => setTagFilter(null)}>All</button>
              <button className="text-xs px-2 py-0.5 bg-slate-800 rounded" onClick={() => setTagFilter('rumor')}>Rumors</button>
              <button className="text-xs px-2 py-0.5 bg-slate-800 rounded" onClick={() => setTagFilter('encounter')}>Encounters</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-slate-800">
            {filteredEvents.length === 0 ? <div className="p-3 text-slate-500 text-sm">No events</div> :
              filteredEvents.map(ev => (
                <div key={ev.id} className="p-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{ev.title || ev.type}</div>
                    <div className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">{ev.type}</div>
                  </div>
                  {ev.payload?.content && <div className="text-sm text-slate-300">{ev.payload.content}</div>}
                  {!!(ev.tags?.length) && <div className="mt-1 flex flex-wrap gap-1">
                    {ev.tags.map((t:string) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">#{t}</span>)}
                  </div>}
                </div>
              ))
            }
          </div>
        </div>

        {/* Right rail: Party & Quests */}
        <div className="space-y-3 overflow-auto">
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-2 py-1 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">Party</div>
            <div className="p-2 space-y-2">
              {party.map(p => (
                <div key={p.id} className="p-2 rounded bg-slate-900">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-400">{(p.status?.hp ?? 'HP ?')} • {(p.status?.level ?? 'Lv ?')}</div>
                </div>
              ))}
              {party.length===0 && <div className="text-sm text-slate-500">No party members yet.</div>}
            </div>
          </div>
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-2 py-1 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">Quests</div>
            <div className="p-2 space-y-2">
              {arcs.map(a => (
                <div key={a.id} className="p-2 rounded bg-slate-900">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-slate-400">{a.stage ?? '—'} • {(a.progress ?? 0)*100 | 0}%</div>
                </div>
              ))}
              {arcs.length===0 && <div className="text-sm text-slate-500">No active quests.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
