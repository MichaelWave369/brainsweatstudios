# Version 7 verification

V7 is under review on `v7-model-controllers`; public GitHub Pages remains V6
until the operator merges the PR. [Frozen V6 audit](v7-audit.md) identifies the
baseline and its published green evidence. No release tag, automatic merge,
paid service, model download or production secret change.

Local checks: locked installation, lint, TypeScript/production build, all 199
unit tests, original 1,000-episode deterministic runtime sweep and new mock agent
harness. The focused 37 model/bridge tests cover action authority, all eight
worlds, illegal/malformed/refusal/oversized/timeout output, bounded retries,
pause/stop/stale replies, handoffs, cooperation/masks, partial information costs,
contexts/notebooks, redigested replay tampering, split/transfer manifest reruns,
loopback origins/Host/bodies/concurrency/deadlines/disconnect and secret projection.

The mock harness completes 32 episodes, verifies 33 replays, runs and reruns
an eight-trial frozen experiment and recovers six deliberately illegal proposals.
Timing is machine-specific and will be recorded alongside final checks.
`npm run qualify:ollama` reports **unavailable**, with zero models/trials on this
workspace. No real Ollama/model success is claimed. Bridge and browser transport
mocks are separate from real-model qualification.

PR browser/production evidence is pending. Added 21 Garage cases (seven per
Chromium/Firefox/WebKit), while retaining the 18 runtime, 16 Academy cases,
ten WebKit persistence repeats, full 888 authored mission sweep, existing
accessibility/localization/graphics/online checks, PostgreSQL/Deno packaging,
service-worker stale-reproduction/two-tab upgrade and all-world offline checks.
Production and future actual-public verification also run the offline Garage,
action replay and profile restoration. No existing meaningful coverage was lowered.

Review captures will be taken from the actual production PR build, not a mockup.
Live V7 verification is intentionally pending operator merge. Current public
online remains configuration-pending; local models are optional, and model
competitions remain future work.
