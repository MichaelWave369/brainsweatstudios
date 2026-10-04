# V8 frozen starting audit and implementation plan

Baseline main: `343d6c0fdd334b79e5b62aadadb195af1d7a2ff3`. Published V7
code: `a50ac5e9f92b489db5e3d82096b44d0d37ba5185`, identical to reviewed
PR #2's code tree. This commit only adds published evidence. No release tag
was created. The repository, rather than the campaign's approximate counts,
is the source of truth: 37 human worlds, 48 classes, 888 mission slots.

Fresh locked install, lint, all 206 unit cases, production build, original
headless sweep (1,000 episodes, 76,766 steps, 978 goals, 15 verified replays),
and mock sweep (32 successes, 786 ticks, 33 verified replays, eight frozen
trials, six recoveries) pass. Logs were captured before edits. Timings were
1,159 ms and 1,409 ms for the respective sweeps on this machine. Existing
production bundle retains its 500 KB advisory. Browser evidence is recorded
separately; an absent browser executable is not a passing test.

Read: README, V7 verification/audit, architecture, Academy, runtime,
controllers, observation/action contracts, bridge/security, online guide,
runtime/agents/training/profile/import implementations, and CI. No applicable
AGENTS.md exists. V6 authority and V7 model receipts are independent contracts;
their validators and artifact versions must remain intact. Online service
configuration remains pending; this campaign does not change it.

## Concrete implementation

1. Add a separate, provider-free `src/worlds/` data contract, strict compiler,
   allowlisted bounded rule interpreter, and content-addressed WorldPack.
   No migration of existing game worlds. Reject schedule/dependency cycles
   before a world starts.
2. Add explicit seed streams, deterministic simulation clock, capped scheduler,
   delayed macros, scoped roles, observations, structured signals and ordered /
   deterministic simultaneous proposals. Record actual provenance.
3. Add compact hash-chained action/event receipts and periodic checkpoints;
   verify by rerunning the same rules. Restore only verified recordings.
4. Author a tiny teaching world and one interacting Town Zero family (7–30
   simulated days). Add transparent baselines and generic V8 provider contracts,
   separate actor contexts/budgets, cancellable inference and operator handoffs.
5. Add explicit frozen split/mutation manifests, descriptive batch comparisons
   and reproducible instance hashes. No automatic holdout tuning.
6. Add a fifth advanced Academy tool with forms, validated preview, operations
   board, replay/causal inspector, bounded saving, English/Spanish controls.
   Normal games/rewards stay on their existing code path.
7. Add security, determinism, authority, replay, lifecycle, compatibility,
   browser/offline regressions and measured long-run benchmarks. Keep every
   existing assertion and release through a reviewable PR; live deployment
   requires the operator's reviewed merge.

Stretch work follows only after core checks are green. Real Ollama trials must
be reported unavailable if no installed local provider is reachable. Receipts
are unsigned reproducibility evidence, not identity or professional credentials.
