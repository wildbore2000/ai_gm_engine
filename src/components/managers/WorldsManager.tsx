import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../ui/card";
import ActionBar, { type ActionDef } from "../ui/ActionBar";
import { useWorld } from "@/context/WorldContext";
import { listWorlds, createWorld, upsertWorld, deleteWorld, advanceWorldTick, onWorldsChange, type WorldRow } from "@/lib/worlds";

export default function WorldsManager() {
  const { worldId, setWorldId } = useWorld();
  const [worlds, setWorlds] = useState<WorldRow[]>([]);
  const [selectedWorld, setSelectedWorld] = useState<WorldRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load worlds
  useEffect(() => {
    loadWorlds();
    
    // Subscribe to realtime changes
    const subscription = onWorldsChange((payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        setWorlds(prev => [payload.new as WorldRow, ...prev]);
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        setWorlds(prev => prev.map(w => w.id === payload.new.id ? payload.new as WorldRow : w));
      } else if (payload.eventType === 'DELETE' && payload.old) {
        setWorlds(prev => prev.filter(w => w.id !== payload.old.id));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Update selected world when worldId changes
  useEffect(() => {
    if (worldId) {
      const world = worlds.find(w => w.id === worldId);
      setSelectedWorld(world || null);
    } else {
      setSelectedWorld(null);
    }
  }, [worldId, worlds]);

  const loadWorlds = async () => {
    try {
      setIsLoading(true);
      const data = await listWorlds();
      setWorlds(data);
    } catch (error) {
      console.error("Failed to load worlds:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewWorld = useCallback(async () => {
    const name = window.prompt("Name your world:");
    if (!name?.trim()) return;
    
    try {
      const newWorld = await createWorld(name.trim(), {
        time: `Day ${worlds.length + 1}, 12:00`,
        weather: "clear",
        tension: 0,
        locations: []
      });
      setWorldId(newWorld.id);
    } catch (error) {
      console.error("Failed to create world:", error);
    }
  }, [worlds.length, setWorldId]);

  const handleSave = useCallback(async () => {
    if (!selectedWorld || !hasChanges) return;
    
    try {
      setIsLoading(true);
      await upsertWorld(selectedWorld);
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save world:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedWorld, hasChanges]);

  const handleDelete = useCallback(async () => {
    if (!selectedWorld) return;
    
    if (!confirm(`Delete world "${selectedWorld.id.slice(0, 8)}"? This cannot be undone.`)) {
      return;
    }

    try {
      setIsLoading(true);
      await deleteWorld(selectedWorld.id);
      if (worldId === selectedWorld.id) {
        setWorldId(null);
      }
    } catch (error) {
      console.error("Failed to delete world:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedWorld, worldId, setWorldId]);

  const handleRefresh = useCallback(() => {
    loadWorlds();
  }, []);

  const handleAdvanceTick = useCallback(async () => {
    if (!worldId) return;
    
    try {
      setIsLoading(true);
      await advanceWorldTick(worldId, 1);
    } catch (error) {
      console.error("Failed to advance world tick:", error);
    } finally {
      setIsLoading(false);
    }
  }, [worldId]);

  const handleExport = useCallback(() => {
    if (!selectedWorld) return;
    const blob = new Blob([JSON.stringify(selectedWorld, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `world-${selectedWorld.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedWorld]);

  const handleImport = useCallback(() => {
    // TODO: Implement import functionality
    console.log("Import worlds - TODO");
  }, []);

  // Action definitions
  const actions: ActionDef[] = [
    {
      id: "new",
      label: "New",
      tooltip: "Create a new world",
      kbd: "N",
      onClick: handleNewWorld,
      variant: "primary"
    },
    {
      id: "save",
      label: "Save",
      tooltip: "Save current world",
      kbd: "Ctrl+S",
      onClick: handleSave,
      disabled: !selectedWorld || !hasChanges
    },
    {
      id: "delete",
      label: "Delete",
      tooltip: selectedWorld ? "Delete selected world" : "Select a world to delete",
      kbd: "Del",
      onClick: handleDelete,
      disabled: !selectedWorld,
      variant: "danger"
    }
  ];

  const extraActions: ActionDef[] = [
    {
      id: "refresh",
      label: "Refresh",
      tooltip: "Refresh worlds list",
      kbd: "R",
      onClick: handleRefresh
    },
    {
      id: "advanceTick",
      label: "Advance Tick",
      tooltip: worldId ? "Advance world simulation" : "Select a world to advance",
      onClick: handleAdvanceTick,
      disabled: !worldId
    },
    {
      id: "export",
      label: "Export",
      tooltip: selectedWorld ? "Export selected world" : "Select a world to export",
      onClick: handleExport,
      disabled: !selectedWorld
    },
    {
      id: "import",
      label: "Import",
      tooltip: "Import worlds",
      onClick: handleImport
    }
  ];

  return (
    <div className="space-y-4">
      <ActionBar
        title="Worlds"
        scope="worlds"
        actions={actions}
        extraActions={extraActions}
        busy={isLoading}
      />

      <div className="flex gap-4">
        {/* Worlds List */}
        <div className="w-80">
          <Card>
          <CardContent className="p-4">
            <h3 className="text-md font-medium mb-3">Available Worlds</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {worlds.map((world) => (
                <div
                  key={world.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    worldId === world.id
                      ? "bg-indigo-600/20 border-indigo-500"
                      : "bg-slate-800 border-slate-700 hover:bg-slate-700"
                  }`}
                  onClick={() => setWorldId(world.id)}
                >
                  <div className="font-medium">World {world.id.slice(0, 8)}</div>
                  <div className="text-sm text-slate-400 mt-1">{world.time} • {world.weather}</div>
                </div>
              ))}
              {worlds.length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  No worlds found. Create your first world!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>

        {/* World Details */}
        <div className="flex-1">
          <Card>
          <CardContent className="p-4">
            <h3 className="text-md font-medium mb-3">World Details</h3>
            {selectedWorld ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">ID</label>
                  <input
                    type="text"
                    value={selectedWorld.id}
                    readOnly
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Time</label>
                  <input
                    type="text"
                    value={selectedWorld.time || ""}
                    onChange={(e) => {
                      setSelectedWorld({ ...selectedWorld, time: e.target.value });
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tension</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={selectedWorld.tension || 0}
                      onChange={(e) => {
                        setSelectedWorld({ ...selectedWorld, tension: parseInt(e.target.value) });
                        setHasChanges(true);
                      }}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Weather</label>
                    <select
                      value={selectedWorld.weather || "clear"}
                      onChange={(e) => {
                        setSelectedWorld({ ...selectedWorld, weather: e.target.value });
                        setHasChanges(true);
                      }}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg"
                    >
                      <option value="clear">Clear</option>
                      <option value="cloudy">Cloudy</option>
                      <option value="rainy">Rainy</option>
                      <option value="stormy">Stormy</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                Select a world to view details
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}