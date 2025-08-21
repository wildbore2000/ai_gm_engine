# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is an AI Game Master Engine with Supabase backend integration consisting of multiple components:

### Frontend (React/TypeScript)
- **`src/components/EngineEditor.tsx`**: Main editor component with tabbed interface for editing game data
- **`src/components/ui/`**: Reusable UI components (buttons, cards, inputs, tabs, textareas)
- Uses Vite, React, TypeScript, TailwindCSS, ShadCN components, and Framer Motion
- JSON schema validation using AJV library
- Supabase integration for data persistence and real-time sync

### Backend Options
- **Supabase (Primary)**: Postgres database with Row-Level Security, optional Edge Functions for server-side simulation
- **Local Python (Legacy)**: Pure Python simulation with file-based storage
  - `engine/overseer.py`: AI/heuristic engine that proposes GameEvents based on world state and tension levels
  - `engine/rails.py`: Deterministic event handlers that apply GameEvents to modify world state
  - `run_sim.py`: Main simulation runner that executes overseer passes and applies events

### Data Layer
- **`data/`**: JSON data files for local development and testing
- **`schemas/`**: JSON Schema definitions for data validation
- **Supabase tables**: entities, factions, arcs, worlds, events with real-time capabilities

## Development Commands

### Frontend Development
```bash
npm run dev        # Start development server (Vite) on port 5173
npm run build      # Build for production (TypeScript compilation + Vite build)
npm run preview    # Preview production build
```

### Backend Simulation
```bash
python run_sim.py  # Run single overseer pass and apply first event
```

## Key Data Types

The system uses 5 core JSON schemas:
- **Entity**: NPCs with SRD stats, personality, relationships, and status
- **Faction**: Groups with goals, resources, stability, and inter-faction relations
- **WorldState**: Global state including time, weather, locations, faction data, and tension
- **Arc**: Story arcs with progress tracking and pressure vectors
- **GameEvent**: Events with type, payload, and priority for world modification

## Environment Setup

Create a `.env` file with Supabase credentials:
```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Set up Supabase database using `/supabase/schema.sql` for tables: entities, factions, arcs, worlds, events.

## Development Notes

- World tension drives event generation: low tension → rumors, high tension → dialogue/conflict
- The frontend editor provides real-time JSON validation and CRUD operations with Supabase sync
- Supabase Edge Functions can handle server-side simulation and world advancement
- Local Python simulation remains available for pure file-based development
- Data files in `data/` provide sample content for testing the simulation loop
- Row-Level Security policies control data access in Supabase