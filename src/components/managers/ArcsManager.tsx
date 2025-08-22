import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import ActionBar, { type ActionDef } from "../ui/ActionBar";
import { useWorld } from "@/context/WorldContext";
import { listArcs, upsertArc, deleteArc, onArcsChange, type ArcRow } from "@/lib/arcs";

export default function ArcsManager() {
  const { worldId } = useWorld();
  const [arcs, setArcs] = useState<ArcRow[]>([]);
  const [selectedArc, setSelectedArc] = useState<ArcRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [query, setQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Load arcs on world change
  useEffect(() => {
    if (!worldId) {
      setArcs([]);
      setSelectedArc(null);
      return;
    }
    loadArcs();
  }, [worldId]);

  // Realtime subscription
  useEffect(() => {
    if (!worldId) return;
    
    const subscription = onArcsChange((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      
      // Only handle events for the current world
      if (newRow && (newRow as any).world_id !== worldId) return;
      if (oldRow && (oldRow as any).world_id !== worldId) return;
      
      switch (eventType) {
        case 'INSERT':
          if (newRow) {
            setArcs(prev => {
              const exists = prev.find(a => a.id === newRow.id);
              if (exists) return prev;
              return [newRow as ArcRow, ...prev];
            });
          }
          break;
          
        case 'UPDATE':
          if (newRow) {
            setArcs(prev => prev.map(a => a.id === newRow.id ? newRow as ArcRow : a));
          }
          break;
          
        case 'DELETE':
          if (oldRow) {
            setArcs(prev => {
              const newArcs = prev.filter(a => a.id !== oldRow.id);
              if (selectedArc?.id === oldRow.id) {
                setSelectedArc(newArcs.length > 0 ? newArcs[0] : null);
              }
              return newArcs;
            });
          }
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [worldId, selectedArc]);

  const loadArcs = async () => {
    if (!worldId) return;
    try {
      setIsLoading(true);
      const data = await listArcs(worldId);
      setArcs(data);
      if (data.length > 0) {
        setSelectedArc(data[0]);
      }
    } catch (error) {
      console.error("Failed to load arcs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers
  const handleNew = useCallback(() => {
    if (!worldId) return;
    const newArc: ArcRow = {
      id: `arc_${Date.now()}`,
      world_id: worldId,
      title: "New Story Arc",
      stage: "setup",
      goal: "",
      progress: 0,
      triggers: [],
      beats: [],
      pressure_vector: {},
      owner: ""
    };
    setArcs(prev => [newArc, ...prev]);
    setSelectedArc(newArc);
    setHasChanges(true);
  }, [worldId]);

  const handleSave = useCallback(async () => {
    if (!selectedArc || !hasChanges) return;
    
    try {
      setIsLoading(true);
      await upsertArc(selectedArc);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save arc:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedArc, hasChanges]);

  const handleDelete = useCallback(async () => {
    if (!selectedArc) return;
    if (!confirm(`Delete arc "${selectedArc.title}"? This cannot be undone.`)) return;
    
    try {
      setIsLoading(true);
      await deleteArc(selectedArc.id);
      // State will be updated via realtime subscription
    } catch (error) {
      console.error("Failed to delete arc:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedArc]);

  const handleRefresh = useCallback(() => {
    if (worldId) {
      loadArcs();
    }
  }, [worldId]);

  const handleFilter = useCallback(() => {
    setShowFilter(prev => !prev);
  }, []);

  const handleImport = useCallback(() => {
    // TODO: Implement import logic
    console.log("Import arcs - TODO");
  }, []);

  const handleExport = useCallback(() => {
    // TODO: Implement export logic
    console.log("Export arcs - TODO");
  }, []);

  // Action definitions
  const actions: ActionDef[] = [
    {
      id: "new",
      label: "New",
      tooltip: worldId ? "Create a new story arc" : "Select a world to create arcs",
      kbd: "N",
      onClick: handleNew,
      disabled: !worldId,
      variant: "primary"
    },
    {
      id: "save",
      label: "Save",
      tooltip: selectedArc ? "Save current arc" : "Select an arc to save",
      kbd: "Ctrl+S",
      onClick: handleSave,
      disabled: !selectedArc || !hasChanges
    },
    {
      id: "delete",
      label: "Delete",
      tooltip: selectedArc ? "Delete selected arc" : "Select an arc to delete",
      kbd: "Del",
      onClick: handleDelete,
      disabled: !selectedArc,
      variant: "danger"
    }
  ];

  const extraActions: ActionDef[] = [
    {
      id: "refresh",
      label: "Refresh",
      tooltip: "Refresh arcs list",
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
      tooltip: "Import arcs from file",
      onClick: handleImport
    },
    {
      id: "export",
      label: "Export",
      tooltip: "Export arcs to file",
      onClick: handleExport
    }
  ];

  const filteredArcs = arcs.filter(arc =>
    arc.title.toLowerCase().includes(query.toLowerCase()) ||
    arc.id.toLowerCase().includes(query.toLowerCase()) ||
    (arc.stage || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* ActionBar */}
      <ActionBar
        title="Story Arcs"
        scope="arcs"
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
                  placeholder="Search by name, ID, or status..." 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        {/* Arcs List */}
        <div className="w-80">
          <Card>
          <CardContent className="p-4">
            <h3 className="text-md font-medium mb-3">Story Arcs</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredArcs.map((arc) => (
                <div
                  key={arc.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedArc?.id === arc.id
                      ? "bg-indigo-600/20 border-indigo-500"
                      : "bg-slate-800 border-slate-700 hover:bg-slate-700"
                  }`}
                  onClick={() => setSelectedArc(arc)}
                >
                  <div className="font-medium">{arc.title}</div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      arc.stage === 'active' ? 'bg-green-600' :
                      arc.stage === 'paused' ? 'bg-yellow-600' :
                      'bg-gray-600'
                    }`}>
                      {arc.stage || 'setup'}
                    </span>
                    <span>Progress: {arc.progress}%</span>
                  </div>
                </div>
              ))}
              {filteredArcs.length === 0 && !worldId && (
                <div className="text-center text-slate-400 py-8">
                  Select a world to manage story arcs
                </div>
              )}
              {filteredArcs.length === 0 && worldId && (
                <div className="text-center text-slate-400 py-8">
                  No story arcs found. Create your first arc!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Arc Details */}
        <div className="flex-1">
          <Card>
          <CardContent className="p-4">
            <h3 className="text-md font-medium mb-3">Arc Details</h3>
            {selectedArc ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={selectedArc.title}
                    onChange={(e) => {
                      setSelectedArc({ ...selectedArc, title: e.target.value });
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Goal</label>
                  <textarea
                    value={selectedArc.goal || ""}
                    onChange={(e) => {
                      setSelectedArc({ ...selectedArc, goal: e.target.value });
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Stage</label>
                    <select
                      value={selectedArc.stage || "setup"}
                      onChange={(e) => {
                        setSelectedArc({ ...selectedArc, stage: e.target.value });
                        setHasChanges(true);
                      }}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                    >
                      <option value="setup">Setup</option>
                      <option value="active">Active</option>
                      <option value="climax">Climax</option>
                      <option value="resolution">Resolution</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Owner</label>
                    <input
                      type="text"
                      value={selectedArc.owner || ""}
                      onChange={(e) => {
                        setSelectedArc({ ...selectedArc, owner: e.target.value });
                        setHasChanges(true);
                      }}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                      placeholder="Character or faction"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Progress</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedArc.progress}
                    onChange={(e) => {
                      setSelectedArc({ ...selectedArc, progress: parseInt(e.target.value) });
                      setHasChanges(true);
                    }}
                    className="w-full"
                  />
                  <div className="text-sm text-slate-400 text-center">{selectedArc.progress}%</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                Select a story arc to view details
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}