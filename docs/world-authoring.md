# Authoring lab and small world SDK

Open `#/academy?tab=worlds`. Ordinary games remain independent of this advanced
tool. Start with Reserve Lesson, then Town Zero. Forms edit clock, resources,
visibility, role capabilities, locations, facilities, predicates, objectives,
actions, macro costs/durations, schedules and delayed effects. Add resources,
actions or events and inspect JSON. Immediate validation blocks invalid preview.
Export/import data-only packs for local exchange; no provider is required.

For a new developer-authored family:

1. Copy `tutorialWorld()` in `src/worlds/townZero.ts`. Change its safe id/version,
   objective text and bounded resources/locations/roles.
2. Add predefined actions with explicit costs, predicates, effects and delay.
   Give only intended roles each action/resource/location capability.
3. Add finite schedules and visibility rules. Never supply a callback or script.
4. Call `compileWorld` / `requireWorld`; display structured failures and stop.
5. Use `createWorldEnvironment` for synchronous headless control, or
   `WorldSession` for human/baseline/model bindings and lifecycle.
6. Use `WorldRecorder` and `verifyWorldReceipt` to retain/replay evidence.
7. Use `generateExperiment` for frozen disjoint partitions and declared transfer
   mutations. A new world needs data and the generic board, not a bespoke
   model controller or another giant renderer.

The public controller view contains masked resources/status/flags, public
objectives, small signals, legal intent ids/costs, role/time and permitted map.
No snapshot, private PRNG, scheduler, state mutation method, provider credential,
shell or filesystem capability is supplied. Human input and provider proposals
reach the same validator. A provider can propose a poor legal action; it cannot
change rules, claim a score or write the state.

Use Step or choose event/decision/day/tick-cap autonomy. Pause, stop or replace
a role at any time. Public notebook/plan edits have their own bounded schemas
and do not change world authority. Saved runs restore stopped and disconnected.
The generic mock is an authored teaching policy; arbitrary new ids need an
appropriate public baseline or operator/model decisions, not a claimed AI pass.


**Compare public context strategies** freezes three offline mock controllers with
different context modes on identical instances. The mock is an authored policy;
equal outcomes do not establish real-model memory equivalence. **Individual frozen
trials** recreates the selected offline run and checks its hash rather than saving
an unlimited receipt archive. Select a role to view its explicit plan/memory and
use the public handoff controls for human, baseline, mock or selected local model.

**Recorded behavior profile** shows completion alongside reserves, recovery time,
repeated rejections, delayed outages and action costs. A repeat means the same
role/action has the same blocked/conflict outcome again before a successful
execution. A delayed outage means an entity changes from a nonzero status to
zero through an event scheduled on an earlier tick; canceled events do not count.
In Town Zero this provides an operational measure of unresolved delayed facility
consequences. It does not infer that a controller forgot or understood anything.
Costs sum only world-authorized executed action costs, per resource; unlike units
are not merged into an efficiency score. Completion, cost distributions and
remaining reserves let operators assess the tradeoff. All diagnostics derive
from a fully verified receipt. Aggregate reports remain unsigned descriptive
summaries; individual trial recreation verifies the underlying recording.
