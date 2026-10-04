# V11 — Synthetic voice, music and performance

The resumed campaign starts from published V10 main
`21fde5d76431e62184a53417b1eec41b0a6692ac`. Its build, deployment, actual-live
verification and gameplay checks succeeded. The retained older working tree
was V8; the earlier V11 draft was not present. This implementation reconstructs
the reported V11 checkpoint on `codex/v11-synthetic-performance`.

V11 is a review branch. The public studio remains V10. No merge, tag, release,
paid service, production secret, microphone access or public-site deployment is
part of this checkpoint.

## Implemented and verified locally

- Four original score modes: choir, band, call and response, eight-bar composition;
  key/tempo/meter controls and strict score/voice relationships.
- Versioned V11 conductor entry, dynamics and cutoff with simultaneous role
  proposals and logical timestamps. V10 configuration behavior stays intact.
- Strict fictional synthetic voice identities, original formant/instrument
  renderer, responsive worker, stereo WAV, MIDI, original-score JSON,
  replay-verified bundles and separately hashed audio receipts.
- Playback consent, studio mute, hidden-page/unmount cancellation, invalidation
  after voice edits, atomic imports and stopped restoration.
- Source-backed human listening notes separate from mechanical metrics.
- Owned score artifacts supply actual native score hashes and cue beats to
  Stunt Show and Stream Studio. Existing partition/provenance rules still apply.
- Generic synthetic-only PerformanceBus contract. No Commonline API integration
  or real local model is claimed as qualified.

## Evidence

| Check | Result |
| --- | --- |
| Locked V10 baseline install/lint/build | Passed; all 316 original unit tests passed before editing. |
| V11 unit suite | 337 passed: 316 previous plus 21 performance cases. |
| Lint / TypeScript / production build | Passed. |
| License inventory | 195 packages; no unspecified license; no new application dependency. |
| Runtime / model / worlds / career / family CLI sweeps | All passed: 1,000 runtime episodes, 32 mock-agent missions, 7/30-day Town Zero replay, 100-episode and generated-world sweeps, career continuity and all six native families. |
| Immutable V10 replay | Ensemble, Stunt Show and Stream Studio fixtures captured from main retain their exact original digests. |
| Chromium native family flows | Four existing stories passed, including six episodes, human controls, EN/ES/axe, pause and real-origin outage. |
| Chromium V11 browser flows | Four stories passed: real WAV/MIDI downloads, bundle import/reload, listening-note persistence, mute/real playback/hidden stop, atomic rejection, voice edits, Spanish keyboard/320/390/axe, offline worker after real origin outage. |
| Local production verification | Full verifier passed against the production preview: Town Zero/replays, 37 worlds, 48 classes, six native families, stopped restoration, V11 worker/WAV download, and zero page errors. This is local preview evidence, not a public V11 deployment. |
| Advanced GitHub campaign | [Run 37222880091](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37222880091) passed all 36 career/family/performance stories across Chromium, Firefox and WebKit, including all 12 new V11 browser cases. |
| GitHub production gates | [Run 37222880084](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37222880084) passed build/lint/337 unit tests, all headless sweeps, isolated PostgreSQL RLS/concurrency, legacy service-worker upgrade recovery, offline production routes, and 71 Chromium advanced stories. Deployment and actual-live jobs are correctly skipped on this PR. |
| GitHub full gameplay | [Run 37222880088](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37222880088) passed all 1,062 gameplay/accessibility cases (1,050 existing plus 12 V11), all earlier specialist stages, and ten repeated WebKit visibility/origin-outage cases. |
| Headless original choir export | Mock performance replay verified; 18.278 seconds, 403,030 frames, 1,612,164-byte stereo PCM WAV and MIDI written locally. |

Local browser evidence used Chromium 153.0.8010.0 with intact assertions and
deadlines. The standard browser download was unavailable in this workspace;
a packaged Chromium executable supplied real Playwright browser execution.
The agent-browser daemon did not start, so its visual-check path was unavailable;
the Playwright captures were inspected directly. All three GitHub source gates passed for
`1ec8503d2a8f83d33c84bfc61c736597f4722f37`. This final evidence update changes
only this document; the verified application, workflows, dependencies and tests
are unchanged. [PR #6](https://github.com/larrinamsalva/brainsweatstudios/pull/6)
is held for operator review. No existing assertions, deadlines, retries or skips
were weakened.

All existing CI coverage is retained. The advanced campaign now includes the
four V11 stories in Chromium/Firefox/WebKit, and the production workflow includes
them alongside the previous suites. Public live verification also requires a
real V11 worker render/WAV download after an operator-approved merge.

Review captures: [choir listening room](screenshots/v11/choir.png) and
[Spanish phone controls](screenshots/v11/spanish-phone.png).

## Limits

Voices approximate synthetic vowels; there is no realistic speech, microphone
input or artist imitation. The eight-bar workflow is a bounded original score
generator and configurable ensemble, not a general audio workstation. Voice
edits are retained in explicitly exported bundles; refresh restores the saved
native recording with default profiles. Stunt/stream score cues are local
simulation evidence, not an external broadcast. Mechanical success is separate
from artistic review. Fixed-engine audio byte hashes are distinct from portable
score replay. Commonline and real Ollama qualification are not available here.
