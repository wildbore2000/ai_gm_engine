# run_sim.py
import json, os
from engine.overseer import overseer_pass
from engine.rails import apply_event

ROOT = os.path.dirname(__file__)

def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)

def main():
    world = load_json(os.path.join(ROOT, 'data/world/world.json'))
    arcs = [load_json(os.path.join(ROOT, 'data/world/arc_cult_rise.json'))]
    entities = [load_json(os.path.join(ROOT, 'data/entities/npc_mira.json'))]

    print('World tension:', world.get('tension'))
    events = overseer_pass(world, arcs, entities, diff=None)

    print(f"Proposed {len(events)} event(s):")
    for e in events:
        print('-', e['title'], f"({e['type']})" )

    # Apply first event deterministically
    if events:
        diff = apply_event(world, events[0])
        print('\nApplied first event. Diff:')
        print(json.dumps(diff, indent=2))

        # Save updated world snapshot
        with open(os.path.join(ROOT, 'data/world/world_after.json'), 'w') as f:
            json.dump(world, f, indent=2)
        print("\nUpdated world saved to data/world/world_after.json")

if __name__ == '__main__':
    main()
