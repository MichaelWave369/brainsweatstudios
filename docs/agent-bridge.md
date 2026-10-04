# Optional local Ollama bridge

The website remains fully useful without Ollama. Install/manage Ollama and a
local model yourself if desired; this project does not install, pull, delete,
configure or upgrade models. The public studio cannot assume every browser can
reach localhost. Use the offline mock when no provider is available.

```sh
npm ci
npm run dev
# In another terminal on the same device:
npm run agent:bridge
```

Open the local studio, choose Local Ollama in the Garage, connect the bridge,
then explicitly select an installed model. Listing or selecting never requests
inference. Metadata shows bytes, context length and capabilities when reported;
missing values are UNKNOWN. Use JSON fallback explicitly if an installed model
cannot use a schema; proposals still undergo the same strict validation.

For the GitHub Pages studio, explicitly allow its exact origin:

```sh
npm run agent:bridge -- --allow-origin https://larrinamsalva.github.io
```

Default allowed origins are localhost/127.0.0.1 on ports 5173 and 4173. No
wildcard, null origin, credential-bearing URL or arbitrary HTTP origin. A Pages
origin includes all pages hosted on that same origin, so only allow an origin
you trust. Close the bridge when finished. It listens exclusively at
`http://127.0.0.1:11435` and contacts fixed `http://127.0.0.1:11434` Ollama routes.
It is not a LAN service, generic URL proxy, model installer or shell server.

## Browser restrictions

Ollama has its own origin rules; this bridge's server-side calls avoid requiring
changes to OLLAMA_ORIGINS. The browser-to-bridge hop still needs CORS and may need
local-network permission, an appropriate secure context and mixed-content
handling. Supporting browsers receive `targetAddressSpace: 'loopback'`; older
browsers may ignore it or block the request. A grant cannot be forced by code.
The bridge handles permitted CORS/private-network preflights, but does not
bypass browser security. Run the studio locally if deployed HTTPS access is
blocked. A bridge running on a different device is not that browser's localhost.

Primary references checked 2026-10-03:
[Ollama chat/schema API](https://docs.ollama.com/api/chat),
[installed models](https://docs.ollama.com/api/tags),
[Ollama origin FAQ](https://docs.ollama.com/faq),
[MDN local-network access](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access).

## Exact HTTP API

All requests require an allowed Origin and exact loopback Host. Health returns
a random per-process session token, held in memory only by the connected client.
Other routes require it in X-Brain-Sweat-Bridge. No cookies or credential export.

| Method/path | Body / result |
|---|---|
| GET /health | `agent-bridge@1`, provider, scope, ephemeral session token |
| GET /models | Installed local model descriptors (maximum 64); no inference |
| POST /metadata | Exactly `{model}`; projected size/context/capabilities/digest |
| POST /inference | Valid `provider-request@1`; projected `{model,text,usage}` |
| POST /shutdown | Exactly `{}`; stop accepting and abort pending requests |
| OPTIONS exact route | Allowlisted method/headers/origin preflight only |

No other path, query, method, forwarded Host, arbitrary upstream URL, auth
header, filesystem access or shell command is accepted. JSON bodies are ≤48 KB,
no compression; upstream responses have bounded streaming reads. There are at
most two active operations, sixteen connections and 180 requests/minute;
headers/body/upstream timeouts are bounded. Disconnect cancels upstream work.
The default bind cannot be changed to 0.0.0.0 through the CLI.

Inference rechecks installed model metadata, rejects advertised cloud entries,
uses `/api/chat`, `stream:false`, `think:false`, bounded output/context,
operator sampling settings, mission instructions and JSON/schema format. No
tools are supplied. Thinking fields and unexpected fields are projected away;
no private body is logged. Models that cannot honor this mode may be unavailable.
The operator remains responsible for their own local Ollama configuration;
the project never activates a cloud fallback.

## Optional qualification

```sh
npm run qualify:ollama
npm run qualify:ollama -- --model EXACT_INSTALLED_MODEL
```

The first checks local inventory. The second freezes settings and runs small
Survey/Signal Maze trials at seed 20017, recording measured results and verified
world hashes to `reports/ollama-qualification.json`. It is not CI and does not
change model weights or prompts. A missing server/model produces an explicit
unavailable report with zero trials. A trial failure remains a measured failure,
not a fabricated pass. The current workspace has no reachable Ollama model.


## V8 WorldSpec transport

The bridge's existing request validator dispatches provider-request@1 and @2.
World requests use masked model-observation@2 and the unchanged structured
model-action@1 format, with explicit role and bounded long-horizon budgets.
No new endpoint, origin exception, arbitrary URL, shell/tool capability or cloud
fallback is added. V8 model teams select installed model ids explicitly and keep
separate controller budgets; replay/batch baselines and mocks need no bridge.
Actual provider availability is reported independently of mock/transport tests.
