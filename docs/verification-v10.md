# V10 — Agent Circuit Worlds

V10 builds on the verified V9 source `6a1a5b2263550609b028c9f52990d1e7f2a39fd0`. Its six native family kernels, shared career host, CLI, and advanced Locker controls are implemented. V9 is the published studio, merged at `0ec973702c6e3eca187ab622699a22d2584fdb6c` with production deployment and actual-live verification passed. V10 remains a review build. CI results for this rung must be recorded before advancing to V11.

## Distinct mechanics

| Family | Authority and public inputs | Recorded outcomes and outputs |
| --- | --- | --- |
| Agent Auto Circuit | Normalized vehicle mass, power, capacity, grip, brakes, cooling, reliability, aero and setup; data-defined curved/rough/elevated sectors, pit lanes and weather. All driver/crew intents resolve from one pre-turn snapshot. | Positions, energy, grip, heat, damage, laps, sectors, pit service, symmetric traffic incidents, recovery, consistency and efficiency. Solo, head-to-head, four-car and team endurance formats. Vehicle setup and track notes. |
| Stunt Show Lab | Fictional motion tokens, preparation, launches, timed rotation/landing windows, toy-envelope rejection/recovery, producer music and camera cues. | Precision, timing, smoothness, resources, coordination and envelope compliance. Recorded performance plan. No physical apparatus or real-world execution instructions. |
| Cache Quest | Seeded virtual terrain, weather, landmarks and cache; limited visited-cell visibility; inspection, public arithmetic clue, discovery and return-to-camp; explorer/navigator signals. | Navigation path, discovery/return, information, energy, puzzle errors and coordination. Revealed route only. No location permission or geographic service. |
| Web Scout | Seeded synthetic pages, links, index, dated official/conflicting claims; open/follow/search/save/compare/submit. Page text remains untrusted data. | Correct finding, compared evidence, source snapshots with synthetic URL, turn, content hash and excerpt. Research dossier. No live network fetch. |
| Stream Studio | Producer, host, director, audio, graphics and researcher roles. A segment requires prior caption/camera/audio/graphic/research cues. Host presentation and producer completion govern the local timeline. | Local simulated rundown, missed cues, coordination and admitted dossier source hashes. No account, external post or broadcast. |
| Ensemble Lab | Original generated eight-bar score with meter, key, chords, tempo map, instruments, voice parts, dynamics and entry/cutoff cues. Every part proposes before a logical beat advances. | Authoritative note/rest/cue events with logical timestamps, pitch accuracy, completion, timing/cue errors and synchrony. Original portable score. Artistic review remains separate. Audio rendering belongs to V11. |

Vehicle values and motion are fictional normalized units. Measures describe recorded scenario/controller outcomes, including teammates; they do not rank intelligence.

## Continuity, replay and bounds

- Existing V7/V8/V9 imports remain accepted. Existing passports retain their declarations until the operator chooses **Enable circuit families**. Controller changes preserve the operational ID and previous evidence.
- `family-config@1`, `family-episode@1` and typed artifacts are descriptor-safe, exact, bounded, finite data. There are at most 256 simultaneous turns and eight roles. Native replay reconstructs every masked observation, decision, action, transition hash, result and authored output. A hash identifies data; it does not authenticate a provider or person.
- Model evidence reconstructs the existing `provider-request@2`, verifies bounded response JSON and legal action, and binds the chosen controller. Requests have deadlines and budgets. Pause/visibility invalidates pending proposals; overlapping and illegal turns cannot advance the world. Model completion order never establishes priority.
- Public notes and artifact snapshots are declared before execution. Artifacts require owned eligible native creator evidence and destination acceptance. They cannot write world state. A research dossier supplies recorded source references to a later local show. A vehicle setup changes permitted initial normalized parameters; it cannot assign a finish.
- Fresh benchmark input contains no prior notes/artifacts. Source-backed HOLDOUT/TRANSFER memory and artifacts cannot enter career context or inventory. Family seed ranges are disjoint: TRAIN 1000–1999, HOLDOUT 2000–2999, TRANSFER 3000–3999; CAREER uses other seeds. Replay checks these declarations too.
- The existing Locker bound remains eight passports/eight raw runs/twelve notes per passport/twenty-four artifacts/1.35 MB. Provenance dependencies are retained; export is required when a dependent archive fills. Voice references remain empty until validated V11 implementation.

## Operator surfaces

The advanced Locker at `#/academy?tab=locker` provides family destinations, seed/format controls, validated configuration import/export, shared controller descriptors, native human intents, role inspection, SVG telemetry, evidence and output retention. Restores remain STOPPED and award no game XP. EN/ES controls, keyboard focus and 320/390 layouts have explicit browser cases. The normal five academy tabs and human mission catalog remain unchanged. Display/build release metadata is aligned with package version 10.0.0; the prior main source retained an older display label.

Shared commands:

```sh
npm run family:list
npm run race:run -- --mode endurance
npm run cache:run -- --partition HOLDOUT
npm run performance:run -- --controller mock
npm run family:run -- web-scout --seed 17
npm run agent:run -- stream-studio
npm run replay:verify -- exported-receipt-or-locker.json
npm run test:families
```

Configuration or Locker JSON can be supplied with `--input FILE`. Provider connections, paid services, real locations, microphones and external media are not prerequisites.

## Verification evidence

Local checks: all 316 unit tests (279 previous plus 37 family/continuity tests), lint, TypeScript, build and the shared six-family CLI sweep. Tests exercise actual four-format races, replay tampering, simultaneous completion order, masked observations, rejected stunt envelopes, untrusted research text, cancellation, legacy passports, scoped/frozen inputs, provenance, partition seeds and cross-family continuity.

Four new browser stories run in Chromium, Firefox and WebKit: all six family episodes/output retention/restore; human race/configuration rejection/heldout inputs; hidden pause plus real origin outage/service-worker restore; and Spanish keyboard/320/390 telemetry with axe. Successful Chromium review captures are saved as CI artifacts.

The production and gameplay workflows retain all original tests, 37 worlds, 48 classes and 888 authored missions, V6/V7/V8 deterministic hosts, repeated WebKit visibility cases, SQL, offline upgrades, licensing and security checks. CI status is pending for the V10 review source; no result is claimed before execution.

The first three-browser run exposed an inherited handoff depth bound that rejected a valid nested research dossier at checkpoint. The handoff/evaluation bounds now cover typed family snapshots within the unchanged aggregate archive limit, and a native research-to-show save regression exercises the actual handoff. The Spanish browser test now uses the established `Avanzar un paso` control label. A compatibility audit also keeps legacy WorldSpec ids separate from native family observations in the mock adapter and prevents a portable setup from replacing destination vehicle entity ids.

Provider episode/template hashes contain public input and family definition data, not the private scenario seed. A twin-map regression proves equal pre-inspection public observations and requests for maps with different concealed cache positions; inspection then reveals the legitimate differing clue. Complete seed/config hashes remain in the exported replay evidence.
