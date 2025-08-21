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
* [ ] Supabase integration (CRUD + Realtime)
* [ ] Edge Functions for simulation (advance time, spawn events)
* [ ] Encounter mode (turn-based resolution)
* [ ] Narrative generator driven by LLM

---

## License

MIT — build cool things.

