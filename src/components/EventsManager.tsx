import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { PlusCircle, Trash2, Upload, Download, Save, Eye, Edit3 } from "lucide-react";
import { listEvents, insertEvent, onEventsChange, type EventRow } from "@/lib/events";

interface EventsManagerProps {
  worldId: string;
}

export default function EventsManager({ worldId }: EventsManagerProps) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!worldId) {
      // Clear events when no world is selected
      setEvents([]);
      setSelected(null);
      return;
    }
    // Clear events immediately when world changes to prevent stale data
    setEvents([]);
    setSelected(null);
    loadEvents();
  }, [worldId]);

  useEffect(() => {
    if (!worldId) return;
    
    const subscription = onEventsChange((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      
      // Only handle events for the current world
      if (newRow && (newRow as any).world_id !== worldId) return;
      if (oldRow && (oldRow as any).world_id !== worldId) return;
      
      switch (eventType) {
        case 'INSERT':
          if (newRow) {
            setEvents(prev => {
              const exists = prev.find(e => e.id === newRow.id);
              if (exists) return prev;
              return [newRow, ...prev];
            });
          }
          break;
          
        case 'UPDATE':
          if (newRow) {
            setEvents(prev => prev.map(e => e.id === newRow.id ? newRow : e));
          }
          break;
          
        case 'DELETE':
          if (oldRow) {
            setEvents(prev => {
              const newEvents = prev.filter(e => e.id !== oldRow.id);
              if (selected !== null && prev[selected]?.id === oldRow.id) {
                setSelected(newEvents.length > 0 ? 0 : null);
              }
              return newEvents;
            });
          }
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [worldId, selected]);


  const loadEvents = async () => {
    try {
      const rows = await listEvents(worldId);
      setEvents(rows);
      if (rows.length > 0) {
        setSelected(0);
      }
    } catch (e) {
      console.warn("Load events failed", e);
      // Clear events if loading fails (world might be deleted)
      setEvents([]);
      setSelected(null);
    }
  };

  const createQuickRumor = async () => {
    if (!worldId) {
      console.warn("Cannot create rumor: No world selected");
      return;
    }
    try {
      const rumorEvent = {
        world_id: worldId,
        type: "rumor",
        title: "New Rumor",
        payload: {
          content: "A mysterious rumor spreads through the settlement...",
          source: "tavern_gossip",
          reliability: 0.6
        },
        priority: 1,
        tags: ["quick", "rumor"]
      };
      
      const newEvent = await insertEvent(rumorEvent);
      setEvents(prev => [newEvent, ...prev]);
      setSelected(0);
    } catch (e) {
      console.error("Failed to create rumor:", e);
    }
  };

  const createQuickDialogue = async () => {
    if (!worldId) {
      console.warn("Cannot create dialogue: No world selected");
      return;
    }
    try {
      const dialogueEvent = {
        world_id: worldId,
        type: "dialogue",
        title: "New Dialogue",
        payload: {
          speaker: "npc_unknown",
          content: "I have something important to tell you...",
          mood: "concerned",
          location: "town_square"
        },
        priority: 2,
        tags: ["quick", "dialogue"]
      };
      
      const newEvent = await insertEvent(dialogueEvent);
      setEvents(prev => [newEvent, ...prev]);
      setSelected(0);
    } catch (e) {
      console.error("Failed to create dialogue:", e);
    }
  };

  const deleteEvent = (index: number) => {
    setEvents(prev => prev.filter((_, i) => i !== index));
    if (selected === index) {
      setSelected(events.length > 1 ? 0 : null);
    } else if (selected !== null && selected > index) {
      setSelected(selected - 1);
    }
  };

  const downloadEvents = () => {
    if (!worldId) {
      console.warn("Cannot download events: No world selected");
      return;
    }
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `events_${worldId || 'unknown'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const imported = JSON.parse(text);
        if (Array.isArray(imported)) {
          setEvents(imported);
        }
      } catch (err) {
        console.error("Failed to import events:", err);
      }
    });
  };

  const filtered = events.filter(event => {
    const searchText = `${event.type} ${event.title || ''} ${event.tags?.join(' ') || ''}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  });

  const currentEvent = selected !== null ? events[selected] : null;

  if (!worldId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Please select a world to view events
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Events Sidebar */}
      <div className="w-80">
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Simple Action Bar */}
            <div className="flex items-center justify-center gap-1 p-2 bg-slate-900/50 rounded-md border border-slate-700">
              <Button variant="secondary" onClick={createQuickRumor} title="Add Rumor">
                <PlusCircle className="h-4 w-4" />
              </Button>
              <Button variant="secondary" onClick={() => selected !== null && deleteEvent(selected)} disabled={selected === null} title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="secondary" onClick={() => setIsEditMode(!isEditMode)} title={isEditMode ? "View Mode" : "Edit Mode"}>
                {isEditMode ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
              </Button>
            </div>
            
            <div>
              <input 
                className="w-full rounded-md bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm" 
                placeholder="Search events..." 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
              />
            </div>
            
            <div className="grid gap-2 max-h-[420px] overflow-auto">
              {filtered.map((event, i) => (
                <div 
                  key={event.id} 
                  onClick={() => setSelected(events.findIndex(e => e.id === event.id))} 
                  className={`p-2 rounded-lg border cursor-pointer transition ${
                    selected === events.findIndex(e => e.id === event.id) 
                      ? 'border-indigo-500/70 bg-indigo-500/10 ring-1 ring-indigo-500/30' 
                      : 'border-slate-800 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{event.title || event.type}</div>
                      <div className="text-xs opacity-70">{event.type} • Priority {event.priority}</div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEvent(events.findIndex(ev => ev.id === event.id));
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Details */}
      <div style={{ flex: 1 }}>
        {currentEvent ? (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs opacity-80">Type</label>
                    <div className="text-sm font-medium p-2 bg-slate-900 rounded border">{currentEvent.type}</div>
                  </div>
                  <div>
                    <label className="text-xs opacity-80">Priority</label>
                    <div className="text-sm font-medium p-2 bg-slate-900 rounded border">{currentEvent.priority}</div>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs opacity-80">Title</label>
                  <div className="text-sm p-2 bg-slate-900 rounded border">{currentEvent.title || 'Untitled'}</div>
                </div>
                
                <div>
                  <label className="text-xs opacity-80">Tags</label>
                  <div className="text-sm p-2 bg-slate-900 rounded border">
                    {currentEvent.tags?.join(', ') || 'No tags'}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs opacity-80">Source</label>
                  <div className="text-sm p-2 bg-slate-900 rounded border">{currentEvent.source || 'Unknown'}</div>
                </div>
                
                <div>
                  <label className="text-xs opacity-80">Created At</label>
                  <div className="text-sm p-2 bg-slate-900 rounded border">
                    {new Date(currentEvent.created_at).toLocaleString()}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs opacity-80">Payload</label>
                  <pre className="text-xs p-2 bg-slate-900 rounded border overflow-auto max-h-40">
                    {JSON.stringify(currentEvent.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Select an event to view details
          </div>
        )}
      </div>
    </div>
  );
}