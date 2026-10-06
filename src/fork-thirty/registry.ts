import type { AgentManifest, BridgeManifest, ForkThirtyManifest } from './contracts';
import { cast } from './cast';
import { bridgeManifests } from './bridges/catalog';
import { assertUniqueIds } from './contracts';

export const forkThirty: ForkThirtyManifest = Object.freeze({
  schema: 'fork-thirty-manifest@1',
  lineage: Object.freeze({
    upstream: 'larrinamsalva/brainsweatstudios',
    baselineCommit: '91c697a06d74c328d7425b63bd55e32932340788',
    baselineVersion: '12.0.0',
  }),
  invariant: 'Agents propose. The world decides.',
  features: Object.freeze({
    castRuntime: true,
    bridgeRuntime: false,
    persistentServices: true,
    localModelRuntime: true,
    societyLayer: true,
  }),
});

export const agents: readonly AgentManifest[] = cast;

export const bridges: readonly BridgeManifest[] = bridgeManifests;

assertUniqueIds(agents, 'agent');
assertUniqueIds(bridges, 'bridge');
