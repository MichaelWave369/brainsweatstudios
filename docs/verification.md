# Version 2 verification

Release 2.0.0 expands Brain Sweat Studio to 15 worlds, eight missions per world, and three modes: 360 progress slots. The original 12 worlds have five base simulations and three connected field scenarios each. Music Maker, Frequency Lab, and Botany Garden each have eight authored briefs.

## Verified locally

Production TypeScript/Vite build and ESLint pass. The unit suite has 79 passing checks across mission rewards, game consequences, creative science, localization, and profiles/checkpoints.

- All **360 bot runs** completed in the production build: every mission in all 15 worlds in Explorer, Builder, and Master. Each reached a result with a score of at least 60, zero JavaScript page errors, and no earned XP, badges, streaks, or mission records.
- Another 36 completion runs used direct player controls, one original-world variant in each mode. These awarded normal progress. Music and frequency also completed with earned progress and silent controls.
- The complete production browser run passed 412 checks. Follow-up checks cover the final nickname translation opt-out and a simulated low-power display.
- Automated WCAG 2 A/AA and 2.1 A/AA scans found no violations on 10 studio pages and all 15 active mission interfaces in English and Spanish: 50 scanned views.
- The skip link focuses the main content. Keyboard commands, pause, narrow 320/390-pixel layouts, touch controls, vector fallback, and GPU cleanup were exercised.
- The low-power simulation uses a 390-pixel display, 3× device pixel ratio, 4× CPU throttling, and reduced motion. The three creative worlds fit the screen, cap render resolution at 1.5× CSS size, and stop drawing when motion is reduced.
- All 360 checkpoint identifiers roundtrip through validation. Browser reload tests covered Power Grid, Media Detective, Scam Shield, Food & Fuel, Music Maker, Frequency Lab, Botany Garden, and Code Quest. A running robot resumes stopped with its queue, position, and cursor retained.
- Existing version 1 awards migrate to version 2. Six profile slots isolate saves and settings. Malformed imports leave the active save intact; stale effects cannot write into a different profile. Storage failures show a warning and allow export. A damaged profile bundle can recover the mirrored legacy active save.
- Local reading chooses an explicitly local voice, stops on mute/navigation, and shows a text fallback when no matching voice exists. Remote voices are excluded. Haptics remain optional and disabled on unsupported devices.
- Spanish has 1,977 reviewed catalog entries. Browser playtests started all 15 worlds, refreshed the assistant, completed a bot field mission with zero XP, and exercised mobile keyboard controls, with no page errors or React warnings. Long unknown imported text is bounded to avoid expensive template matching. Player nicknames marked `translate="no"` remain verbatim.
- `scripts/verify-production.mjs` passed the actual `/brainsweatstudios/` prefix, service-worker installation, offline reload, all 15 lazy game routes offline, assistant/bot pages, Spanish refresh, offline gameplay, and saved progress after refresh.

## Continuous checks

The GitHub browser workflow runs on main pushes and pull requests. It executes the full 360-run agent sweep in Chromium and the accessibility/feature flows in Chromium, Firefox, and WebKit. [Release run 37099165783](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37099165783) passed all **432 browser checks**, plus lint, the 79 unit checks, and the production build. Test results are attached to failed runs. Local Firefox startup was blocked by this workspace’s process sandbox; local WebKit lacked native libraries. The successful Actions run supplies verification for both engines.

After deployment, the Pages workflow runs `scripts/verify-live.mjs` against the public URL. It checks the 15-world catalog, assistant and council, three creative science interfaces, a saved melody after refresh, earned music progress, bot reward isolation, and Spanish after refresh, and captures a live-site screenshot.

[Deployment and live verification run 37099835283](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37099835283) passed against https://larrinamsalva.github.io/brainsweatstudios/. The browser earned 100 XP by completing Music Maker, completed a separate Frequency Lab bot practice without adding rewards, retained a melody after refresh, and retained Spanish after refresh, with zero page errors. The [captured live studio](screenshots/live-v2.png) records the verified public build.

The deployment workflow also checks returning-player upgrades before publishing. It rebuilds the original v1 and pre-fix v2 commits, reproduces a returning player remaining at 12 worlds while a fresh visitor sees 15, then exercises the fixed upgrade with two original tabs open. The regression checks migrated awards, old lazy assets, an English/Spanish refresh notice for a subsequent release fixture, retained melody state, and offline reload. The public homepage identifies the release with **NEW IN VERSION 2**.

## Scope and limits

The optional bots operate actual controls using deterministic authored strategies. They can find broken flows and inspect consequences, but do not measure whether real children understand a game or how an individual screen-reader user experiences it. Automated scans are not an accessibility certification. The CPU/display checks simulate a constrained device; they are not battery or physical-phone measurements. Speech voices and vibration depend on the device. Spanish completion was sampled, not independently replayed for every one of the 360 cases. Not every alternate decision path has been exhausted.

The assistant and council run offline with authored guidance and saved progress. They do not use a remote language model, store chat history, or provide real funds. Garden values are fictional; music does not alter plant growth. Timed phone vibrations are distinct from an audio signal’s hertz.

Saves use local browser storage and can be erased by browser-data deletion or exhausted storage quotas. Export an active profile before changing devices. Scores and badges record game practice, not qualifications or intelligence measurements.
