# Version 4 verification

Version 4 adds 11 worlds and 22 bilingual classes to Version 3: **37 worlds, 44 classes, 888 mission/difficulty slots, and 80 badges**. The save schema remains version 2, preserving older records, settings, profiles, and unfinished checkpoints.

## Local and backend checks

ESLint, TypeScript, the production build, and **126 unit checks** pass. Every world has checkpoint roundtrip coverage across its eight missions and three difficulties. New model checks cover reaction/braking distance, required road revisions, virtual truck inspection and loading, material kerf/tolerance, authorized utility response order, Ohm's law/protection trips, alternate clear exits, and layered water safety.

The four agent models pass 96 worked episodes across seeds and difficulty modes, with finite traces, reproducible results, resource constraints, and a 120-tick cap. Server tests also evaluate larger shared seeds. Invalid/extra policy fields, arbitrary code, oversized rule arrays, unbounded inputs, idle policies, fuel exhaustion, blocked moves, and non-docking policies are rejected or stop within the bound.

Online handler tests cover hashed device credentials, private membership, host permissions, invitation guessing/capacity/rate limits, concurrent joins, version conflicts, real alternating team turns, locked rosters, concealed opponent results, server-scored seeded competition, preset signals, host transfer, deletion, and event closure after an active participant leaves. The REST adapter keeps service credentials server-side and uses an atomic version filter.

Fresh local profile identities now persist before their first game or settings change, so online-first players reconnect after reload. Empty groups close before deletion, preventing a concurrent invitation join from entering a disappearing group. A shared network can register a full 20-member clan within the bounded hourly quota. Polling stops on either a request deadline or a caller disconnect.

The deployment workflow applies the CLI-generated migration to an isolated PostgreSQL 17.11 container. RLS is enabled; browser roles lack table grants; service-role grants are explicit. Membership queries work, and two simultaneous updates against one version have exactly one winner. The packaged Edge function passes a Deno 2.9.6 strict type check using the same canonical handler and models.

## Browser and public-site evidence

The [full mission sweep](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37118110799) passed all **888 authored bot runs** in Chromium at commit `4be7626f9606b8e1f5a3af3ab9c9eee5896d040b`. That combined run passed 1,049 checks and identified one WebKit overflow after resizing the connected commons to 320 pixels. The follow-up constrains dropdown text within its control, stacks phone selectors and host controls, and hides the closed phone navigation drawer from layout and keyboard focus. The focused WebKit multiplayer cases now pass. Game models and bot strategies are unchanged.

The final [cross-browser interface suite](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37121763720) passed all **162 cases** in Chromium, Firefox, and WebKit, plus the three focused WebKit multiplayer cases, at source commit `11573424f2908a4ebe51c276bb9bcce5c923955b`. The [production deployment and live-site verification](https://github.com/larrinamsalva/brainsweatstudios/actions/runs/37121763747) passed at that commit: **126 unit checks**, the isolated SQL permissions/concurrency checks, returning-player and offline checks, **34 production browser cases**, and verification of the actual public site with no page errors.

Browser cases cover all new worlds through normal player completion, score and XP persistence, required preparation, circuit-trip diagnosis, wrong-answer correction, policy import bounds, pause/resume, stopped controller recovery, trace replay, retro integration, and Spanish classes/controls.

Two independent browser contexts connect to the same real HTTP handler, join private groups, rotate nine cooperative turns, transfer a clan host, compete with different controllers, inspect server results, reconnect, delete an identity, and verify unchanged local XP. The API uses a test memory adapter; only the configuration endpoint is intercepted. This verifies shared state between browsers, not a public Supabase deployment.

Automated accessibility coverage scans English and Spanish across 52 views in Chromium, Firefox, and WebKit: 15 studio/class/retro pages and all 37 worlds, totaling 312 scans. Connected room and tournament scans add six more. Narrow-layout checks exercise actual controls at 320 and 390 pixels, including the connected commons. Camera controls, vector fallback, keyboard behavior, reduced motion, and a simulated constrained display are checked separately.

The [Version 4 screenshots](screenshots/v4/) were captured from the verified production build. `live.png` comes from the actual public studio. The cooperative-room and tournament images use the isolated shared HTTP service described above.

## Deployment boundary and model limits

The published online configuration has no service endpoint until the account owner chooses an organization and confirms the quoted cost for a separate project. Public online play is therefore pending. No unrelated existing project is modified. The ready client, migration, Edge package, and [deployment instructions](online-setup.md) are committed for the final setup step.

These are teaching models and career introductions, not DMV/CDL licensing exams, ELDT provider training, apprenticeship completions, journeyman credentials, live electrical-work instructions, or emergency-rescue qualifications. Related classes link to current official state services, FMCSA, Apprenticeship.gov, OSHA, USFA, Red Cross, and NASA resources.

Agent control is an authored, inspectable priority-rule system, not an external language model or arbitrary-code runner. Space rendezvous uses ideal Cartesian relative motion without gravity or orbital dynamics. Online standings reflect the bounded model; they do not measure general intelligence or establish real-world performance.

Automated bots use actual game controls and never earn player rewards. Browser and accessibility checks do not establish learning outcomes or certify every assistive technology or physical device. Screenshots document captured states and complement interactive checks.
