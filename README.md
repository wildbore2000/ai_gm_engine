# AI GM Engine

An experimental **AI-driven Game Master engine** inspired by tabletop RPGs and games like *RimWorld*, *Baldur’s Gate*, and *Neverwinter Nights*.  
The engine is structured around JSON-defined entities, factions, arcs, and worlds, with Supabase handling persistence and optional Edge Functions for simulation.

---

## Features
- **Entity/Faction/Arc/World Manager** – UI for creating and editing game objects
- **JSON Schema Validation** – all game data conforms to defined structures
- **Supabase Integration** – store game data in Postgres with Row-Level Security
- **Edge Functions (optional)** – run server-side world updates, log events, advance time
- **Modern UI** – React + Vite + TailwindCSS + ShadCN components

---

## Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/YOURNAME/ai_gm_engine.git
cd ai_gm_engine
npm install
````

### 2. Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Restart your dev server after adding env vars.

### 3. Run Locally

```bash
npm run dev
```

Visit: [http://localhost:5173](http://localhost:5173)

---

## Supabase Setup

1. Create a Supabase project at [https://app.supabase.com](https://app.supabase.com).
2. Go to **Project Settings → API**:

   * Copy your `Project URL`
   * Copy your `anon` key (for browser)
   * Copy your `service_role` key (for server/Edge Functions)
3. Open the **SQL Editor** and run the schema in [`/supabase/schema.sql`](./supabase/schema.sql) (see `docs/` if not present).
4. Enable **Row Level Security** and run the provided policies (same script as above).

### Tables created:

* `entities`
* `factions`
* `arcs`
* `worlds`
* `events`

### How to Seed via SQL

You can populate your database with sample data using these SQL snippets in the Supabase SQL Editor:

#### Entities
```sql
INSERT INTO entities (id, name, tags, srd, personality, status, relationships) VALUES 
('npc_mira', 'Mira Stonewind', '["npc", "ranger", "human"]', 
 '{"level": 3, "ancestry": "Human", "role": "Ranger", "alignment": "CG", "stats": {"str": 12, "dex": 18, "con": 14, "int": 10, "wis": 16, "cha": 11}, "hp": 28, "ac": 17, "saves": {"fortitude": 6, "reflex": 9, "will": 5}, "skills": {"survival": 8, "stealth": 7, "diplomacy": 3}, "abilities": ["Hunt Prey", "Twin Takedown"], "inventory": [{"name": "Longbow", "type": "weapon", "qty": 1}, {"name": "Healing Potion", "type": "consumable", "qty": 1}]}',
 '{"temperament": "quiet and observant", "ideals": ["freedom", "nature above civilization"], "fears": ["being caged"], "motivations": ["protect wildlands", "redeem family name"], "flaws": ["acts before asking"]}',
 '{"location": "greenfall_edge", "faction": "Rangers of the Vale", "mood": "cautious", "current_task": "patrol"}',
 '{"npc_raider_chief": "uncertain ally", "player": "ally"}');
```

#### Factions
```sql
INSERT INTO factions (id, name, tags, ideology, goals, pressure, stability, resources, relations, leaders) VALUES 
('f_raiders', 'Ash Dune Riders', '["raiders", "nomads"]', 'Strength through freedom', 
 '["control trade routes", "undermine town council"]', 0.42, 0.58,
 '{"food": 40, "mounts": 25, "weapons": 60}',
 '{"f_town": -35, "f_rangers": -10}',
 '["npc_raider_chief"]');
```

#### Worlds  
```sql
INSERT INTO worlds (id, time, weather, locations, factions, events, history_log, tension) VALUES 
('world_greenfall', 'Day 12, 03:00', 'rain', 
 '["greenfall", "greenfall_edge", "old_road"]',
 '{"f_raiders": {"pressure": 0.42, "stability": 0.58}}',
 '["raider_scout_spotted", "storm_warning"]',
 '["Day 11: merchant caravan robbed"]',
 0.47);
```

#### Arcs
```sql
INSERT INTO arcs (id, title, stage, goal, progress, triggers, beats, pressure_vector, owner) VALUES 
('arc_cult_rise', 'Whispers Beneath Greenfall', 'rumors', 'destabilize settlement from within', 0.22,
 '["nightmares", "missing supplies"]',
 '["first rumor", "suspicious sermon", "disappearance"]',
 '{"f_town": 0.2, "f_cult": 0.5}',
 'f_cult');
```

#### Events
```sql
INSERT INTO events (id, world_id, type, title, payload, priority, source, tags) VALUES 
('event_rumor_001', 'world_greenfall', 'rumor', 'Strange Lights in the Woods', 
 '{"content": "Travelers report eerie blue lights dancing between the trees near the old shrine", "source": "merchant_caravan", "reliability": 0.7}',
 1, 'npc_merchant', '["mystery", "supernatural"]'),
('event_dialogue_001', 'world_greenfall', 'dialogue', 'Concerned Guard Captain', 
 '{"speaker": "npc_captain_hayes", "content": "We need more patrols. Something is stirring in the wilderness.", "mood": "worried", "location": "town_barracks"}',
 2, 'tension_system', '["warning", "military"]');
```

---

## Development Notes

* **CRUD:** The editor tabs let you create, update, delete, and import/export JSON definitions.
* **Validation:** Uses [AJV](https://ajv.js.org/) for schema validation.
* **Realtime:** Supabase Realtime can auto-sync entities/factions between clients.
* **Storage Choice:** Default backend is Supabase (Postgres). You could also use Mongo, SQLite, or files if preferred.
* **UI Components:** TailwindCSS + ShadCN (Tabs, Cards, Buttons, Sidebar).

---

## Edge Functions

Optional server-side logic can live in Supabase Functions.

Example: **advanceWorldTick**

```bash
supabase functions new advanceWorldTick
```

Example function body:

```ts
Deno.serve(async (req) => {
  const { world_id, hours } = await req.json();
  // update world time + insert event
  return new Response(JSON.stringify({ ok: true, world_id, hours }), {
    headers: { "content-type": "application/json" }
  });
});
```

Deploy:

```bash
supabase functions deploy advanceWorldTick --project-ref YOUR_PROJECT_REF
```

---

## Roadmap

* [x] Entities Manager
* [x] Factions & Arcs Manager
* [x] World Editor
* [x] Supabase integration (CRUD + Realtime)
* [x] Events Manager with quick actions
* [x] Realtime sync for Factions, Arcs, Worlds, Events
* [ ] Edge Functions for simulation (advance time, spawn events)
* [ ] Encounter mode (turn-based resolution)
* [ ] Narrative generator driven by LLM

---

## License

MIT — build cool things.

