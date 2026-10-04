# The Agent Circuit (V12)

Open `#/academy?tab=circuit`. The Paddock has a separate route; the five ordinary
Academy tools and all 37 human worlds remain available. Circuit work awards no
game XP. Local rules, offline mock, human roles and explicitly connected existing
local models use the same native authority and logical turns.

Create two starter crews, optionally prepare an original opening score, then
freeze a six or twelve event season. Freezing captures the teams, operational
passports, controller configurations, seeds, memory/artifact policies, formats
and scoring dimensions. Subsequent roster edits affect future seasons. The
operator advances each event; there are no wall-clock obligations or automatic
season advancement. Stop, hidden tabs, navigation and reload suspend execution.

## Native events

| Format | Actual mechanics and evidence |
|---|---|
| Original performance | Prepared V11 choir/band/call-response score; simultaneous conductor and part actions; original performed notes; synthetic local WAV/MIDI renderer and separate human listening reviews. |
| Racing league | Equal-track solo qualifiers determine a frozen grid. The actual race has driver, crew-chief, strategist and pit roles per vehicle, logical grid delay, legal pit windows, resource service, traffic, sectors and lap receipts. Team, driver and fictional constructor standings derive from those results. |
| Cache rally | Solo, relay and cooperative native map episodes, inspectable source-backed route hints, a changed frozen map, masked landmarks/puzzles and a limited signal cadence. |
| Town relay | Native seven-day or manifest-selected thirty-day Town Zero; scheduled role rotations are real controller handoffs. The verifier checks every recorded decision against its scheduled passport and requires the native handoff ledger. |
| Synthetic research | Deterministic local document fixtures, source comparison, freshness and untrusted page instructions. Official standings never fetch live web content. |
| Stunt festival | Abstract virtual choreography consumes the team's verified opening score. The subsequent native local show admits that score, choreography plan and actual research dossier with their source digests. |

`family-config@3` explicitly selects the new race and Cache authorities. Only those
two families accept version 3. Original version 1 mechanics, version 2 performance
mechanics and their request fingerprints remain independently replayable. Six
immutable recordings captured from merged V11 commit `14f50dd88fe5a46257b846ac512c28b13a89c01b`
verify the original digests, in addition to the existing V10 fixtures.

## Memory and artifact exchange

Notes declare a team or world scope and a partition. Each native role receives an
immutable admission snapshot. CAREER/TRAIN sources can be considered in a career
round; HOLDOUT/TRANSFER sources cannot become automatic context. Frozen gauntlets
use FRESH memory and NONE artifacts regardless of the operator's inventory.

Every retained vehicle, score, route, track note, research dossier or production
plan names its native source receipt, event, part, team and creator. An imported
inventory reference alone cannot authorize admission. Native source evidence must
remain in the archive. Qualifier and earlier-stage outputs can feed the next
phase, with their exact receipt hashes. No unfinished phase can be skipped.

An explicit local exchange declares the asset hash and recipient team. Another
team may admit it only if the frozen round declares SHARED and the destination
accepts its type. The default season uses TEAM. WorldPacks are strictly validated
operator assets that can be exported into the World authoring lab; they do not
replace a frozen official round. This is local artifact exchange, with no money,
code execution, marketplace, public account or external publication.

## Standings and interpretation

Measurements remain separate: racing, navigation, resources, coordination,
research, creative mechanics and recovery. Unmeasured dimensions are null and
display a dash. Official points include only completed, unique events. The
verifier recomputes every measurement and rejects a changed score even if its
envelope was rehashed. Circuit points average the declared dimensions per round
and sum those round values; they are entertainment rules for these simulations.

| Dimension | Normalization used by the default season |
|---|---|
| Racing | Finished cars: 100/80 by native place; unfinished cars: bounded course progress × 60. |
| Navigation | Native discovery and return checks, each worth 50. |
| Resources | Town's native objective completion fraction × 100. The full native reserves remain separately inspectable. |
| Coordination | Native role signals, race crew operations, research comparison, ensemble timing/cue/synchrony and completed show operations, depending on the declared family. |
| Research | Native synthetic-source accuracy, or admitted source references in a local show. |
| Creative mechanics | Native pitch accuracy, virtual landing precision or completed production segments; no artistic-quality inference. |
| Recovery | Declared native recovery counts or envelope/puzzle error checks; detailed native counts remain visible. |

League race points use 25/18 for the two finished entries; unfinished entries
receive zero race points. Those league points remain distinct from multidimensional
Circuit points. Mechanical success, editable operational identity and a digest
do not establish provider authenticity, consciousness, IQ or real-world ability.

## Replay and local presentation

Choose any archived part, camera role and native frame. Family replay reruns
recorded legal intents; Town uses verified native checkpoints and causal actions.
The theater includes race telemetry, masked map exploration, Town resources and
handoffs, choreography, score timing, research sources and local show rundown.
It exports the actual native recording and a public local program.

Template commentary reads public events only. Its public packet uses masked role
state; hidden Town reserves and undiscovered map fingerprints are excluded. It
has no action channel or scoring authority. Original music is rendered by the
existing consent-based V11 performance worker. Playback starts stopped and obeys
mute/visibility settings. Human listening reviews never alter official receipts.

The existing `PerformanceBus`, generic bounded `AgentEnvironmentPort` and new
`VisualAssetBus`, `VoiceBus` and `MediaBus` types are optional operator interfaces.
Synthetic presentation packets are finite, bounded, hashed data; adapters must
acknowledge the exact packet hash and stop on rejection or cancellation. The
Paddock exports their interface manifests. Commonline, Domistika, Auralith,
KaoticFX and Aetherion are not connected or claimed as qualified integrations.

## Frozen comparisons

GAUNTLET manifests freeze disjoint TRAIN/HOLDOUT/TRANSFER seeds and controller
snapshots. The browser worker and CLI invoke the same CircuitSession/native host.
No weights, settings or automatic policy changes occur between partitions. A
browser batch runs one declared seed from each partition; CLI `--seeds` can use
more within the 36-event batch limit. A twelve-round batch permits one seed per
partition; a six-round batch permits up to two.

The matrix shows observed sample count, mean, minimum, maximum and population
variance. Samples are team outcomes in recorded matches; opponents in one match
are coupled observations. These are descriptive values, not significance tests,
confidence intervals or a general intelligence score. Empty partitions remain
blank. Export batch evidence to retain its full native trials; batch reports
remain separate from career standings and do not enter automatic memory.

## Bounded storage and commands

The Circuit archive allows 8 agents, 4 teams, 3 frozen seasons, 36 events, 24 notes,
24 exchanges, 4 operator WorldPacks, 24 listening reviews and 6 MB of native JSON.
A season admits one or two teams and up to twelve declared events. A native
event has at most 16 phases. Batches allow 36 event trials and 16 MB. Validators
also enforce node/depth bounds, exact fields, finite values and descriptor-safe
data; getters, prototype keys and executable fields are rejected before use.

Profile storage applies lossless UTF-8/LZW encoding with a bounded dictionary
only to the Circuit field. Loading expands and replay-verifies the original
data; exports retain ordinary native JSON and original digests. The previous
Academy fields keep their original aggregate 3 MB and depth limits; the additional
Circuit field has its own bound. Combined Academy/progress imports allow up to
9 MB to carry that additional field. Browser quota still applies across profiles;
save failures are surfaced and exports remain available. Export before clearing
an archive, deleting browser data or changing devices.

```sh
npm run circuit:list
node scripts/circuit.mjs template --length 12 > circuit-template.json
npm run circuit:run -- --controller mock > six-event-circuit.json
npm run circuit:run -- --input circuit-template.json --round round-1
npm run circuit:verify -- --input six-event-circuit.json
npm run circuit:batch -- --mode GAUNTLET --seeds 1 > frozen-circuit-batch.json
npm run replay:verify -- frozen-circuit-batch.json
npm run test:circuit
```

Headless automatic runs admit declared public baselines/offline mocks. Human
actions use the browser role controls. Local models require an explicitly
connected loopback bridge and an existing installed model. Imports and replay
inspection never connect a provider. No model is installed or downloaded.
