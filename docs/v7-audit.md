# V7 starting audit

Frozen baseline: `e80052aefb19e972063a593cdf486b863e222988` (V6 main).
The last behavior change is `90a27bbb26048d85d45af6ba61caae71b1284873`;
the later commit only records published evidence and its screenshot.

Fresh local baseline: locked install, lint, 162 tests in 11 files, production
build, and 1,000 headless episodes pass. The sweep checked 76,766 transitions
twice, 978 goals and 15 full receipt replays in 1,173 ms on this workspace.
V6 browser/production/public evidence remains in [verification-v6](verification-v6.md):
18 runtime cases, ten WebKit persistence repeats, all 888 authored missions,
offline/upgrade/online isolation and actual Pages verification passed.
Local Playwright executables are unavailable; new browser evidence will come
from the repository's three-browser PR workflows, not a claimed local pass.

## Boundaries retained

- Five immutable, private-state environments at runtime/environment 1.0.0;
  legal blocked attempts still consume a tick. Rover RNG is never public.
- Human/authored/rule/replay/frozen-Q controllers, independent actual learners,
  TRAIN/VALIDATION/HOLDOUT recipes, unsigned action-replay receipts and manifests.
- Profile schema 2, V5/V6 migrations, six profiles, bounded notebooks and imports.
- 37 human worlds, 48 classes, checkpoints, bot rewards isolation, rendering,
  sound, English/Spanish, retro interface, offline/update shell.
- Server-selected online competition seeds and server-executed data-only rules;
  existing public online endpoint remains pending. No model enters this authority.

The audit read README, architecture, Academy/runtime/online guides and verification,
runtime types/rules/environments/controllers/receipts/data/curriculum/notebook,
training and profile integration, import validation, Academy/experiment UI,
headless scripts and both workflows. No applicable AGENTS.md was found.

## V7 design decisions

Provider adapters live in `src/agents/`; the deterministic runtime remains
provider-free. V6 artifacts and rules keep their version. V7 adds independent
model-observation/action/controller/receipt/manifest versions and three bounded
fictional reference worlds. Every controller uses the same world validator.
External output is untrusted; cancellation/stale responses cannot advance a world.
Model receipts prove world replay from recorded actions, not reproducible model
generation or authenticated controller identity.

Ollama native API documentation was checked on 2026-10-03: `/api/tags`,
`/api/show`, `/api/chat`, JSON/schema format and `think:false`. Only installed
models will be listed; no pull/delete/config endpoints. The bridge uses a fixed
loopback Ollama destination, exact routes, explicit origins and Host checks,
bounded bodies/responses/timeouts/concurrency, no arbitrary proxy or shell.
Browser origin, mixed-content and local-network permission restrictions still
apply; running the studio locally is the documented fallback.

Sources: [Ollama chat](https://docs.ollama.com/api/chat),
[model listing](https://docs.ollama.com/api/tags),
[origin FAQ](https://docs.ollama.com/faq#how-can-i-allow-additional-web-origins-to-access-ollama),
[MDN local-network access](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access).

CI uses deterministic mock providers only. Real Ollama qualification is optional
and must report unavailable honestly when no installed model is present.
V7 follows the existing draft-PR/operator-merge workflow. No automatic merge,
tag, cloud service, model download, billing or production secret change.
