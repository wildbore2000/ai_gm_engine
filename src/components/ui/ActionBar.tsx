import React, { useEffect } from "react";
import { 
  Plus, Copy, Save, CheckCircle2, Trash2, RotateCw, 
  Filter, Upload, Download, FastForward, Loader2 
} from "lucide-react";

export type ActionId =
  | "new" | "duplicate" | "save" | "validate" | "delete"
  | "refresh" | "filter" | "import" | "export" | "advanceTick";

export type ActionDef = {
  id: ActionId;
  label: string;
  tooltip?: string;
  kbd?: string;             // e.g., "N", "Ctrl+S"
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  icon?: React.ComponentType<{ className?: string }>;
};

export type ActionBarProps = {
  title: string;            // e.g., "Entities", "Events"
  scope: "worlds" | "entities" | "factions" | "arcs" | "events";
  actions: ActionDef[];     // left-aligned core actions: New, Save, Delete, etc.
  extraActions?: ActionDef[]; // right-aligned optional actions
  busy?: boolean;           // show spinner overlay on bar when true
  compact?: boolean;        // optional compact mode
};

// Icon mapping for consistent icons across actions
const ACTION_ICONS: Record<ActionId, React.ComponentType<{ className?: string }>> = {
  new: Plus,
  duplicate: Copy,
  save: Save,
  validate: CheckCircle2,
  delete: Trash2,
  refresh: RotateCw,
  filter: Filter,
  import: Upload,
  export: Download,
  advanceTick: FastForward,
};

// Hook for keyboard shortcuts
function useKeyboardShortcuts(actions: ActionDef[], extraActions: ActionDef[] = []) {
  useEffect(() => {
    const allActions = [...actions, ...extraActions];
    
    const handleKeydown = (event: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as any)?.isContentEditable
      ) {
        return;
      }

      for (const action of allActions) {
        if (!action.kbd || action.disabled) continue;

        const kbd = action.kbd.toLowerCase();
        const isCtrlCmd = event.metaKey || event.ctrlKey;
        const key = event.key.toLowerCase();

        let shouldTrigger = false;

        if (kbd === "n" && key === "n" && !isCtrlCmd) {
          shouldTrigger = true;
        } else if (kbd === "ctrl+s" && key === "s" && isCtrlCmd) {
          shouldTrigger = true;
          event.preventDefault(); // Prevent browser save
        } else if (kbd === "del" && (key === "delete" || key === "del")) {
          shouldTrigger = true;
        } else if (kbd === "r" && key === "r" && !isCtrlCmd) {
          shouldTrigger = true;
        } else if (kbd === "v" && key === "v" && !isCtrlCmd) {
          shouldTrigger = true;
        } else if (kbd === "f" && key === "f" && !isCtrlCmd) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          event.preventDefault();
          action.onClick();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [actions, extraActions]);
}

// Action button component
function ActionButton({ 
  action, 
  compact = false 
}: { 
  action: ActionDef; 
  compact?: boolean; 
}) {
  const Icon = action.icon || ACTION_ICONS[action.id];
  
  const baseClasses = `
    inline-flex items-center gap-2 rounded-xl border border-slate-700
    focus:outline-none focus:ring-2 focus:ring-indigo-500
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors duration-150
    ${compact ? "px-2 py-1" : "px-3 py-1.5"}
  `.trim();

  const variantClasses = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500",
    danger: "bg-rose-600 hover:bg-rose-500 text-white border-rose-500", 
    ghost: "bg-slate-800 hover:bg-slate-700 text-slate-200"
  };

  const variant = action.variant || "ghost";
  const className = `${baseClasses} ${variantClasses[variant]}`;

  const tooltipText = action.tooltip || action.label;
  const fullTooltip = action.kbd ? `${tooltipText} (${action.kbd})` : tooltipText;

  return (
    <button
      type="button"
      className={className}
      onClick={action.onClick}
      disabled={action.disabled}
      aria-label={action.label}
      title={fullTooltip}
      aria-disabled={action.disabled}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="text-sm font-medium">{action.label}</span>
      {action.kbd && (
        <span className="text-xs text-slate-400 bg-slate-700 px-1 rounded">
          {action.kbd}
        </span>
      )}
    </button>
  );
}

export default function ActionBar({
  title,
  scope,
  actions,
  extraActions = [],
  busy = false,
  compact = false
}: ActionBarProps) {
  useKeyboardShortcuts(actions, extraActions);

  return (
    <div className="relative">
      {/* Busy overlay */}
      {busy && (
        <div className="absolute inset-0 bg-slate-900/50 rounded-xl flex items-center justify-center z-10">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        </div>
      )}
      
      <div className={`
        flex items-center justify-between p-4 bg-slate-900/50 rounded-xl 
        border border-slate-700 shadow-sm ${compact ? "p-3" : "p-4"}
      `}>
        {/* Left side: Title + Core Actions */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
          <div className="flex items-center gap-2">
            {actions.map((action) => (
              <ActionButton 
                key={action.id} 
                action={action} 
                compact={compact} 
              />
            ))}
          </div>
        </div>

        {/* Right side: Extra Actions */}
        {extraActions.length > 0 && (
          <div className="flex items-center gap-2">
            {extraActions.map((action) => (
              <ActionButton 
                key={action.id} 
                action={action} 
                compact={compact} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}