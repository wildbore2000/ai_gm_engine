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

-- RPC Functions for AI Advisor atomic updates
create or replace function apply_world_deltas(
  p_world_id uuid,
  p_tension_delta numeric default 0,
  p_time_advance text default null
)
returns void
language plpgsql
security definer
as $$
begin
  -- Check ownership
  if not exists (select 1 from public.worlds where id = p_world_id and created_by = auth.uid()) then
    raise exception 'World not found or access denied';
  end if;

  -- Apply tension delta (clamp between 0 and 1)
  update public.worlds 
  set 
    tension = greatest(0, least(1, coalesce(tension, 0.5) + p_tension_delta)),
    updated_at = now()
  where id = p_world_id;

  -- Time advance is handled by updating the timestamp for now
  -- You could add a proper time column and advance logic here
end;
$$;

create or replace function apply_arc_progress_deltas(
  p_updates jsonb -- [{"id": "uuid", "progress_delta": 0.1}, ...]
)
returns void
language plpgsql
security definer
as $$
declare
  update_item jsonb;
  arc_id uuid;
  progress_delta numeric;
begin
  -- Process each update
  for update_item in select jsonb_array_elements(p_updates)
  loop
    arc_id := (update_item->>'id')::uuid;
    progress_delta := (update_item->>'progress_delta')::numeric;
    
    -- Check ownership through world relationship
    if not exists (
      select 1 from public.arcs a 
      join public.worlds w on a.world_id = w.id 
      where a.id = arc_id and w.created_by = auth.uid()
    ) then
      continue; -- Skip unauthorized arcs
    end if;

    -- Apply progress delta (clamp between 0 and 1)
    update public.arcs 
    set progress = greatest(0, least(1, coalesce(progress, 0) + progress_delta))
    where id = arc_id;
  end loop;
end;
$$;

create or replace function apply_faction_pressure_deltas(
  p_updates jsonb -- [{"id": "uuid", "pressure_delta": 0.05}, ...]
)
returns void
language plpgsql
security definer
as $$
declare
  update_item jsonb;
  faction_id uuid;
  pressure_delta numeric;
begin
  -- Process each update
  for update_item in select jsonb_array_elements(p_updates)
  loop
    faction_id := (update_item->>'id')::uuid;
    pressure_delta := (update_item->>'pressure_delta')::numeric;
    
    -- Check ownership through world relationship
    if not exists (
      select 1 from public.factions f 
      join public.worlds w on f.world_id = w.id 
      where f.id = faction_id and w.created_by = auth.uid()
    ) then
      continue; -- Skip unauthorized factions
    end if;

    -- Apply pressure delta (clamp between 0 and 1)
    update public.factions 
    set pressure = greatest(0, least(1, coalesce(pressure, 0.5) + pressure_delta))
    where id = faction_id;
  end loop;
end;
$$;

-- apply_world_deltas: adjust tension and optionally add hours/minutes to a timestamp column
create or replace function public.apply_world_deltas(
  p_world_id uuid,
  p_tension_delta numeric default 0,
  p_time_advance text default null
) returns void
language plpgsql
security definer
as $$
declare
  v_time_advance interval;
begin
  -- clamp tension 0..1
  update public.worlds w
     set tension = greatest(0, least(1, coalesce(w.tension, 0.5) + coalesce(p_tension_delta, 0)))
   where w.id = p_world_id;

  -- If you only have "time TEXT", skip time math for now. (Optional: add a timestamptz column.)
  if p_time_advance is not null then
    -- NO-OP unless you add a proper timestamptz column like "current_time"
    null;
  end if;
end$$;

-- apply_arc_progress_deltas: [{id, progress_delta}]
create or replace function public.apply_arc_progress_deltas(p_updates jsonb)
returns void
language plpgsql
security definer
as $$
declare
  rec jsonb;
  v_id text;
  v_delta numeric;
  v_progress numeric;
begin
  for rec in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  loop
    v_id := (rec->>'id');
    v_delta := coalesce((rec->>'progress_delta')::numeric, 0);
    select progress into v_progress from public.arcs where id = v_id;
    if found then
      update public.arcs
         set progress = greatest(0, least(1, coalesce(v_progress,0) + v_delta))
       where id = v_id;
    end if;
  end loop;
end$$;

-- apply_faction_pressure_deltas: [{id, pressure_delta}]
create or replace function public.apply_faction_pressure_deltas(p_updates jsonb)
returns void
language plpgsql
security definer
as $$
declare
  rec jsonb;
  v_id text;
  v_delta numeric;
  v_pressure numeric;
begin
  for rec in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  loop
    v_id := (rec->>'id');
    v_delta := coalesce((rec->>'pressure_delta')::numeric, 0);
    select pressure into v_pressure from public.factions where id = v_id;
    if found then
      update public.factions
         set pressure = greatest(0, least(1, coalesce(v_pressure,0.5) + v_delta))
       where id = v_id;
    end if;
  end loop;
end$$;
