# V8 verification and release gate

V8 is built in [PR #3](https://github.com/larrinamsalva/brainsweatstudios/pull/3).
It has not been merged or published. The actual public studio remains V7.
A reviewed merge, Pages deployment and actual-live verification remain required
before calling V8 released. No release tag, model download, paid service,
production credential change or public online activation was made.

The immutable starting main is `343d6c0fdd334b79e5b62aadadb195af1d7a2ff3`;
published V7 code is `a50ac5e9f92b489db5e3d82096b44d0d37ba5185`.
[Audit and implementation plan](v8-audit.md) records the fresh baseline.
The 37 human worlds, 48 classes and 888 authored mission slots remain unchanged.
V6/V7 individual schemas and their original validators remain independent.

## Current evidence

Local source has 256 passing unit cases (the original 206 plus 50 V8 cases),
lint, TypeScript and production build. Fresh CI also passes those checks. Browser
verification is still running after the fixes below; pending checks are not passes.

| Check | Recorded result |
|---|---|
| Locked install, lint, TypeScript and production build | Passed locally / in CI |
| Full unit suite | 256 passed; original assertions retained |
| Original headless runtime | 1,000 episodes; 76,766 steps; 978 successes; 15 verified replays |
| Existing deterministic mock sweep | 32 successes; 786 ticks; 33 verified replays; eight frozen trials; six recoveries |
| Town Zero headless | Full 7- and 30-day campaigns and 20-/100-world batches passed |
| New world validation/authority/receipts/family tests | Passed |
| Existing Academy/runtime/Garage browser cases | Passed in prior V8 CI; fresh full regression running |
| New World Lab browser cases | Long campaigns, human handoffs, rejection and offline worker flows passed; final three-browser rerun pending |
| Production upgrade/offline/online SQL checks | Passed in V8 CI |
| Full 888-mission and broader accessibility suite | Fresh V8 sweep pending |
| Actual Pages V8 / live verification | Pending reviewed merge |
| Actual installed Ollama | UNAVAILABLE; no models or trials |

The current regression workflows exercise all existing suites without lowering
assertions/deadlines or adding unconditional retries. The new World Lab suite
checks 7-/30-day mock replay, human delayed actions/plans/memory/handoffs, atomic
imports, worker manifests and individual frozen receipt reproduction, Spanish,
keyboard/aXe/narrow layouts, hidden/pause lifecycle and production outage recovery.
Local browser execution was blocked by missing executables and an unsuccessful
browser download; browser evidence comes from the actual production CI build.

## Boundaries exercised

The 50 V8 cases cover strict schema/size/depth/finite values, malformed packs,
prototype keys/getters/unsafe processors, duplicate ids/references/cycles,
role scopes, detached masks/hidden buckets, paid inspection, delayed costs and
actual cancellation provenance, scheduler overflow and finite accounting,
simultaneous shared assets and completion-order independence, ignored aborts,
timeouts/request economy, rejected lifecycle/artifact updates, long hash-chain/
checkpoint replay, redigested tampering, stopped restore with receipt identity,
controller memory/plan persistence, generic provider-request@2, reproducible
100-instance families, split leakage, bounded mutations/distributions, isolated
frozen trial selection and three public context strategies.

Offline context comparisons use the authored deterministic mock. They establish
the experiment mechanism; no actual-model memory/recovery result is claimed.
Unsigned receipts prove simulation replay, not who generated an action or a
provider's private reasoning. No IQ, general intelligence or certification claim.

## Measured local capacity

The [machine-readable result](v8-performance.json) comes from the shared headless
runtime. Measurements are machine-specific, descriptive and outside React/provider
latency. The 10,000-step sample resets 30-day campaigns; it is not one 10,000-hour
Town Zero scenario or an arbitrary-scale promise.

| Work | Time | Evidence size / count |
|---|---:|---:|
| 1,000 authoritative steps | 231 ms | Two campaigns |
| 10,000 authoritative steps | 1,876 ms | 14 campaigns |
| Full 7 days | 86 ms | 168 ticks; 201,824-byte receipt |
| Full 30 days | 281 ms | 720 ticks; 799,560-byte receipt |
| Full 30-day receipt verification | 302 ms | Every transition/checkpoint |
| Frozen 20-world batch | 3,077 ms | 20 verified trials |
| Sequential 100-episode batch | 15,657 ms | 100 verified trials |
| Generated family | 515 ms | 100 disjoint reproducible instances |

Standalone recordings are capped at 8 MB; local World Lab saves at 1.1 MB.
The new UI is lazy loaded (~44 KB minified) and the batch worker is ~67 KB.
The shared profile bundle remains ~550 KB minified / 188 KB gzip, with Vite's
original 500 KB advisory retained. Production precaches the worker and 41 static
assets. No warning or build threshold was relaxed.

## Findings corrected during verification

Initial V8 CI saturated the small runner with concurrent deterministic searches.
Unit file concurrency is now bounded at two, preserving original test deadlines.
Short runtime trials share a bounded 12 ms slice to avoid repeatedly rendering
the trace inspector between each trial; existing Firefox/WebKit regressions pass.
New aXe checks found keyboard-inaccessible overflow tables; scroll regions and
JSON views now receive keyboard focus. Restoring a completed frozen receipt now
preserves its original ending/hash until new evidence is added, while the session
itself starts STOPPED.

Playwright 1.63 WebKit rejects service-worker reload with its offline-emulation
flag, also reproduced [upstream](https://github.com/microsoft/playwright/issues/42775).
The production-outage test closes an isolated origin server and proves ordinary
network fetch fails, then requires a 200 service-worker response, stopped restore,
replay and worker comparison. Chromium/Firefox also set the offline flag. This
retains three-browser outage coverage without skipping or retrying the failure.

Initial production review captures were inspected from code commit
`210c029ba408b50490435aa5e3bcfecd910e7434` in
[this workflow](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37170902015).
Final checked captures are generated by the same production workflow. These are
real UI screenshots of fictional baselines, not generated mockups or model results.
