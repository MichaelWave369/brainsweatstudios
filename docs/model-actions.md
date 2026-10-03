# Proposals, receipts and manifests

A provider returns one data-only JSON proposal:

```json
{"action":{"type":"scan"},"confidence":0.8,"note":"Inspect the current site."}
```

Action has exactly one type from that actor's enabled legal intents. Confidence
is optional, finite 0–1 and is model-supplied, not calibrated success probability.
Note is optional, at most 200 characters and a public annotation, not verified
reasoning. Unknown fields, code/tools/score claims, illegal actions, extra action
parameters, out-of-range values, empty/malformed/oversized output fail without
advancing the world. Optional notebook updates use the exact bounded notebook
schema. No chain-of-thought field is requested or accepted.

Model text is parsed and validated, then the world validates the intent again.
The inspector separates proposed, validated and executed action. Rover wind may
change execution. A collision or unmet precondition is a legal world outcome;
it may consume a tick even though task progress did not occur. Terminal masks
are empty. World reward/result is computed only by the environment.

## Artifacts and versions

| Schema | Meaning |
|---|---|
| agent-controller@1 | Secret-free descriptor; fixed provider/model/config and optional validated V6 rule/Q package |
| provider-request@1 | mission@1 instructions, model-observation@1, context and budgets |
| agent-notebook@1 | Bounded facts/plans/warnings/completed/unresolved public notes |
| model-episode@1 | Full public decision/action/world evidence plus controller bindings and handoffs |
| model-experiment@1 | Frozen split/transfer comparison settings and measured summaries/hashes |
| agent-garage@1 | One verified receipt, two manifests; profile schema remains 2 |

V6 `controller@1`, `episode@1`, `experiment@1` and runtime/environment 1.0.0
retain their validators and behavior. Unsupported versions fail; imports never
rewrite an old artifact into a claimed newer model execution. Files are data,
not plugins or arbitrary programs. V5/V6 profiles gain an empty Garage.

A model receipt records independent versions, episode/config, initial controller
bindings/hash, context strategy, budgets, ordered records, handoffs, requestsUsed,
result/final hash, ending, world/model trace hashes and integrity digest. Records
include observation/mask/context, every bounded attempt (action summary, public
note, code, sequence, timing and reported usage), validated intent, authoritative
transition/events/reward/result, state hash, world step timing and notebook.
Cancelled requests count toward requestsUsed even if no late output is recorded.
Raw responses/thinking/error bodies, bridge tokens and endpoint secrets are absent.

Verifier bounds size/work, checks versions/digest/identity/handoff ordering,
reconstructs the exact world, observations and contexts, repeats every validated
intent, and checks events/reward/result/hash/notebook. Rejected proposals must
leave the world unchanged. Stopped/error/budget partial episodes are supported
and labeled honestly. An unsigned receipt proves recorded world replay, not
who authored/generated the action, a model's private rationale or an actual
provider's identity. Hashes are not signatures or server competition authority.

World trace hashes omit provider timing/notes but include authoritative actions
and transitions. Model trace hashes include public proposals/config/context,
excluding wall-clock timing. Asking a real model again can change either; rerun
reports matches/differences rather than claiming deterministic model generation.
Mock generation is deterministic for frozen settings and request sequence.

Manifests require V6's disjoint eight-seed recipe and explicitly select one to
four trials per group. Reports store exact measured trial order, action/model
trace hashes, completion/score/ticks/reserves/errors/retries/failures, transfer
and baseline deltas, bounded recovery counts, actual requests and optional usage.
A manifest rerun makes fresh inference calls only through an explicitly connected
local provider. Receipt replay never contacts a provider. Import never executes
file code, accepts remote scores, automatically uploads or tunes against holdout.

Limits: 500 KB agent import/save/receipt, two recent manifests, ≤240 records,
≤32 handoffs, ≤120 world ticks, ≤240 controller requests. Recording stops before
an action when its bounded evidence cannot be retained. Full Academy file import
is 1.5 MB; full progress retains its existing 2 MB limit. Connection state and
running work resume disconnected/stopped after refresh/import.
