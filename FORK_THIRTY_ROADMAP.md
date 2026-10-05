# Fork-Thirty roadmap

Fork-Thirty begins from the verified BrainSweat V12 Agent Circuit baseline and deliberately diverges as an agent-native experimental line.

## Foundation rule

**Agents propose. The world decides.**

Capability never implies authority. External projects are optional bridges, not hidden dependencies. Every integration should remain attributable, inspectable, disableable and replay-compatible where the underlying world supports replay.

## Planned rungs

### Rung 3 — Foundation
- freeze lineage and feature flags
- establish agent and bridge contracts
- register interface-only seams for Commonline, Domistika, Auralith, Infinite Porch and PhiOS
- keep every experimental runtime feature off by default
- introduce fast PR CI while preserving full regression gates for critical paths and merged main

### Rung 4 — Cast manifests
Introduce Al, SAL, OilLeak, CoreGlow, Cache, Patch, Flux, Ping, Spark and Brian Sweat as data-defined identities and roles. No identity receives authority merely by being capable or memorable.

### Rung 5 — Bridge adapters
Implement one adapter at a time behind explicit feature gates. Start with local, operator-controlled contracts and preserve BrainSweat's world authority.

### Rung 6 — Persistent services
Add bounded presence, memory, role handoffs and service lifecycles with inspectable provenance and operator controls.

### Rung 7 — Local-model runtime
Expand provider-neutral local model participation while keeping model output as proposals routed through existing validation and authority boundaries.

### Rung 8 — Society layer
Compose teams, councils, institutions, shared services and long-horizon world participation from the already verified identity, world, artifact, season and receipt substrate.

## CI policy

Pull requests always run lint, unit tests and a production build. The full cross-browser and long-horizon regression wall also runs before merge whenever a change touches critical runtime, world, persistence, authority, online, dependency or workflow paths.

The full regression suite additionally runs on a nightly schedule and remains manually dispatchable. It no longer reruns automatically after every ordinary merge to `main`.

Merged `main` builds and publishes GitHub Pages, then runs a lightweight live smoke that checks the Fork-Thirty marker, repository metadata, world catalogue, Circuit route and Agent Locker route. The heavyweight `scripts/verify-live.mjs` verifier remains available for deliberate release-grade evidence runs.

This keeps routine experimental rungs fast without converting "green" into a decorative color.
