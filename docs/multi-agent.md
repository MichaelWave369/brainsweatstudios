# Shared-world teams

An actor has a unique id and one spec-defined role. The compiler checks role
actions, resource effects/costs, reachable locations and signal permission.
The runtime rejects unknown actors, wrong ordered turns and unavailable
actions before changing time/state. Legal attempts with missing resources or
preconditions produce blocked outcomes and consume a frame.

Ordered mode uses the spec's fixed role order. Simultaneous mode captures every
role's public observation before inference, then resolves the complete intent
set by spec role order. Input order and promise completion timing cannot change
priority. Exclusive assets stay reserved through a delayed operation. Shared
resource costs are rechecked against the actual state as intents resolve.
Busy roles can only wait; they cannot double-book their macro operations.

Signals are REQUEST_RESOURCE, RESOURCE_AVAILABLE, OBJECTIVE_COMPLETE,
OBJECTIVE_BLOCKED, NEED_INSPECTION, NEED_REPAIR, HOLD, PROCEED, RISK_DETECTED
and STATUS_REQUEST. The pack declares small resource/amount payloads and a
role/team recipient. Sender and simulated tick are authoritative. The recent
inbox holds at most 16 signals. Default communication has no unrestricted
model-to-model text or hidden channel.

Each actor has independent request accounting, public history, memory and
controller binding. Generic `provider-request@2` extends the provider-neutral
V7 port for long, data-defined worlds; old `provider-request@1` remains strict.
The same mock and optional local bridge serve both. The bridge has unchanged
loopback, origin, Host, body, upstream, timeout and concurrency restrictions.

Controller errors pause the frame without world mutation. Operator handoff
records actor, index, tick, old/new descriptor and note. Late replies after
pause, stop or replacement cannot act. Busy-role waits and a declared decision
interval reduce requests; a handoff cannot erase lifetime request accounting.
The model receives only masked state, legal actions and bounded public context.
Public plans/notebooks are inspectable claims, not private reasoning or authority.
