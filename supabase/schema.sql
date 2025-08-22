-- AI Game Master Engine - Supabase Schema
-- Run this in the Supabase SQL Editor to create/update tables

-- Worlds: UUID PK + owner
create table if not exists public.worlds (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  name text not null,
  time text,
  weather text,
  locations text[] not null default '{}',
  factions  jsonb not null default '{}',
  events    jsonb not null default '[]',
  history_log jsonb not null default '[]',
  tension numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Optional migration for existing rows: update worlds set locations = coalesce( (select array(select jsonb_array_elements_text(locations))), '{}'::text[] );

-- Backfill owner for existing rows (optional):
-- update public.worlds set created_by = auth.uid() where created_by is null;  -- run per-session

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  name text not null,
  tags jsonb not null default '[]',
  srd jsonb not null default '{}',
  personality jsonb not null default '{}',
  status jsonb not null default '{}',
  relationships jsonb not null default '{}',
  memory jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.factions (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
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
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
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
  world_id uuid not null references public.worlds(id) on delete cascade,
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

-- Policies: owner only for worlds
create policy "worlds_select_own" on public.worlds
  for select using (auth.uid() = created_by);
create policy "worlds_modify_own" on public.worlds
  for insert with check (auth.uid() = created_by)
  using (auth.uid() = created_by);

-- Child rows must reference user's worlds
create policy "entities_by_owner_world" on public.entities
  for all using (exists (select 1 from public.worlds w where w.id = world_id and w.created_by = auth.uid()))
  with check (exists (select 1 from public.worlds w where w.id = world_id and w.created_by = auth.uid()));
create policy "factions_by_owner_world" on public.factions
  for all using (exists (select 1 from public.worlds w where w.id = world_id and w.created_by = auth.uid()))
  with check (exists (select 1 from public.worlds w where w.id = world_id and w.created_by = auth.uid()));
create policy "arcs_by_owner_world" on public.arcs
  for all using (exists (select 1 from public.worlds w where w.id = world_id and w.created_by = auth.uid()))
  with check (exists (select 1 from public.worlds w where w.id = world_id and w.created_by = auth.uid()));
create policy "events_by_owner_world" on public.events
  for all using (exists (select 1 from public.worlds w where w.id = world_id and w.created_by = auth.uid()))
  with check (exists (select 1 from public.worlds w where w.id = world_id and w.created_by = auth.uid()));

-- Enable realtime for all tables
alter publication supabase_realtime add table public.worlds;
alter publication supabase_realtime add table public.entities;
alter publication supabase_realtime add table public.factions;
alter publication supabase_realtime add table public.arcs;
alter publication supabase_realtime add table public.events;