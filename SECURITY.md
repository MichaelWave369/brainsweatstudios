# Security

The local studio is a static, offline-capable browser application. Progress and Academy artifacts stay in the current anonymous local profile and can be exported as validated JSON. No payment, advertising, analytics, real-name field or external AI provider is included. Optional private online play has a separate authenticated server implementation; its public endpoint remains unconfigured.

Please report a vulnerability privately using GitHub’s private vulnerability reporting when available in the repository’s Security tab. If unavailable, use a private contact channel offered by the maintainer. Do not post exploit details, credentials, private saves, or children’s information in public issues.

For a report, describe the affected version, browser, a fictional reproduction, and the expected impact. Avoid attaching actual personal data. Ordinary bugs can be reported as public issues with fictional examples.

Imported saves are size-limited and validated before replacing current progress. Scores and earned rewards are recalculated from permitted mission records. No imported text is rendered as HTML or executed as code. The save format is a local game record, not a tamper-proof certificate or credential.

Keep dependency versions locked and review notices when updating. The GitHub workflows use limited permissions; Pages deployment needs `pages: write` and an identity token. Never add tokens or secrets to frontend code or the public repository.

## Agent runtime and online authority

Controllers receive frozen observations and legal-action descriptions. Only the environment applies world rules. Packages, receipts and manifests have strict versions, shapes, finite numeric bounds and size/work limits; imports never execute JavaScript, evaluate code, render HTML or load remote models. A receipt digest is an integrity check, not a signature or credential. Replay verification reruns all actions from the configured initial state. A recomputed digest does not make altered transitions pass. Unsupported runtime/environment versions fail.

The online server chooses competition seeds and recomputes results through the canonical runtime; it never trusts client scores or local receipts. Membership, ordered turns, host roles, locked rosters, private invitations, rate/expiry limits and CAS remain server-enforced. Other players’ results remain concealed until submissions lock. Service secrets stay server-side; browser database roles have no table grants. The packaged Deno runtime is copied from canonical source, not separately maintained world logic. See [online setup](docs/online-setup.md) and [runtime contracts](docs/agent-runtime.md).
