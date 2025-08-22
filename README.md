# AI GM Engine

An experimental **AI-driven Game Master engine** inspired by tabletop RPGs and games like *RimWorld*, *Baldur’s Gate*, and *Neverwinter Nights*.  

This project is both a **world editor** (define entities, factions, arcs, and events) and a **GM Screen** that lets you **advance time, trigger encounters, and watch your world evolve in real-time**.  
Supabase provides persistence, authentication, realtime sync, and optional Edge Functions for simulation.

---

## ✨ Vision

The **AI GM Engine** is designed to:

- **Simulate living worlds** that progress on their own (time ticks, tensions shift, factions act).
- **Give GMs control** via a unified **GM Screen** with HUD, event feed, map grid, party, and quests.
- **Keep all data world-scoped**, so you can run multiple worlds in parallel without cross-contamination.
- **Stay deterministic first** (simple systems generate events); later, **LLM flavor text** enriches the narrative.

---

## 🔑 Features
- **Unified Manager Interface** – CRUD editors with consistent ActionBar actions & keyboard shortcuts  
- **GM Screen (play mode)** – world HUD, tension bar, event feed, map/locations, party pane, quests pane  
- **World Naming System** – friendly world names with inline editing and display  
- **Supabase Integration** – Postgres persistence, Row-Level Security, realtime events  
- **Authentication System** – email/password login with secure sessions  
- **Keyboard Accessibility** – N (new), Ctrl+S (save), Del (delete), R (refresh), V (validate)  
- **Edge Functions** – optional server-side simulation (advance time, spawn rumors/events)  
- **Modern UI** – React + Vite + TailwindCSS + ShadCN components  

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/YOURNAME/ai_gm_engine.git
cd ai_gm_engine
npm install
```

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
Visit [http://localhost:5173](http://localhost:5173)

---

## 🗄️ Supabase Setup

1. Create a Supabase project at [https://app.supabase.com](https://app.supabase.com).
2. Copy your **Project URL** and **anon key** (browser) and **service role key** (Edge Functions).
3. Open **SQL Editor** and run the schema in [`/supabase/schema.sql`](./supabase/schema.sql).
4. Enable **Row Level Security** and run the provided policies.

### Tables
- `worlds` – name, time, weather, tension, locations, owner  
- `entities` – NPCs, PCs, monsters, etc. (with tags, personality, relationships)  
- `factions` – organizations with resources, pressure, stability  
- `arcs` – narrative threads with stages, progress, triggers  
- `events` – immutable event log tied to worlds

Use this SQL to export the database structure:
```sql
  select table_name, column_name, data_type
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position;
```


### Seed Example Data

You can populate your database with sample entities, factions, worlds, arcs, and events using the provided script:

```bash
psql < docs/seeds.sql
```

Or copy/paste the contents of [`docs/seeds.sql`](./docs/seeds.sql) into the **Supabase SQL Editor**.

---

## 🎮 Gameplay Loop

- **World View (macro)** – Advance time, tensions drift, global events fire.  
- **Location View (meso)** – Select a town/zone; surface local factions, NPCs, rumors.  
- **Encounter Mode (micro)** – Resolve discrete conflicts turn-by-turn, generate consequences.  

The GM Screen ties these together into a single, glanceable dashboard.

---

## 🧩 Development Notes
- **Validation** with AJV schemas for JSON definitions.  
- **Realtime** sync for collaborative editing or multi-device play.  
- **UI Components** built with TailwindCSS + ShadCN (Tabs, Cards, Buttons, Sidebar).  
- **Storage** default is Supabase Postgres, but structure is JSON-first (portable to SQLite, Mongo, etc.).  

---

## ⚡ Edge Functions

Optional server-side logic can live in Supabase Functions.

Example: **advanceWorldTick**

```bash
supabase functions new advanceWorldTick
```

Example function body (`docs/functions/advanceWorldTick.ts`):

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

## 🔮 Roadmap

### Phase 1 — Foundation
- ✅ Auth with Supabase  
- ✅ CRUD + realtime sync  
- ✅ Worlds have names  
- ✅ Unified ActionBar across managers  

### Phase 2 — GM Screen
- [ ] HUD (time, tension bar, world name)  
- [ ] Event Feed with badges & filters  
- [ ] Map grid & location selection  
- [ ] Party pane (entities tagged `party`)  
- [ ] Quests pane (active arcs)  

### Phase 3 — Simulation Systems
- [ ] Tick engine (advance time, drift tension, spawn rumors)  
- [ ] Faction pressure & moves  
- [ ] Encounter generator v0 (table-based)  

### Phase 4 — AI Assist (optional)
- [ ] Narrative flavor for events/encounters  
- [ ] Procedural quest hooks  

---

## 📄 License
MIT — build cool things.
