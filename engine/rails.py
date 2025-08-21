# engine/rails.py
"""Rails: deterministic handlers that apply GameEvents to the world state."""
from typing import Dict, Any, List

def apply_event(world: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    etype = event.get("type")
    payload = event.get("payload", {})
    diff: Dict[str, Any] = {"world": {}, "log": []}

    if etype == "rumor":
        content = payload.get("content", "") 
        world.setdefault("history_log", []).append(f"Rumor: {content}")
        # Apply simple stability impact if present
        impacts = payload.get("impacts", {})
        for fac, changes in impacts.items():
            # In this minimal demo, factions are keyed in world["factions"]
            if fac in world.get("factions", {}):
                for k, v in changes.items():
                    # Only handle numeric fields
                    if isinstance(v, (int, float)):
                        old = world["factions"][fac].get(k, 0.0)
                        world["factions"][fac][k] = old + v
                        diff["world"].setdefault("factions", {}).setdefault(fac, {})[k] = {"from": old, "to": old+v}
        diff["log"].append(f"Applied rumor '{event.get('title')}'")    

    elif etype == "dialogue":
        # In a real engine, push a dialogue state machine / UI hook
        world.setdefault("events", []).append("dialogue_available")
        diff["log"].append(f"Dialogue queued: {payload.get('speaker','unknown')} -> {payload.get('targets', [])}")
    else:
        diff["log"].append(f"Unhandled event type: {etype}")

    return diff
