# Version 6 baseline audit and implementation plan

## Frozen baseline

Version 5 is reproducible at `a5f107b4f8b413d07630858036090c46deb9fa72`
(application source `93ec2a31853bca15329edcb05b186640c2ca79da`). No tag is needed.
`git archive a5f107b4f8b413d07630858036090c46deb9fa72` reconstructs it. The
37-world manifest normalizes eight missions and three modes: 888 slots. There
are 48 classes and 80 badges. See [the immutable V5 evidence](verification-v5.md).

GitHub run 37141747478 passed lint, build, 133 unit tests, all 888 authored
mission runs, and Chromium/Firefox/WebKit integration (1,066 passes, two
Chromium-specific instrumentation skips). Run 37141747445 passed the production
prefix build, isolated PostgreSQL permissions/CAS, returning-player upgrades,
all lazy routes offline, academy persistence, 40 production browser checks and
published-site verification. Public online remains unconfigured; isolated online
tests do not mean a public multiplayer service is deployed.

## Coupling found before extraction

| Area | Existing behavior | V6 action |
|---|---|---|
| Arenas | Pure rules inside a module also containing driving/trade/safety rules | Extract only agent rules; preserve legacy exports, states and results |
| React checkpoints | React stores serializable state, validated on reload; running timers restart stopped | Keep checkpoint payloads; route transitions through headless authority |
| Search | Bounded first-match rule search on eight training seeds | Use common environment; add explicit validation/holdout groups |
| Rover | Q-learning, separate exploration/environment random streams, 294×4 table | Extract dynamics; retain learning algorithm, expose chosen versus wind-executed action |
| Replay | Arena coordinates; Academy recomputes some prefixes; wind trace records executed moves only | Versioned receipts store intended actions and verify every transition |
| Imports | Strict version 1 policy and local profile v1/v2 validators | Retain legacy formats; add strict data-only packages, receipts and manifests |
| Online | Server chooses seeds, evaluates policy, conceals other results, atomic CAS | Evaluate through the same runtime; preserve secrecy/CAS and public deployment status |
| Rendering | Native WebGL2 and vector fallback consume plain state; presentation has its own randomness | Keep renderer outside authority; add inspector in Academy only |
| Metadata | HTML still says twelve games; some current copy duplicates counts/version | Derive current counts; generate build metadata, preserve historical evidence |
| CI | Full gameplay workflow plus production build/deploy/live workflow | Keep coverage; run production checks on PR without deploying |

Local fresh install succeeded with locked packages (the offline attempt lacked
one cached dependency). Browser executables are provided by CI; local browser
availability will be recorded separately from actual browser evidence.

## Concrete implementation order

1. Freeze this audit, recheck baseline and open a draft branch. Extract arena
   and rover rules into a React-free package. Focused legacy tests and build.
2. Add typed environment/action/observation/snapshot contracts, deterministic
   hashes, adapters, versioned configuration and minimal ordered multi-agent
   substrate. Prove behavior parity, immutable boundaries and seed isolation.
3. Add bounded receipts with authoritative verification, strict controller
   packages, split/curriculum/transfer data and reproducible manifests. Add
   headless regression sweeps and profile before optimizing.
4. Move human, policy, search, learner and server competition execution through
   the boundary. Add a local Academy experiment/trace inspector. Preserve
   legacy save imports; keep advanced tooling out of normal worlds.
5. Repair metadata/counts, document contracts/architecture/privacy/online,
   exercise malformed imports, full browser/a11y/ES/mobile/reduced-motion,
   offline/update/legacy saves and isolated server/database authority.
6. Provide the final green branch, screenshots and verification report for
   review. Operator approval is required before publishing V6. Actual live V6
   verification follows approval; a PR production build is not a live release.

No external model SDK, provider key, new paid service, account billing change,
production secret change or public online activation is part of this rung.
