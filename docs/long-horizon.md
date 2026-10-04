# Simulation clock and long traces

Time is simulation data: unit, ticks per day and maximum ticks. No elapsed user
time, animation cadence, inference latency or wall-clock deadline changes world
outcomes. Pausing freezes the world. Request deadlines stop controller work,
not simulation time. Ordered actions advance one frame; simultaneous intent
resolution advances one frame after all proposals are available.

Master seed derives independent map/resource/event/weather/observation/
presentation seeds through canonical SHA-256. The scheduler's event choices
use explicit xorshift state recorded in snapshots. Streams not needed by the
current spec remain unused. No authoritative behavior uses `Math.random`.
Renderers read state; presentation randomness has no mutation capability.

Receipts store compact actions and event deltas, not duplicated per-role full
observations. Every 96 records a checkpoint stores state, state hash, chain
hash and checkpoint digest. Full verification reruns every recorded action.
Only after that verification can inspection hydrate the nearest verified
checkpoint and replay its short segment. A raw imported snapshot or recomputed
hash is never accepted as verification of an episode's ancestry.

Receipt caps: 8 MB, 10,000 records, 128 checkpoints, 32 handoffs and 128 bounded
plan/notebook edits. Recording reserves worst-case step space before execution.
The local world notebook retains one receipt/pack and one comparison at 1.1 MB;
older comparison data is pruned when needed to retain the receipt. Larger
headless recordings can be exported and verified with the CLI. They cannot
silently expand profile storage. Academy/progress file selection caps are now
3 MB; older individual artifact validators retain their original bounds.

The board yields between small execution bursts. Batch comparisons run the same
runtime in a dedicated worker; stop, hidden-tab state or unmount terminates
background work. Campaign pause/resume/save/restore keeps the same world.
Refresh/import restores STOPPED with providers disconnected. A stopped batch
retains completed trial displays; rerunning uses its frozen manifest, without
tuning or silently promoting incomplete results to a completed report.
