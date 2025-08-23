import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { PlusCircle, Save, Eye, Edit3, ChevronDown, Trash2, RotateCw, Pencil } from "lucide-react";
import { listWorlds, createWorld, upsertWorld, advanceWorldTick, deleteWorld, renameWorld, onWorldsChange } from "@/lib/worlds";
import { useWorld } from "../context/WorldContext";

// Lazy load tab components  
const EntitiesManager = lazy(() => import("./managers/EntitiesManager"));
const FactionsManager = lazy(() => import("./managers/FactionsManager"));
const ArcsManager = lazy(() => import("./managers/ArcsManager"));
const EventsManager = lazy(() => import("./EventsManager"));
const AIAdvisor = lazy(() => import("./AIAdvisor"));
const AIAdvisorPanel = lazy(() => import("./AIAdvisorPanel"));

// Loading fallback
const TabLoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-sm opacity-70">Loading...</div>
  </div>
);

// Removed placeholder managers - now using real managers

// Memoized World Content component
const WorldContent = React.memo(({ 
  worldId, 
  worldData,
  worlds,
  onWorldChange,
  onNewWorld,
  onDeleteWorld,
  onRenameWorld
}: { 
  worldId: string;
  worldData: any;
  worlds: any[];
  onWorldChange: (worldId: string) => void;
  onNewWorld: () => void;
  onDeleteWorld: () => void;
  onRenameWorld: (id: string, name: string) => void;
}) => {
  const [isWorldEditMode, setIsWorldEditMode] = useState(false);
  const [showWorldDropdown, setShowWorldDropdown] = useState(false);
  const [isRenamingWorld, setIsRenamingWorld] = useState(false);
  const [newWorldName, setNewWorldName] = useState("");

  const advanceWorld = useCallback(async () => {
    if (!worldId) return;
    try {
      const result = await advanceWorldTick(worldId, 1);
      console.log("World advanced:", result);
    } catch (e) {
      console.error("Failed to advance world:", e);
    }
  }, [worldId]);

  const saveWorld = useCallback(async () => {
    if (!worldId || !worldData) return;
    try {
      await upsertWorld(worldData);
      console.log("World saved");
    } catch (e) {
      console.error("Failed to save world:", e);
    }
  }, [worldId, worldData]);

  const handleRenameWorld = useCallback(() => {
    if (!worldData?.name) return;
    setNewWorldName(worldData.name);
    setIsRenamingWorld(true);
    setShowWorldDropdown(false);
  }, [worldData?.name]);

  const handleRenameSubmit = useCallback(() => {
    if (!worldId || !newWorldName.trim() || newWorldName.trim() === worldData?.name) {
      setIsRenamingWorld(false);
      setNewWorldName("");
      return;
    }
    onRenameWorld(worldId, newWorldName.trim());
    setIsRenamingWorld(false);
    setNewWorldName("");
  }, [worldId, newWorldName, worldData?.name, onRenameWorld]);

  // Memoized world stats
  const worldStats = useMemo(() => {
    if (!worldData) return null;
    
    const tension = worldData.tension || 0;
    const tensionColor = tension > 0.7 ? 'text-red-400' : 
                       tension > 0.4 ? 'text-yellow-400' : 'text-green-400';
    
    return {
      id: worldData.id || 'Unknown ID',
      name: worldData.name || 'Unnamed World',
      time: worldData.time || 'No time set',
      weather: worldData.weather || 'Unknown',
      tension: tension.toFixed(2),
      tensionColor,
      locationCount: (worldData.locations || []).length
    };
  }, [worldData]);

  if (!worldId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Please select a world to continue
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* World Header */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                {isRenamingWorld ? (
                  <div className="flex items-center space-x-2 p-2 rounded-lg border border-slate-700 bg-slate-800">
                    <div className="text-left flex-1">
                      <input
                        type="text"
                        value={newWorldName}
                        onChange={(e) => setNewWorldName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameSubmit();
                          } else if (e.key === 'Escape') {
                            setIsRenamingWorld(false);
                            setNewWorldName("");
                          }
                        }}
                        onBlur={handleRenameSubmit}
                        className="text-lg font-semibold bg-transparent text-white border-none outline-none w-full"
                        autoFocus
                      />
                      <p className="text-xs text-slate-400">{worldStats?.time}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowWorldDropdown(!showWorldDropdown)}
                    className="flex items-center space-x-2 p-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <div className="text-left">
                      <h1 className="text-lg font-semibold text-white" title={worldStats?.id}>{worldStats?.name}</h1>
                      <p className="text-xs text-slate-400">{worldStats?.time}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                )}
                
                {showWorldDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                    <div className="p-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-200">Select World</span>
                        <Button variant="secondary" className="text-xs px-2 py-1" onClick={onNewWorld}>
                          <PlusCircle className="h-3 w-3 mr-1" />New
                        </Button>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {worlds.map((world) => (
                          <button
                            key={world.id}
                            onClick={() => {
                              onWorldChange(world.id);
                              setShowWorldDropdown(false);
                            }}
                            className={`w-full text-left p-2 rounded text-sm transition-colors ${
                              world.id === worldId
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-300 hover:bg-slate-700'
                            }`}
                            title={world.id}
                          >
                            <div className="font-medium">{world.name || 'Unnamed World'}</div>
                            <div className="text-xs opacity-70">{world.time} • {world.weather}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {worldStats && (
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">Weather:</span>
                    <span className="text-white">{worldStats.weather}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">Tension:</span>
                    <span className={`font-medium ${worldStats.tensionColor}`}>
                      {worldStats.tension}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">Locations:</span>
                    <span className="text-white">{worldStats.locationCount}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Enhanced World Action Bar */}
              <div className="flex items-center gap-1 p-2 bg-slate-900/50 rounded-md border border-slate-700">
                <Button 
                  variant="secondary" 
                  onClick={() => setIsWorldEditMode(!isWorldEditMode)} 
                  title={isWorldEditMode ? "View Mode" : "Edit Mode"}
                >
                  {isWorldEditMode ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                </Button>
                <Button variant="secondary" onClick={saveWorld} title="Save World">
                  <Save className="h-4 w-4" />
                </Button>
                <Button variant="secondary" onClick={advanceWorld} title="Advance Time +1h">
                  <PlusCircle className="h-4 w-4" />
                </Button>
                <Button variant="secondary" onClick={handleRenameWorld} title="Rename World">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="secondary" onClick={onNewWorld} title="Create New World">
                  <PlusCircle className="h-4 w-4" />
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={onDeleteWorld} 
                  title="Delete Current World"
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main content area - two column layout */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left column - main tabs */}
        <div className="flex-1 flex flex-col min-w-0">
          <Tabs defaultValue="entities" className="flex-1 flex flex-col">
            <TabsList className="w-full border-b border-slate-800 rounded-none bg-transparent p-0">
              <TabsTrigger value="entities">Entities</TabsTrigger>
              <TabsTrigger value="factions">Factions</TabsTrigger>
              <TabsTrigger value="arcs">Arcs</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="advisor">AI Advisor</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto">
              <TabsContent value="entities">
                <div className="p-4">
                  <Suspense fallback={<TabLoadingFallback />}>
                    <EntitiesManager worldId={worldId} />
                  </Suspense>
                </div>
              </TabsContent>
              <TabsContent value="factions">
                <div className="p-4">
                  <Suspense fallback={<TabLoadingFallback />}>
                    <FactionsManager />
                  </Suspense>
                </div>
              </TabsContent>
              <TabsContent value="arcs">
                <div className="p-4">
                  <Suspense fallback={<TabLoadingFallback />}>
                    <ArcsManager />
                  </Suspense>
                </div>
              </TabsContent>
              <TabsContent value="events">
                <div className="p-4">
                  <Suspense fallback={<TabLoadingFallback />}>
                    <EventsManager worldId={worldId} />
                  </Suspense>
                </div>
              </TabsContent>

              <TabsContent value="advisor">
                <div className="p-4">
                  <Suspense fallback={<TabLoadingFallback />}>
                    <AIAdvisor worldId={worldId} />
                  </Suspense>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Right column - AI Advisor Panel */}
        <div className="w-80 flex-shrink-0 p-4 border-l border-slate-800 bg-slate-950/30">
          <Suspense fallback={<TabLoadingFallback />}>
            <AIAdvisorPanel worldId={worldId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
});

WorldContent.displayName = 'WorldContent';

// Main Engine Editor with optimizations
export default function EngineEditor() {
  const { worldId, setWorldId } = useWorld();
  const [worlds, setWorlds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Optimized world loading
  useEffect(() => {
    let isCancelled = false;

    const loadWorlds = async () => {
      try {
        const worldList = await listWorlds();
        if (!isCancelled) {
          setWorlds(worldList);
          if (worldList.length > 0 && !worldId) {
            setWorldId(worldList[0].id);
          }
        }
      } catch (e) {
        if (!isCancelled) {
          console.error("Failed to load worlds:", e);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadWorlds();

    return () => {
      isCancelled = true;
    };
  }, []); // Remove worldId dependency to prevent unnecessary reloads

  // Optimized real-time updates
  useEffect(() => {
    const subscription = onWorldsChange((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      
      setWorlds(prev => {
        switch (eventType) {
          case 'INSERT':
            if (newRow) {
              const exists = prev.find(w => w.id === newRow.id);
              if (exists) return prev;
              return [newRow, ...prev];
            }
            return prev;
            
          case 'UPDATE':
            if (newRow) {
              return prev.map(w => w.id === newRow.id ? newRow : w);
            }
            return prev;
            
          case 'DELETE':
            if (oldRow) {
              const newWorlds = prev.filter(w => w.id !== oldRow.id);
              // Update selected world if it was deleted
              if (worldId === oldRow.id) {
                setWorldId(newWorlds.length > 0 ? newWorlds[0].id : null);
              }
              return newWorlds;
            }
            return prev;
            
          default:
            return prev;
        }
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [worldId]);

  const handleCreateWorld = useCallback(async () => {
    const name = window.prompt("Name your world:");
    if (!name?.trim()) return;
    
    try {
      const newWorld = await createWorld(name.trim());
      
      setWorlds(prev => [newWorld, ...prev]);
      setWorldId(newWorld.id);
    } catch (e) {
      console.error("Failed to create world:", e);
      alert(`Failed to create world: ${(e as Error).message}`);
    }
  }, [setWorldId]);

  const handleDeleteWorld = useCallback(async (worldId: string) => {
    if (!confirm("Are you sure you want to delete this world?")) return;
    
    try {
      await deleteWorld(worldId);
      // State will be updated via realtime subscription
    } catch (e) {
      console.error("Failed to delete world:", e);
    }
  }, []);

  // Memoized selected world
  const selectedWorld = useMemo(() => {
    return worlds.find(w => w.id === worldId);
  }, [worlds, worldId]);

  // All hooks must be called before any early returns
  const handleDeleteCurrentWorld = useCallback(async () => {
    if (!worldId) return;
    await handleDeleteWorld(worldId);
  }, [worldId, handleDeleteWorld]);

  const handleRenameCurrentWorld = useCallback(async (id: string, name: string) => {
    try {
      await renameWorld(id, name);
      // State will be updated via realtime subscription
    } catch (e) {
      console.error("Failed to rename world:", e);
      alert(`Failed to rename world: ${(e as Error).message}`);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-lg">Loading worlds...</div>
      </div>
    );
  }

  if (!worldId && worlds.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Welcome to AI Game Master Engine</h1>
          <p className="text-slate-400 mb-6">Create your first world to get started</p>
          <Button onClick={handleCreateWorld} className="px-6 py-3 text-lg">
            <PlusCircle className="h-5 w-5 mr-2" />
            Create First World
          </Button>
        </div>
      </div>
    );
  }

  if (!worldId) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-4">Select a World</h1>
          <p className="text-slate-400 mb-6">Choose a world to manage or create a new one</p>
          <div className="space-y-2 max-w-md">
            {worlds.map((world) => (
              <button
                key={world.id}
                onClick={() => setWorldId(world.id)}
                className="w-full p-3 text-left bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                title={world.id}
              >
                <div className="font-medium">{world.name || 'Unnamed World'}</div>
                <div className="text-sm text-slate-400">{world.time} • {world.weather}</div>
              </button>
            ))}
            <Button onClick={handleCreateWorld} className="w-full mt-4" variant="secondary">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create New World
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 text-white">
      <WorldContent
        worldId={worldId}
        worldData={selectedWorld}
        worlds={worlds}
        onWorldChange={setWorldId}
        onNewWorld={handleCreateWorld}
        onDeleteWorld={handleDeleteCurrentWorld}
        onRenameWorld={handleRenameCurrentWorld}
      />
    </div>
  );
}