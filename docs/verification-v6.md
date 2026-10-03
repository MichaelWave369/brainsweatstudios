# Version 6 verification

**Release status: branch review; publication pending operator approval.** The
actual public site remains the verified V5 baseline. Production-prefix checks
on a PR do not mean V6 is live. No tag, secret, billing or service activation is
included. Public online configuration is still empty and described as pending.

## Acceptance scope

V6 keeps 37 worlds, 48 classes, 888 mission/difficulty slots and 80 badges. Five
agent simulation families now share an authoritative headless runtime. See
[baseline audit](v6-audit.md), [architecture](architecture.md),
[runtime contracts](agent-runtime.md), and [Academy guide](academy-guide.md).

Local checks pass install, ESLint, TypeScript/production build, the complete
unit suite, the headless harness and Deno 2.9.6 deployment-package check. Browser
executables are unavailable in this workspace, so real browser/production
evidence comes from GitHub Actions; no local launch failure is counted as a
passing browser check.

## Runtime evidence

- 48 golden arena outcomes were produced from immutable V5 source, covering all
  four arenas, all three difficulties and four seeds each. Headless authority
  matches them exactly. Existing 888 authored gameplay checks remain required.
- Frozen observations, detached snapshots, unavailable/invalid actions,
  terminal masks, strict restore and deterministic reset/step/hash are tested.
- Human, authored, rules, replay and frozen-Q adapters use the same boundary.
  Wind receipts preserve requested and executed actions separately.
- Replay verification checks every observation, mask, event, reward, changed
  field, step hash and terminal result. Alterations fail even with recomputed
  digests; incompatible versions and oversized histories fail.
- Strict packages, legacy policies, manifests and old profile imports are
  checked. TRAIN/VALIDATION/HOLDOUT are disjoint across all 100 supported
  experiment seeds. Evaluation/transfer does not update learned values.
- All five families have meaningful transfer changes; manifests rerun from
  their initial controller and reproduce measured results and receipt hashes.
- Ordered multi-agent observations/masks/turns and shared state are checked.
  Existing online membership, concealed results, authority and simultaneous
  CAS tests stay in the suite; server hashes match canonical local runs.

The local 1,000-episode harness observed 76,766 duplicate-checked steps, 978
goal completions and 15 verified receipts in approximately 1.5 seconds. Its
recipes include five families, three difficulties and standard/transfer
conditions; success is a simulation outcome, not a capability ranking.
Throughput is machine-specific. Histories, receipts, notebooks and route caches
have explicit finite bounds; UI training yields and pauses when hidden.

## Browser and production evidence

The integrated production run at `b944b6d12f9bef5dfe084796abf5e22e48b15f02`
passed PostgreSQL grants/RLS/CAS, stale-worker reproduction, v1→V6 returning
players, all offline lazy routes/classes, offline Academy learning and the new
experiment/receipt restore. It passed 45 of 46 focused production browser
checks. The remaining check found a real recent-manifest button contrast issue,
which was repaired and requires the final rerun below.

The unchanged baseline and initial V6 runs also exposed a 5-second fallback
training assertion finishing around 925–950/1000 episodes under concurrent CI.
The focused training deadline is now explicitly 20 seconds, retaining the
1,000-episode and minimum-delivery assertions. No gameplay or accessibility
assertion was removed.

The final required run includes Chromium/Firefox/WebKit Academy and runtime
integration, full authored gameplay, WCAG AA, English/Spanish, 320/390-pixel
layouts, reduced motion, vector fallback, pause/refresh/import, production
prefix/offline/service-worker upgrades and isolated connected-online tests.
Final run ids and screenshots will be recorded after that suite completes.

Actual V6 live verification uses `scripts/verify-live.mjs` after operator-approved
publication. It checks current counts/version, player rewards, bot isolation,
classes, Academy learning, runtime experiments/verified receipts, refresh,
Spanish, council/retro lab and page errors. It has not yet run against a public
V6 release.
