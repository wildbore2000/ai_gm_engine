// src/lib/story_director.ts
// Turns a (source event, outcome) into an action plan the UI can Apply.
export type Degree = "critical_success" | "success" | "failure" | "critical_failure";
export type ActionPlan = {
  new_events: Array<{
    type: string;
    title?: string;
    payload?: Record<string, any>;
    priority?: number;
    tags?: string[];
  }>;
  updates: {
    world?: { tension_delta?: number };
    arcs?: { id: string; progress_delta: number; stage_to?: string }[];
    factions?: { id: string; pressure_delta: number }[];
  };
  // Optional: spawn an encounter in your modal later
  encounter?: { seed: string; kind: string; difficulty: "low" | "moderate" | "severe" };
  // Optional: mark source as resolved
  mutate?: { source_event_id?: string; add_tags?: string[]; remove_tags?: string[] };
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/**
 * Simple recipes keyed by event type. You can expand this over time.
 * Rumor flow: SUCCESS -> lead/discovery; FAILURE -> complication/escalation.
 */
export function planFromOutcome(
  source: { id: string; type: string; title?: string; payload?: any; tags?: string[] },
  degree: Degree,
): ActionPlan {
  switch (source.type) {
    case "rumor":
      return rumorOutcome(source, degree);
    case "faction_move":
      return factionMoveOutcome(source, degree);
    default:
      // Safe default: log the result, nudge tension a hair
      return {
        new_events: [],
        updates: { world: { tension_delta: degree.includes("success") ? -0.01 : 0.01 }, arcs: [], factions: [] },
        mutate: { source_event_id: source.id, add_tags: ["resolved"] },
      };
  }
}

function rumorOutcome(source: any, degree: Degree): ActionPlan {
  const loc = source?.payload?.location ?? guessLoc(source);
  if (degree === "critical_success") {
    return {
      new_events: [
        {
          type: "discovery",
          title: `Hidden Cache at ${pretty(loc)}`,
          payload: { location: loc, note: "Marked stones reveal a stash." },
          priority: 2,
          tags: ["discovery", loc, "major"],
        },
        {
          type: "lead",
          title: "Trail of Symbols",
          payload: { location: loc, clue: "Symbols point toward the old ruins." },
          priority: 1,
          tags: ["lead", "exploration", loc],
        },
      ],
      updates: {
        world: { tension_delta: -0.05 },
        arcs: [{ id: "arc_bandit_threat", progress_delta: 0.15, stage_to: "breakthrough" }],
        factions: [],
      },
      encounter: { seed: `${loc}|scouts`, kind: "ambush", difficulty: "low" },
      mutate: { source_event_id: source.id, add_tags: ["resolved"] },
    };
  }
  if (degree === "success") {
    return {
      new_events: [
        {
          type: "lead",
          title: `Local Whispers Clarified`,
          payload: { location: loc, clue: "Blue lights = decoy bonfires near the shrine." },
          priority: 1,
          tags: ["lead", "investigation", loc],
        },
      ],
      updates: {
        world: { tension_delta: -0.03 },
        arcs: [{ id: "arc_bandit_threat", progress_delta: 0.08, stage_to: "clues" }],
        factions: [],
      },
      mutate: { source_event_id: source.id, add_tags: ["resolved"] },
    };
  }
  if (degree === "failure") {
    return {
      new_events: [
        {
          type: "complication",
          title: "False Trail Consumes Time",
          payload: { location: loc, cost: "time", note: "Tracks double back into brambles." },
          priority: 1,
          tags: ["complication", loc],
        },
      ],
      updates: {
        world: { tension_delta: 0.03 },
        arcs: [{ id: "arc_bandit_threat", progress_delta: 0.0 }],
        factions: [],
      },
      mutate: { source_event_id: source.id, add_tags: ["stale"] },
    };
  }
  // critical_failure
  return {
    new_events: [
      {
        type: "faction_move",
        title: "Bandit Scouts Spotted",
        payload: { faction_id: "f_bandits", location: loc, note: "You were observed while searching." },
        priority: 2,
        tags: ["faction", "escalation", loc],
      },
    ],
    updates: {
      world: { tension_delta: 0.06 },
      arcs: [{ id: "arc_bandit_threat", progress_delta: -0.03, stage_to: "setbacks" }],
      factions: [{ id: "f_bandits", pressure_delta: 0.04 }],
    },
    mutate: { source_event_id: source.id, add_tags: ["complication"] },
  };
}

function factionMoveOutcome(source: any, degree: Degree): ActionPlan {
  const f = source?.payload?.faction_id ?? "f_bandits";
  if (degree.includes("success")) {
    return {
      new_events: [
        { type: "report", title: "Pressure Eased", payload: { faction_id: f }, priority: 1, tags: ["faction"] },
      ],
      updates: { world: { tension_delta: -0.02 }, arcs: [], factions: [{ id: f, pressure_delta: degree === "critical_success" ? -0.06 : -0.03 }] },
      mutate: { source_event_id: source.id, add_tags: ["blunted"] },
    };
  }
  return {
    new_events: [
      { type: "warning", title: "Retaliation Brewing", payload: { faction_id: f }, priority: 1, tags: ["faction", "escalation"] },
    ],
    updates: { world: { tension_delta: 0.02 }, arcs: [], factions: [{ id: f, pressure_delta: degree === "critical_failure" ? 0.04 : 0.02 }] },
    mutate: { source_event_id: source.id, add_tags: ["escalated"] },
  };
}

function guessLoc(ev: any) {
  const t: string[] = ev?.tags ?? [];
  return t.find((x) => !["rumor", "investigation", "skill"].includes(x)) ?? "wilderness";
}
const pretty = (s: string) => (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
