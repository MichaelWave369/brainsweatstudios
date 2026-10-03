# Version 5 verification

Version 5 adds the agent academy, four bilingual classes, richer simulation geometry, shadow rendering, and original stereo sound. The studio contains **37 worlds, 48 classes, 888 mission/difficulty slots, and 80 badges**. Older version 1 and 2 progress migrates without changing earned results; the save schema remains version 2.

## Learning and model checks

ESLint, TypeScript, the production build, and **133 unit checks** pass. Academy checks cover disjoint training/evaluation seeds, monotonic controller selection, all four arenas, reward learning in steady and windy environments, reproducibility, frozen evaluation, finite trial bounds, save migration, and rejection of malformed or unbounded imports. Existing game, checkpoint, class, progression, and online handler checks remain included.

The controller benchmark starts with one incomplete `always → approach` rule, runs six search generations on eight training seeds using experiment seed 3, then evaluates on eight separate seeds. Each cell below is a completion count, not an intelligence or probability estimate.

| Arena | Initial evaluation | Foundation | Constraints | Endurance |
| --- | --- | --- | --- | --- |
| Sports | 0/8 | 8/8 | 8/8 | 8/8 |
| Survival | 0/8 | 8/8 | 8/8 | 8/8 |
| Scenario | 0/8 | 8/8 | 8/8 | 8/8 |
| Space | 0/8 | 8/8 | 8/8 | 8/8 |

The courier benchmark starts with zero action values and RNG state 42. It trains 1,000 episodes in 25-episode batches, then uses 20 fixed separate evaluation seeds with no exploration or value updates.

| Environment | Initial deliveries | After 1,000 episodes | Mean evaluation ticks | Mean blocked moves |
| --- | --- | --- | --- | --- |
| Steady courier | 0/20 | 20/20 | 23.5 | 0 |
| Storm courier, 12% clockwise action drift | 0/20 | 20/20 | 27.0 | 0.5 |

The same benchmark at 2,000 and 3,000 episodes also completes 20/20 in both environments. These are deterministic results for the specified setup and small evaluation set, not a guarantee on arbitrary tasks. Three layouts, grid position, and parcel state define 294 observations with four action values. Training seeds stay below 10,000; evaluation seeds start at 20,000. Each episode ends within 80 ticks. The reward update uses learning rate 0.25 and discount 0.97, with zero future bootstrap on terminal transitions.

## Browser and publication evidence

The [production deployment and public-site verification](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37141747445) passed at source commit `93ec2a31853bca15329edcb05b186640c2ca79da`: **133 unit checks**, isolated SQL permissions/concurrency checks, upgrade/offline checks, **40 production browser cases**, screenshot capture, Pages publishing, and tests against the actual public site. The live check trained and evaluated both academy tools, restored rover learning after refresh, verified 37 worlds and 48 classes, preserved player rewards, and reported zero page errors.

The final [cross-browser verification](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37141747478) passed at the same source commit. The focused academy stage passed **16 cases** across Chromium, Firefox, and WebKit; two additional GPU/audio instrumentation cases are intentionally scoped to Chromium and skipped in the other engines. The main regression stage passed **1,050 cases**, including all **888 authored mission runs** and 162 existing interface cases. Together, that is **1,066 distinct passing browser cases**. The three focused WebKit connected-navigation cases also passed.

The [Version 5 screenshots](screenshots/v5/) come from that verified production build. `live.png` was captured from the actual public studio. Desktop and phone images show controller improvement, learned rover routes, separate evaluation results, Spanish controls, richer arena geometry, the retro space interface, and a new agent class.

The browser suite exercises genuine user controls: controller search, failure replay, pause, champion export, loading the champion into its arena, learned rover evaluation, policy-value inspection, stopped recovery, profile isolation, rejected imports, valid backups, Spanish classes, keyboard tabs, populated narrow layouts, and vector fallback. Evaluation is checked against the saved learning data to verify that it leaves values unchanged.

Graphics instrumentation measures actual WebGL2 draws, depth-framebuffer shadow passes, nonuniform rendered pixels, graphics errors, and release of textures/programs when leaving the academy. Audio instrumentation keeps the real Web Audio graph and measures nonzero oscillator output through its compressor, stereo pan values, and the muted master gain/output. Those instrumented checks use Chromium; Firefox and WebKit exercise the learning flows and vector fallback. The tests do not establish subjective sound quality or universal physical-device support.

English and Spanish accessibility checks scan **54 views** per browser: 17 studio/class/retro/academy routes plus all 37 worlds. Chromium, Firefox, and WebKit total **324 route scans**. The populated academy reports add six scans, and connected rooms/tournaments add six more. Layout checks cover 320 and 390 pixels. The low-power simulation checks resolution capping and reduced-motion draw suspension.

The deployment checks retain isolated PostgreSQL permissions/concurrency tests, the original stale-worker reproduction, two-tab upgrades from version 1, checkpoint persistence, all 37 offline game routes, offline academy learning/evaluation/restoration, Spanish refresh, player reward integrity, and zero page errors. Public online activation remains a separate pending setup; these online tests use an isolated service, not a live multiplayer backend.

## Scope and limits

Controller training is bounded neighborhood search over inspectable priority rules. Its approach action includes the existing path planner. The rover uses local tabular Q-learning without a planner; it is not a cloud model, language-model fine-tune, arbitrary-code runner, or external agent connection. Separate evaluation seeds still come from the same authored task distribution. Space uses ideal Cartesian relative motion without orbital gravity.

Training histories, learned values, and controllers save with the active local profile and export with progress. Training and replays recover stopped; academy runs do not grant player XP or badges. Sound starts after interaction, music defaults off, mute silences the master graph, and hidden pages suppress sound and active academy work.

All geometry, original lessons, and procedural sound are project-authored. Browser, accessibility, and bot checks verify implemented behavior, not human learning outcomes or formal qualifications.
