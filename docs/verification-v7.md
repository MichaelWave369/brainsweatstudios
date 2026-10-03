# Version 7 verification

V7 is under review on `v7-model-controllers`; public GitHub Pages remains V6
until the operator merges the PR. [Frozen V6 audit](v7-audit.md) identifies the
baseline and its published green evidence. No release tag, automatic merge,
paid service, model download or production secret change.

Local checks: locked installation, lint, TypeScript/production build, all 206
unit tests, original 1,000-episode deterministic runtime sweep and new mock agent
harness. The focused 44 model/bridge tests cover action authority, all eight
worlds, illegal/malformed/refusal/oversized/timeout output, bounded retries,
pause/stop/stale replies, handoffs, cooperation/masks, partial information costs,
contexts/notebooks, redigested replay tampering, split/transfer manifest reruns,
loopback origins/Host/bodies/concurrency/deadlines/disconnect and secret projection.
Malformed discovery metadata and provider envelopes (including missing or extra
usage fields) are rejected before presentation or world execution; failed output
still produces a verifiable rejected-decision receipt.
Large frozen-table handoffs are rejected atomically before the whole recording
overflows. A legacy receipt still verifies and restores within its existing
import bound; older local comparisons are pruned when necessary to preserve it.

The mock harness completes 32 episodes (786 world ticks), verifies 33 replays,
runs and reruns an eight-trial frozen experiment and recovers six deliberately
illegal proposals. A recorded local run took 1,464 ms: 36 ms in world steps,
136 ms awaiting mock controllers and 502 ms verifying receipts. Its largest
receipt was 208,619 bytes; the four cooperative episodes used 36 ticks total.
Displayed steps yield for 35 ms; existing render caps remain. Timings are
machine-specific, not a real-model latency claim. The unchanged V6 sweep checked
76,766 transitions, 978 goals and 15 receipt replays in 1,166 ms. The shared
profile-validation bundle is now 543 KB minified (192 KB gzip); Vite reports its
500 KB advisory. No build assertion or warning threshold was lowered.
`npm run qualify:ollama` reports **unavailable**, with zero models/trials on this
workspace. No real Ollama/model success is claimed. Bridge and browser transport
mocks are separate from real-model qualification.

Read the latest full browser and production results on [PR #2](https://github.com/larrinamsalva/brainsweatstudios/pull/2).
The workflows run 21 Garage cases (seven per Chromium/Firefox/WebKit), while
retaining the 18 runtime, 16 Academy cases,
ten WebKit persistence repeats, full 888 authored mission sweep, existing
accessibility/localization/graphics/online checks, PostgreSQL/Deno packaging,
service-worker stale-reproduction/two-tab upgrade and all-world offline checks.
Production and future actual-public verification also run the offline Garage,
action replay and profile restoration. No existing meaningful coverage was lowered.

The [seven review captures](screenshots/v7) were taken from the actual production
PR build at `03feabcb188dc194a2c90274f582e8dcf04db82c`, before the follow-up fixes.
They cover the studio, Survey, Community Restore, retry recovery/inspection,
frozen comparison, mobile and Spanish. Each later production workflow attaches
fresh captures for its own checked head under `rung-seven-studio-review`.
Live V7 verification is intentionally pending operator merge. Current public
online remains configuration-pending; local models are optional, and model
competitions remain future work.
The first PR browser pass had 19/21 Garage cases and 52/53 production browser
cases green. Its two offline-test failures switched networking off before the
lazy Academy screen finished loading (and counted same-origin static/worker GETs
as provider calls). The test now waits for the Garage controls, checks actual
provider/external requests and network writes, and keeps the offline execution
and receipt assertions. The independent full production offline/reload check
already passed. No skip, unconditional retry or loosened game assertion was added.
