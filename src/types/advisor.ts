export interface AdvisorInput {
  world_id: string;
  include: {
    recent_events?: number;
    party?: boolean;
    arcs?: boolean;
    factions?: boolean;
  };
  ask: string;
  constraints: {
    max_new_events?: number;
    allow_updates?: boolean;
    deterministic_only?: boolean;
  };
  seed?: number;
}

export interface AdvisorEventPayload {
  [key: string]: any;
}

export interface AdvisorNewEvent {
  type: string;
  title?: string;
  payload: AdvisorEventPayload;
  priority: number;
  tags: string[];
}

export interface AdvisorWorldUpdate {
  tension_delta?: number;
  time_advance?: string;
}

export interface AdvisorArcUpdate {
  id: string;
  progress_delta: number;
}

export interface AdvisorFactionUpdate {
  id: string;
  pressure_delta: number;
}

export interface AdvisorUpdates {
  world?: AdvisorWorldUpdate;
  arcs?: AdvisorArcUpdate[];
  factions?: AdvisorFactionUpdate[];
}

export interface AdvisorEncounter {
  seed?: string;
  kind?: string;
  difficulty?: string;
  flavor?: string;
}

export interface AdvisorOutput {
  summary: string;
  new_events: AdvisorNewEvent[];
  updates: AdvisorUpdates;
  encounter?: AdvisorEncounter;
  notes: string[];
}

export interface WorldSnapshot {
  world_id: string;
  world_data: any;
  recent_events: any[];
  entities: any[];
  factions: any[];
  arcs: any[];
}