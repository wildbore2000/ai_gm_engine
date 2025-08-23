import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// PF2e Rules Engine - Core mechanics from official SRD
const DC_BY_LEVEL: Record<number, number> = {
  0:14, 1:15, 2:16, 3:18, 4:19, 5:20, 6:22, 7:23, 8:24, 9:26, 10:27,
  11:28, 12:30, 13:31, 14:32, 15:34, 16:35, 17:36, 18:38, 19:39, 20:40,
  21:42, 22:44, 23:46, 24:48, 25:50
}; // Source: PF2e GM Core "Level-Based DCs" (same values as Core CRB)

function levelDc(level: number): number {
  const clampedLevel = Math.max(0, Math.min(25, Math.floor(level)));
  return DC_BY_LEVEL[clampedLevel];
}

type Degree = "critical_success" | "success" | "failure" | "critical_failure";

function degreeOfSuccess(total: number, dc: number): Degree {
  if (total >= dc + 10) return "critical_success";
  if (total >= dc) return "success";
  if (total <= dc - 10) return "critical_failure";
  return "failure";
} // Degrees of success per PF2e rules

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getConditionsForScenario(scenario: string): string[] {
  const s = scenario.toLowerCase();
  if (s.includes('fear') || s.includes('intimidat')) return ['frightened'];
  if (s.includes('poison') || s.includes('sick')) return ['sickened'];
  if (s.includes('darkness') || s.includes('blind')) return ['blinded', 'dazzled'];
  if (s.includes('grab') || s.includes('restrain')) return ['grabbed'];
  if (s.includes('stun') || s.includes('daze')) return ['stunned'];
  return [];
}

// --- Zod Schemas ---
const Input = z.object({
  world_id: z.string(),
  include: z.object({
    recent_events: z.number().default(10),
    party: z.boolean().default(true),
    arcs: z.boolean().default(true),
    factions: z.boolean().default(true),
  }).default({ recent_events: 10, party: true, arcs: true, factions: true }),
  ask: z.string().default("Advance one tick."),
  constraints: z.object({
    max_new_events: z.number().default(3),
    allow_updates: z.boolean().default(true),
    deterministic_only: z.boolean().default(true),
  }).default({ max_new_events: 3, allow_updates: true, deterministic_only: true }),
  seed: z.number().optional()
});

const Output = z.object({
  summary: z.string(),
  new_events: z.array(z.object({
    type: z.string(),
    title: z.string().optional(),
    payload: z.record(z.any()).default({}),
    priority: z.number().default(1),
    tags: z.array(z.string()).default([]),
  })).default([]),
  updates: z.object({
    world: z.object({ 
      tension_delta: z.number().optional(), 
      time_advance: z.string().optional() 
    }).partial().default({}),
    arcs: z.array(z.object({ 
      id: z.string(), 
      progress_delta: z.number().default(0) 
    })).default([]),
    factions: z.array(z.object({ 
      id: z.string(), 
      pressure_delta: z.number().default(0) 
    })).default([]),
  }).default({ world: {}, arcs: [], factions: [] }),
  encounter: z.object({
    seed: z.string().optional(),
    kind: z.string().optional(),
    difficulty: z.string().optional(),
    flavor: z.string().optional(),
  }).partial().default({}),
  notes: z.array(z.string()).default([])
});

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const parsed = Input.parse(body);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(url, serviceKey, {
      global: {
        headers: req.headers.get('Authorization') ? { Authorization: req.headers.get('Authorization')! } : {},
      },
    });

    // 1) Hydrate snapshot (parallel fetching for performance)
    const { world_id } = parsed;
    const [w, ev, party, arcs, factions] = await Promise.all([
      supabase.from("worlds").select("*").eq("id", world_id).single(),
      supabase.from("events").select("*").eq("world_id", world_id).order("created_at", { ascending: false }).limit(parsed.include.recent_events),
      parsed.include.party ? supabase.from("entities").select("*").eq("world_id", world_id) : Promise.resolve({ data: [] }),
      parsed.include.arcs ? supabase.from("arcs").select("*").eq("world_id", world_id) : Promise.resolve({ data: [] }),
      parsed.include.factions ? supabase.from("factions").select("*").eq("world_id", world_id) : Promise.resolve({ data: [] }),
    ]);

    if (w.error || !w.data) {
      throw new Error(`World not found: ${w.error?.message || 'Unknown error'}`);
    }

    // 2) Create snapshot object
    const snapshot = {
      world: w.data,
      recentEvents: ev.data ?? [],
      party: party.data ?? [],
      arcs: arcs.data ?? [],
      factions: factions.data ?? [],
      seed: parsed.seed
    };

    // 3) Generate deterministic baseline plan
    const plan = baselinePlan(snapshot, parsed);

    // 4) Optional LLM augmentation (opt-in)
    if (!parsed.constraints.deterministic_only) {
      const llmPlan = await llmAugment(plan, parsed, snapshot);
      // Merge and validate
      Object.assign(plan, safeMergePlans(plan, llmPlan));
    }

    // 5) Validate output schema and return
    const output = Output.parse(plan);
    
    return new Response(JSON.stringify(output), { 
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json" 
      } 
    });

  } catch (e: any) {
    console.error('AI Recommend Error:', e);
    return new Response(
      JSON.stringify({ 
        error: e.message ?? String(e),
        details: e.issues ? e.issues : undefined // Zod validation errors
      }), 
      { 
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});

// --- PF2e-Enhanced Deterministic baseline rules ---
function baselinePlan(snapshot: any, input: z.infer<typeof Input>) {
  const tension = Number(snapshot.world?.tension ?? 0.5);
  const locs: string[] = snapshot.world?.locations ?? ["wilderness", "settlement", "crossroads"];
  const recentEventCount = snapshot.recentEvents?.length ?? 0;
  
  // Read party array; default to level 1 if missing.
  const first = Array.isArray(snapshot.party) && snapshot.party.length > 0 ? snapshot.party[0] : null;
  const inferredLevel = Number(first?.srd?.level ?? first?.level ?? 1);
  const partyLevel = Math.max(1, Math.floor(inferredLevel));
  
  // Seeded random for deterministic behavior
  let seed = input.seed ?? 42;
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  const pick = <T,>(arr: T[]): T | undefined => 
    arr.length ? arr[Math.floor(seededRandom() * arr.length)] : undefined;

  // Initialize plan with PF2e rule references
  const updates = {
    world: { 
      tension_delta: clamp((seededRandom() - 0.45) * 0.05, -0.02, 0.04), 
      time_advance: pick(["10m", "1h", "8h"]) ?? "1h" // PF2e time increments
    },
    arcs: [] as any[],
    factions: [] as any[],
  };

  const new_events: any[] = [];
  const ruleReferences: string[] = [];

  // Event generation based on tension and activity
  const shouldGenerateRumor = seededRandom() < clamp(0.2 + tension * 0.6, 0.15, 0.8);
  const lowActivity = recentEventCount < 3;

  if (shouldGenerateRumor || lowActivity) {
    const loc = pick(locs) ?? "wilderness";
    const rumorTypes = [
      { 
        content: "Strange lights flicker in the distance", 
        skill_check: "Perception",
        dc: levelDc(partyLevel),
        conditions: [] as string[]
      },
      { 
        content: "Locals speak of missing travelers", 
        skill_check: "Diplomacy",
        dc: levelDc(partyLevel), 
        conditions: ["frightened"]
      },
      { 
        content: "Ancient symbols appear carved into trees", 
        skill_check: "Occultism",
        dc: levelDc(partyLevel),
        conditions: []
      },
      { 
        content: "Wildlife avoids certain areas entirely", 
        skill_check: "Survival", 
        dc: levelDc(partyLevel),
        conditions: []
      }
    ];
    
    const rumor = pick(rumorTypes) ?? rumorTypes[0];
    const ruleRef = `DC ${rumor.dc} ${rumor.skill_check} (Level ${partyLevel}, GM Core p.503)`;
    
    new_events.push({
      type: "rumor", 
      title: "Local Whispers",
      payload: { 
        location: loc,
        content: rumor.content,
        investigation: {
          skill: rumor.skill_check,
          dc: rumor.dc,
          rule_reference: ruleRef,
          on_roll_example: { total: rumor.dc + 5, degree: degreeOfSuccess(rumor.dc + 5, rumor.dc) }
        },
        potential_conditions: rumor.conditions
      },
      priority: rumor.dc > levelDc(partyLevel) ? 3 : 2,
      tags: ["rumor", loc, "investigation", rumor.skill_check.toLowerCase()]
    });
    
    ruleReferences.push(ruleRef);
  }

  // Faction activity when tension is high
  if (tension > 0.55 && snapshot.factions?.length > 0) {
    const faction = pick(snapshot.factions);
    if (faction) {
      const pressureChange = clamp(seededRandom() * 0.06 - 0.01, -0.02, 0.05);
      updates.factions.push({ id: faction.id, pressure_delta: pressureChange });
      
      const moveTypes = [
        { 
          action: "increased patrol activity", 
          skill_check: "Stealth",
          dc: levelDc(partyLevel),
          description: "Avoid detection by faction scouts"
        },
        { 
          action: "diplomatic negotiations", 
          skill_check: "Diplomacy", 
          dc: levelDc(partyLevel),
          description: "Influence or gather information from faction envoys"
        },
        { 
          action: "resource gathering", 
          skill_check: "Society",
          dc: levelDc(partyLevel), 
          description: "Learn about faction supply lines and activities"
        }
      ];
      
      const move = pick(moveTypes) ?? moveTypes[0];
      const moveRuleRef = `DC ${move.dc} ${move.skill_check} to ${move.description.toLowerCase()} (Level ${partyLevel}, Core Rulebook)`;
      
      new_events.push({
        type: "faction_move",
        title: "Faction Activity",
        payload: { 
          faction_id: faction.id, 
          faction_name: faction.name || faction.id,
          action: move.action,
          challenge: {
            skill: move.skill_check,
            dc: move.dc,
            description: move.description,
            rule_reference: moveRuleRef
          }
        },
        priority: 2,
        tags: ["faction", "challenge", move.skill_check.toLowerCase()]
      });
      
      ruleReferences.push(moveRuleRef);
    }
  }

  // Arc progression (light nudges)
  if (snapshot.arcs?.length > 0 && seededRandom() < 0.3) {
    const arc = pick(snapshot.arcs);
    if (arc && (arc.progress ?? 0) < 0.9) {
      const progressDelta = clamp(seededRandom() * 0.15 - 0.05, -0.02, 0.1);
      updates.arcs.push({ id: arc.id, progress_delta: progressDelta });
      
      if (progressDelta > 0.05) {
        new_events.push({
          type: "arc_development",
          title: "Story Development",
          payload: { 
            arc_id: arc.id,
            arc_title: arc.title || arc.id,
            development: "Circumstances shift, bringing new clarity to the situation"
          },
          priority: 2,
          tags: ["story", "arc", arc.stage || "unknown"]
        });
      }
    }
  }

  // Discovery events for exploration
  if (tension < 0.4 && seededRandom() < 0.25) {
    const loc = pick(locs) ?? "wilderness";
    const discoveries = [
      { item: "ancient inscription", significance: "minor" },
      { item: "hidden cache", significance: "moderate" },
      { item: "forgotten shrine", significance: "major" }
    ];
    
    const discovery = pick(discoveries) ?? discoveries[0];
    new_events.push({
      type: "discovery",
      title: "Unexpected Find",
      payload: { 
        location: loc,
        item: discovery.item,
        significance: discovery.significance
      },
      priority: discovery.significance === "major" ? 3 : discovery.significance === "moderate" ? 2 : 1,
      tags: ["discovery", loc, discovery.significance]
    });
  }

  // Generate encounter seed for high tension using PF2e encounter building
  const encounter = tension > 0.65 ? {
    seed: `level:${partyLevel}|tension:${tension.toFixed(2)}|${pick(locs)}`,
    kind: pick(["ambush", "social", "exploration", "combat"]) ?? "combat",
    difficulty: tension > 0.8 ? "severe" : tension > 0.7 ? "moderate" : "low",
    enemy_level: partyLevel + (tension > 0.8 ? 2 : tension > 0.7 ? 0 : -1),
    flavor: pick([
      "Hostile forces gather in the shadows...",
      "The situation grows more dangerous...", 
      "An opportunity for confrontation arises..."
    ]) ?? "Danger approaches...",
    rule_reference: `Level ${partyLevel} party vs Level ${partyLevel + (tension > 0.8 ? 2 : tension > 0.7 ? 0 : -1)} threat (GM Core p.498-500)`
  } : {};
  
  if (encounter.rule_reference) {
    ruleReferences.push(encounter.rule_reference);
  }

  // Generate summary
  const eventCount = Math.min(new_events.length, input.constraints.max_new_events);
  const summaryParts = [];
  
  if (updates.world.tension_delta) {
    const change = updates.world.tension_delta > 0 ? "rises" : "falls";
    summaryParts.push(`Tension ${change} slightly`);
  }
  
  if (eventCount > 0) {
    summaryParts.push(`${eventCount} event(s) surface`);
  }
  
  if (updates.factions.length > 0) {
    summaryParts.push("faction movement detected");
  }
  
  if (encounter.kind) {
    summaryParts.push(`${encounter.kind} encounter prepared`);
  }

  const summary = summaryParts.length > 0 
    ? summaryParts.join("; ") + "."
    : "World state remains stable.";

  return {
    summary,
    new_events: new_events.slice(0, input.constraints.max_new_events),
    updates,
    encounter,
    notes: [
      "Generated using PF2e rules from Archives of Nethys SRD",
      `Party Level: ${partyLevel}, World Tension: ${tension.toFixed(2)}`,
      "All DCs based on official level-based difficulty tables",
      "Rule references: " + (ruleReferences.length > 0 ? ruleReferences.join("; ") : "None"),
      "Safe to apply piecemeal - all changes are deltas"
    ]
  };
}

// --- Utility functions already defined above ---

// --- Stub for LLM augmentation (future enhancement) ---
async function llmAugment(plan: any, input: z.infer<typeof Input>, snapshot: any) {
  // Future: Call your internal model here (Ollama/OpenWebUI/etc.)
  // For now, return the original plan unchanged
  console.log('LLM augmentation requested but not implemented yet');
  return {};
}

function safeMergePlans(base: any, augmentation: any) {
  // Safely merge LLM suggestions with baseline plan
  const merged = structuredClone(base);
  
  // Append new events (validate they don't exceed constraints)
  if (augmentation?.new_events?.length) {
    merged.new_events = [...base.new_events, ...augmentation.new_events];
  }
  
  // Sum deltas for updates
  if (augmentation?.updates) {
    if (augmentation.updates.world) {
      if (augmentation.updates.world.tension_delta) {
        merged.updates.world.tension_delta = 
          (merged.updates.world.tension_delta ?? 0) + augmentation.updates.world.tension_delta;
      }
      // Keep time_advance from base unless augmentation provides a different one
      if (augmentation.updates.world.time_advance) {
        merged.updates.world.time_advance = augmentation.updates.world.time_advance;
      }
    }
    
    // Merge arc and faction updates
    if (augmentation.updates.arcs?.length) {
      merged.updates.arcs = [...merged.updates.arcs, ...augmentation.updates.arcs];
    }
    
    if (augmentation.updates.factions?.length) {
      merged.updates.factions = [...merged.updates.factions, ...augmentation.updates.factions];
    }
  }
  
  // Override encounter if augmentation provides one
  if (augmentation?.encounter && Object.keys(augmentation.encounter).length > 0) {
    merged.encounter = augmentation.encounter;
  }
  
  // Merge notes
  if (augmentation?.notes?.length) {
    merged.notes = [...merged.notes, ...augmentation.notes];
  }
  
  return merged;
}