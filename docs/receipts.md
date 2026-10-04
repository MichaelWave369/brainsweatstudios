# Artifact versions and verification

| Artifact | Schema and evidence |
|---|---|
| Original bounded runtime | `episode@1`; unchanged V6 world replay |
| V7 Garage | `model-episode@1`; unchanged model proposals + world replay |
| WorldSpec episode | `world-episode@1`; embedded pack, actor bindings, compact frames, checkpoints |
| World family | `world-family@1`; base spec, declared mutations, curricula and frozen holdout policy |
| World comparison | `world-experiment@1`, `world-batch@1`; exact instance/controller identities and distributions |
| Operator artifacts | `world-memory@1`, `world-plan@1`; bounded public controller-owned annotations |
| Profile extension | `world-lab@1`; save schema remains 2 |

Long verification checks strict shape/size/work bounds, pack/spec hashes,
seeds, initial state, handoff/artifact ordering, actor/controller attribution,
action validity, every world event/result/state hash, chain and checkpoint.
Tampered world evidence fails even after recomputing the outer digest.
Error records cannot advance state; successful completion cannot be claimed
for a nonterminal world. Model requests include separately counted abandoned
calls; network generation and supplied annotations remain unsigned claims.

Hash chain starts from pack/world/initial-state/seeds/actors and hashes previous
chain plus the canonical decision/frame record. Receipt digest also covers
bindings, annotations, handoffs, public artifacts and final result. There are
no signatures, server authority or blockchain claims. Replay verifies recorded
actions, not reproducible real-model generation.

Instance identity is `hash({worldHash,seed})`, independent of its partition
label. A duplicated id cannot be hidden by changing TRAIN to HOLDOUT. Mutations
must be declared and bounded; ordinary groups cannot contain transfer changes.
Candidate/baseline use the same instance set. Batches have no tuning step and
support only offline public baselines or the deterministic mock.

Reports preserve mean, median, min/max, sample count, success rate and failure
counts, alongside per-trial receipt hashes and behavior measures. Saved report
imports validate attribution, integrity and rederive distributions; an imported
manifest reruns its frozen trials. A summary alone is not an independently
verified world receipt. No significance, IQ, personality or professional claim.
