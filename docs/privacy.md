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


## V8 World Lab

Each anonymous local profile may retain one validated world pack/receipt and one
frozen manifest/comparison, within a 1.1 MB World Lab cap. Comparison history is
pruned when needed to keep the current receipt. Standalone long receipts have an
8 MB verification limit; aggregate Academy/progress file selection is capped at
3 MB. Existing V6 and V7 notebooks keep their original independent limits.

World evidence contains abstract state, legal actions, event causes, role/controller
identities, seeds/hashes, public plans/notebooks and request counts. Public artifacts
are operator-visible and may travel with an export. Do not put personal information
in a fictional world or public notebook. No transcript, private reasoning, bridge
credential, API key or model weights are retained. Imports restore stopped and
providers disconnected; a file cannot start inference or install executable code.

Authoring, baselines, mock context comparisons, workers and recorded-action replay
stay offline. Individual trial inspection recreates an offline frozen trial. Only
explicitly connected local-model execution sends the selected role's masked public
observation/legal actions/context to the optional loopback bridge. There is no
automatic upload, analytics, paid adapter or fallback. Operator inspection can show
private world state; its model projection is separately masked. An operator can
choose to write a public fact, but the host does not secretly copy hidden state into
controller memory. Local model logging remains outside the studio's ownership.
