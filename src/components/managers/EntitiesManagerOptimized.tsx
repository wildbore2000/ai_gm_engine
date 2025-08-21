import React, { useState, useRef, useCallback, memo } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { CheckCircle2, AlertCircle, Trash2, PlusCircle, ChevronDown, ChevronUp, Save, Eye, Edit3 } from "lucide-react";
import { validateEntity, download } from "../utils/validation";
import { useEntityManager } from "../../hooks/useEntityManager";

interface EntitiesManagerProps {
  worldId: string;
}

// Memoized entity list item
const EntityListItem = memo(({ 
  entity, 
  index, 
  isSelected, 
  onClick 
}: { 
  entity: any; 
  index: number; 
  isSelected: boolean; 
  onClick: () => void; 
}) => (
  <div 
    onClick={onClick} 
    className={`p-2 rounded-lg border cursor-pointer transition ${
      isSelected 
        ? 'border-indigo-500/70 bg-indigo-500/10 ring-1 ring-indigo-500/30' 
        : 'border-slate-800 hover:bg-slate-800/40'
    }`}
  >
    <div className="text-sm font-medium">{entity.name || entity.id}</div>
    <div className="text-xs opacity-70">{entity.id}</div>
  </div>
));

EntityListItem.displayName = 'EntityListItem';

// Memoized action bar
const ActionBar = memo(({ 
  onAddNew, 
  onDelete, 
  onToggleEdit, 
  onSave, 
  hasSelection,
  isEditMode 
}: {
  onAddNew: () => void;
  onDelete: () => void;
  onToggleEdit: () => void;
  onSave: () => void;
  hasSelection: boolean;
  isEditMode: boolean;
}) => (
  <div className="flex items-center justify-center gap-1 p-2 bg-slate-900/50 rounded-md border border-slate-700">
    <Button variant="secondary" onClick={onAddNew} title="Add New">
      <PlusCircle className="h-4 w-4" />
    </Button>
    <Button variant="secondary" onClick={onDelete} disabled={!hasSelection} title="Delete">
      <Trash2 className="h-4 w-4" />
    </Button>
    <Button variant="secondary" onClick={onToggleEdit} title={isEditMode ? "View Mode" : "Edit Mode"}>
      {isEditMode ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
    </Button>
    <Button variant="secondary" onClick={onSave} disabled={!hasSelection} title="Save">
      <Save className="h-4 w-4" />
    </Button>
  </div>
));

ActionBar.displayName = 'ActionBar';

// Memoized form field
const FormField = memo(({ 
  label, 
  value, 
  onChange, 
  disabled, 
  type = "text",
  className = "" 
}: {
  label: string;
  value: any;
  onChange: (value: any) => void;
  disabled: boolean;
  type?: string;
  className?: string;
}) => (
  <label className={`text-xs opacity-80 ${className}`}>
    {label}
    <input 
      className="w-full p-1 rounded bg-slate-900 border border-slate-700" 
      type={type}
      value={value} 
      onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
      disabled={disabled}
    />
  </label>
));

FormField.displayName = 'FormField';

export default function EntitiesManagerOptimized({ worldId }: EntitiesManagerProps) {
  const {
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
  } = useEntityManager(worldId);

  const [showRawJson, setShowRawJson] = useState(false);
  const [isEditMode, setIsEditMode] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleValidate = useCallback(() => {
    if (!currentEntity) return false;
    const ok = validateEntity(currentEntity);
    setErrors((validateEntity as any).errors?.map((e: any) => `${e.instancePath || "/"} ${e.message}`) || []);
    return ok;
  }, [currentEntity, setErrors]);

  const handleSaveAll = useCallback(async () => {
    // Implementation for save all
    console.log("Save all entities");
  }, []);

  const handleDownloadCollection = useCallback(() => {
    download("entities.json", filteredEntities.map(f => f.entity));
  }, [filteredEntities]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    file.text().then((text) => {
      try {
        const obj = JSON.parse(text);
        if (Array.isArray(obj)) {
          // Handle import logic
          console.log("Import entities:", obj);
        } else if (obj && typeof obj === "object") {
          console.log("Import single entity:", obj);
        }
      } catch (err) {
        setErrors(['Invalid JSON file']);
      }
    });
  }, [setErrors]);

  const tagString = currentEntity?.tags?.join(", ") || "";

  const handleTagsChange = useCallback((newTagString: string) => {
    const tags = newTagString.split(',').map(s => s.trim()).filter(Boolean);
    updateEntity({ tags });
  }, [updateEntity]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm opacity-70">Loading entities...</div>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Sidebar list */}
      <div className="w-80">
        <Card>
          <CardContent className="p-4 space-y-3">
            <ActionBar
              onAddNew={addNewEntity}
              onDelete={deleteCurrentEntity}
              onToggleEdit={() => setIsEditMode(!isEditMode)}
              onSave={saveEntity}
              hasSelection={selected >= 0}
              isEditMode={isEditMode}
            />
            
            <div>
              <input 
                className="w-full rounded-md bg-slate-950/60 border border-slate-800 px-2 py-1 text-sm" 
                placeholder="Search by name, id, tag..." 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
              />
            </div>
            
            <div className="grid gap-2 max-h-[420px] overflow-auto">
              {filteredEntities.map(({ entity, index }) => (
                <EntityListItem
                  key={entity.id}
                  entity={entity}
                  index={index}
                  isSelected={index === selected}
                  onClick={() => setSelected(index)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail editor */}
      <div className="flex-1">
        {currentEntity ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                {errors.length === 0 ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle2 className="h-4 w-4"/> Valid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4"/> Invalid
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <Button variant="secondary" onClick={handleValidate}>Validate</Button>
                  <Button variant="secondary" onClick={saveEntity}>Save Current</Button>
                  <Button variant="secondary" onClick={handleSaveAll}>Save All</Button>
                  <Button variant="secondary" onClick={() => download(currentEntity.id + '.json', currentEntity)}>
                    Download
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <FormField
                  label="ID"
                  value={currentEntity.id}
                  onChange={(value) => updateEntity({ id: value })}
                  disabled={!isEditMode}
                />
                <FormField
                  label="Name"
                  value={currentEntity.name}
                  onChange={(value) => updateEntity({ name: value })}
                  disabled={!isEditMode}
                />
                <FormField
                  label="Tags (comma-separated)"
                  value={tagString}
                  onChange={handleTagsChange}
                  disabled={!isEditMode}
                  className="col-span-2"
                />
              </div>

              <div className="grid grid-cols-6 gap-2">
                {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(stat => (
                  <FormField
                    key={stat}
                    label={stat.toUpperCase()}
                    value={currentEntity.srd?.stats?.[stat] || 10}
                    onChange={(value) => updateNestedEntity(['srd', 'stats', stat], value)}
                    disabled={!isEditMode}
                    type="number"
                  />
                ))}
              </div>

              <div className="grid grid-cols-4 gap-2">
                <FormField
                  label="HP"
                  value={currentEntity.srd?.hp || 10}
                  onChange={(value) => updateNestedEntity(['srd', 'hp'], value)}
                  disabled={!isEditMode}
                  type="number"
                />
                <FormField
                  label="AC"
                  value={currentEntity.srd?.ac || 10}
                  onChange={(value) => updateNestedEntity(['srd', 'ac'], value)}
                  disabled={!isEditMode}
                  type="number"
                />
                <FormField
                  label="Faction"
                  value={currentEntity.status?.faction || ""}
                  onChange={(value) => updateNestedEntity(['status', 'faction'], value)}
                  disabled={!isEditMode}
                />
                <FormField
                  label="Location"
                  value={currentEntity.status?.location || ""}
                  onChange={(value) => updateNestedEntity(['status', 'location'], value)}
                  disabled={!isEditMode}
                />
              </div>

              <div>
                <Button 
                  variant="secondary" 
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full flex justify-between items-center"
                >
                  <span className="text-xs opacity-80">Advanced (Raw JSON)</span>
                  {showRawJson ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                {showRawJson && (
                  <Textarea 
                    className="font-mono text-xs min-h-[160px] mt-2" 
                    value={JSON.stringify(currentEntity, null, 2)} 
                    onChange={(e) => {
                      try { 
                        const obj = JSON.parse(e.target.value); 
                        updateEntity(obj);
                        setErrors([]);
                      } catch (err: any) { 
                        setErrors([err.message]); 
                      }
                    }} 
                    disabled={!isEditMode}
                  />
                )}
              </div>

              {errors.length > 0 && (
                <div className="text-xs text-red-500">
                  {errors.map((e, i) => (
                    <div key={i}>• {e}</div>
                  ))}
                </div>
              )}
              
              <input 
                type="file" 
                accept="application/json" 
                className="hidden" 
                ref={fileRef} 
                onChange={handleImport} 
              />
            </CardContent>
          </Card>
        ) : (
          <div className="opacity-70 text-sm p-4">No entity selected.</div>
        )}
      </div>
    </div>
  );
}