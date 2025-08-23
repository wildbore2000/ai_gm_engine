import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Loader2, Wand2, Check, X } from 'lucide-react';
import { AIAdvisorService } from '../lib/advisor';
import type { AdvisorInput, AdvisorOutput } from '../types/advisor';

interface AIAdvisorProps {
  worldId: string;
  onUpdate?: () => void;
}

function AIAdvisor({ worldId, onUpdate }: AIAdvisorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [advice, setAdvice] = useState<AdvisorOutput | null>(null);
  const [appliedSections, setAppliedSections] = useState<Set<string>>(new Set());
  
  const [input, setInput] = useState<AdvisorInput>({
    world_id: worldId,
    include: {
      recent_events: 10,
      party: true,
      arcs: true,
      factions: true
    },
    ask: "Advance one tick and suggest interesting developments.",
    constraints: {
      max_new_events: 3,
      allow_updates: true,
      deterministic_only: true
    },
    seed: Math.floor(Math.random() * 10000)
  });

  const handleGetAdvice = async () => {
    setIsLoading(true);
    try {
      const result = await AIAdvisorService.getAdvice(input);
      setAdvice(result);
      setAppliedSections(new Set());
    } catch (error) {
      console.error('Failed to get advice:', error);
      alert('Failed to get advice from AI Advisor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySection = async (section: string) => {
    if (!advice) return;
    
    try {
      switch (section) {
        case 'world':
          await AIAdvisorService.applyWorldUpdate(worldId, advice.updates.world);
          break;
        case 'arcs':
          await AIAdvisorService.applyArcUpdates(advice.updates.arcs);
          break;
        case 'factions':
          await AIAdvisorService.applyFactionUpdates(advice.updates.factions);
          break;
        case 'events':
          await AIAdvisorService.applyNewEvents(worldId, advice.new_events);
          break;
      }
      
      setAppliedSections(prev => new Set([...prev, section]));
      onUpdate?.();
    } catch (error) {
      console.error(`Failed to apply ${section}:`, error);
      alert(`Failed to apply ${section} updates`);
    }
  };

  const handleApplyAll = async () => {
    if (!advice) return;
    
    try {
      await Promise.all([
        AIAdvisorService.applyWorldUpdate(worldId, advice.updates.world),
        AIAdvisorService.applyArcUpdates(advice.updates.arcs),
        AIAdvisorService.applyFactionUpdates(advice.updates.factions),
        AIAdvisorService.applyNewEvents(worldId, advice.new_events)
      ]);
      
      setAppliedSections(new Set(['world', 'arcs', 'factions', 'events']));
      onUpdate?.();
    } catch (error) {
      console.error('Failed to apply all updates:', error);
      alert('Failed to apply all updates');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            AI Advisor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ask">What should the AI focus on?</Label>
              <Textarea
                id="ask"
                value={input.ask}
                onChange={(e) => setInput(prev => ({ ...prev, ask: e.target.value }))}
                placeholder="Advance one tick and suggest interesting developments."
                rows={3}
              />
            </div>
            
            <div className="space-y-3">
              <Label>Include in snapshot:</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recent_events"
                    checked={input.include.recent_events !== undefined}
                    onCheckedChange={(checked) => 
                      setInput(prev => ({
                        ...prev,
                        include: {
                          ...prev.include,
                          recent_events: checked ? 10 : undefined
                        }
                      }))
                    }
                  />
                  <Label htmlFor="recent_events">Recent Events</Label>
                  {input.include.recent_events !== undefined && (
                    <Input
                      type="number"
                      value={input.include.recent_events}
                      onChange={(e) => 
                        setInput(prev => ({
                          ...prev,
                          include: {
                            ...prev.include,
                            recent_events: parseInt(e.target.value) || 10
                          }
                        }))
                      }
                      className="w-16 h-6"
                      min="1"
                      max="50"
                    />
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="party"
                    checked={!!input.include.party}
                    onCheckedChange={(checked) => 
                      setInput(prev => ({
                        ...prev,
                        include: { ...prev.include, party: checked === true }
                      }))
                    }
                  />
                  <Label htmlFor="party">Entities/Party</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="arcs"
                    checked={!!input.include.arcs}
                    onCheckedChange={(checked) => 
                      setInput(prev => ({
                        ...prev,
                        include: { ...prev.include, arcs: checked === true }
                      }))
                    }
                  />
                  <Label htmlFor="arcs">Story Arcs</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="factions"
                    checked={!!input.include.factions}
                    onCheckedChange={(checked) => 
                      setInput(prev => ({
                        ...prev,
                        include: { ...prev.include, factions: checked === true }
                      }))
                    }
                  />
                  <Label htmlFor="factions">Factions</Label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="max_events">Max New Events</Label>
              <Input
                id="max_events"
                type="number"
                value={input.constraints.max_new_events}
                onChange={(e) => 
                  setInput(prev => ({
                    ...prev,
                    constraints: {
                      ...prev.constraints,
                      max_new_events: parseInt(e.target.value) || 3
                    }
                  }))
                }
                min="0"
                max="10"
              />
            </div>
            
            <div>
              <Label htmlFor="seed">Random Seed</Label>
              <Input
                id="seed"
                type="number"
                value={input.seed}
                onChange={(e) => 
                  setInput(prev => ({ ...prev, seed: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
            
            <div className="flex items-end">
              <Button
                onClick={handleGetAdvice}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Get AI Advice
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {advice && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              AI Advice Preview
              <Button onClick={handleApplyAll} variant="default" size="sm">
                Apply All
              </Button>
            </CardTitle>
            <p className="text-sm text-muted-foreground">{advice.summary}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* New Events */}
            {advice.new_events.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    New Events ({advice.new_events.length})
                    {appliedSections.has('events') && <Check className="w-4 h-4 text-green-500" />}
                  </h4>
                  <Button
                    onClick={() => handleApplySection('events')}
                    disabled={appliedSections.has('events')}
                    variant="outline"
                    size="sm"
                  >
                    {appliedSections.has('events') ? 'Applied' : 'Apply Events'}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {advice.new_events.map((event, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium">{event.title || `${event.type} event`}</h5>
                          <p className="text-sm text-muted-foreground">Type: {event.type}</p>
                          <div className="mt-2 text-xs">
                            <strong>Payload:</strong> {JSON.stringify(event.payload, null, 2)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="secondary">Priority {event.priority}</Badge>
                          <div className="flex gap-1">
                            {event.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* World Updates */}
            {advice.updates.world && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    World Updates
                    {appliedSections.has('world') && <Check className="w-4 h-4 text-green-500" />}
                  </h4>
                  <Button
                    onClick={() => handleApplySection('world')}
                    disabled={appliedSections.has('world')}
                    variant="outline"
                    size="sm"
                  >
                    {appliedSections.has('world') ? 'Applied' : 'Apply World'}
                  </Button>
                </div>
                
                <Card className="p-3">
                  <div className="space-y-2 text-sm">
                    {advice.updates.world.tension_delta !== undefined && (
                      <div>
                        <strong>Tension Change:</strong> {advice.updates.world.tension_delta > 0 ? '+' : ''}{advice.updates.world.tension_delta.toFixed(3)}
                      </div>
                    )}
                    {advice.updates.world.time_advance && (
                      <div>
                        <strong>Time Advance:</strong> {advice.updates.world.time_advance}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* Arc Updates */}
            {advice.updates.arcs && advice.updates.arcs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    Arc Updates ({advice.updates.arcs.length})
                    {appliedSections.has('arcs') && <Check className="w-4 h-4 text-green-500" />}
                  </h4>
                  <Button
                    onClick={() => handleApplySection('arcs')}
                    disabled={appliedSections.has('arcs')}
                    variant="outline"
                    size="sm"
                  >
                    {appliedSections.has('arcs') ? 'Applied' : 'Apply Arcs'}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {advice.updates.arcs.map((update, index) => (
                    <Card key={index} className="p-3">
                      <div className="text-sm">
                        <strong>Arc:</strong> {update.id}<br />
                        <strong>Progress Change:</strong> {update.progress_delta > 0 ? '+' : ''}{update.progress_delta.toFixed(3)}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Faction Updates */}
            {advice.updates.factions && advice.updates.factions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    Faction Updates ({advice.updates.factions.length})
                    {appliedSections.has('factions') && <Check className="w-4 h-4 text-green-500" />}
                  </h4>
                  <Button
                    onClick={() => handleApplySection('factions')}
                    disabled={appliedSections.has('factions')}
                    variant="outline"
                    size="sm"
                  >
                    {appliedSections.has('factions') ? 'Applied' : 'Apply Factions'}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {advice.updates.factions.map((update, index) => (
                    <Card key={index} className="p-3">
                      <div className="text-sm">
                        <strong>Faction:</strong> {update.id}<br />
                        <strong>Pressure Change:</strong> {update.pressure_delta > 0 ? '+' : ''}{update.pressure_delta.toFixed(3)}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Encounter */}
            {advice.encounter && (advice.encounter.kind || advice.encounter.flavor) && (
              <div>
                <h4 className="font-semibold mb-3">Suggested Encounter</h4>
                <Card className="p-4">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {advice.encounter.kind && <Badge>{advice.encounter.kind}</Badge>}
                      {advice.encounter.difficulty && <Badge variant="secondary">{advice.encounter.difficulty}</Badge>}
                    </div>
                    {advice.encounter.flavor && <p className="text-sm italic">"{advice.encounter.flavor}"</p>}
                    {advice.encounter.seed && (
                      <p className="text-xs text-muted-foreground">
                        Seed: {advice.encounter.seed}
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* Notes */}
            {advice.notes && advice.notes.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Notes</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {advice.notes.map((note, index) => (
                    <li key={index}>• {note}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AIAdvisor;