import React, { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { PlusCircle, Save, Eye, Edit3, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { listWorlds, createWorld, upsertWorld, advanceWorldTick, deleteWorld, onWorldsChange } from "@/lib/worlds";
import EntitiesManager from "./managers/EntitiesManager";
import EventsManager from "./EventsManager";

// Simple temporary managers that we can improve later
function FactionsManager({ worldId }: { worldId: string }) {
  return <div className="p-4 text-center">Factions Manager - Coming soon</div>;
}

function ArcsManager({ worldId }: { worldId: string }) {
  return <div className="p-4 text-center">Arcs Manager - Coming soon</div>;
}

// World Sidebar
function WorldSidebar({
  worlds,
  selectedWorldId,
  onSelectWorld,
  onCreateWorld,
  onDeleteWorld
}: {
  worlds: any[];
  selectedWorldId: string | null;
  onSelectWorld: (id: string) => void;
  onCreateWorld: () => void;
  onDeleteWorld: (id: string) => void;
}) {
  return (
    <div className="w-64 h-full border-r border-slate-800 bg-slate-950/50">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Worlds</h2>
          <Button onClick={onCreateWorld}>
            <PlusCircle className="h-4 w-4"/>
          </Button>
        </div>
      </div>
      
      <div className="overflow-auto h-full pb-16">
        {worlds.map((world) => (
          <motion.div
            key={world.id}
            className={`p-4 border-b border-slate-800/50 cursor-pointer transition-colors ${
              selectedWorldId === world.id 
                ? 'bg-indigo-500/20 border-l-4 border-l-indigo-500' 
                : 'hover:bg-slate-800/30'
            }`}
            onClick={() => onSelectWorld(world.id)}
            whileHover={{ x: 4 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate mb-1">{world.id}</h3>
                <p className="text-xs text-slate-400 mb-2">{world.time || 'No time set'}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Tension: <span className={`font-medium ${
                      (world.tension || 0) > 0.7 ? 'text-red-400' : 
                      (world.tension || 0) > 0.4 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {(world.tension || 0).toFixed(1)}
                    </span>
                  </span>
                </div>
              </div>
              <Button 
                variant="secondary" 
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteWorld(world.id);
                }}
                className="ml-2 p-1 text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        ))}
        
        {worlds.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <p className="text-sm">No worlds created yet.</p>
            <p className="text-xs mt-1">Click the + button to create your first world.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// World Content (tabs within selected world)
function WorldContent({ 
  worldId, 
  worldData 
}: { 
  worldId: string;
  worldData: any;
}) {
  const [isWorldEditMode, setIsWorldEditMode] = useState(false);

  const advanceWorld = async () => {
    if (!worldId) return;
    try {
      const result = await advanceWorldTick(worldId, 1);
      console.log("World advanced:", result);
    } catch (e) {
      console.error("Failed to advance world:", e);
    }
  };

  const saveWorld = async () => {
    if (!worldId || !worldData) return;
    try {
      await upsertWorld(worldData);
      console.log("World saved");
    } catch (e) {
      console.error("Failed to save world:", e);
    }
  };

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
                <h1 className="text-xl font-semibold text-white">{worldData?.id || 'Unknown World'}</h1>
                <p className="text-sm text-slate-400">{worldData?.time || 'No time set'}</p>
              </div>
              
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Weather:</span>
                  <span className="text-white">{worldData?.weather || 'Unknown'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Tension:</span>
                  <span className={`font-medium ${
                    (worldData?.tension || 0) > 0.7 ? 'text-red-400' : 
                    (worldData?.tension || 0) > 0.4 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {(worldData?.tension || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Locations:</span>
                  <span className="text-white">{(worldData?.locations || []).length}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Simple World Action Bar */}
              <div className="flex items-center gap-1 p-2 bg-slate-900/50 rounded-md border border-slate-700">
                <Button variant="secondary" onClick={() => setIsWorldEditMode(!isWorldEditMode)} title={isWorldEditMode ? "View Mode" : "Edit Mode"}>
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
              <EntitiesManager worldId={worldId} />
            </div>
          </TabsContent>
          <TabsContent value="factions">
            <div className="p-4">
              <FactionsManager worldId={worldId} />
            </div>
          </TabsContent>
          <TabsContent value="arcs">
            <div className="p-4">
              <ArcsManager worldId={worldId} />
            </div>
          </TabsContent>
          <TabsContent value="events">
            <div className="p-4">
              <EventsManager worldId={worldId} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// Main Engine Editor
export default function EngineEditor() {
  const [worlds, setWorlds] = useState<any[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);

  // Load worlds on mount
  useEffect(() => {
    const loadWorlds = async () => {
      try {
        const worldList = await listWorlds();
        setWorlds(worldList);
        if (worldList.length > 0 && !selectedWorldId) {
          setSelectedWorldId(worldList[0].id);
        }
      } catch (e) {
        console.error("Failed to load worlds:", e);
      }
    };
    loadWorlds();
  }, [selectedWorldId]);

  // Real-time world updates
  useEffect(() => {
    const subscription = onWorldsChange((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      
      switch (eventType) {
        case 'INSERT':
          if (newRow) {
            setWorlds(prev => {
              const exists = prev.find(w => w.id === newRow.id);
              if (exists) return prev;
              return [newRow, ...prev];
            });
          }
          break;
          
        case 'UPDATE':
          if (newRow) {
            setWorlds(prev => prev.map(w => w.id === newRow.id ? newRow : w));
          }
          break;
          
        case 'DELETE':
          if (oldRow) {
            setWorlds(prev => {
              const newWorlds = prev.filter(w => w.id !== oldRow.id);
              if (selectedWorldId === oldRow.id) {
                setSelectedWorldId(newWorlds.length > 0 ? newWorlds[0].id : null);
              }
              return newWorlds;
            });
          }
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedWorldId]);

  const handleCreateWorld = async () => {
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
  };

  const handleDeleteWorld = async (worldId: string) => {
    if (!confirm("Are you sure you want to delete this world?")) return;
    
    try {
      await deleteWorld(worldId);
      setWorlds(prev => prev.filter(w => w.id !== worldId));
      if (selectedWorldId === worldId) {
        const remaining = worlds.filter(w => w.id !== worldId);
        setSelectedWorldId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (e) {
      console.error("Failed to delete world:", e);
    }
  };

  const selectedWorld = worlds.find(w => w.id === selectedWorldId);

  return (
    <div className="h-screen flex bg-slate-950 text-white">
      <WorldSidebar
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