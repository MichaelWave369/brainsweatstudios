# V7 agent security and privacy boundaries

Model capability gives no extra world authority. The world alone validates
actors/actions and computes rewards/results. Models receive public observations
and legal intents; no mutable world, snapshots, credentials, shell, filesystem,
JS loader, online service token or provider key. Environmental signs/notebooks
are untrusted data, visibly distinct from task instructions. A compromised model
can choose bad legal actions; it cannot bypass the transition rules.

The optional bridge is loopback-only with exact origin/Host/routes/methods,
ephemeral session token, no cookies, fixed upstream paths, streaming byte limits,
timeouts, cancellation, request/concurrency/connection caps. It rejects null and
unknown origins, forwarded hosts, arbitrary URLs, unknown fields, compressed or
oversized bodies and unsupported model entries. It never invokes pull/delete,
remote cloud URLs, shell or filesystem endpoints. Public origin access is an
explicit operator choice; browser permissions still apply. See [bridge](agent-bridge.md).

Tests use a fake upstream and actual loopback HTTP to check discovery/projection,
private-thinking removal, origins/null/Host/session/routes/methods/preflights,
malformed/oversized bodies, concurrency/deadlines/client disconnect, model
selection and transport failure. This is security regression coverage, not a
penetration-test certification or real-model qualification. No external AI is CI.

Receipts/manifests/packages have strict schemas, finite values, compatibility
checks, byte/work caps and action replay from configured initial state. A new
digest cannot conceal a changed observation, transition, reward or final state.
Annotations and provider identity remain unsigned claims; the online server
never trusts client hashes/scores. Existing online rules competitions retain
server-selected seeds and independently executed data-only policies. Model
competitions are future work; no remote model controls the server in V7.

Stop/pause/handoff/disconnect abort pending inference and stale replies are
ignored. No unbounded requests, traces, contexts, notebooks, retries or imported
programs. Records stop before they cannot retain action evidence. Errors are
typed projections, not raw upstream exception text or private output.

Observations, model-provided short public notes, notebooks, receipts and model
experiments remain in anonymous local profiles/backups. A selected local model
sees only simulation data explicitly sent to the connected bridge. No analytics,
background cloud request, automatic upload or competition submission. Actual
model logs/storage are controlled by the operator's local provider; the studio
does not configure it. Clearing local progress removes Garage records through
the existing reset flow. Connection/session tokens are memory-only and excluded
from every profile and export. No production secret or paid service is activated.
