# engine/overseer.py
"""Mock Overseer: proposes GameEvents from compact world snapshots.
Replace with an LLM call or heuristic later."""
from typing import List, Dict, Any

def overseer_pass(world: Dict[str, Any], arcs: List[Dict[str, Any]], entities: List[Dict[str, Any]], diff: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
    tension = world.get("tension", 0.0)
    proposals: List[Dict[str, Any]] = []

    # Simple heuristic: if tension moderate, seed a rumor; if high, push a parley
    if tension < 0.6:
        proposals.append({
            "id": "ev_rumor_001",
            "type": "rumor",
            "title": "Child from the woods",
            "payload": {
                "location": "greenfall",
                "content": "A child claims the village is under siege—details are inconsistent.",
                "impacts": {"f_town": {"stability": -0.03}}
            },
            "priority": 3,
            "tags": ["hook","investigation"]
        })
    else:
        proposals.append({
            "id": "ev_negotiation_offer",
            "type": "dialogue",
            "title": "Parley with the Ash Dune Riders",
            "payload": {
                "speaker": "npc_raider_chief",
                "targets": ["player"],
                "options": ["pay_tribute","joint_raid","betray_town","refuse"],
                "skill_checks": {"diplomacy": 18, "deception": 16}
            },
            "priority": 4
        })

    return proposals
