# Model observation contract

`model-observation@1` has an independent action version `model-action@1`.
Only the host creates observations, from `GarageWorld.observe` and its current
legal mask. Providers receive a frozen, detached, serializable projection.

Fields: schema/actionSchema; episode/sequence; world/environmentVersion;
agent `{id,role}`; tick/turn; objective; public state; target/map; conditions;
observationIndex; legalActions; constraints; bounded recent events; terminal
metadata. A provider request additionally contains `mission@1`, a frozen
controller descriptor, budgets and one bounded context strategy.

V6 public coordinates, reserves, progress, objective, walls and condition
sensors retain their original units and compressed rover Q observation index.
No private rover RNG, snapshot, world mutation method, storage credential or
server state is sent. State hashes live in receipts, not model observations.
A legal action describes an intent, not a guarantee that it will succeed.

| Reference world | Public information and change |
|---|---|
| Survey | Six indexed sites, current position, scan results (-1 unknown, 0 empty, 1 cache), carry/delivery status and energy; the seeded cache location is concealed until scanned. Scan costs one tick/two energy. Transfer shifts the hidden cache and reduces reserves. |
| Community Restore | Abstract power/water/roads/communications flags, supply tokens, role, turn and last eight preset signals. Roles have different masks and causal dependencies. Transfer adds a supply cost for communications. |
| Signal Maze | Authoritative mission route/progress, position/reserves and explicitly untrusted fictional signs. Transfer changes the route. Signs cannot alter validators or fabricate completion. |

These are fictional token/route worlds, not real utility work, emergency
operations or real-world safety instructions. Difficulty curricula reuse V6;
the three reference worlds have fixed small horizons rather than artificial
claims of increasingly intelligent tasks.

Request versions, ids, bounds and JSON are validated before transport. Receipt
import reconstructs each observation/mask from initial world state and rejects
unknown/hidden/tampered values even when the digest is recomputed. Inspecting an
old frame reads a recording; it does not restore or step the live world.


## Data-defined worlds (@2)

`provider-request@2` carries a strict `model-observation@2` with world and pack
hashes, validated world/version/role identity, tick/turn, public objective, masked
resource/entity/flag fields, permitted graph map, legal actions, bounded signals
and public event projection. It uses the same mission@1 instructions and
model-action@1 proposal parser. V7 @1 requests retain their original validator.

Sensors may be always/role-visible, hidden, revealed by inspection, bucketed,
delayed or location-limited. Costs/status preconditions are validated by the world;
a legal mask does not reveal a hidden precondition. Private scheduler, future
variants, RNG, raw snapshots and exact hidden/bucket values are excluded. Terminal
provider metadata contains no private reserve score. Public event projection also
checks visibility, so a resource ledger cannot bypass masking through context.

The operator board and receipt inspector can show authoritative state; provider
requests are independently projected and validated. Tests cover hidden state,
role-specific paid reveal, bucket values, detached frozen data and score claims.
