// src/pages/GameScreen.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useWorld } from "@/context/WorldContext";
import { Play, FastForward, Filter, MapPin } from "lucide-react";
import { listEvents, type EventRow } from "@/lib/events";
import { listEntities } from "@/lib/entities";
import { listArcs } from "@/lib/arcs";
import { advanceWorldTick } from "@/lib/worlds";
import HUDGoal from "@/components/HUDGoal";
import { InvestigateRumorModal, PressureFactionModal } from "@/components/ActionModals";

export default function GameScreen() {
  const { worldId } = useWorld();
  const [world, setWorld] = useState<any>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [party, setParty] = useState<any[]>([]);
  const [arcs, setArcs] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string|null>(null);
  const [showRumor, setShowRumor] = useState<null | any>(null);
  const [showMove, setShowMove] = useState<null | { move: any; factionId: string }>(null);
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

  function renderSummary(ev: any) {
    const getResultIcon = (degree: string) => {
      if (degree?.includes("success")) return "✓";
      if (degree?.includes("failure")) return "✕";
      return "";
    };

    switch (ev.type) {
      case "rumor":
        return `Rumor spreads: ${ev.payload?.content ?? ev.title}`;
      case "skill_result":
        const skillIcon = getResultIcon(ev.payload?.degree);
        return `${skillIcon} ${ev.payload?.actor ?? "Someone"} investigated "${ev.payload?.source_event_id}" → ${ev.payload?.degree} (${ev.payload?.total} vs DC ${ev.payload?.dc})`;
      case "faction_pressure_result":
        const factionIcon = getResultIcon(ev.payload?.degree);
        return `${factionIcon} Pressured faction → ${ev.payload?.degree} (${ev.payload?.total} vs DC ${ev.payload?.dc})`;
      case "faction_move":
        return `Faction ${ev.payload?.faction_id} acts: ${ev.title ?? "move"}`;
      case "discovery":
        return `Discovery: ${ev.payload?.content ?? ev.title}`;
      case "arc_development":
        return `Arc advanced: ${ev.title}`;
      case "weather":
        return `Weather shifts: ${ev.payload?.content ?? ev.title}`;
      default:
        return ev.title ?? ev.type;
    }
  }

  const locations: string[] = Array.isArray(world?.locations) ? world.locations : [];
  const filteredEvents = events.filter(e => {
    const tags: string[] = (e.tags ?? []);
    const locOk = selectedLocation ? (e.payload?.location === selectedLocation || tags.includes(selectedLocation)) : true;
    const tagOk = tagFilter ? tags.includes(tagFilter) : true;
    return locOk && tagOk;
  });

  // Group events: nest results under their source events
  const groupedEvents = useMemo(() => {
    const groups: any[] = [];
    const resultsBySource = new Map<string, any[]>();
    
    // First pass: collect all results by their source_event_id
    filteredEvents.forEach(ev => {
      if (ev.payload?.source_event_id && (ev.type === "skill_result" || ev.type === "faction_pressure_result")) {
        const sourceId = ev.payload.source_event_id;
        if (!resultsBySource.has(sourceId)) {
          resultsBySource.set(sourceId, []);
        }
        resultsBySource.get(sourceId)!.push(ev);
      }
    });

    // Second pass: build grouped structure
    filteredEvents.forEach(ev => {
      // Skip results that will be nested
      if (ev.payload?.source_event_id && (ev.type === "skill_result" || ev.type === "faction_pressure_result")) {
        return;
      }
      
      // Add main event with any nested results
      const eventGroup = {
        ...ev,
        children: resultsBySource.get(ev.id) || []
      };
      groups.push(eventGroup);
    });

    return groups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredEvents]);

  if (!worldId) return <div className="p-6 text-slate-200">Select or create a world first.</div>;
  if (loading) return <div className="p-6 text-slate-200">Loading world…</div>;

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
            <div className="bg-indigo-500 h-2 rounded transition-all duration-500" style={{ width: `${tensionPct}%` }} />
          </div>
          <HUDGoal worldId={worldId!} />
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
            {groupedEvents.length === 0 ? <div className="p-3 text-slate-500 text-sm">No events</div> :
              groupedEvents.map(ev => (
                <div key={ev.id} className="p-2">
                  <div className="font-medium">{renderSummary(ev)}</div>
                  <div className="text-xs text-slate-400">{new Date(ev.created_at).toLocaleString()}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    — {ev.type}{ev.tags?.length ? `, ${ev.tags.join(', ')}` : ''}
                  </div>

                  {/* NESTED CHILDREN */}
                  {ev.children?.length > 0 && (
                    <div className="ml-4 mt-2 space-y-1 border-l border-slate-700 pl-3">
                      {ev.children.map((child: any) => (
                        <div key={child.id}>
                          <div className="font-medium text-sm">{renderSummary(child)}</div>
                          <div className="text-xs text-slate-400">{new Date(child.created_at).toLocaleString()}</div>
                          <div className="text-xs text-slate-500">
                            — {child.type}{child.tags?.length ? `, ${child.tags.join(', ')}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ACTIONS */}
                  <div className="mt-2 flex gap-2">
                    {ev.type === "rumor" && (
                      <button onClick={() => setShowRumor(ev)} className="text-xs px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600">
                        Investigate
                      </button>
                    )}
                    {ev.type === "faction_move" && (
                      <button onClick={() => setShowMove({ move: ev, factionId: ev.payload?.faction_id ?? "f_bandits" })}
                              className="text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600">
                        Pressure Faction
                      </button>
                    )}
                  </div>
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

      {/* Modals */}
      {showRumor && (
        <InvestigateRumorModal
          worldId={worldId!}
          rumor={showRumor}
          party={party}
          onClose={() => setShowRumor(null)}
          onDidApply={() => {/* optional: flash UI */}}
        />
      )}
      {showMove && (
        <PressureFactionModal
          worldId={worldId!}
          move={showMove.move}
          factionId={showMove.factionId}
          onClose={() => setShowMove(null)}
          onDidApply={() => {/* optional: flash UI */}}
        />
      )}
    </div>
  );
}
