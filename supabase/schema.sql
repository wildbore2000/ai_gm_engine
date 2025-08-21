-- AI Game Master Engine - Supabase Schema
-- Run this in the Supabase SQL Editor to create/update tables

-- Worlds table with created_at for proper ordering
create table if not exists public.worlds (
  id text primary key,
  time text,
  weather text,
  locations jsonb not null default '[]',
  factions  jsonb not null default '{}',
  events    jsonb not null default '[]',
  history_log jsonb not null default '[]',
  tension numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Add created_at if it was missing from existing table
alter table public.worlds
  add column if not exists created_at timestamptz not null default now();

-- Other core tables (add created_at to all for consistency)
create table if not exists public.entities (
  id text primary key,
  name text not null,
  tags jsonb not null default '[]',
  srd jsonb not null default '{}',
  personality jsonb not null default '{}',
  status jsonb not null default '{}',
  relationships jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.factions (
  id text primary key,
  name text not null,
  tags jsonb not null default '[]',
  ideology text,
  goals jsonb not null default '[]',
  pressure numeric not null default 0,
  stability numeric not null default 0,
  resources jsonb not null default '{}',
  relations jsonb not null default '{}',
  leaders jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.arcs (
  id text primary key,
  title text not null,
  stage text,
  goal text,
  progress numeric not null default 0,
  triggers jsonb not null default '[]',
  beats jsonb not null default '[]',
  pressure_vector jsonb not null default '{}',
  owner text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  world_id text not null references public.worlds(id) on delete cascade,
  type text not null,
  title text,
  payload jsonb not null default '{}',
  priority integer not null default 1,
  source text,
  tags jsonb not null default '[]',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.worlds enable row level security;
alter table public.entities enable row level security;
alter table public.factions enable row level security;
alter table public.arcs enable row level security;
alter table public.events enable row level security;

-- Basic RLS policies (allow all for now - customize as needed)
create policy "Allow all operations on worlds" on public.worlds for all using (true);
create policy "Allow all operations on entities" on public.entities for all using (true);
create policy "Allow all operations on factions" on public.factions for all using (true);
create policy "Allow all operations on arcs" on public.arcs for all using (true);
create policy "Allow all operations on events" on public.events for all using (true);

-- Enable realtime for all tables
alter publication supabase_realtime add table public.worlds;
alter publication supabase_realtime add table public.entities;
alter publication supabase_realtime add table public.factions;
alter publication supabase_realtime add table public.arcs;
alter publication supabase_realtime add table public.events;