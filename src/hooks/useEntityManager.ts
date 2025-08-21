import { useState, useEffect, useCallback, useMemo } from 'react';
import { listEntities, upsertEntity, deleteEntity, onEntitiesChange } from '@/lib/entities';
import { useDebounce } from './useDebounce';

interface Entity {
  id: string;
  world_id: string;
  name: string;
  tags: string[];
  srd: any;
  personality: any;
  status: any;
  relationships: any;
  [key: string]: any;
}

export function useEntityManager(worldId: string) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selected, setSelected] = useState(-1);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  const debouncedQuery = useDebounce(query, 300);

  // Load entities when worldId changes
  useEffect(() => {
    if (!worldId) {
      setEntities([]);
      setSelected(-1);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);

    const loadEntities = async () => {
      try {
        const rows = await listEntities(worldId);
        if (!isCancelled) {
          setEntities(rows);
          setSelected(rows.length > 0 ? 0 : -1);
        }
      } catch (e) {
        if (!isCancelled) {
          console.warn("Load entities failed", e);
          setEntities([]);
          setSelected(-1);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadEntities();

    return () => {
      isCancelled = true;
    };
  }, [worldId]);

  // Realtime subscription
  useEffect(() => {
    if (!worldId) return;

    const subscription = onEntitiesChange((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      
      // Filter by world_id
      if (newRow && (newRow as any).world_id !== worldId) return;
      if (oldRow && (oldRow as any).world_id !== worldId) return;
      
      switch (eventType) {
        case 'INSERT':
          if (newRow) {
            setEntities(prev => {
              const exists = prev.find(e => e.id === newRow.id);
              if (exists) return prev;
              return [newRow as Entity, ...prev];
            });
          }
          break;
          
        case 'UPDATE':
          if (newRow) {
            setEntities(prev => prev.map(e => e.id === newRow.id ? newRow as Entity : e));
          }
          break;
          
        case 'DELETE':
          if (oldRow) {
            setEntities(prev => {
              const newEntities = prev.filter(e => e.id !== oldRow.id);
              // Update selected index if needed
              setSelected(current => {
                if (current >= 0 && prev[current]?.id === oldRow.id) {
                  return newEntities.length > 0 ? 0 : -1;
                }
                return current >= newEntities.length ? newEntities.length - 1 : current;
              });
              return newEntities;
            });
          }
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [worldId]);

  // Memoized filtered entities
  const filteredEntities = useMemo(() => {
    if (!debouncedQuery) return entities.map((e, i) => ({ entity: e, index: i }));
    
    const lowerQuery = debouncedQuery.toLowerCase();
    return entities
      .map((e, i) => ({ entity: e, index: i }))
      .filter(({ entity: e }) => {
        const searchText = `${e.name} ${e.id} ${(e.tags || []).join(" ")}`.toLowerCase();
        return searchText.includes(lowerQuery);
      });
  }, [entities, debouncedQuery]);

  // Current entity
  const currentEntity = useMemo(() => {
    return selected >= 0 && selected < entities.length ? entities[selected] : null;
  }, [entities, selected]);

  // Actions
  const updateEntity = useCallback((patch: Partial<Entity>) => {
    if (selected < 0) return;
    
    setEntities(prev => {
      const next = [...prev];
      next[selected] = { ...next[selected], ...patch };
      return next;
    });
  }, [selected]);

  const updateNestedEntity = useCallback((path: string[], value: any) => {
    if (selected < 0) return;
    
    setEntities(prev => {
      const next = [...prev];
      const obj = { ...next[selected] };
      let current = obj;
      
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        current[key] = { ...(current[key] || {}) };
        current = current[key];
      }
      
      current[path[path.length - 1]] = value;
      next[selected] = obj;
      return next;
    });
  }, [selected]);

  const saveEntity = useCallback(async () => {
    if (selected < 0 || !currentEntity) return;
    
    try {
      await upsertEntity(currentEntity);
      setErrors([]);
    } catch (e) {
      console.error('Failed to save entity:', e);
      setErrors(['Failed to save entity']);
    }
  }, [selected, currentEntity]);

  const deleteCurrentEntity = useCallback(async () => {
    if (selected < 0 || !currentEntity) return;
    
    try {
      await deleteEntity(currentEntity.id);
      // State will be updated via realtime subscription
    } catch (e) {
      console.error('Failed to delete entity:', e);
      setErrors(['Failed to delete entity']);
    }
  }, [selected, currentEntity]);

  const addNewEntity = useCallback(() => {
    if (!worldId) return;
    
    const id = `npc_${Math.random().toString(36).slice(2, 7)}`;
    const newEntity: Entity = {
      id,
      world_id: worldId,
      name: "New Entity",
      tags: [],
      srd: {
        level: 1,
        ancestry: "Human",
        role: "Fighter",
        alignment: "N",
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        hp: 10,
        ac: 10,
        saves: { fortitude: 0, reflex: 0, will: 0 },
        skills: {},
        abilities: [],
        inventory: []
      },
      personality: {
        temperament: "",
        ideals: [],
        fears: [],
        motivations: [],
        flaws: []
      },
      relationships: {},
      memory: [],
      status: { location: "", faction: "", mood: "", current_task: "", flags: [] }
    };
    
    setEntities(prev => [...prev, newEntity]);
    setSelected(entities.length);
  }, [worldId, entities.length]);

  const duplicateEntity = useCallback(() => {
    if (!worldId || !currentEntity) return;
    
    const clone = structuredClone(currentEntity);
    clone.id = `${clone.id}_copy`;
    clone.world_id = worldId;
    
    setEntities(prev => [...prev, clone]);
    setSelected(entities.length);
  }, [worldId, currentEntity, entities.length]);

  return {
    entities,
    filteredEntities,
    currentEntity,
    selected,
    setSelected,
    query,
    setQuery,
    isLoading,
    errors,
    setErrors,
    updateEntity,
    updateNestedEntity,
    saveEntity,
    deleteCurrentEntity,
    addNewEntity,
    duplicateEntity
  };
}