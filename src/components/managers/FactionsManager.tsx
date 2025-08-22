import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import ActionBar, { type ActionDef } from "../ui/ActionBar";
import { useWorld } from "@/context/WorldContext";
import { listFactions, upsertFaction, deleteFaction, onFactionsChange, type FactionRow } from "@/lib/factions";

export default function FactionsManager() {
  const { worldId } = useWorld();
  const [factions, setFactions] = useState<FactionRow[]>([]);
  const [selectedFaction, setSelectedFaction] = useState<FactionRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [query, setQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Load factions on world change
  useEffect(() => {
    if (!worldId) {
      setFactions([]);
      setSelectedFaction(null);
      return;
    }
    loadFactions();
  }, [worldId]);

  // Realtime subscription
  useEffect(() => {
    if (!worldId) return;
    
    const subscription = onFactionsChange((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      
      // Only handle events for the current world
      if (newRow && (newRow as any).world_id !== worldId) return;
      if (oldRow && (oldRow as any).world_id !== worldId) return;
      
      switch (eventType) {
        case 'INSERT':
          if (newRow) {
            setFactions(prev => {
              const exists = prev.find(f => f.id === newRow.id);
              if (exists) return prev;
              return [newRow as FactionRow, ...prev];
            });
          }
          break;
          
        case 'UPDATE':
          if (newRow) {
            setFactions(prev => prev.map(f => f.id === newRow.id ? newRow as FactionRow : f));
          }
          break;
          
        case 'DELETE':
          if (oldRow) {
            setFactions(prev => {
              const newFactions = prev.filter(f => f.id !== oldRow.id);
              if (selectedFaction?.id === oldRow.id) {
                setSelectedFaction(newFactions.length > 0 ? newFactions[0] : null);
              }
              return newFactions;
            });
          }
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [worldId, selectedFaction]);

  const loadFactions = async () => {
    if (!worldId) return;
    try {
      setIsLoading(true);
      const data = await listFactions(worldId);
      setFactions(data);
      if (data.length > 0) {
        setSelectedFaction(data[0]);
      }
    } catch (error) {
      console.error("Failed to load factions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers
  const handleNew = useCallback(() => {
    if (!worldId) return;
    const newFaction: FactionRow = {
      id: `faction_${Date.now()}`,
      world_id: worldId,
      name: "New Faction",
      tags: [],
      ideology: "",
      goals: [],
      pressure: 0,
      stability: 50,
      resources: {},
      relations: {},
      leaders: []
    };
    setFactions(prev => [newFaction, ...prev]);
    setSelectedFaction(newFaction);
    setHasChanges(true);
  }, [worldId]);

  const handleSave = useCallback(async () => {
    if (!selectedFaction || !hasChanges) return;
    
    try {
      setIsLoading(true);
      await upsertFaction(selectedFaction);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save faction:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFaction, hasChanges]);

  const handleDelete = useCallback(async () => {
    if (!selectedFaction) return;
    if (!confirm(`Delete faction "${selectedFaction.name}"? This cannot be undone.`)) return;
    
    try {
      setIsLoading(true);
      await deleteFaction(selectedFaction.id);
      // State will be updated via realtime subscription
    } catch (error) {
      console.error("Failed to delete faction:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFaction]);

  const handleRefresh = useCallback(() => {
    if (worldId) {
      loadFactions();
    }
  }, [worldId]);

  const handleFilter = useCallback(() => {
    setShowFilter(prev => !prev);
  }, []);

  const handleImport = useCallback(() => {
    // TODO: Implement import logic
    console.log("Import factions - TODO");
  }, []);

  const handleExport = useCallback(() => {
    // TODO: Implement export logic
    console.log("Export factions - TODO");
  }, []);

  // Action definitions
  const actions: ActionDef[] = [
    {
      id: "new",
      label: "New",
      tooltip: worldId ? "Create a new faction" : "Select a world to create factions",
      kbd: "N",
      onClick: handleNew,
      disabled: !worldId,
      variant: "primary"
    },
    {
      id: "save",
      label: "Save",
      tooltip: selectedFaction ? "Save current faction" : "Select a faction to save",
      kbd: "Ctrl+S",
      onClick: handleSave,
      disabled: !selectedFaction || !hasChanges
    },
    {
      id: "delete",
      label: "Delete",
      tooltip: selectedFaction ? "Delete selected faction" : "Select a faction to delete",
      kbd: "Del",
      onClick: handleDelete,
      disabled: !selectedFaction,
      variant: "danger"
    }
  ];

  const extraActions: ActionDef[] = [
    {
      id: "refresh",
      label: "Refresh",
      tooltip: "Refresh factions list",
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
      tooltip: "Import factions from file",
      onClick: handleImport
    },
    {
      id: "export",
      label: "Export",
      tooltip: "Export factions to file",
      onClick: handleExport
    }
  ];

  const filteredFactions = factions.filter(faction =>
    faction.name.toLowerCase().includes(query.toLowerCase()) ||
    faction.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* ActionBar */}
      <ActionBar
        title="Factions"
        scope="factions"
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
                  placeholder="Search by name or ID..." 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        {/* Factions List */}
        <div className="w-80">
          <Card>
          <CardContent className="p-4">
            <h3 className="text-md font-medium mb-3">Factions</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredFactions.map((faction) => (
                <div
                  key={faction.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedFaction?.id === faction.id
                      ? "bg-indigo-600/20 border-indigo-500"
                      : "bg-slate-800 border-slate-700 hover:bg-slate-700"
                  }`}
                  onClick={() => setSelectedFaction(faction)}
                >
                  <div className="font-medium">{faction.name}</div>
                  <div className="text-sm text-slate-400">Stability: {faction.stability}%</div>
                </div>
              ))}
              {filteredFactions.length === 0 && !worldId && (
                <div className="text-center text-slate-400 py-8">
                  Select a world to manage factions
                </div>
              )}
              {filteredFactions.length === 0 && worldId && (
                <div className="text-center text-slate-400 py-8">
                  No factions found. Create your first faction!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Faction Details */}
        <div className="flex-1">
          <Card>
          <CardContent className="p-4">
            <h3 className="text-md font-medium mb-3">Faction Details</h3>
            {selectedFaction ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={selectedFaction.name}
                    onChange={(e) => {
                      setSelectedFaction({ ...selectedFaction, name: e.target.value });
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Ideology</label>
                  <textarea
                    value={selectedFaction.ideology || ""}
                    onChange={(e) => {
                      setSelectedFaction({ ...selectedFaction, ideology: e.target.value });
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                    rows={2}
                    placeholder="Core beliefs and values"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Stability</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedFaction.stability}
                      onChange={(e) => {
                        setSelectedFaction({ ...selectedFaction, stability: parseInt(e.target.value) });
                        setHasChanges(true);
                      }}
                      className="w-full"
                    />
                    <div className="text-sm text-slate-400 text-center">{selectedFaction.stability}%</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Pressure</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedFaction.pressure}
                      onChange={(e) => {
                        setSelectedFaction({ ...selectedFaction, pressure: parseInt(e.target.value) });
                        setHasChanges(true);
                      }}
                      className="w-full"
                    />
                    <div className="text-sm text-slate-400 text-center">{selectedFaction.pressure}%</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={selectedFaction.tags?.join(", ") || ""}
                    onChange={(e) => {
                      const tags = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setSelectedFaction({ ...selectedFaction, tags });
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                    placeholder="political, military, religious"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                Select a faction to view details
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}