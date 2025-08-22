import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Eye, Edit3 } from "lucide-react";
import { listEvents, insertEvent, deleteEvent, onEventsChangeForWorld, type EventRow } from "@/lib/events";
import { useWorld } from "../context/WorldContext";
import ActionBar, { type ActionDef } from "./ui/ActionBar";

interface EventsManagerProps {
  worldId?: string;
}

export default function EventsManager({ worldId: propWorldId }: EventsManagerProps) {
  const { worldId: contextWorldId } = useWorld();
  const worldId = propWorldId || contextWorldId;
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
    
    const subscription = onEventsChangeForWorld(worldId, (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      
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


  const loadEvents = useCallback(async () => {
    if (!worldId) return;
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }, [worldId]);

  const createQuickRumor = async () => {
    if (!worldId) {
      console.warn("Cannot create rumor: No world selected");
      return;
    }
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const createQuickDialogue = async () => {
    if (!worldId) {
      console.warn("Cannot create dialogue: No world selected");
      return;
    }
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEvent = async (index: number) => {
    const event = events[index];
    if (!event) return;
    
    try {
      setIsLoading(true);
      await deleteEvent(event.id);
      // State will sync via realtime subscription
      if (selected === index) {
        setSelected(events.length > 1 ? 0 : null);
      } else if (selected !== null && selected > index) {
        setSelected(selected - 1);
      }
    } catch (e) {
      console.error("Failed to delete event:", e);
    } finally {
      setIsLoading(false);
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

  // Additional handlers for ActionBar
  const handleNew = useCallback(() => {
    createQuickRumor();
  }, [createQuickRumor]);

  const handleSave = useCallback(() => {
    // TODO: Implement save logic for current event
    console.log("Save current event - TODO");
  }, []);

  const handleDelete = useCallback(async () => {
    if (selected !== null) {
      await handleDeleteEvent(selected);
    }
  }, [selected, handleDeleteEvent]);

  const handleRefresh = useCallback(() => {
    if (worldId) {
      loadEvents();
    }
  }, [worldId, loadEvents]);

  const handleFilter = useCallback(() => {
    setShowFilter(prev => !prev);
  }, []);

  const handleImportClick = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleExport = useCallback(() => {
    downloadEvents();
  }, [downloadEvents]);

  const filtered = events.filter(event => {
    const searchText = `${event.type} ${event.title || ''} ${event.tags?.join(' ') || ''}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  });

  const currentEvent = selected !== null ? events[selected] : null;

  // Action definitions
  const actions: ActionDef[] = [
    {
      id: "new",
      label: "New",
      tooltip: worldId ? "Create a new event" : "Select a world to create events",
      kbd: "N",
      onClick: handleNew,
      disabled: !worldId,
      variant: "primary"
    },
    {
      id: "save",
      label: "Save",
      tooltip: currentEvent ? "Save current event" : "Select an event to save",
      kbd: "Ctrl+S",
      onClick: handleSave,
      disabled: !currentEvent
    },
    {
      id: "delete",
      label: "Delete",
      tooltip: currentEvent ? "Delete selected event" : "Select an event to delete",
      kbd: "Del",
      onClick: handleDelete,
      disabled: !currentEvent,
      variant: "danger"
    }
  ];

  const extraActions: ActionDef[] = [
    {
      id: "refresh",
      label: "Refresh",
      tooltip: "Refresh events list",
      kbd: "R",
      onClick: handleRefresh
    },
    {
      id: "filter",
      label: "Filter",
      tooltip: "Toggle filter panel",
      kbd: "F",
      onClick: handleFilter,
      variant: showFilter ? "primary" : "ghost"
    },
    {
      id: "import",
      label: "Import",
      tooltip: "Import events from file",
      onClick: handleImportClick
    },
    {
      id: "export",
      label: "Export",
      tooltip: "Export events to file",
      onClick: handleExport
    }
  ];

  if (!worldId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Please select a world to view events
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ActionBar */}
      <ActionBar
        title="Events"
        scope="events"
        actions={actions}
        extraActions={extraActions}
        busy={isLoading}
      />

      {/* Filter Panel */}
      {showFilter && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Filter Options</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Search</label>
                <input 
                  className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-sm" 
                  placeholder="Search events..." 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={onImport}
      />

      <div className="flex gap-4">
        {/* Events Sidebar */}
        <div className="w-80">
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Edit Mode Toggle */}
              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => setIsEditMode(!isEditMode)} title={isEditMode ? "View Mode" : "Edit Mode"}>
                  {isEditMode ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                  <span className="ml-2">{isEditMode ? "View Mode" : "Edit Mode"}</span>
                </Button>
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
                  <div className="flex-1">
                    <div className="text-sm font-medium">{event.title || event.type}</div>
                    <div className="text-xs opacity-70">{event.type} • Priority {event.priority}</div>
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
    </div>
  );
}