import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { PlusCircle, Save, Eye, Edit3 } from "lucide-react";
import { listWorlds, createWorld, upsertWorld, advanceWorldTick, deleteWorld, onWorldsChange } from "@/lib/worlds";
import WorldSidebarOptimized from "./WorldSidebarOptimized";

// Lazy load tab components
const EntitiesManagerOptimized = lazy(() => import("./managers/EntitiesManagerOptimized"));
const EventsManager = lazy(() => import("./EventsManager"));

// Loading fallback
const TabLoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="text-sm opacity-70">Loading...</div>
  </div>
);

// Temporary placeholder managers
const FactionsManagerPlaceholder = () => (
  <div className="p-4 text-center">Factions Manager - Coming soon</div>
);

const ArcsManagerPlaceholder = () => (
  <div className="p-4 text-center">Arcs Manager - Coming soon</div>
);

// Memoized World Content component
const WorldContent = React.memo(({ 
  worldId, 
  worldData 
}: { 
  worldId: string;
  worldData: any;
}) => {
  const [isWorldEditMode, setIsWorldEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('entities');

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

  // Memoized world stats
  const worldStats = useMemo(() => {
    if (!worldData) return null;
    
    const tension = worldData.tension || 0;
    const tensionColor = tension > 0.7 ? 'text-red-400' : 
                       tension > 0.4 ? 'text-yellow-400' : 'text-green-400';
    
    return {
      id: worldData.id || 'Unknown World',
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
              <div>
                <h1 className="text-xl font-semibold text-white">{worldStats?.id}</h1>
                <p className="text-sm text-slate-400">{worldStats?.time}</p>
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
              {/* Simple World Action Bar */}
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
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="entities" className="flex-1 flex flex-col">
        <TabsList className="w-full border-b border-slate-800 rounded-none bg-transparent p-0">
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="factions">Factions</TabsTrigger>
          <TabsTrigger value="arcs">Arcs</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          <TabsContent value="entities">
            <div className="p-4">
              <Suspense fallback={<TabLoadingFallback />}>
                <EntitiesManagerOptimized worldId={worldId} />
              </Suspense>
            </div>
          </TabsContent>
          <TabsContent value="factions">
            <div className="p-4">
              <FactionsManagerPlaceholder />
            </div>
          </TabsContent>
          <TabsContent value="arcs">
            <div className="p-4">
              <ArcsManagerPlaceholder />
            </div>
          </TabsContent>
          <TabsContent value="events">
            <div className="p-4">
              <Suspense fallback={<TabLoadingFallback />}>
                <EventsManager worldId={worldId} />
              </Suspense>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
});

WorldContent.displayName = 'WorldContent';

// Main Engine Editor with optimizations
export default function EngineEditorOptimized() {
  const [worlds, setWorlds] = useState<any[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Optimized world loading
  useEffect(() => {
    let isCancelled = false;

    const loadWorlds = async () => {
      try {
        const worldList = await listWorlds();
        if (!isCancelled) {
          setWorlds(worldList);
          if (worldList.length > 0 && !selectedWorldId) {
            setSelectedWorldId(worldList[0].id);
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
  }, []); // Remove selectedWorldId dependency to prevent unnecessary reloads

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
              if (selectedWorldId === oldRow.id) {
                setSelectedWorldId(newWorlds.length > 0 ? newWorlds[0].id : null);
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
  }, [selectedWorldId]);

  const handleCreateWorld = useCallback(async () => {
    try {
      const newWorld = await createWorld({
        time: "Day 1, 00:00",
        weather: "clear",
        locations: [],
        factions: {},
        events: [],
        history_log: [],
        tension: 0
      });
      
      setWorlds(prev => [newWorld, ...prev]);
      setSelectedWorldId(newWorld.id);
    } catch (e) {
      console.error("Failed to create world:", e);
    }
  }, []);

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
    return worlds.find(w => w.id === selectedWorldId);
  }, [worlds, selectedWorldId]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-lg">Loading worlds...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-950 text-white">
      <WorldSidebarOptimized
        worlds={worlds}
        selectedWorldId={selectedWorldId}
        onSelectWorld={setSelectedWorldId}
        onCreateWorld={handleCreateWorld}
        onDeleteWorld={handleDeleteWorld}
      />
      <WorldContent
        worldId={selectedWorldId || ''}
        worldData={selectedWorld}
      />
    </div>
  );
}