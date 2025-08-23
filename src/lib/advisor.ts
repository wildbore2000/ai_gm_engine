import { supabase } from './supabase';
import type { AdvisorInput, AdvisorOutput, WorldSnapshot } from '../types/advisor';

export class AIAdvisorService {
  static async getAdvice(input: AdvisorInput): Promise<AdvisorOutput> {
    const { data, error } = await supabase.functions.invoke('ai_recommend', {
      body: input
    });

    if (error) {
      throw new Error(`AI Recommend error: ${error.message}`);
    }

    if (data.error) {
      throw new Error(`AI Recommend error: ${data.error}${data.details ? ` - ${JSON.stringify(data.details)}` : ''}`);
    }

    return data as AdvisorOutput;
  }

  static async createWorldSnapshot(worldId: string, include: AdvisorInput['include']): Promise<WorldSnapshot> {
    const snapshot: WorldSnapshot = {
      world_id: worldId,
      world_data: {},
      recent_events: [],
      entities: [],
      factions: [],
      arcs: []
    };

    // Fetch world data
    const { data: worldData, error: worldError } = await supabase
      .from('worlds')
      .select('*')
      .eq('id', worldId)
      .single();

    if (worldError) {
      throw new Error(`Failed to fetch world data: ${worldError.message}`);
    }

    snapshot.world_data = worldData;

    // Fetch recent events if requested
    if (include.recent_events) {
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('world_id', worldId)
        .order('created_at', { ascending: false })
        .limit(include.recent_events);

      if (eventsError) {
        console.warn('Failed to fetch events:', eventsError.message);
      } else {
        snapshot.recent_events = events || [];
      }
    }

    // Fetch entities if party is requested
    if (include.party) {
      const { data: entities, error: entitiesError } = await supabase
        .from('entities')
        .select('*')
        .eq('world_id', worldId);

      if (entitiesError) {
        console.warn('Failed to fetch entities:', entitiesError.message);
      } else {
        snapshot.entities = entities || [];
      }
    }

    // Fetch factions if requested
    if (include.factions) {
      const { data: factions, error: factionsError } = await supabase
        .from('factions')
        .select('*')
        .eq('world_id', worldId);

      if (factionsError) {
        console.warn('Failed to fetch factions:', factionsError.message);
      } else {
        snapshot.factions = factions || [];
      }
    }

    // Fetch arcs if requested
    if (include.arcs) {
      const { data: arcs, error: arcsError } = await supabase
        .from('arcs')
        .select('*')
        .eq('world_id', worldId);

      if (arcsError) {
        console.warn('Failed to fetch arcs:', arcsError.message);
      } else {
        snapshot.arcs = arcs || [];
      }
    }

    return snapshot;
  }

  static async applyWorldUpdate(worldId: string, update: AdvisorOutput['updates']['world']): Promise<void> {
    if (!update) return;

    const updates: any = {};

    if (update.tension_delta !== undefined) {
      // Get current tension
      const { data: currentWorld } = await supabase
        .from('worlds')
        .select('tension')
        .eq('id', worldId)
        .single();

      if (currentWorld) {
        updates.tension = Math.max(0, Math.min(1, (currentWorld.tension || 0.5) + update.tension_delta));
      }
    }

    // NOTE: time_advance is handled server-side via RPC once a real timestamptz column exists.

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('worlds')
        .update(updates)
        .eq('id', worldId);

      if (error) {
        throw new Error(`Failed to update world: ${error.message}`);
      }
    }
  }

  static async applyArcUpdates(arcUpdates: AdvisorOutput['updates']['arcs']): Promise<void> {
    if (!arcUpdates || arcUpdates.length === 0) return;

    for (const update of arcUpdates) {
      // Get current progress
      const { data: currentArc } = await supabase
        .from('arcs')
        .select('progress')
        .eq('id', update.id)
        .single();

      if (currentArc) {
        const newProgress = Math.max(0, Math.min(1, (currentArc.progress || 0) + update.progress_delta));
        
        const { error } = await supabase
          .from('arcs')
          .update({ progress: newProgress })
          .eq('id', update.id);

        if (error) {
          console.error(`Failed to update arc ${update.id}:`, error.message);
        }
      }
    }
  }

  static async applyFactionUpdates(factionUpdates: AdvisorOutput['updates']['factions']): Promise<void> {
    if (!factionUpdates || factionUpdates.length === 0) return;

    for (const update of factionUpdates) {
      // Get current pressure
      const { data: currentFaction } = await supabase
        .from('factions')
        .select('pressure')
        .eq('id', update.id)
        .single();

      if (currentFaction) {
        const newPressure = Math.max(0, Math.min(1, (currentFaction.pressure || 0.5) + update.pressure_delta));
        
        const { error } = await supabase
          .from('factions')
          .update({ pressure: newPressure })
          .eq('id', update.id);

        if (error) {
          console.error(`Failed to update faction ${update.id}:`, error.message);
        }
      }
    }
  }

  static async applyNewEvents(worldId: string, events: AdvisorOutput['new_events']): Promise<void> {
    if (!events || events.length === 0) return;

    const eventsToInsert = events.map(event => ({
      world_id: worldId,
      type: event.type,
      title: event.title,
      payload: event.payload,
      priority: event.priority,
      tags: event.tags,
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('events')
      .insert(eventsToInsert);

    if (error) {
      throw new Error(`Failed to insert events: ${error.message}`);
    }
  }
}