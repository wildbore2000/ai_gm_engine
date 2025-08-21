import React, { memo, useCallback } from "react";
import { Button } from "./ui/button";
import { PlusCircle, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

interface World {
  id: string;
  time?: string;
  tension?: number;
}

interface WorldSidebarProps {
  worlds: World[];
  selectedWorldId: string | null;
  onSelectWorld: (id: string) => void;
  onCreateWorld: () => void;
  onDeleteWorld: (id: string) => void;
}

// Memoized world item component
const WorldItem = memo(({ 
  world, 
  isSelected, 
  onSelect, 
  onDelete 
}: { 
  world: World; 
  isSelected: boolean; 
  onSelect: () => void; 
  onDelete: () => void; 
}) => {
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  }, [onDelete]);

  const getTensionColor = useCallback((tension: number) => {
    if (tension > 0.7) return 'text-red-400';
    if (tension > 0.4) return 'text-yellow-400';
    return 'text-green-400';
  }, []);

  return (
    <motion.div
      className={`p-4 border-b border-slate-800/50 cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-indigo-500/20 border-l-4 border-l-indigo-500' 
          : 'hover:bg-slate-800/30'
      }`}
      onClick={onSelect}
      whileHover={{ x: 4 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate mb-1">{world.id}</h3>
          <p className="text-xs text-slate-400 mb-2">{world.time || 'No time set'}</p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Tension: <span className={`font-medium ${getTensionColor(world.tension || 0)}`}>
                {(world.tension || 0).toFixed(1)}
              </span>
            </span>
          </div>
        </div>
        <Button 
          variant="secondary" 
          onClick={handleDelete}
          className="ml-2 p-1 text-red-400 hover:text-red-300"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
});

WorldItem.displayName = 'WorldItem';

// Memoized empty state
const EmptyState = memo(() => (
  <div className="p-8 text-center text-slate-500">
    <p className="text-sm">No worlds created yet.</p>
    <p className="text-xs mt-1">Click the + button to create your first world.</p>
  </div>
));

EmptyState.displayName = 'EmptyState';

// Main component
const WorldSidebarOptimized = memo<WorldSidebarProps>(({ 
  worlds, 
  selectedWorldId, 
  onSelectWorld, 
  onCreateWorld, 
  onDeleteWorld 
}) => {
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
        {worlds.length === 0 ? (
          <EmptyState />
        ) : (
          worlds.map((world) => (
            <WorldItem
              key={world.id}
              world={world}
              isSelected={selectedWorldId === world.id}
              onSelect={() => onSelectWorld(world.id)}
              onDelete={() => onDeleteWorld(world.id)}
            />
          ))
        )}
      </div>
    </div>
  );
});

WorldSidebarOptimized.displayName = 'WorldSidebarOptimized';

export default WorldSidebarOptimized;