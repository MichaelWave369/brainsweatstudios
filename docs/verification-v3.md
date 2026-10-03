# Version 3 verification

Version 3 adds 11 worlds to the previous 15, with 22 classes, 624 mission/mode slots, 58 badges, a retro lab, and native 3D scenes. The save format remains version 2; older exports migrate optional class and palette fields without changing earned mission rewards.

## Local checks completed

ESLint, TypeScript, the production build, and **94 unit checks** pass. The unit suite covers calculus derivative/integral relationships, ballistic landing and complementary launch angles, gearing/power conservation, battery-limited routes on all foundry maps, every worked VM program, invalid addresses and bounded loops, resilient modern journeys, water balance and chemical-source rejection, virtual heating, mix peaks, video bits/bytes, 96 finite STEM questions, bilingual classes, save migration, and 624 checkpoint roundtrips.

## Browser verification

The [published build run](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37110925366) passed lint, 94 unit checks, the production build, and **17 production browser checks** in Chromium. It also reproduced the original stale-page problem, verified the corrected two-tab upgrade from v1 to v3, checked all 26 worlds offline, and captured desktop/phone review screenshots. The public-site job then verified the actual GitHub Pages studio: 26 worlds, advanced controls, classes, retro lab, saved checkpoints across refresh, earned music completion, bot isolation, Spanish refresh, and zero page errors.

The [complete bot sweep](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37109365494) passed **all 624 authored bot runs** in Chromium: 26 worlds × eight briefs × three difficulty modes. Each checks earned-completion score thresholds and rejects bot-created player rewards. That combined run was not fully green: 732 tests passed and three phone-layout checks failed on a long calculus experiment label. The responsive metric layout was corrected; interface checks are rerun separately because the game models and bot strategies are unchanged. Earlier checks also found and corrected duplicate retro headings and a missing Spanish assistant shortcut.

The [interface run](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37110925381) passed **111 checks** across Chromium, Firefox, and WebKit. English and Spanish each scan 40 views (14 studio/class/retro pages plus 26 games), totaling **240 automated WCAG scans**. Keyboard, 320/390-pixel layouts with actual game controls, feature flows, and localization also passed. The checks use a distinct document URL for each audited view, preventing a hash-navigation timing race from measuring the previous page.

The final phone follow-up passed all 111 interface checks again. Retro mission tabs use two columns; every button fits its visible container at both phone widths. The narrow-layout check loads 80 actual views per browser and verifies keyboard control and pause behavior afterward. The release code is commit `ed15303cbb2da5cf0c6806ce6a811e40fea68904`; the bot-tested game models are unchanged from `ea4e2012f418e25f8940667e19909d8b27b90a30`.

Advanced browser cases cover wrong-answer feedback and corrected earned completion; engine stall/revision; assembled robot state across normal/retro views; memory bounds and computer output; class experiments, explained answers, profile isolation, and zero class XP; water contamination; cooking measurement and refrigeration; production export/recording fallback; Spanish controls; vector fallback; and keyboard camera controls.

The [release gallery](screenshots/v3/) includes the studio, all classes, a calculus class, engine/robot/computer builders, retro lab, cooking, production, a phone view, and the actual public studio. Screenshots are review evidence for the captured states, not a substitute for interactive checks.

## Model and testing limits

The virtual computer is a finite instruction interpreter, not an operating-system VM. Native builders use idealized teaching coefficients. The modern journey uses fictional resources, not emergency-supply recommendations. Water treatment switches represent a verified process rather than treatment doses. A virtual thermometer, model heating time, or clear-water animation cannot certify a real meal or source. Official learning/safety references appear inside the related classes.

The production preview is generated and local; exported WebM is silent with captions. It does not broadcast to a streaming service. MediaRecorder capabilities vary by browser. The audio mixer calculates worst-case coherent peaks as a planning model.

Bots exercise actual DOM controls and never earn player progress. Automated tests and accessibility scans do not establish human learning outcomes or certify accessibility for every assistive technology. Spanish class prose is bilingual by construction; interface translations and completion samples are checked separately. Physical-device battery life and every alternate decision path are outside the automated coverage.
