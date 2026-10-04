# Local agent data

The in-app Privacy page describes game and optional online data. V7 adds one
bounded model receipt and two model manifests to each anonymous local profile.
Public episode notebooks and short supplied model notes are annotations. No
private reasoning, chain-of-thought, raw model transcript, bridge token or API
key is retained. Refresh/import starts controller work stopped and providers
disconnected. Profiles and validated exports retain their existing local ownership.

Offline mocks, deterministic simulation, replay and file validation need no
network. Only an explicit local Ollama connection/run sends public simulation
observations/context to its loopback bridge. There is no automatic cloud fallback,
telemetry, analytics or upload. The local model's own logs are outside the studio's
control. Selecting a model does not infer, download, delete or train it.

Online competition remains an explicit separate submission of validated rules;
the authoritative service executes them itself. Model receipts do not confer
server authority. No model competition service is enabled. Existing device
credentials are still excluded from progress backups. Local settings export,
import and confirmed reset manage the Garage along with other Academy data.

See [agent security](agent-security.md), [artifacts](model-actions.md) and
[local connection](agent-bridge.md).
