# Security

The first release is a static browser application. It has no accounts, application server, payments, analytics, or player-to-player messaging. Progress is stored in the device’s browser and can be exported as JSON.

Please report a vulnerability privately using GitHub’s private vulnerability reporting when available in the repository’s Security tab. If unavailable, use a private contact channel offered by the maintainer. Do not post exploit details, credentials, private saves, or children’s information in public issues.

For a report, describe the affected version, browser, a fictional reproduction, and the expected impact. Avoid attaching actual personal data. Ordinary bugs can be reported as public issues with fictional examples.

Imported saves are size-limited and validated before replacing current progress. Scores and earned rewards are recalculated from permitted mission records. No imported text is rendered as HTML or executed as code. The save format is a local game record, not a tamper-proof certificate or credential.

Keep dependency versions locked and review notices when updating. The GitHub workflows use limited permissions; Pages deployment needs `pages: write` and an identity token. Never add tokens or secrets to frontend code or the public repository.
