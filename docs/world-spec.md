# WorldSpec 1

`brain-sweat-world@1` is bounded data. The application implements a fixed list
of processors; a pack supplies their parameters. It cannot supply JavaScript,
callbacks, scripts, HTML, shell commands, URLs, filesystem paths or network
capabilities. Application V8 leaves V6/V7 artifacts at their original versions.

`src/worlds/types.ts` is the exact TypeScript contract. `compiler.ts` validates
plain data, strict fields, versions, finite integer bounds, unique identifiers,
typed allowlisted references, role permissions, objective dependencies and
event scheduling cycles before producing an immutable compiled world. Failure
returns `{ok:false, errors:[{path,code,message}]}`; no partial environment starts.
Programmatic accessors are rejected without invoking them. File byte limits are
checked before JSON parsing; iterative traversal bounds depth and node count.

| Collection | Limit |
|---|---:|
| Roles / resources / locations | 4 / 16 / 16 |
| Entities / flags / objectives | 32 / 16 / 24 |
| Actions / events / rules | 48 / 32 / 24 |
| Effects in one definition / predicate children / predicate depth | 16 / 8 / 6 |
| Campaign ticks / future queued operations | 10,000 / 128 |
| Fired operations / effects / predicate-node evaluations in a step | 32 / 512 / 4,096 |
| Individual spec / pack | 128 KB / 256 KB |

Locations are an abstract directed graph. Role dispatch checks a reachable path
through permitted locations. Resources have integer min/max/initial values;
explicit production effects clamp at their documented bounds, and costs must
leave the resource above its minimum. Facilities expose abstract 0–100 status.
Flags are booleans. No operational infrastructure procedure is modeled.

Objectives have campaign/day/task labels, explicit parent/dependency ids,
conditions, criticality, optional deadlines and environment-defined failure
codes. Objective truth is evaluated by the world, never a controller plan.
Events have fixed or conditional initiation, bounded recurrence/run counts,
predefined effects and optionally seeded effect variants. Delays are positive.
See [rules](world-rules.md), [clock and receipts](long-horizon.md), and
[the SDK walkthrough](world-authoring.md).
