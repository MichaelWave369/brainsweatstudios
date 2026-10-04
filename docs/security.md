# Security guide

Imported WorldPacks, receipts, manifests and provider output are untrusted data.
V8 does not install executable worlds. The compiler allows only closed processors
implemented by the application. No eval, imported JavaScript, arbitrary HTML,
remote asset/script, shell, network, filesystem or dynamic property access exists
in the WorldSpec execution path. Byte limits precede parsing; iterative traversal
rejects excessive depth/nodes, nonfinite values, accessors and prototype keys.

| Threat | Boundary / regression |
|---|---|
| Unknown fields/rules, script/URL/HTML/shell fragments | Strict keys and plain-text/identifier validators; malformed imports reject atomically |
| Duplicate ids, invalid refs, role escalation | Typed references, action/resource/location/signal scopes and runtime actor checks |
| Cyclic scheduling/objectives | Static dependency checks; no user loops or callbacks |
| Event/effect explosion | 128 queued operations, 32 fired per frame, 512 effects, 4,096 predicate-node evaluations and bounded ledger |
| Reusing a scarce resource / shared asset | Costs rechecked in deterministic role order; exclusive reservations persist through macros |
| Hidden-state leakage | Detached role projections, buckets, paid reveals, public event filtering; no RNG, scheduler or snapshot sent to providers |
| Slow/disconnected or stale controller | Deadline/abort/epoch checks, bounded lifetime requests and explicit operator replacement |
| Redigested receipt/checkpoint manipulation | Full transition replay, actor/controller attribution, chain, state and checkpoint verification |
| Forged summary or split labels | Recomputed distributions, content identities independent of partition, declared transfer mutations |
| Storage/work exhaustion | Independent artifact caps, one bounded local recording/comparison, worker termination and stopped restore |

A runtime bound failure rolls back the current step, records SIMULATION_LIMIT
and terminates with explicit evidence. An invalid actor/turn/action is rejected
before a transition. Rejected lifecycle/artifact changes preserve the previous
controller/status/memory. Partial/error/budget receipts remain labeled partial;
they cannot claim a successful terminal result.

Operator inspection may show authoritative state. That view is not the model's
observation. Public notes/plans are untrusted supplied artifacts, never hidden
reasoning or execution authority. Hashes and local receipts are unsigned;
reproducible simulation does not authenticate a provider/person or permit server
competition submission of a claimed score.

V6/V7 individual validators and online server authority remain intact. The
[agent threat model](agent-security.md) and [bridge guide](agent-bridge.md) cover
unchanged loopback origin/Host/token/body/concurrency/upstream controls. Only an
explicit connection and selected installed model enable optional local requests;
no cloud fallback, model download or online infrastructure activation is added.
See [privacy](privacy.md) and [repository reporting instructions](../SECURITY.md).
