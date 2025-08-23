import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useWorld } from "../context/WorldContext";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Loader2, Wand2, Check, AlertCircle } from "lucide-react";

interface AdvisorResult {
  summary: string;
  new_events: Array<{
    type: string;
    title?: string;
    payload: any;
    priority: number;
    tags: string[];
  }>;
  updates: {
    world?: {
      tension_delta?: number;
      time_advance?: string;
    };
    arcs?: Array<{
      id: string;
      progress_delta: number;
    }>;
    factions?: Array<{
      id: string;
      pressure_delta: number;
    }>;
  };
  encounter?: {
    seed?: string;
    kind?: string;
    difficulty?: string;
    flavor?: string;
    enemy_level?: number;
    rule_reference?: string;
  };
  notes: string[];
}

interface AIAdvisorPanelProps {
  worldId: string;
  onUpdate?: () => void;
}

export default function AIAdvisorPanel({ worldId, onUpdate }: AIAdvisorPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [deterministicOnly, setDeterministicOnly] = useState(true);
  const [appliedSections, setAppliedSections] = useState<Set<string>>(new Set());
  const [ask, setAsk] = useState("Advance one tick and surface a local hook.");

  const handleAskAI = useCallback(async () => {
    if (!worldId) return;
    setLoading(true);
    setResult(null);
    setAppliedSections(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("ai_recommend", {
        body: {
          world_id: worldId,
          include: { recent_events: 10, party: true, arcs: true, factions: true },
          ask: ask,
          constraints: { 
            max_new_events: 3, 
            allow_updates: true, 
            deterministic_only: deterministicOnly 
          },
          seed: Date.now() % 10000
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
    } catch (error: any) {
      console.error('AI Advisor error:', error);
      alert(`AI Advisor error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [worldId, ask, deterministicOnly]);

  const handleApplyEvents = useCallback(async () => {
    if (!worldId || !result?.new_events?.length) return;

    try {
      const rows = result.new_events.map((e) => ({
        world_id: worldId,
        type: e.type,
        title: e.title || null,
        payload: e.payload || {},
        priority: e.priority || 1,
        tags: e.tags || [],
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase.from("events").insert(rows);
      if (error) throw error;

      setAppliedSections(prev => new Set([...prev, 'events']));
      onUpdate?.();
    } catch (error: any) {
      console.error('Apply events error:', error);
      alert(`Failed to apply events: ${error.message}`);
    }
  }, [worldId, result, onUpdate]);

  const handleApplyWorldUpdates = useCallback(async () => {
    if (!worldId || !result?.updates?.world) return;

    try {
      const { world } = result.updates;
      
      const { error } = await supabase.rpc('apply_world_deltas', {
        p_world_id: worldId,
        p_tension_delta: world.tension_delta || 0,
        p_time_advance: world.time_advance || null
      });

      if (error) throw error;

      setAppliedSections(prev => new Set([...prev, 'world']));
      onUpdate?.();
    } catch (error: any) {
      console.error('Apply world updates error:', error);
      alert(`Failed to apply world updates: ${error.message}`);
    }
  }, [worldId, result, onUpdate]);

  const handleApplyArcUpdates = useCallback(async () => {
    if (!worldId || !result?.updates?.arcs?.length) return;

    try {
      const { error } = await supabase.rpc('apply_arc_progress_deltas', {
        p_updates: result.updates.arcs
      });

      if (error) throw error;

      setAppliedSections(prev => new Set([...prev, 'arcs']));
      onUpdate?.();
    } catch (error: any) {
      console.error('Apply arc updates error:', error);
      alert(`Failed to apply arc updates: ${error.message}`);
    }
  }, [worldId, result, onUpdate]);

  const handleApplyFactionUpdates = useCallback(async () => {
    if (!worldId || !result?.updates?.factions?.length) return;

    try {
      const { error } = await supabase.rpc('apply_faction_pressure_deltas', {
        p_updates: result.updates.factions
      });

      if (error) throw error;

      setAppliedSections(prev => new Set([...prev, 'factions']));
      onUpdate?.();
    } catch (error: any) {
      console.error('Apply faction updates error:', error);
      alert(`Failed to apply faction updates: ${error.message}`);
    }
  }, [worldId, result, onUpdate]);

  const handleApplyAll = useCallback(async () => {
    await Promise.all([
      handleApplyEvents(),
      handleApplyWorldUpdates(),
      handleApplyArcUpdates(),
      handleApplyFactionUpdates()
    ]);
  }, [handleApplyEvents, handleApplyWorldUpdates, handleApplyArcUpdates, handleApplyFactionUpdates]);

  return (
    <Card className="p-4 bg-slate-900/40 border-slate-700">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            <span className="font-medium text-slate-200">AI Advisor</span>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input 
              type="checkbox" 
              checked={deterministicOnly} 
              onChange={e => setDeterministicOnly(e.target.checked)}
              className="rounded"
            />
            Deterministic only
          </label>
        </div>

        {/* Ask Input */}
        <div className="space-y-2">
          <textarea
            value={ask}
            onChange={e => setAsk(e.target.value)}
            placeholder="What should the AI focus on?"
            className="w-full p-2 text-sm bg-slate-800 border border-slate-600 rounded resize-none"
            rows={2}
          />
          <Button 
            onClick={handleAskAI}
            disabled={!worldId || loading}
            className="w-full"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Thinking...
              </>
            ) : (
              "Ask AI"
            )}
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="p-3 bg-slate-800/50 rounded border border-slate-600">
              <div className="text-sm text-slate-300">{result.summary}</div>
            </div>

            {/* New Events */}
            {result.new_events && result.new_events.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      New Events ({result.new_events.length})
                    </span>
                    {appliedSections.has('events') && <Check className="w-3 h-3 text-green-400" />}
                  </div>
                  <Button
                    onClick={handleApplyEvents}
                    disabled={appliedSections.has('events')}
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 py-1 h-6"
                  >
                    {appliedSections.has('events') ? 'Applied' : 'Apply Events'}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {result.new_events.map((event, index) => (
                    <div key={index} className="p-2 bg-slate-800 border border-slate-700 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-200">
                          {event.title || event.type}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          P{event.priority}
                        </Badge>
                      </div>
                      {event.payload?.content && (
                        <div className="text-xs text-slate-400 mb-1">{event.payload.content}</div>
                      )}
                      
                      {/* PF2e Skill Challenge */}
                      {event.payload?.investigation && (
                        <div className="mt-2 p-2 bg-slate-700 rounded text-xs border-l-2 border-blue-400">
                          <div className="font-semibold text-blue-300">Investigation</div>
                          <div className="text-slate-200">DC {event.payload.investigation.dc} {event.payload.investigation.skill}</div>
                          <div className="text-slate-400 text-[10px] mt-1">{event.payload.investigation.rule_reference}</div>
                        </div>
                      )}
                      
                      {/* PF2e Challenge */}
                      {event.payload?.challenge && (
                        <div className="mt-2 p-2 bg-slate-700 rounded text-xs border-l-2 border-purple-400">
                          <div className="font-semibold text-purple-300">Challenge</div>
                          <div className="text-slate-200">DC {event.payload.challenge.dc} {event.payload.challenge.skill}</div>
                          <div className="text-slate-300 text-[10px]">{event.payload.challenge.description}</div>
                          <div className="text-slate-400 text-[10px] mt-1">{event.payload.challenge.rule_reference}</div>
                        </div>
                      )}
                      
                      {/* Conditions */}
                      {event.payload?.potential_conditions && event.payload.potential_conditions.length > 0 && (
                        <div className="mt-2">
                          <div className="text-[10px] text-slate-400 mb-1">Potential Conditions:</div>
                          <div className="flex gap-1 flex-wrap">
                            {event.payload.potential_conditions.map((condition: string) => (
                              <span key={condition} className="text-[9px] px-1 py-0.5 bg-red-800 text-red-200 rounded">
                                {condition}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {event.tags && event.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {event.tags.map(tag => (
                            <span key={tag} className="text-[10px] text-slate-500">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* World Updates */}
            {result.updates?.world && Object.keys(result.updates.world).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      World Updates
                    </span>
                    {appliedSections.has('world') && <Check className="w-3 h-3 text-green-400" />}
                  </div>
                  <Button
                    onClick={handleApplyWorldUpdates}
                    disabled={appliedSections.has('world')}
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 py-1 h-6"
                  >
                    {appliedSections.has('world') ? 'Applied' : 'Apply World'}
                  </Button>
                </div>
                
                <div className="p-2 bg-slate-800 border border-slate-700 rounded">
                  <div className="text-xs space-y-1">
                    {result.updates.world.tension_delta !== undefined && (
                      <div>
                        <strong>Tension:</strong> {result.updates.world.tension_delta > 0 ? '+' : ''}{result.updates.world.tension_delta.toFixed(3)}
                      </div>
                    )}
                    {result.updates.world.time_advance && (
                      <div>
                        <strong>Time:</strong> +{result.updates.world.time_advance}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Arc Updates */}
            {result.updates?.arcs && result.updates.arcs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      Arc Updates ({result.updates.arcs.length})
                    </span>
                    {appliedSections.has('arcs') && <Check className="w-3 h-3 text-green-400" />}
                  </div>
                  <Button
                    onClick={handleApplyArcUpdates}
                    disabled={appliedSections.has('arcs')}
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 py-1 h-6"
                  >
                    {appliedSections.has('arcs') ? 'Applied' : 'Apply Arcs'}
                  </Button>
                </div>
                
                <div className="space-y-1">
                  {result.updates.arcs.map((update, index) => (
                    <div key={index} className="p-2 bg-slate-800 border border-slate-700 rounded">
                      <div className="text-xs">
                        <strong>{update.id}:</strong> {update.progress_delta > 0 ? '+' : ''}{update.progress_delta.toFixed(3)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Faction Updates */}
            {result.updates?.factions && result.updates.factions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      Faction Updates ({result.updates.factions.length})
                    </span>
                    {appliedSections.has('factions') && <Check className="w-3 h-3 text-green-400" />}
                  </div>
                  <Button
                    onClick={handleApplyFactionUpdates}
                    disabled={appliedSections.has('factions')}
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 py-1 h-6"
                  >
                    {appliedSections.has('factions') ? 'Applied' : 'Apply Factions'}
                  </Button>
                </div>
                
                <div className="space-y-1">
                  {result.updates.factions.map((update, index) => (
                    <div key={index} className="p-2 bg-slate-800 border border-slate-700 rounded">
                      <div className="text-xs">
                        <strong>{update.id}:</strong> {update.pressure_delta > 0 ? '+' : ''}{update.pressure_delta.toFixed(3)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Encounter */}
            {result.encounter && (result.encounter.kind || result.encounter.flavor) && (
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Encounter Suggestion
                </span>
                <div className="p-2 bg-slate-800 border border-slate-700 rounded">
                  <div className="space-y-1">
                    <div className="flex gap-2 flex-wrap">
                      {result.encounter.kind && <Badge className="text-xs">{result.encounter.kind}</Badge>}
                      {result.encounter.difficulty && <Badge variant="secondary" className="text-xs">{result.encounter.difficulty}</Badge>}
                      {result.encounter.enemy_level && <Badge variant="outline" className="text-xs">Level {result.encounter.enemy_level}</Badge>}
                    </div>
                    {result.encounter.flavor && (
                      <div className="text-xs text-slate-300 italic">"{result.encounter.flavor}"</div>
                    )}
                    {result.encounter.rule_reference && (
                      <div className="text-xs text-slate-400 mt-1 border-t border-slate-700 pt-1">
                        <span className="font-medium">Rule:</span> {result.encounter.rule_reference}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Apply All Button */}
            <Button
              onClick={handleApplyAll}
              className="w-full"
              size="sm"
              disabled={appliedSections.size === 4} // All sections applied
            >
              {appliedSections.size === 4 ? 'All Applied' : 'Apply All Changes'}
            </Button>

            {/* Notes */}
            {result.notes && result.notes.length > 0 && (
              <div className="text-xs text-slate-500 space-y-1">
                {result.notes.map((note, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {note}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}