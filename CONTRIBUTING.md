# Contributing

Brain Sweat Studio welcomes practical, encouraging games and improvements. Please read the README’s architecture and “Add another game” sections first.

Fork the repository, create a branch, install packages, and make a focused change. Run `npm run lint`, `npm run test`, `npm run build`, and the relevant browser checks. Include what players can do, the game-loop change, and how you checked it in your pull request. Screenshots help with visual changes.

Keep the release static and free. Do not add logins, analytics, tracking, ads, paid APIs, public chat, or collection of personal information. Keep all characters, credentials, messages, and scenarios fictional. Keep safety-sensitive guidance within simulations and explain when to ask a trusted adult or professional.

Use original or compatibly licensed assets with clear attribution. Changes to dependencies need updated license notices. New games need keyboard and touch controls, an understandable tutorial, three meaningful difficulty modes, a result and retry flow, and a non-WebGL fallback.

Make errors encouraging and specific. Do not use shame, intelligence claims, dieting scores, random gambling rewards, or coercive streak penalties. Respect players who communicate in different ways.

Do not include real children’s information, screenshots containing personal data, or private credentials in issues or pull requests. Use fictional reproduction steps. Follow the code of conduct and the security reporting guidance.

For simulation changes, read [the architecture](docs/architecture.md) and [runtime specification](docs/agent-runtime.md). Controllers propose actions; never pass them authoritative mutable state. Keep default V5 arena golden outcomes unless deliberately versioning changed behavior. Add focused environment, determinism, replay, malformed import, split isolation and transfer checks. Run `npm run test:headless`; use browsers for integration/accessibility rather than as the only physics test. Preserve all 888 authored mission checks. Package and Deno-check online source after shared runtime changes.

Unknown artifact fields and incompatible versions must fail safely; no `eval`, imported JavaScript, provider key or automatic upload. Record measured evidence and bounded simulation limitations. Keep advanced tooling in Academy surfaces, language approachable, and all controls usable with keyboard/touch/reduced motion/vector fallback. Operator approval is required before tagging or publishing a release, production secret changes, paid service activation or billing changes.
