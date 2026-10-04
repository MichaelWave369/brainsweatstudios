# Town Zero

Town Zero is one data-defined fictional settlement family, separate from the
37 human game worlds. Standard curricula last 7, 14 or 30 simulated days:
168, 336 or 720 authoritative hourly frames. Resource/status units and every
repair are abstract. The scene provides no actual utility or emergency procedure.

Power, water, food, fuel, parts, budget, roads, communications, maintenance and
seeded weather interact. Daily demand needs production. A worn pump produces
less water and spends additional energy; ignoring maintenance schedules a
later failure. Maintenance consumes parts/budget now and completes several
hours later. Storms can block deliveries, drain reserves and queue a later
communications outage. A failed delivery does not erase future opportunities.

| Role | Examples of authority |
|---|---|
| Planner | Fictional funding, supply reserves, reduced demand |
| Logistics | Food/fuel delivery, water measurement, road recovery |
| Infrastructure | Generator/pump inspection and delayed maintenance |
| Communications | Tower recovery and structured team signals |

Roles have scoped actions, resource permissions and permitted connected
locations. Inspection reveals a hidden facility only to its authorized role.
Water is initially a LOW/MEDIUM/HIGH bucket; measurement reveals exact units
only to the declared roles. No controller receives the scheduler, hidden daily
pulse, RNG, future variants or authoritative snapshot.

The campaign owns objective truth. Success requires functional reserves and
available abstract utilities at the end; reserves, roads and communications are
additional visible objectives. Resources exhausted, a failed critical objective,
missed end condition or runtime cap is an explicit failure, not model narration.
Recovery counts offline-to-available facility transitions and their simulated
delay. Conflicts, blocked attempts, inspections and signals remain separate.

Five public baselines are inspectable in `worlds/controllers.ts`: greedy,
maintenance-first, reserve-first, objective-priority and reactive. They are
authored policies, not trained intelligence. Models, human role rotation and
mixed teams all reach the same authority validator. The mock is a deterministic
teaching policy; actual Ollama availability is recorded separately.

`reserve-lesson` is a tiny 12-tick teaching world. Inspect hidden water tokens,
pay to queue a refill, and preserve a reserve through delayed demand. It uses
the same compiler, runtime, controller contracts, receipts and UI as Town Zero.
