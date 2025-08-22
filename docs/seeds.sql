-- docs/seeds.sql (fixed for current schema)

-- REQUIREMENTS:
-- 1) Replace this with a real user UUID who should own the seeded world:
--    e.g., select auth.uid() when running as that user, or paste a known user id.
-- 2) Run with a service role or after disabling RLS for the duration of the seed.

-- ensure gen_random_uuid exists
create extension if not exists pgcrypto;

do $$
declare
  owner uuid := '00000000-0000-0000-0000-000000000001';  -- TODO: replace with a real user UUID
  w_id uuid := gen_random_uuid();
begin
  -- WORLD
  insert into public.worlds (id, created_by, name, time, weather, locations, factions, events, history_log, tension)
  values (
    w_id, owner,
    'Greenfall Valley',
    'Day 12, 03:00',
    'rain',
    ARRAY['greenfall','greenfall_edge','old_road']::text[],
    jsonb_build_object('f_raiders', jsonb_build_object('pressure', 0.42, 'stability', 0.58)),
    '[]'::jsonb,
    ARRAY['Day 11: merchant caravan robbed']::text[],
    0.47
  );

  -- ENTITIES (id is text in your schema)
  insert into public.entities (id, world_id, name, tags, srd, personality, status, relationships)
  values (
    'npc_mira',
    w_id,
    'Mira Stonewind',
    ARRAY['npc','ranger','human']::text[],
    '{
      "level":3,"ancestry":"Human","role":"Ranger","alignment":"CG",
      "stats":{"str":12,"dex":18,"con":14,"int":10,"wis":16,"cha":11},
      "hp":28,"ac":17,
      "saves":{"fortitude":6,"reflex":9,"will":5},
      "skills":{"survival":8,"stealth":7,"diplomacy":3},
      "abilities":["Hunt Prey","Twin Takedown"],
      "inventory":[{"name":"Longbow","type":"weapon","qty":1},{"name":"Healing Potion","type":"consumable","qty":1}]
    }'::jsonb,
    '{
      "temperament":"quiet and observant",
      "ideals":["freedom","nature above civilization"],
      "fears":["being caged"],
      "motivations":["protect wildlands","redeem family name"],
      "flaws":["acts before asking"]
    }'::jsonb,
    '{"location":"greenfall_edge","faction":"Rangers of the Vale","mood":"cautious","current_task":"patrol"}'::jsonb,
    '{"npc_raider_chief":"uncertain ally","player":"ally"}'::jsonb
  );

  -- FACTIONS (id is text)
  insert into public.factions (id, world_id, name, tags, ideology, goals, pressure, stability, resources, relations, leaders)
  values (
    'f_raiders',
    w_id,
    'Ash Dune Riders',
    ARRAY['raiders','nomads']::text[],
    'Strength through freedom',
    ARRAY['control trade routes','undermine town council']::text[],
    0.42, 0.58,
    '{"food":40,"mounts":25,"weapons":60}'::jsonb,
    '{"f_town":-35,"f_rangers":-10}'::jsonb,
    ARRAY['npc_raider_chief']::text[]
  );

  -- ARCS (id is text)
  insert into public.arcs (id, world_id, title, stage, goal, progress, triggers, beats, pressure_vector, owner)
  values (
    'arc_cult_rise',
    w_id,
    'Whispers Beneath Greenfall',
    'rumors',
    'destabilize settlement from within',
    0.22,
    ARRAY['nightmares','missing supplies']::text[],
    ARRAY['first rumor','suspicious sermon','disappearance']::text[],
    '{"f_town":0.2,"f_cult":0.5}'::jsonb,
    'f_cult'
  );

  -- EVENTS (id is uuid)
  insert into public.events (id, world_id, type, title, payload, priority, source, tags)
  values
  (
    gen_random_uuid(),
    w_id,
    'rumor',
    'Strange Lights in the Woods',
    '{
      "content":"Travelers report eerie blue lights dancing between the trees near the old shrine",
      "source":"merchant_caravan",
      "reliability":0.7
    }'::jsonb,
    1,
    'npc_merchant',
    ARRAY['mystery','supernatural']::text[]
  ),
  (
    gen_random_uuid(),
    w_id,
    'dialogue',
    'Concerned Guard Captain',
    '{
      "speaker":"npc_captain_hayes",
      "content":"We need more patrols. Something is stirring in the wilderness.",
      "mood":"worried",
      "location":"town_barracks"
    }'::jsonb,
    2,
    'tension_system',
    ARRAY['warning','military']::text[]
  );
end $$;
