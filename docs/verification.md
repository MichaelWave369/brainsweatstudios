# First release verification

The release includes twelve game loops and five mission variants in each game. Three modes change resources, hints, complexity, or decision constraints. It includes sixty authored mission variants and 180 distinct progress slots when counting the difficulty modes.

Verified with the production TypeScript/Vite build, ESLint, Vitest, and Chromium browser gameplay checks:

- Twelve unit checks: unique manifests and badges; replay XP; one-time milestone bonuses; save roundtrip and malformed imports; play streak preservation; local-date challenges; business capacity; meal portions; battery limits; affordable grid imports; robot collisions.
- Thirty-six mission completion runs: one variant from every game in Explorer, Builder, and Master modes. Explorer used mission 1, Builder mission 3, and Master mission 5. Each reached a result screen with a completion score and earned badges, without JavaScript page errors.
- Export/reset/import roundtrip, including preserving the current save when an invalid JSON version is imported.
- Navigation, world search, category filters, unknown-route handling, and hash-route refreshes.
- All studio views and game tutorials fit 320- and 390-pixel viewports. A touch session completed Money Mission.
- Unsupported WebGL2 uses the vector fallback and can finish a mission.
- Pausing disables mission controls; leaving a game deletes its WebGL buffers.
- The production `/brainsweatstudios/` folder prefix, all twelve lazy game routes offline, offline gameplay, and saved progress after an offline refresh passed `scripts/verify-production.mjs` without JavaScript page errors.

These checks validate a smaller first release. They do not replace playtesting with kids and teenagers, screen-reader testing, real low-power phone measurements, or coverage of every possible decision path. Missions 2 and 4 share the same tested loops but were not independently completed in all modes in this check. Exact session durations will need playtesting.

Saves include finished results only. Closing a tab during a mission restarts that unfinished session. There is one anonymous save per browser profile. Daily challenge dates use the device clock and are not an anti-cheat system. Badges and scores are game progress, not certificates or intelligence measurements.
