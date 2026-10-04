# Bounded rules

Predicates support `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `contains`, `all`, `any`
and `not`. References are exactly `tick`, `resource:ID`, `entity:ID`, `flag:ID`
and `objective:ID`. Compilation checks reference type against the literal
value/operator. There are no expressions, loops, recursion, dynamic property
paths, reflection or extensions supplied by a file.

```json
{"op":"all","rules":[
  {"op":"eq","ref":"flag:daily","value":true},
  {"op":"lt","ref":"entity:pump","value":60}
]}
```

The interpreter has bounded tree evaluation. `all`/`any` short-circuit in their
declared order. A step has an aggregate predicate-node budget; exceeding it
rolls back that step and records `SIMULATION_LIMIT` without partially applying
resource changes. Runtime event/effect/ledger/queue bounds use the same failure
path. Unauthorized actor/action/turn input is rejected before any transition.

| Effect | Authoritative change |
|---|---|
| resource | Bounded integer increment/decrement |
| entity / flag | Set abstract bounded status / boolean |
| move | Move a named entity to a validated location |
| reveal | Reveal a declared sensor target to named roles |
| schedule / cancel | Queue a bounded named event / cancel its queued runs |
| objective | Explicit complete/failed status owned by the world |
| signal | Preset type with small resource/amount payload |
| emit | Short plain public event label |

Action costs and reachable location are checked when resolving a proposal.
Effects occur immediately or at the end of a bounded macro duration. Future
events cannot execute imported code. Event-to-event schedule cycles are rejected
statically; condition-driven pressure is additionally capped at runtime.

The clock advances once per ordered action or once per simultaneous frame.
Each frame resolves actions, advances the clock, processes eligible scheduled
operations in due-time/insertion order, applies spec-order rules, evaluates
objectives and checks accounting. Initial events at zero fire on the first step.
Cancelled recurring opportunities still consume a bounded run and schedule
the next declared opportunity. Presentation timing never enters this sequence.
