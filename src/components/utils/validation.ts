import React, { useRef, useState } from "react";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

// --- SRD-light JSON Schemas (mirror of the design doc) ---
const entitySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "schema/entity.json",
  title: "Entity",
  type: "object",
  required: ["id", "name", "tags", "srd", "personality", "status"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    srd: {
      type: "object",
      required: ["level", "ancestry", "role", "stats", "hp", "ac"],
      properties: {
        level: { type: "integer" },
        ancestry: { type: "string" },
        role: { type: "string" },
        alignment: { type: "string" },
        stats: {
          type: "object",
          required: ["str", "dex", "con", "int", "wis", "cha"],
          properties: {
            str: { type: "integer" },
            dex: { type: "integer" },
            con: { type: "integer" },
            int: { type: "integer" },
            wis: { type: "integer" },
            cha: { type: "integer" }
          }
        },
        hp: { type: "integer" },
        ac: { type: "integer" },
        saves: {
          type: "object",
          properties: {
            fortitude: { type: "integer" },
            reflex: { type: "integer" },
            will: { type: "integer" }
          }
        },
        skills: { type: "object", additionalProperties: { type: "integer" } },
        abilities: { type: "array", items: { type: "string" } },
        inventory: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, type: { type: "string" }, qty: { type: "integer" } }
          }
        }
      }
    },
    personality: {
      type: "object",
      properties: {
        temperament: { type: "string" },
        ideals: { type: "array", items: { type: "string" } },
        fears: { type: "array", items: { type: "string" } },
        motivations: { type: "array", items: { type: "string" } },
        flaws: { type: "array", items: { type: "string" } }
      }
    },
    relationships: { type: "object", additionalProperties: { type: "string" } },
    memory: { type: "array", items: { type: "string" } },
    status: {
      type: "object",
      required: ["location", "faction", "mood"],
      properties: {
        location: { type: "string" },
        faction: { type: "string" },
        mood: { type: "string" },
        current_task: { type: "string" },
        flags: { type: "array", items: { type: "string" } }
      }
    },
    custom: { type: "object" }
  }
};

const factionSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "schema/faction.json",
  title: "Faction",
  type: "object",
  required: ["id", "name", "goals", "resources", "relations"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    ideology: { type: "string" },
    goals: { type: "array", items: { type: "string" } },
    pressure: { type: "number", minimum: 0, maximum: 1 },
    stability: { type: "number", minimum: 0, maximum: 1 },
    resources: { type: "object", additionalProperties: { type: "integer" } },
    relations: { type: "object", additionalProperties: { type: "integer" } },
    leaders: { type: "array", items: { type: "string" } },
    custom: { type: "object" }
  }
};

const worldSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "schema/worldstate.json",
  title: "WorldState",
  type: "object",
  required: ["time", "weather", "locations", "factions", "events", "history_log"],
  properties: {
    time: { type: "string" },
    weather: { type: "string" },
    locations: { type: "array", items: { type: "string" } },
    factions: { type: "object" },
    events: { type: "array", items: { type: "string" } },
    history_log: { type: "array", items: { type: "string" } },
    tension: { type: "number", minimum: 0, maximum: 1 },
    custom: { type: "object" }
  }
};

const arcSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "schema/arc.json",
  title: "Arc",
  type: "object",
  required: ["id", "title", "stage", "goal", "progress", "triggers"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    stage: { type: "string" },
    goal: { type: "string" },
    progress: { type: "number", minimum: 0, maximum: 1 },
    triggers: { type: "array", items: { type: "string" } },
    beats: { type: "array", items: { type: "string" } },
    pressure_vector: { type: "object" },
    owner: { type: "string" },
    custom: { type: "object" }
  }
};

const gameEventSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "schema/gameevent.json",
  title: "GameEvent",
  type: "object",
  required: ["id", "type", "title", "payload", "priority"],
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: ["spawn", "dialogue", "modify", "rumor", "quest", "environment"] },
    title: { type: "string" },
    payload: { type: "object" },
    priority: { type: "integer" },
    expires_at: { type: "string" },
    source: { type: "string" },
    tags: { type: "array", items: { type: "string" } }
  }
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
export const validateEntity = ajv.compile(entitySchema as any);
export const validateFaction = ajv.compile(factionSchema as any);
export const validateWorld = ajv.compile(worldSchema as any);
export const validateArc = ajv.compile(arcSchema as any);
export const validateEvent = ajv.compile(gameEventSchema as any);

export function download(filename: string, data: object) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useJsonEditor<T>(initial: T, validate: (d: any) => boolean) {
  const [raw, setRaw] = useState<string>(() => JSON.stringify(initial, null, 2));
  const [parsed, setParsed] = useState<T>(initial);
  const [errors, setErrors] = useState<string[]>([]);

  const parse = (text: string) => {
    setRaw(text);
    try {
      const obj = JSON.parse(text);
      const ok = validate(obj);
      if (!ok) {
        const ajvErrors = (validate as any).errors || [];
        setErrors(ajvErrors.map((e: any) => `${e.instancePath || "/"} ${e.message}`));
      } else {
        setErrors([]);
        setParsed(obj);
      }
    } catch (e: any) {
      setErrors([e.message]);
    }
  };

  const uploadRef = useRef<HTMLInputElement>(null);
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => parse(t));
  };

  return { raw, setRaw: parse, parsed, errors, uploadRef, onUpload };
}