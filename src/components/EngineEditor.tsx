import React, { useMemo, useState, useRef, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Download, Upload, CheckCircle2, AlertCircle, Trash2, PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { motion } from "framer-motion";
import { listEntities, upsertEntity, deleteEntity } from "@/lib/entities";
import { listFactions, upsertFaction, deleteFaction } from "@/lib/factions";
import { listArcs, upsertArc, deleteArc } from "@/lib/arcs";
import { listWorlds, upsertWorld } from "@/lib/worlds";



// --- SRD-light JSON Schemas (mirror of the design doc) ---
const entitySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "schema/entity.json",
  title: "Entity",
  type: "object",
  required: ["id", "name", "tags", "srd", "personality", "status"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    srd: {
      type: "object",
      required: ["level", "ancestry", "role", "stats", "hp", "ac"],
      properties: {
        level: { type: "integer" },
        ancestry: { type: "string" },
        role: { type: "string" },
        alignment: { type: "string" },
        stats: {
          type: "object",
          required: ["str", "dex", "con", "int", "wis", "cha"],
          properties: {
            str: { type: "integer" },
            dex: { type: "integer" },
            con: { type: "integer" },
            int: { type: "integer" },
            wis: { type: "integer" },
            cha: { type: "integer" }
          }
        },
        hp: { type: "integer" },
        ac: { type: "integer" },
        saves: {
          type: "object",
          properties: {
            fortitude: { type: "integer" },
            reflex: { type: "integer" },
            will: { type: "integer" }
          }
        },
        skills: { type: "object", additionalProperties: { type: "integer" } },
        abilities: { type: "array", items: { type: "string" } },
        inventory: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, type: { type: "string" }, qty: { type: "integer" } }
          }
        }
      }
    },
    personality: {
      type: "object",
      properties: {
        temperament: { type: "string" },
        ideals: { type: "array", items: { type: "string" } },
        fears: { type: "array", items: { type: "string" } },
        motivations: { type: "array", items: { type: "string" } },
        flaws: { type: "array", items: { type: "string" } }
      }
    },
    relationships: { type: "object", additionalProperties: { type: "string" } },
    memory: { type: "array", items: { type: "string" } },
    status: {
      type: "object",
      required: ["location", "faction", "mood"],
      properties: {
        location: { type: "string" },
        faction: { type: "string" },
        mood: { type: "string" },
        current_task: { type: "string" },
        flags: { type: "array", items: { type: "string" } }
      }
    },
    custom: { type: "object" }
  }
};

const factionSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "schema/faction.json",
  title: "Faction",
  type: "object",
  required: ["id", "name", "goals", "resources", "relations"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    ideology: { type: "string" },
    goals: { type: "array", items: { type: "string" } },
    pressure: { type: "number", minimum: 0, maximum: 1 },
    stability: { type: "number", minimum: 0, maximum: 1 },
    resources: { type: "object", additionalProperties: { type: "integer" } },
    relations: { type: "object", additionalProperties: { type: "integer" } },
    leaders: { type: "array", items: { type: "string" } },
    custom: { type: "object" }
  }
};

const worldSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "schema/worldstate.json",
  title: "WorldState",
  type: "object",
  required: ["time", "weather", "locations", "factions", "events", "history_log"],
  properties: {
    time: { type: "string" },
    weather: { type: "string" },
    locations: { type: "array", items: { type: "string" } },
    factions: { type: "object" },
    events: { type: "array", items: { type: "string" } },
    history_log: { type: "array", items: { type: "string" } },
    tension: { type: "number", minimum: 0, maximum: 1 },
    custom: { type: "object" }
  }
};

const arcSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "schema/arc.json",
  title: "Arc",
  type: "object",
  required: ["id", "title", "stage", "goal", "progress", "triggers"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    stage: { type: "string" },
    goal: { type: "string" },
    progress: { type: "number", minimum: 0, maximum: 1 },
    triggers: { type: "array", items: { type: "string" } },
    beats: { type: "array", items: { type: "string" } },
    pressure_vector: { type: "object" },
    owner: { type: "string" },
    custom: { type: "object" }
  }
};

const gameEventSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "schema/gameevent.json",
  title: "GameEvent",
  type: "object",
  required: ["id", "type", "title", "payload", "priority"],
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: ["spawn", "dialogue", "modify", "rumor", "quest", "environment"] },
    title: { type: "string" },
    payload: { type: "object" },
    priority: { type: "integer" },
    expires_at: { type: "string" },
    source: { type: "string" },
    tags: { type: "array", items: { type: "string" } }
  }
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateEntity = ajv.compile(entitySchema as any);
const validateFaction = ajv.compile(factionSchema as any);
const validateWorld = ajv.compile(worldSchema as any);
const validateArc = ajv.compile(arcSchema as any);
const validateEvent = ajv.compile(gameEventSchema as any);

const sampleEntity = {
  id: "npc_mira",
  name: "Mira Stonewind",
  tags: ["npc", "ranger", "human"],
  srd: {
    level: 3,
    ancestry: "Human",
    role: "Ranger",
    alignment: "CG",
    stats: { str: 12, dex: 18, con: 14, int: 10, wis: 16, cha: 11 },
    hp: 28,
    ac: 17,
    saves: { fortitude: 6, reflex: 9, will: 5 },
    skills: { survival: 8, stealth: 7, diplomacy: 3 },
    abilities: ["Hunt Prey", "Twin Takedown"],
    inventory: [
      { name: "Longbow", type: "weapon", qty: 1 },
      { name: "Healing Potion", type: "consumable", qty: 1 }
    ]
  },
  personality: {
    temperament: "quiet and observant",
    ideals: ["freedom", "nature above civilization"],
    fears: ["being caged"],
    motivations: ["protect wildlands", "redeem family name"],
    flaws: ["acts before asking"]
  },
  relationships: { npc_raider_chief: "uncertain ally", player: "ally" },
  memory: ["Defended Greenfall", "Vision from old gods"],
  status: { location: "greenfall_edge", faction: "Rangers of the Vale", mood: "cautious", current_task: "patrol" }
};

const sampleFaction = {
  id: "f_raiders",
  name: "Ash Dune Riders",
  tags: ["raiders", "nomads"],
  ideology: "Strength through freedom",
  goals: ["control trade routes", "undermine town council"],
  pressure: 0.42,
  stability: 0.58,
  resources: { food: 40, mounts: 25, weapons: 60 },
  relations: { f_town: -35, f_rangers: -10 },
  leaders: ["npc_raider_chief"]
};

const sampleWorld = {
  time: "Day 12, 03:00",
  weather: "rain",
  locations: ["greenfall", "greenfall_edge", "old_road"],
  factions: { f_raiders: sampleFaction },
  events: ["raider_scout_spotted", "storm_warning"],
  history_log: ["Day 11: merchant caravan robbed"],
  tension: 0.47
};

const sampleArc = {
  id: "arc_cult_rise",
  title: "Whispers Beneath Greenfall",
  stage: "rumors",
  goal: "destabilize settlement from within",
  progress: 0.22,
  triggers: ["nightmares", "missing supplies"],
  beats: ["first rumor", "suspicious sermon", "disappearance"],
  pressure_vector: { f_town: 0.2, f_cult: 0.5 }
};

function download(filename: string, data: object) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function useJsonEditor<T>(initial: T, validate: (d: any) => boolean) {
  const [raw, setRaw] = useState<string>(() => JSON.stringify(initial, null, 2));
  const [parsed, setParsed] = useState<T>(initial);
  const [errors, setErrors] = useState<string[]>([]);

  const parse = (text: string) => {
    setRaw(text);
    try {
      const obj = JSON.parse(text);
      const ok = validate(obj);
      if (!ok) {
        const ajvErrors = (validate as any).errors || [];
        setErrors(ajvErrors.map((e: any) => `${e.instancePath || "/"} ${e.message}`));
      } else {
        setErrors([]);
        setParsed(obj);
      }
    } catch (e: any) {
      setErrors([e.message]);
    }
  };

  const uploadRef = useRef<HTMLInputElement>(null);
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => parse(t));
  };

  return { raw, setRaw: parse, parsed, errors, uploadRef, onUpload };
}

function EditorPane({
  label,
  filename,
  hook
}: {
  label: string;
  filename: string;
  hook: ReturnType<typeof useJsonEditor<any>>;
}) {
  const { raw, setRaw, parsed, errors, uploadRef, onUpload } = hook;

  const isValid = errors.length === 0;
  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {isValid ? (
            <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle2 className="h-4 w-4"/> Valid</span>
          ) : (
            <span className="flex items-center gap-1 text-red-600 text-sm"><AlertCircle className="h-4 w-4"/> Invalid</span>
          )}
          <div className="ml-auto flex gap-2">
            <input type="file" accept="application/json" className="hidden" ref={uploadRef} onChange={onUpload} />
            <Button variant="secondary" onClick={() => uploadRef.current?.click()}><Upload className="h-4 w-4 mr-1"/>Import</Button>
            <Button onClick={() => download(filename, parsed)}><Download className="h-4 w-4 mr-1"/>Export</Button>
          </div>
        </div>
        <Textarea className="font-mono text-xs min-h-[320px]" value={raw} onChange={(e) => setRaw(e.target.value)} />
        {!isValid && (
          <div className="text-xs text-red-600">
            {errors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Entities CRUD Manager ---
function EntitiesManager() {
  const [entities, setEntities] = useState<any[]>([structuredClone(sampleEntity)]);
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [showRawJson, setShowRawJson] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  (async () => {
    try { const rows = await listEntities(); if (rows.length) { setEntities(rows as any[]); setSelected(0); } }
    catch(e){ console.warn("Load entities failed", e); }
  })();
}, []);

async function saveCurrent(){ try { await upsertEntity(entities[selected] as any); } catch(e){ console.error(e); } }
async function saveAll(){ for (const e of entities){ try { await upsertEntity(e as any); } catch(err){ console.error(err); } } }
async function removeCurrent(){
  const id = entities[selected]?.id; if (!id) return;
  try { await deleteEntity(id); } catch(e){ console.error(e); }
  setEntities(prev => prev.filter((_,i)=>i!==selected)); setSelected(0);
}

  const current = entities[selected];
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
    setEntities((prev) => {
      const next = [...prev];
      next[selected] = { ...next[selected], ...patch };
      return next;
    });
  };

  const updateNested = (path: string[], value: any) => {
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
    const id = `npc_${Math.random().toString(36).slice(2, 7)}`;
    const base = structuredClone(sampleEntity);
    base.id = id;
    base.name = "New Entity";
    setEntities((prev) => [...prev, base]);
    setSelected(entities.length);
  };

  const duplicate = () => {
    const clone = structuredClone(current);
    clone.id = `${clone.id}_copy`;
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
            <div className="flex gap-2 items-center">
              <Button onClick={addNew}><PlusCircle className="h-4 w-4 mr-1"/>New</Button>
              <Button variant="secondary" onClick={duplicate}>Duplicate</Button>
              <Button variant="secondary" onClick={remove}><Trash2 className="h-4 w-4 mr-1"/>Delete</Button>
            </div>
            <div>
              <input className="w-full rounded-md bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm" placeholder="Search by name, id, tag..." value={query} onChange={(e)=>setQuery(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <input type="file" accept="application/json" className="hidden" ref={fileRef} onChange={onImport} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1"/>Import</Button>
              <Button onClick={downloadCollection}><Download className="h-4 w-4 mr-1"/>Export</Button>
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
                <label className="text-xs opacity-80">ID<input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={current.id} onChange={(e)=>update({id:e.target.value})} /></label>
                <label className="text-xs opacity-80">Name<input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={current.name} onChange={(e)=>update({name:e.target.value})} /></label>
                <label className="col-span-2 text-xs opacity-80">Tags (comma-separated)
                  <input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={tagString} onChange={(e)=>update({tags:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
                <label className="text-xs opacity-80">STR<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.str} onChange={(e)=>updateNested(['srd','stats','str'], Number(e.target.value))}/></label>
                <label className="text-xs opacity-80">DEX<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.dex} onChange={(e)=>updateNested(['srd','stats','dex'], Number(e.target.value))}/></label>
                <label className="text-xs opacity-80">CON<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.con} onChange={(e)=>updateNested(['srd','stats','con'], Number(e.target.value))}/></label>
                <label className="text-xs opacity-80">INT<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.int} onChange={(e)=>updateNested(['srd','stats','int'], Number(e.target.value))}/></label>
                <label className="text-xs opacity-80">WIS<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.wis} onChange={(e)=>updateNested(['srd','stats','wis'], Number(e.target.value))}/></label>
                <label className="text-xs opacity-80">CHA<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.stats.cha} onChange={(e)=>updateNested(['srd','stats','cha'], Number(e.target.value))}/></label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                <label className="text-xs opacity-80">HP<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.hp} onChange={(e)=>updateNested(['srd','hp'], Number(e.target.value))}/></label>
                <label className="text-xs opacity-80">AC<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" type="number" value={current.srd.ac} onChange={(e)=>updateNested(['srd','ac'], Number(e.target.value))}/></label>
                <label className="text-xs opacity-80">Faction<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" value={current.status.faction} onChange={(e)=>updateNested(['status','faction'], e.target.value)}/></label>
                <label className="text-xs opacity-80">Location<input className="w-full p-1 rounded bg-slate-900 border border-slate-700" value={current.status.location} onChange={(e)=>updateNested(['status','location'], e.target.value)}/></label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label className="text-xs opacity-80">Temperament<input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={current.personality.temperament || ''} onChange={(e)=>updateNested(['personality','temperament'], e.target.value)}/></label>
                <label className="text-xs opacity-80">Mood<input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={current.status.mood || ''} onChange={(e)=>updateNested(['status','mood'], e.target.value)}/></label>
                <label className="col-span-2 text-xs opacity-80">Ideals (comma-separated)
                  <input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={(current.personality.ideals||[]).join(', ')} onChange={(e)=>updateNested(['personality','ideals'], e.target.value.split(',').map(s=>s.trim()).filter(Boolean))}/>
                </label>
              </div>

              <div>
                <Button 
                  variant="secondary" 
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full justify-between"
                >
                  <span className="text-xs opacity-80">Advanced (Raw JSON)</span>
                  {showRawJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {showRawJson && (
                  <Textarea 
                    className="font-mono text-xs min-h-[160px] mt-2" 
                    value={JSON.stringify(current, null, 2)} 
                    onChange={(e)=>{
                      try{ const obj = JSON.parse(e.target.value); setEntities(prev=>{ const n=[...prev]; n[selected]=obj; return n;}); setErrors([]);}catch(err:any){ setErrors([err.message]); }
                    }} 
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

// --- Factions CRUD Manager ---
function FactionsManager() {
  const [factions, setFactions] = useState<any[]>([structuredClone(sampleFaction)]);
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [showRawJsonFactions, setShowRawJsonFactions] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

useEffect(()=>{(async()=>{
  try{ const rows=await listFactions(); if(rows.length){ setFactions(rows as any[]); setSelected(0);} }
  catch(e){ console.warn("Load factions failed", e); }
})();},[]);

async function saveCurrent(){ try{ await upsertFaction(factions[selected] as any);}catch(e){console.error(e);} }
async function saveAll(){ for(const f of factions){ try{ await upsertFaction(f as any);}catch(e){console.error(e);} } }
async function removeCurrent(){ const id=factions[selected]?.id; if(!id) return;
  try{ await deleteFaction(id);}catch(e){console.error(e);}
  setFactions(prev=>prev.filter((_,i)=>i!==selected)); setSelected(0);
}

  const current = factions[selected];
  const filtered = factions.map((f, i) => ({ f, i })).filter(({ f }) => {
    const hay = `${f.name} ${f.id} ${(f.tags || []).join(" ")}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const validateCurrent = () => {
    const ok = validateFaction(current);
    setErrors((validateFaction as any).errors?.map((e: any) => `${e.instancePath || "/"} ${e.message}`) || []);
    return ok;
  };

  const update = (patch: any) => {
    setFactions((prev) => {
      const next = [...prev];
      next[selected] = { ...next[selected], ...patch };
      return next;
    });
  };

  const addNew = () => {
    const id = `f_${Math.random().toString(36).slice(2, 7)}`;
    const base = structuredClone(sampleFaction);
    base.id = id;
    base.name = "New Faction";
    setFactions((prev) => [...prev, base]);
    setSelected(factions.length);
  };

  const duplicate = () => {
    const clone = structuredClone(current);
    clone.id = `${clone.id}_copy`;
    setFactions((p) => [...p, clone]);
    setSelected(factions.length);
  };

  const remove = async () => {
    if (!factions.length) return;
    await removeCurrent();
  };

  const downloadCollection = () => download("factions.json", factions);

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      try {
        const obj = JSON.parse(t);
        if (Array.isArray(obj)) setFactions(obj);
        else if (obj && typeof obj === "object") setFactions((p) => [...p, obj]);
      } catch {}
    });
  };

  const tagString = (current?.tags || []).join(", ");

  return (
    <div className="flex gap-4">
      <div className="w-80">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2 items-center">
              <Button onClick={addNew}><PlusCircle className="h-4 w-4 mr-1"/>New</Button>
              <Button variant="secondary" onClick={duplicate}>Duplicate</Button>
              <Button variant="secondary" onClick={remove}><Trash2 className="h-4 w-4 mr-1"/>Delete</Button>
            </div>
            <div>
              <input className="w-full rounded-md bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm" placeholder="Search by name, id, tag..." value={query} onChange={(e)=>setQuery(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <input type="file" accept="application/json" className="hidden" ref={fileRef} onChange={onImport} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1"/>Import</Button>
              <Button onClick={downloadCollection}><Download className="h-4 w-4 mr-1"/>Export</Button>
            </div>
            <div className="grid gap-2 max-h-[420px] overflow-auto">
              {filtered.map(({ f, i }) => (
                <div key={i} onClick={() => setSelected(i)} className={`p-2 rounded-lg border cursor-pointer transition ${i===selected ? 'border-indigo-500/70 bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'border-slate-800 hover:bg-slate-800/40'}`}>
                  <div className="text-sm font-medium">{f.name || f.id}</div>
                  <div className="text-xs opacity-70">{f.id}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
                <label className="text-xs opacity-80">ID<input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={current.id} onChange={(e)=>update({id:e.target.value})} /></label>
                <label className="text-xs opacity-80">Name<input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={current.name} onChange={(e)=>update({name:e.target.value})} /></label>
                <label className="col-span-2 text-xs opacity-80">Tags (comma-separated)
                  <input className="w-full p-2 rounded bg-slate-900 border border-slate-700" value={tagString} onChange={(e)=>update({tags:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} />
                </label>
              </div>

              <div>
                <Button 
                  variant="secondary" 
                  onClick={() => setShowRawJsonFactions(!showRawJsonFactions)}
                  className="w-full justify-between"
                >
                  <span className="text-xs opacity-80">Advanced (Raw JSON)</span>
                  {showRawJsonFactions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {showRawJsonFactions && (
                  <Textarea 
                    className="font-mono text-xs min-h-[320px] mt-2" 
                    value={JSON.stringify(current, null, 2)} 
                    onChange={(e)=>{
                      try{ const obj = JSON.parse(e.target.value); setFactions(prev=>{ const n=[...prev]; n[selected]=obj; return n;}); setErrors([]);}catch(err:any){ setErrors([err.message]); }
                    }} 
                  />
                )}
              </div>

              {errors.length>0 && (
                <div className="text-xs text-red-500">{errors.map((e,i)=>(<div key={i}>• {e}</div>))}</div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="opacity-70 text-sm">No faction selected.</div>
        )}
      </div>
    </div>
  );
}

// --- Arcs CRUD Manager ---
function ArcsManager() {
  const [arcs, setArcs] = useState<any[]>([structuredClone(sampleArc)]);
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [showRawJson, setShowRawJson] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

useEffect(()=>{(async()=>{
  try{ const rows=await listArcs(); if(rows.length){ setArcs(rows as any[]); setSelected(0);} }
  catch(e){ console.warn("Load arcs failed", e); }
})();},[]);
async function saveCurrent(){ try{ await upsertArc(arcs[selected] as any);}catch(e){console.error(e);} }
async function saveAll(){ for(const a of arcs){ try{ await upsertArc(a as any);}catch(e){console.error(e);} } }
async function removeCurrent(){ const id=arcs[selected]?.id; if(!id) return;
  try{ await deleteArc(id);}catch(e){console.error(e);}
  setArcs(prev=>prev.filter((_,i)=>i!==selected)); setSelected(0);
}

  const updateArc = (patch: any) => {
    setArcs((prev) => {
      const next = [...prev];
      next[selected] = { ...next[selected], ...patch };
      return next;
    });
  };

  const updateNestedArc = (path: string[], value: any) => {
    setArcs((prev) => {
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

  const current = arcs[selected];
  const filtered = arcs.map((a, i) => ({ a, i })).filter(({ a }) => {
    const hay = `${a.title} ${a.id} ${a.stage}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const validateCurrent = () => {
    const ok = validateArc(current);
    setErrors((validateArc as any).errors?.map((e: any) => `${e.instancePath || "/"} ${e.message}`) || []);
    return ok;
  };

  const update = (patch: any) => {
    setArcs((prev) => {
      const next = [...prev];
      next[selected] = { ...next[selected], ...patch };
      return next;
    });
  };

  const addNew = () => {
    const id = `arc_${Math.random().toString(36).slice(2, 7)}`;
    const base = structuredClone(sampleArc);
    base.id = id;
    base.title = "New Arc";
    setArcs((prev) => [...prev, base]);
    setSelected(arcs.length);
  };

  const duplicate = () => {
    const clone = structuredClone(current);
    clone.id = `${clone.id}_copy`;
    setArcs((p) => [...p, clone]);
    setSelected(arcs.length);
  };

  const remove = async () => {
    if (!arcs.length) return;
    await removeCurrent();
  };

  const downloadCollection = () => download("arcs.json", arcs);

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      try {
        const obj = JSON.parse(t);
        if (Array.isArray(obj)) setArcs(obj);
        else if (obj && typeof obj === "object") setArcs((p) => [...p, obj]);
      } catch {}
    });
  };

  return (
    <div className="flex gap-4">
      <div className="w-80">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2 items-center">
              <Button onClick={addNew}><PlusCircle className="h-4 w-4 mr-1"/>New</Button>
              <Button variant="secondary" onClick={duplicate}>Duplicate</Button>
              <Button variant="secondary" onClick={remove}><Trash2 className="h-4 w-4 mr-1"/>Delete</Button>
            </div>
            <div>
              <input className="w-full rounded-md bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm" placeholder="Search by title, id, stage..." value={query} onChange={(e)=>setQuery(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <input type="file" accept="application/json" className="hidden" ref={fileRef} onChange={onImport} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1"/>Import</Button>
              <Button onClick={downloadCollection}><Download className="h-4 w-4 mr-1"/>Export</Button>
            </div>
            <div className="grid gap-2 max-h-[420px] overflow-auto">
              {filtered.map(({ a, i }) => (
                <div key={i} onClick={() => setSelected(i)} className={`p-2 rounded-lg border cursor-pointer transition ${i===selected ? 'border-indigo-500/70 bg-indigo-500/10 ring-1 ring-indigo-500/30' : 'border-slate-800 hover:bg-slate-800/40'}`}>
                  <div className="text-sm font-medium">{a.title || a.id}</div>
                  <div className="text-xs opacity-70">{a.stage} • {a.id}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <label className="text-xs opacity-80">
                    ID
                    <input 
                      className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                      value={current.id || ''} 
                      onChange={(e) => updateArc({id: e.target.value})} 
                    />
                  </label>
                  <label className="text-xs opacity-80">
                    Title
                    <input 
                      className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                      value={current.title || ''} 
                      onChange={(e) => updateArc({title: e.target.value})} 
                    />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <label className="text-xs opacity-80">
                    Stage
                    <input 
                      className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                      value={current.stage || ''} 
                      onChange={(e) => updateArc({stage: e.target.value})} 
                    />
                  </label>
                  <label className="text-xs opacity-80">
                    Owner
                    <input 
                      className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                      value={current.owner || ''} 
                      onChange={(e) => updateArc({owner: e.target.value})} 
                    />
                  </label>
                  <label className="text-xs opacity-80">
                    Progress
                    <input 
                      className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                      type="number" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={current.progress || 0} 
                      onChange={(e) => updateArc({progress: parseFloat(e.target.value) || 0})} 
                    />
                  </label>
                </div>

                <label className="text-xs opacity-80">
                  Goal
                  <textarea 
                    className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                    rows={2}
                    value={current.goal || ''} 
                    onChange={(e) => updateArc({goal: e.target.value})} 
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="text-xs opacity-80">
                    Triggers (comma-separated)
                    <input 
                      className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                      value={(current.triggers || []).join(', ')} 
                      onChange={(e) => updateArc({triggers: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} 
                    />
                  </label>
                  <label className="text-xs opacity-80">
                    Beats (comma-separated)
                    <input 
                      className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                      value={(current.beats || []).join(', ')} 
                      onChange={(e) => updateArc({beats: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} 
                    />
                  </label>
                </div>
              </div>

              <div>
                <Button 
                  variant="secondary" 
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full justify-between"
                >
                  <span className="text-xs opacity-80">Advanced (Raw JSON)</span>
                  {showRawJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {showRawJson && (
                  <Textarea 
                    className="font-mono text-xs min-h-[320px] mt-2" 
                    value={JSON.stringify(current, null, 2)} 
                    onChange={(e)=>{
                      try{ const obj = JSON.parse(e.target.value); setArcs(prev=>{ const n=[...prev]; n[selected]=obj; return n;}); setErrors([]);}catch(err:any){ setErrors([err.message]); }
                    }} 
                  />
                )}
              </div>

              {errors.length>0 && (
                <div className="text-xs text-red-500">{errors.map((e,i)=>(<div key={i}>• {e}</div>))}</div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="opacity-70 text-sm">No arc selected.</div>
        )}
      </div>
    </div>
  );
}

// --- Worlds Manager ---
function WorldsManager() {
  const [worldDoc, setWorldDoc] = useState<any>(structuredClone(sampleWorld));
  const [errors, setErrors] = useState<string[]>([]);
  const [showRawJson, setShowRawJson] = useState(false);

useEffect(()=>{(async()=>{
  try{ const rows = await listWorlds(); if(rows.length) setWorldDoc(rows[0] as any); }
  catch(e){ console.warn("Load worlds failed", e); }
})();},[]);
async function saveWorld(){ try{ await upsertWorld(worldDoc); }catch(e){ console.error(e);} }

  const updateWorld = (patch: any) => {
    setWorldDoc((prev: any) => ({ ...prev, ...patch }));
  };

  const validateCurrent = () => {
    const ok = validateWorld(worldDoc);
    setErrors((validateWorld as any).errors?.map((e: any) => `${e.instancePath || "/"} ${e.message}`) || []);
    return ok;
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {errors.length === 0 ? (
            <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle2 className="h-4 w-4"/> Valid</span>
          ) : (
            <span className="flex items-center gap-1 text-red-600 text-sm"><AlertCircle className="h-4 w-4"/> Invalid</span>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={validateCurrent}>Validate</Button>
            <Button variant="secondary" onClick={saveWorld}>Save World</Button>
            <Button variant="secondary" onClick={() => download('world.json', worldDoc)}>Download</Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <label className="text-xs opacity-80">
              Time
              <input 
                className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                value={worldDoc.time || ''} 
                onChange={(e) => updateWorld({time: e.target.value})} 
              />
            </label>
            <label className="text-xs opacity-80">
              Weather
              <input 
                className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                value={worldDoc.weather || ''} 
                onChange={(e) => updateWorld({weather: e.target.value})} 
              />
            </label>
            <label className="text-xs opacity-80">
              Tension
              <input 
                className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                type="number" 
                min="0" 
                max="1" 
                step="0.01"
                value={worldDoc.tension || 0} 
                onChange={(e) => updateWorld({tension: parseFloat(e.target.value) || 0})} 
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs opacity-80">
              Locations (comma-separated)
              <input 
                className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                value={(worldDoc.locations || []).join(', ')} 
                onChange={(e) => updateWorld({locations: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)})} 
              />
            </label>
            <label className="text-xs opacity-80">
              Events (comma-separated)
              <input 
                className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
                value={(worldDoc.events || []).join(', ')} 
                onChange={(e) => updateWorld({events: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)})} 
              />
            </label>
          </div>

          <label className="text-xs opacity-80">
            History Log (comma-separated)
            <textarea 
              className="w-full p-2 rounded bg-slate-900 border border-slate-700 mt-1" 
              rows={3}
              value={(worldDoc.history_log || []).join(', ')} 
              onChange={(e) => updateWorld({history_log: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)})} 
            />
          </label>
        </div>

        <div>
          <Button 
            variant="secondary" 
            onClick={() => setShowRawJson(!showRawJson)}
            className="w-full justify-between"
          >
            <span className="text-xs opacity-80">Advanced (Raw JSON)</span>
            {showRawJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {showRawJson && (
            <Textarea 
              className="font-mono text-xs min-h-[320px] mt-2" 
              value={JSON.stringify(worldDoc, null, 2)} 
              onChange={(e) => {
                try {
                  const obj = JSON.parse(e.target.value);
                  setWorldDoc(obj);
                  setErrors([]);
                } catch (err: any) {
                  setErrors([err.message]);
                }
              }} 
            />
          )}
        </div>
        {errors.length > 0 && (
          <div className="text-xs text-red-600">
            {errors.map((e, i) => (
              <div key={i}>• {e}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EngineEditor() {
  return (
    <div className="p-6 space-y-4">
      <Tabs defaultValue="entity" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="entity">Entity</TabsTrigger>
          <TabsTrigger value="faction">Faction</TabsTrigger>
          <TabsTrigger value="world">World</TabsTrigger>
          <TabsTrigger value="arc">Arc</TabsTrigger>
        </TabsList>

        <TabsContent value="entity"><EntitiesManager /></TabsContent>
        <TabsContent value="faction"><FactionsManager /></TabsContent>
        <TabsContent value="world"><WorldsManager /></TabsContent>
        <TabsContent value="arc"><ArcsManager /></TabsContent>
      </Tabs>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-sm opacity-80">
        Pro tip: keep SRD mechanics in <em>srd</em>, personality/traits in <em>personality</em>, and world pressure in <em>pressure/stability</em>. This editor validates shape only; game logic stays in Rails/Overseer.
      </motion.div>
    </div>
  );
}
