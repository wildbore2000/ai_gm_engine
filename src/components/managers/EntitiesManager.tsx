import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { CheckCircle2, AlertCircle, Trash2, PlusCircle, ChevronDown, ChevronUp, Save, Eye, Edit3 } from "lucide-react";
import { listEntities, upsertEntity, deleteEntity, onEntitiesChange } from "../../lib/entities";
import { validateEntity, download } from "../utils/validation";

interface EntitiesManagerProps {
  worldId: string;
}

export default function EntitiesManager({ worldId }: EntitiesManagerProps) {
  const [entities, setEntities] = useState<any[]>([]);
  const [selected, setSelected] = useState(-1);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isEditMode, setIsEditMode] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!worldId) {
      setEntities([]);
      setSelected(-1);
      return;
    }
    (async () => {
      try { 
        const rows = await listEntities(worldId); 
        setEntities(rows as any[]); 
        setSelected(rows.length > 0 ? 0 : -1); 
      }
      catch(e){ console.warn("Load entities failed", e); }
    })();
  }, [worldId]);

  useEffect(() => {
    if (!worldId) return;
    
    const subscription = onEntitiesChange((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      
      // Filter by world_id
      if (newRow && (newRow as any).world_id !== worldId) return;
      if (oldRow && (oldRow as any).world_id !== worldId) return;
      
      switch (eventType) {
        case 'INSERT':
          if (newRow) {
            setEntities(prev => {
              const exists = prev.find(e => e.id === newRow.id);
              if (exists) return prev;
              return [newRow, ...prev];
            });
          }
          break;
          
        case 'UPDATE':
          if (newRow) {
            setEntities(prev => prev.map(e => e.id === newRow.id ? newRow : e));
          }
          break;
          
        case 'DELETE':
          if (oldRow) {
            setEntities(prev => {
              const newEntities = prev.filter(e => e.id !== oldRow.id);
              if (selected >= 0 && prev[selected]?.id === oldRow.id) {
                setSelected(newEntities.length > 0 ? 0 : -1);
              }
              return newEntities;
            });
          }
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [worldId, selected]);

  async function saveCurrent(){ if (selected >= 0) try { await upsertEntity(entities[selected] as any); } catch(e){ console.error(e); } }
  async function saveAll(){ for (const e of entities){ try { await upsertEntity(e as any); } catch(err){ console.error(err); } } }
  async function removeCurrent(){
    const id = entities[selected]?.id; if (!id) return;
    try { await deleteEntity(id); } catch(e){ console.error(e); }
    setEntities(prev => prev.filter((_,i)=>i!==selected)); setSelected(0);
  }

  const current = selected >= 0 ? entities[selected] : null;
  const filtered = entities.map((e, i) => ({ e, i })).filter(({ e }) => {
    const hay = `${e.name} ${e.id} ${(e.tags || []).join(" ")}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const validateCurrent = () => {
    const ok = validateEntity(current);
    setErrors((validateEntity as any).errors?.map((e: any) => `${e.instancePath || "/"} ${e.message}`) || []);
    return ok;
  };

  const update = (patch: any) => {
    if (selected < 0) return;
    setEntities((prev) => {
      const next = [...prev];
      next[selected] = { ...next[selected], ...patch };
      return next;
    });
  };

  const updateNested = (path: string[], value: any) => {
    if (selected < 0) return;
    setEntities((prev) => {
      const next = [...prev];
      const obj = { ...next[selected] } as any;
      let cur = obj;
      for (let i = 0; i < path.length - 1; i++) {
        const k = path[i];
        cur[k] = { ...(cur[k] || {}) };
        cur = cur[k];
      }
      cur[path[path.length - 1]] = value;
      next[selected] = obj;
      return next;
    });
  };

  const addNew = () => {
    if (!worldId) return;
    const id = `npc_${Math.random().toString(36).slice(2, 7)}`;
    const base = {
      id,
      world_id: worldId,
      name: "New Entity",
      tags: [],
      srd: {
        level: 1,
        ancestry: "Human",
        role: "Fighter",
        alignment: "N",
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        hp: 10,
        ac: 10,
        saves: { fortitude: 0, reflex: 0, will: 0 },
        skills: {},
        abilities: [],
        inventory: []
      },
      personality: {
        temperament: "",
        ideals: [],
        fears: [],
        motivations: [],
        flaws: []
      },
      relationships: {},
      memory: [],
      status: { location: "", faction: "", mood: "", current_task: "", flags: [] }
    };
    setEntities((prev) => [...prev, base]);
    setSelected(entities.length);
  };

  const duplicate = () => {
    if (!worldId || !current) return;
    const clone = structuredClone(current);
    clone.id = `${clone.id}_copy`;
    clone.world_id = worldId;
    setEntities((p) => [...p, clone]);
    setSelected(entities.length);
  };

  const remove = async () => {
    if (!entities.length) return;
    await removeCurrent();
  };

  const downloadCollection = () => download("entities.json", entities);

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      try {
        const obj = JSON.parse(t);
        if (Array.isArray(obj)) setEntities(obj);
        else if (obj && typeof obj === "object") setEntities((p) => [...p, obj]);
      } catch {}
    });
  };

  const tagString = (current?.tags || []).join(", ");

  return (
    <div className="flex gap-4">
      {/* Sidebar list */}
      <div className="w-80">
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Simple Action Bar */}
            <div className="flex items-center justify-center gap-1 p-2 bg-slate-900/50 rounded-md border border-slate-700">
              <Button variant="secondary" onClick={addNew} title="Add New">
                <PlusCircle className="h-4 w-4" />
              </Button>
              <Button variant="secondary" onClick={remove} disabled={selected < 0} title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="secondary" onClick={() => setIsEditMode(!isEditMode)} title={isEditMode ? "View Mode" : "Edit Mode"}>
                {isEditMode ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
              </Button>
              <Button variant="secondary" onClick={saveCurrent} disabled={selected < 0} title="Save">
                <Save className="h-4 w-4" />
              </Button>
            </div>
            
            <div>
              <input className="w-full rounded-md bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm" placeholder="Search by name, id, tag..." value={query} onChange={(e)=>setQuery(e.target.value)} />
            </div>
            <div className="grid gap-2 max-h-[420px] overflow-auto">
              {filtered.map(({ e, i }) => (
                <div key={i} onClick={() => setSelected(i)} className={`p-2 rounded-lg border cursor-pointer transition ${i===selected ? 'border-indigo-500/70 bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'border-slate-800 hover:bg-slate-800/40'}`}>
                  <div className="text-sm font-medium">{e.name || e.id}</div>
                  <div className="text-xs opacity-70">{e.id}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail editor */}
      <div style={{ flex: 1 }}>
        {current ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                {errors.length === 0 ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle2 className="h-4 w-4"/> Valid</span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 text-sm"><AlertCircle className="h-4 w-4"/> Invalid</span>
                )}
                <div className="ml-auto flex gap-2">
                  <Button variant="secondary" onClick={validateCurrent}>Validate</Button>
                  <Button variant="secondary" onClick={saveCurrent}>Save Current</Button>
                  <Button variant="secondary" onClick={saveAll}>Save All</Button>
                  <Button variant="secondary" onClick={()=>download(current.id + '.json', current)}>Download</Button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label className="text-xs opacity-80">ID<input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={current.id} onChange={(e)=>update({id:e.target.value})} disabled={!isEditMode} /></label>
                <label className="text-xs opacity-80">Name<input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={current.name} onChange={(e)=>update({name:e.target.value})} disabled={!isEditMode} /></label>
                <label className="col-span-2 text-xs opacity-80">Tags (comma-separated)
                  <input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={tagString} onChange={(e)=>update({tags:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} disabled={!isEditMode} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
                <label className="text-xs opacity-80">STR<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.str} onChange={(e)=>updateNested(['srd','stats','str'], Number(e.target.value))} disabled={!isEditMode}/></label>
                <label className="text-xs opacity-80">DEX<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.dex} onChange={(e)=>updateNested(['srd','stats','dex'], Number(e.target.value))} disabled={!isEditMode}/></label>
                <label className="text-xs opacity-80">CON<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.con} onChange={(e)=>updateNested(['srd','stats','con'], Number(e.target.value))} disabled={!isEditMode}/></label>
                <label className="text-xs opacity-80">INT<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.int} onChange={(e)=>updateNested(['srd','stats','int'], Number(e.target.value))} disabled={!isEditMode}/></label>
                <label className="text-xs opacity-80">WIS<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.wis} onChange={(e)=>updateNested(['srd','stats','wis'], Number(e.target.value))} disabled={!isEditMode}/></label>
                <label className="text-xs opacity-80">CHA<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.cha} onChange={(e)=>updateNested(['srd','stats','cha'], Number(e.target.value))} disabled={!isEditMode}/></label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                <label className="text-xs opacity-80">HP<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.hp} onChange={(e)=>updateNested(['srd','hp'], Number(e.target.value))} disabled={!isEditMode}/></label>
                <label className="text-xs opacity-80">AC<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.ac} onChange={(e)=>updateNested(['srd','ac'], Number(e.target.value))} disabled={!isEditMode}/></label>
                <label className="text-xs opacity-80">Faction<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" value={current.status.faction} onChange={(e)=>updateNested(['status','faction'], e.target.value)} disabled={!isEditMode}/></label>
                <label className="text-xs opacity-80">Location<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" value={current.status.location} onChange={(e)=>updateNested(['status','location'], e.target.value)} disabled={!isEditMode}/></label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label className="text-xs opacity-80">Temperament<input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={current.personality.temperament || ''} onChange={(e)=>updateNested(['personality','temperament'], e.target.value)} disabled={!isEditMode}/></label>
                <label className="text-xs opacity-80">Mood<input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={current.status.mood || ''} onChange={(e)=>updateNested(['status','mood'], e.target.value)} disabled={!isEditMode}/></label>
                <label className="col-span-2 text-xs opacity-80">Ideals (comma-separated)
                  <input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={(current.personality.ideals||[]).join(', ')} onChange={(e)=>updateNested(['personality','ideals'], e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} disabled={!isEditMode}/>
                </label>
              </div>

              <div>
                <Button 
                  variant="secondary" 
                  onClick={() => setShowRawJson(!showRawJson)}
                  style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}
                >
                  <span style={{ fontSize: '12px', opacity: 0.8 }}>Advanced (Raw JSON)</span>
                  {showRawJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {showRawJson && (
                  <Textarea 
                    className="font-mono text-xs min-h-[160px] mt-2" 
                    value={JSON.stringify(current, null, 2)} 
                    onChange={(e)=>{
                      try{ const obj = JSON.parse(e.target.value); setEntities(prev=>{ const n=[...prev]; n[selected]=obj; return n;}); setErrors([]);}catch(err:any){ setErrors([err.message]); }
                    }} 
                    disabled={!isEditMode}
                  />
                )}
              </div>

              {errors.length>0 && (
                <div className="text-xs text-red-500">{errors.map((e,i)=>(<div key={i}>• {e}</div>))}</div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="opacity-70 text-sm">No entity selected.</div>
        )}
      </div>
    </div>
  );
}